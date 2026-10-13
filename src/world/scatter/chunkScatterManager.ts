import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { RegionData } from '../../data/regions/schema';
import { HeightFunction } from '../terrain/heightFunction';
import { PhysicsWorld } from '../../engine/physics';
import { LightingModule } from '../../engine/lighting';
import { VariantCache } from '../flora/generators/variantCache';
import { FloraMaterialManager } from '../flora/materials/floraMaterials';
import { FLORA_ARCHETYPES } from '../../data/flora/archetypes';
import { ExclusionManager, ExclusionShape } from './exclusion';
import { ScatterGenerator } from './scatterGenerator';
import { ChunkScatterResult, ScatterInstance } from './scatterTypes';
import { ScatterWorkerRequest, ScatterWorkerResponse } from './scatterWorker';

export interface ActiveScatterChunk {
  key: string;
  chunkX: number;
  chunkZ: number;
  lod: number;
  instancedMeshes: THREE.InstancedMesh[];
  rigidBodies: RAPIER.RigidBody[];
  instances: ScatterInstance[];
  lastUsedFrame: number;
}

export interface NearbyQueryFilter {
  archetypeId?: string;
  category?: string;
  gatherableOnly?: boolean;
}

export class ChunkScatterManager {
  public scene: THREE.Scene;
  public region: RegionData;
  public heightFunction: HeightFunction;
  public physics?: PhysicsWorld;
  public lighting?: LightingModule;

  public exclusionManager: ExclusionManager;
  private variantCache: VariantCache;
  private materialManager: FloraMaterialManager;
  private generator: ScatterGenerator;

  private worker: Worker | null = null;
  private workerAvailable = false;
  private requestIdCounter = 0;
  private pendingRequests = new Map<number, { key: string; chunkX: number; chunkZ: number; lod: number }>();

  // Active chunks keyed by "chunkX,chunkZ"
  private activeChunks = new Map<string, ActiveScatterChunk>();

  // Cached chunk data so we don't recalculate when LOD changes
  private scatterDataCache = new Map<string, ChunkScatterResult>();

  // Glowing instance tracking for light pool
  private nearbyGlowSourceIds = new Set<string>();

  // Configuration
  public renderRadius = 3; // Same as ChunkManager (7x7 chunks)
  public colliderRadius = 1; // Physics colliders streamed for chunks within 1 chunk radius
  public chunkSize: number;
  public freezeStreaming = false;

  private currentFrame = 0;
  private dummyMatrix = new THREE.Matrix4();
  private dummyPosition = new THREE.Vector3();
  private dummyRotation = new THREE.Euler();
  private dummyQuaternion = new THREE.Quaternion();
  private dummyScale = new THREE.Vector3();

  // Performance stats for debug panel
  public stats = {
    activeChunks: 0,
    totalInstances: 0,
    totalDrawCalls: 0,
    totalTriangles: 0,
    registeredGlowLights: 0
  };

  constructor(
    scene: THREE.Scene,
    region: RegionData,
    heightFunction: HeightFunction,
    physics?: PhysicsWorld,
    lighting?: LightingModule
  ) {
    this.scene = scene;
    this.region = region;
    this.heightFunction = heightFunction;
    this.physics = physics;
    this.lighting = lighting;
    this.chunkSize = region.terrain.chunkSize;

    this.exclusionManager = new ExclusionManager(region.features);
    this.variantCache = VariantCache.getInstance();
    this.materialManager = FloraMaterialManager.getInstance();
    this.generator = new ScatterGenerator(region, heightFunction, this.exclusionManager);

    this.initWorker();
  }

