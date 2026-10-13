import * as THREE from 'three';
import { RegionData } from '../../data/regions/schema';
import { HeightFunction } from './heightFunction';
import { TerrainMaterial } from './terrainMaterial';
import { ChunkWorkerRequest, ChunkWorkerResponse } from './chunkWorker';

export interface ChunkRecord {
  key: string;
  chunkX: number;
  chunkZ: number;
  lod: number;
  mesh: THREE.Mesh;
  lastUsedFrame: number;
}

export class ChunkManager {
  public scene: THREE.Scene;
  public region: RegionData;
  public heightFunction: HeightFunction;
  public material: TerrainMaterial;

  private worker: Worker | null = null;
  private workerAvailable = false;
  private requestIdCounter = 0;
  private pendingRequests = new Map<number, { key: string; chunkX: number; chunkZ: number; lod: number }>();

  // Active chunks mapped by key "chunkX,chunkZ"
  private activeChunks = new Map<string, ChunkRecord>();

  // Geometry and mesh pool to eliminate GC allocations
  private meshPool: THREE.Mesh[] = [];

  // Configuration
  public renderRadius = 3; // 3 chunks radius = 7x7 grid
  public chunkSize: number;
  public freezeStreaming = false;

  // Stats for debug panel
  public stats = {
    activeChunks: 0,
    pooledChunks: 0,
    totalTriangles: 0,
    lastWorkerTimeMs: 0
  };

  private currentFrame = 0;

  constructor(scene: THREE.Scene, region: RegionData, heightFunction: HeightFunction, material: TerrainMaterial) {
    this.scene = scene;
    this.region = region;
    this.heightFunction = heightFunction;
    this.material = material;
    this.chunkSize = region.terrain.chunkSize;

    this.initWorker();
  }

