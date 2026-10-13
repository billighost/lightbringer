import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../../engine/physics';
import { HeightFunction } from './heightFunction';
import { RegionData } from '../../data/regions/schema';

export interface ActiveColliderChunk {
  key: string;
  chunkX: number;
  chunkZ: number;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

export class TerrainColliderManager {
  private physics: PhysicsWorld;
  private region: RegionData;
  private heightFunction: HeightFunction;
  private chunkSize: number;
  private activeColliders = new Map<string, ActiveColliderChunk>();
  private pendingQueue: { key: string; chunkX: number; chunkZ: number }[] = [];
  public collisionRadius = 1; // 1 chunk radius = 3x3 chunks around player

  constructor(physics: PhysicsWorld, region: RegionData, heightFunction: HeightFunction) {
    this.physics = physics;
    this.region = region;
    this.heightFunction = heightFunction;
    this.chunkSize = region.terrain.chunkSize;
  }

  public update(playerX: number, playerZ: number): void {
    const centerCX = Math.floor(playerX / this.chunkSize);
    const centerCZ = Math.floor(playerZ / this.chunkSize);

    const neededKeys = new Set<string>();

    for (let dx = -this.collisionRadius; dx <= this.collisionRadius; dx++) {
      for (let dz = -this.collisionRadius; dz <= this.collisionRadius; dz++) {
        const cx = centerCX + dx;
        const cz = centerCZ + dz;
        const key = `${cx},${cz}`;
        neededKeys.add(key);

        if (!this.activeColliders.has(key) && !this.pendingQueue.some((p) => p.key === key)) {
          this.pendingQueue.push({ key, chunkX: cx, chunkZ: cz });
        }
      }
    }

    // Remove colliders that are no longer needed
    for (const [key, active] of this.activeColliders.entries()) {
      if (!neededKeys.has(key)) {
        this.physics.removeRigidBody(active.body);
        this.activeColliders.delete(key);
      }
    }

    // Remove pending items that are no longer needed
    this.pendingQueue = this.pendingQueue.filter((p) => neededKeys.has(p.key));

    // Process at most 1 pending collider build per frame to avoid any frame spike
    if (this.pendingQueue.length > 0) {
      const next = this.pendingQueue.shift()!;
      if (!this.activeColliders.has(next.key)) {
        this.buildChunkCollider(next.key, next.chunkX, next.chunkZ);
      }
    }
  }

  private buildChunkCollider(key: string, chunkX: number, chunkZ: number): void {
    // Build a 16x16 physics resolution trimesh (17x17 = 289 vertices, 512 triangles)
    // Fast, lightweight, and exact matching
    const segments = 16;
    const vertsPerSide = segments + 1;
    const totalVerts = vertsPerSide * vertsPerSide;
    const totalTris = segments * segments * 2;

    const vertices = new Float32Array(totalVerts * 3);
    const indices = new Uint32Array(totalTris * 3);

    const startX = chunkX * this.chunkSize;
    const startZ = chunkZ * this.chunkSize;
    const step = this.chunkSize / segments;

    let vIdx = 0;
    for (let iz = 0; iz <= segments; iz++) {
      const z = startZ + iz * step;
      for (let ix = 0; ix <= segments; ix++) {
        const x = startX + ix * step;
        const y = this.heightFunction.getHeight(x, z);

        vertices[vIdx * 3] = x;
        vertices[vIdx * 3 + 1] = y;
        vertices[vIdx * 3 + 2] = z;
        vIdx++;
      }
    }

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

    const { body, collider } = this.physics.createStaticTrimesh(vertices, indices);
    this.activeColliders.set(key, {
      key,
      chunkX,
      chunkZ,
      body,
      collider
    });
  }

  public getActiveCount(): number {
    return this.activeColliders.size;
  }

  public dispose(): void {
    for (const active of this.activeColliders.values()) {
      this.physics.removeRigidBody(active.body);
    }
    this.activeColliders.clear();
    this.pendingQueue = [];
  }
}