  private initWorker(): void {
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./scatterWorker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this.workerAvailable = true;
      } catch (err) {
        console.warn('[ChunkScatterManager] Worker init failed, using synchronous fallback:', err);
        this.workerAvailable = false;
      }
    }
  }

  private handleWorkerMessage(e: MessageEvent<ScatterWorkerResponse>): void {
    const { requestId, chunkKey, chunkX, chunkZ, result } = e.data;
    const req = this.pendingRequests.get(requestId);
    this.pendingRequests.delete(requestId);
    if (!req) return;

    this.scatterDataCache.set(chunkKey, result);
    this.applyChunkInstances(chunkKey, chunkX, chunkZ, req.lod, result);
  }

  public update(playerPos: THREE.Vector3): void {
    this.currentFrame++;
    if (this.freezeStreaming) return;

    const playerX = playerPos.x;
    const playerZ = playerPos.z;
    const centerCX = Math.floor(playerX / this.chunkSize);
    const centerCZ = Math.floor(playerZ / this.chunkSize);

    const neededKeys = new Set<string>();

    for (let dx = -this.renderRadius; dx <= this.renderRadius; dx++) {
      for (let dz = -this.renderRadius; dz <= this.renderRadius; dz++) {
        const cx = centerCX + dx;
        const cz = centerCZ + dz;
        const key = `${cx},${cz}`;
        neededKeys.add(key);

        const chunkCenterX = (cx + 0.5) * this.chunkSize;
        const chunkCenterZ = (cz + 0.5) * this.chunkSize;
        const dist = Math.hypot(playerX - chunkCenterX, playerZ - chunkCenterZ);

        let targetLod = 0;
        if (dist > this.chunkSize * 1.5) targetLod = 1;
        if (dist > this.chunkSize * 2.8) targetLod = 2;

        const active = this.activeChunks.get(key);
        if (active) {
          active.lastUsedFrame = this.currentFrame;
          if (active.lod !== targetLod) {
            this.requestChunkScatter(key, cx, cz, targetLod);
          }
        } else {
          this.requestChunkScatter(key, cx, cz, targetLod);
        }
      }
    }

    // Unload chunks outside render radius
    for (const [key, active] of this.activeChunks.entries()) {
      if (!neededKeys.has(key)) {
        this.unloadChunk(active);
        this.activeChunks.delete(key);
      }
    }

    // Update Colliders and Light Pool registrations near player
    this.updateNearbyGlowSources(playerPos);
    this.updateStats();
  }

  private requestChunkScatter(key: string, chunkX: number, chunkZ: number, lod: number): void {
    // Check if we already have the cached scatter instances
    if (this.scatterDataCache.has(key)) {
      const cached = this.scatterDataCache.get(key)!;
      this.applyChunkInstances(key, chunkX, chunkZ, lod, cached);
      return;
    }

    // Check if pending request exists
    for (const pending of this.pendingRequests.values()) {
      if (pending.key === key && pending.lod <= lod) return;
    }

    const requestId = ++this.requestIdCounter;
    this.pendingRequests.set(requestId, { key, chunkX, chunkZ, lod });

    if (this.workerAvailable && this.worker) {
      const msg: ScatterWorkerRequest = {
        requestId,
        chunkKey: key,
        chunkX,
        chunkZ,
        region: this.region
      };
      this.worker.postMessage(msg);
    } else {
      // Synchronous fallback
      const result = this.generator.generateChunk(chunkX, chunkZ);
      this.pendingRequests.delete(requestId);
      this.scatterDataCache.set(key, result);
      this.applyChunkInstances(key, chunkX, chunkZ, lod, result);
    }
  }

  private applyChunkInstances(
    key: string,
    chunkX: number,
    chunkZ: number,
    lod: number,
    result: ChunkScatterResult
  ): void {
    // If chunk was already loaded, clean up previous meshes
    const existing = this.activeChunks.get(key);
    if (existing) {
      this.unloadChunk(existing);
    }

    const instancedMeshes: THREE.InstancedMesh[] = [];
    const rigidBodies: RAPIER.RigidBody[] = [];

    // Group instances by (archetypeId, variantIndex)
    const groups = new Map<string, ScatterInstance[]>();

    for (const inst of result.instances) {
      const groupKey = `${inst.archetypeId}_v${inst.variantIndex}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(inst);
    }

    // Create InstancedMesh for each group
    for (const groupInstances of groups.values()) {
      const first = groupInstances[0];
      const def = FLORA_ARCHETYPES[first.archetypeId];
      if (!def) continue;

      const geo = this.variantCache.getVariantGeometry(first.archetypeId, first.variantIndex, lod);
      const mat = this.materialManager.getMaterial(def.materialId, def.glowSettings, def.windSettings, this.region);

      const count = groupInstances.length;
      const instMesh = new THREE.InstancedMesh(geo, mat, count);
      instMesh.castShadow = lod <= 1 && def.category !== 'ground_cover';
      instMesh.receiveShadow = true;
      instMesh.frustumCulled = true;

      for (let i = 0; i < count; i++) {
        const inst = groupInstances[i];
        this.dummyPosition.set(inst.position[0], inst.position[1], inst.position[2]);
        this.dummyRotation.set(inst.rotation[0], inst.rotation[1], inst.rotation[2]);
        this.dummyQuaternion.setFromEuler(this.dummyRotation);
        this.dummyScale.set(inst.scale[0], inst.scale[1], inst.scale[2]);

        this.dummyMatrix.compose(this.dummyPosition, this.dummyQuaternion, this.dummyScale);
        instMesh.setMatrixAt(i, this.dummyMatrix);
      }

      instMesh.instanceMatrix.needsUpdate = true;
      this.scene.add(instMesh);
      instancedMeshes.push(instMesh);
    }

    // Spawn Rapier colliders for solid instances (titans, trees, boulders, spires)
    if (this.physics) {
      for (const inst of result.instances) {
        if (inst.isSolid && inst.colliderDimensions) {
          const body = this.createInstanceCollider(inst);
          if (body) {
            rigidBodies.push(body);
          }
        }
      }
    }

    this.activeChunks.set(key, {
      key,
      chunkX,
      chunkZ,
      lod,
      instancedMeshes,
      rigidBodies,
      instances: result.instances,
      lastUsedFrame: this.currentFrame
    });

    this.updateStats();
  }

  private createInstanceCollider(inst: ScatterInstance): RAPIER.RigidBody | null {
    if (!this.physics || !inst.colliderDimensions) return null;

    const [px, py, pz] = inst.position;
    const [dim0, dim1, dim2] = inst.colliderDimensions;
    const scale = inst.scale[0];

    try {
      if (inst.colliderType === 'cylinder') {
        const halfH = (dim1 * scale) * 0.5;
        const rad = dim0 * scale;
        const col = this.physics.createStaticCylinder(halfH, rad, px, py + halfH, pz);
        return col.parent();
      } else if (inst.colliderType === 'box') {
        const hx = (dim0 * scale) * 0.5;
        const hy = (dim1 * scale) * 0.5;
        const hz = (dim2 * scale) * 0.5;
        const col = this.physics.createStaticBox(hx, hy, hz, px, py + hy, pz, {
          x: inst.rotation[0],
          y: inst.rotation[1],
          z: inst.rotation[2]
        });
        return col.parent();
      } else if (inst.colliderType === 'capsule') {
        const rad = dim0 * scale;
        const col = this.physics.createStaticSphere(rad, px, py + rad, pz);
        return col.parent();
      }
    } catch (err) {
      console.warn('[ChunkScatterManager] Failed to create collider:', err);
    }

    return null;
  }

  private unloadChunk(chunk: ActiveScatterChunk): void {
    // Remove InstancedMeshes
    for (const mesh of chunk.instancedMeshes) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
    chunk.instancedMeshes = [];

    // Remove Rapier physics bodies
    if (this.physics) {
      for (const body of chunk.rigidBodies) {
        this.physics.removeRigidBody(body);
      }
    }
    chunk.rigidBodies = [];
  }

  /**
   * Registers top nearby glowing flora into the 4A Light Pool
   */
  private updateNearbyGlowSources(playerPos: THREE.Vector3): void {
    if (!this.lighting?.lightPool) return;

    const lightPool = this.lighting.lightPool;
    const searchRadiusSq = 32.0 * 32.0;

    const nearbyGlowCandidates: { id: string; pos: THREE.Vector3; color: string; intensity: number; radius: number; distSq: number }[] = [];

    for (const chunk of this.activeChunks.values()) {
      for (const inst of chunk.instances) {
        if (inst.glow && inst.glow.intensity > 0.1) {
          const dx = inst.position[0] - playerPos.x;
          const dz = inst.position[2] - playerPos.z;
          const distSq = dx * dx + dz * dz;

          if (distSq < searchRadiusSq) {
            nearbyGlowCandidates.push({
              id: `glow_${inst.id}`,
              pos: new THREE.Vector3(inst.position[0], inst.position[1] + 1.2, inst.position[2]),
              color: inst.glow.color,
              intensity: inst.glow.intensity,
              radius: inst.glow.radius,
              distSq
            });
          }
        }
      }
    }

    // Sort by distance and pick top nearest sources to feed LightPool
    nearbyGlowCandidates.sort((a, b) => a.distSq - b.distSq);
    const topCandidates = nearbyGlowCandidates.slice(0, lightPool.maxLights);
    const newGlowIds = new Set<string>();

    for (const cand of topCandidates) {
      newGlowIds.add(cand.id);
      if (!this.nearbyGlowSourceIds.has(cand.id)) {
        lightPool.registerGlowSource(cand.id, cand.pos, cand.color, cand.intensity, cand.radius);
      }
    }

    // Unregister sources that moved out of range
    for (const id of this.nearbyGlowSourceIds) {
      if (!newGlowIds.has(id)) {
        lightPool.unregisterGlowSource(id);
      }
    }

    this.nearbyGlowSourceIds = newGlowIds;
    this.stats.registeredGlowLights = newGlowIds.size;
  }

  /**
   * Queries flora instances in active chunks near a world position
   */
  public queryNearby(
    position: THREE.Vector3,
    radius: number,
    filter?: NearbyQueryFilter
  ): { instance: ScatterInstance; distance: number }[] {
    const results: { instance: ScatterInstance; distance: number }[] = [];
    const radSq = radius * radius;

    for (const chunk of this.activeChunks.values()) {
      for (const inst of chunk.instances) {
        if (filter?.archetypeId && inst.archetypeId !== filter.archetypeId) continue;
        if (filter?.gatherableOnly && !inst.gatherableConfig) continue;
        if (filter?.category) {
          const def = FLORA_ARCHETYPES[inst.archetypeId];
          if (!def || def.category !== filter.category) continue;
        }

        const dx = inst.position[0] - position.x;
        const dy = inst.position[1] - position.y;
        const dz = inst.position[2] - position.z;
        const dSq = dx * dx + dy * dy + dz * dz;

        if (dSq <= radSq) {
          results.push({ instance: inst, distance: Math.sqrt(dSq) });
        }
      }
    }

    results.sort((a, b) => a.distance - b.distance);
    return results;
  }

  public addExclusion(shape: ExclusionShape): void {
    this.exclusionManager.addExclusion(shape);
    // Clear scatter data cache so modified chunks re-generate
    this.scatterDataCache.clear();
  }

  public removeExclusion(id: string): void {
    this.exclusionManager.removeExclusion(id);
    this.scatterDataCache.clear();
  }

  private updateStats(): void {
    let totalInst = 0;
    let totalDraws = 0;
    let totalTris = 0;

    for (const chunk of this.activeChunks.values()) {
      totalInst += chunk.instances.length;
      totalDraws += chunk.instancedMeshes.length;

      for (const mesh of chunk.instancedMeshes) {
        const count = mesh.count;
        const idx = mesh.geometry.getIndex();
        if (idx) {
          totalTris += (idx.count / 3) * count;
        }
      }
    }

    this.stats.activeChunks = this.activeChunks.size;
    this.stats.totalInstances = totalInst;
    this.stats.totalDrawCalls = totalDraws;
    this.stats.totalTriangles = totalTris;
  }

  public dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const chunk of this.activeChunks.values()) {
      this.unloadChunk(chunk);
    }
    this.activeChunks.clear();
    this.scatterDataCache.clear();

    if (this.lighting?.lightPool) {
      for (const id of this.nearbyGlowSourceIds) {
        this.lighting.lightPool.unregisterGlowSource(id);
      }
    }
    this.nearbyGlowSourceIds.clear();
  }
}