  private initWorker(): void {
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./chunkWorker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this.workerAvailable = true;
      } catch (err) {
        console.warn('[ChunkManager] Worker initialization failed, using main thread fallback:', err);
        this.workerAvailable = false;
      }
    }
  }

  private handleWorkerMessage(event: MessageEvent<ChunkWorkerResponse>): void {
    const { requestId, chunkKey, chunkX, chunkZ, lod, positions, normals, uvs, indices, minY, maxY, generationTimeMs } =
      event.data;

    this.stats.lastWorkerTimeMs = generationTimeMs;

    const req = this.pendingRequests.get(requestId);
    this.pendingRequests.delete(requestId);

    if (!req) return; // Discard stale request

    // If chunk already exists with same or better LOD, don't overwrite
    const existing = this.activeChunks.get(chunkKey);
    if (existing && existing.lod <= lod) {
      return;
    }

    this.applyChunkGeometry(chunkKey, chunkX, chunkZ, lod, positions, normals, uvs, indices, minY, maxY);
  }

  private applyChunkGeometry(
    key: string,
    chunkX: number,
    chunkZ: number,
    lod: number,
    positions: Float32Array,
    normals: Float32Array,
    uvs: Float32Array,
    indices: Uint16Array | Uint32Array,
    minY: number,
    maxY: number
  ): void {
    let mesh: THREE.Mesh;
    let geometry: THREE.BufferGeometry;

    const existing = this.activeChunks.get(key);
    if (existing) {
      mesh = existing.mesh;
      geometry = mesh.geometry;
    } else if (this.meshPool.length > 0) {
      mesh = this.meshPool.pop()!;
      geometry = mesh.geometry;
      this.scene.add(mesh);
    } else {
      geometry = new THREE.BufferGeometry();
      mesh = new THREE.Mesh(geometry, this.material);
      mesh.receiveShadow = true;
      mesh.castShadow = false; // Terrain receives player shadow; large chunk shadow casting is unnecessary
      mesh.frustumCulled = true;
      this.scene.add(mesh);
    }

    // Set geometry buffer attributes
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    // Custom bounding box for instant frustum culling without expensive recompute
    const minX = chunkX * this.chunkSize;
    const maxX = minX + this.chunkSize;
    const minZ = chunkZ * this.chunkSize;
    const maxZ = minZ + this.chunkSize;

    geometry.boundingBox = new THREE.Box3(
      new THREE.Vector3(minX, minY - 4.0, minZ),
      new THREE.Vector3(maxX, maxY + 2.0, maxZ)
    );

    const center = new THREE.Vector3((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5);
    const radius = Math.sqrt(this.chunkSize * this.chunkSize * 0.5 + Math.pow((maxY - minY) * 0.5, 2));
    geometry.boundingSphere = new THREE.Sphere(center, radius);

    mesh.visible = true;

    this.activeChunks.set(key, {
      key,
      chunkX,
      chunkZ,
      lod,
      mesh,
      lastUsedFrame: this.currentFrame
    });

    this.updateStats();
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

        // Distance from chunk center to player for LOD calculation
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
            // Need LOD change
            this.requestChunk(key, cx, cz, targetLod);
          }
        } else {
          this.requestChunk(key, cx, cz, targetLod);
        }
      }
    }

    // Unload chunks outside render radius into pool
    for (const [key, active] of this.activeChunks.entries()) {
      if (!neededKeys.has(key)) {
        active.mesh.visible = false;
        this.scene.remove(active.mesh);
        this.meshPool.push(active.mesh);
        this.activeChunks.delete(key);
      }
    }

    this.updateStats();
  }

  private requestChunk(key: string, chunkX: number, chunkZ: number, lod: number): void {
    // Check if there is already a pending request for this chunk with same or better LOD
    for (const pending of this.pendingRequests.values()) {
      if (pending.key === key && pending.lod <= lod) {
        return;
      }
    }

    const requestId = ++this.requestIdCounter;
    this.pendingRequests.set(requestId, { key, chunkX, chunkZ, lod });

    if (this.workerAvailable && this.worker) {
      const msg: ChunkWorkerRequest = {
        requestId,
        chunkKey: key,
        chunkX,
        chunkZ,
        lod,
        chunkSize: this.chunkSize,
        region: this.region
      };
      this.worker.postMessage(msg);
    } else {
      // Synchronous fallback
      this.buildChunkSync(requestId, key, chunkX, chunkZ, lod);
    }
  }

  private buildChunkSync(requestId: number, key: string, chunkX: number, chunkZ: number, lod: number): void {
    let segments = 32;
    if (lod === 0) segments = 48;
    if (lod >= 2) segments = 16;

    const vertsPerSide = segments + 1;
    const gridVertCount = vertsPerSide * vertsPerSide;
    const skirtVertCount = segments * 4;
    const totalVertCount = gridVertCount + skirtVertCount;

    const positions = new Float32Array(totalVertCount * 3);
    const normals = new Float32Array(totalVertCount * 3);
    const uvs = new Float32Array(totalVertCount * 2);

    const startX = chunkX * this.chunkSize;
    const startZ = chunkZ * this.chunkSize;
    const step = this.chunkSize / segments;

    let minY = Infinity;
    let maxY = -Infinity;

    let vIdx = 0;
    let uvIdx = 0;

    for (let iz = 0; iz <= segments; iz++) {
      const z = startZ + iz * step;
      const v = iz / segments;
      for (let ix = 0; ix <= segments; ix++) {
        const x = startX + ix * step;
        const u = ix / segments;

        const y = this.heightFunction.getHeight(x, z);
        const [nx, ny, nz] = this.heightFunction.getNormal(x, z, 0.4);

        if (y < minY) minY = y;
        if (y > maxY) maxY = y;

        const pOff = vIdx * 3;
        positions[pOff] = x;
        positions[pOff + 1] = y;
        positions[pOff + 2] = z;

        normals[pOff] = nx;
        normals[pOff + 1] = ny;
        normals[pOff + 2] = nz;

        uvs[uvIdx] = u;
        uvs[uvIdx + 1] = v;

        vIdx++;
        uvIdx += 2;
      }
    }

    const gridTriangles = segments * segments * 2;
    const skirtTriangles = segments * 4 * 2;
    const indices = new Uint32Array((gridTriangles + skirtTriangles) * 3);

    let iIdx = 0;
    for (let iz = 0; iz < segments; iz++) {
      for (let ix = 0; ix < segments; ix++) {
        const a = iz * vertsPerSide + ix;
        const b = (iz + 1) * vertsPerSide + ix;
        const c = (iz + 1) * vertsPerSide + (ix + 1);
        const d = iz * vertsPerSide + (ix + 1);

        indices[iIdx++] = a;
        indices[iIdx++] = b;
        indices[iIdx++] = d;

        indices[iIdx++] = b;
        indices[iIdx++] = c;
        indices[iIdx++] = d;
      }
    }

    // Add skirts
    const skirtDepth = 3.5;
    let skirtBase = gridVertCount;
    const addSkirt = (vA: number, vB: number) => {
      const sA = skirtBase++;
      const sB = skirtBase++;

      positions[sA * 3] = positions[vA * 3];
      positions[sA * 3 + 1] = positions[vA * 3 + 1] - skirtDepth;
      positions[sA * 3 + 2] = positions[vA * 3 + 2];
      normals[sA * 3] = normals[vA * 3];
      normals[sA * 3 + 1] = normals[vA * 3 + 1];
      normals[sA * 3 + 2] = normals[vA * 3 + 2];
      uvs[sA * 2] = uvs[vA * 2];
      uvs[sA * 2 + 1] = uvs[vA * 2 + 1];

      positions[sB * 3] = positions[vB * 3];
      positions[sB * 3 + 1] = positions[vB * 3 + 1] - skirtDepth;
      positions[sB * 3 + 2] = positions[vB * 3 + 2];
      normals[sB * 3] = normals[vB * 3];
      normals[sB * 3 + 1] = normals[vB * 3 + 1];
      normals[sB * 3 + 2] = normals[vB * 3 + 2];
      uvs[sB * 2] = uvs[vB * 2];
      uvs[sB * 2 + 1] = uvs[vB * 2 + 1];

      indices[iIdx++] = vA;
      indices[iIdx++] = sA;
      indices[iIdx++] = sB;

      indices[iIdx++] = vA;
      indices[iIdx++] = sB;
      indices[iIdx++] = vB;
    };

    for (let ix = 0; ix < segments; ix++) addSkirt(ix, ix + 1);
    for (let iz = 0; iz < segments; iz++) addSkirt(iz * vertsPerSide + segments, (iz + 1) * vertsPerSide + segments);
    for (let ix = segments; ix > 0; ix--) addSkirt(segments * vertsPerSide + ix, segments * vertsPerSide + (ix - 1));
    for (let iz = segments; iz > 0; iz--) addSkirt(iz * vertsPerSide, (iz - 1) * vertsPerSide);

    this.pendingRequests.delete(requestId);
    this.applyChunkGeometry(key, chunkX, chunkZ, lod, positions, normals, uvs, indices, minY, maxY);
  }

  private updateStats(): void {
    let triCount = 0;
    for (const chunk of this.activeChunks.values()) {
      const idx = chunk.mesh.geometry.getIndex();
      if (idx) {
        triCount += idx.count / 3;
      }
    }
    this.stats.activeChunks = this.activeChunks.size;
    this.stats.pooledChunks = this.meshPool.length;
    this.stats.totalTriangles = triCount;
  }

  public dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const chunk of this.activeChunks.values()) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
    }
    for (const mesh of this.meshPool) {
      mesh.geometry.dispose();
    }
    this.activeChunks.clear();
    this.meshPool = [];
  }
}
