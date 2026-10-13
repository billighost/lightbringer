import { HeightFunction } from './heightFunction';
import { RegionData } from '../../data/regions/schema';

export interface ChunkWorkerRequest {
  requestId: number;
  chunkKey: string;
  chunkX: number;
  chunkZ: number;
  lod: number;
  chunkSize: number;
  region: RegionData;
}

export interface ChunkWorkerResponse {
  requestId: number;
  chunkKey: string;
  chunkX: number;
  chunkZ: number;
  lod: number;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array | Uint32Array;
  minY: number;
  maxY: number;
  generationTimeMs: number;
}

// Cached height function instance per region seed
let cachedHeightFunction: HeightFunction | null = null;
let cachedRegionSeed: number | null = null;

function getHeightFunction(region: RegionData): HeightFunction {
  if (!cachedHeightFunction || cachedRegionSeed !== region.seed) {
    cachedHeightFunction = new HeightFunction(region);
    cachedRegionSeed = region.seed;
  }
  return cachedHeightFunction;
}

self.onmessage = (event: MessageEvent<ChunkWorkerRequest>) => {
  const start = performance.now();
  const { requestId, chunkKey, chunkX, chunkZ, lod, chunkSize, region } = event.data;

  const hFunc = getHeightFunction(region);

  // LOD resolutions:
  // LOD 0: 64 segments (65x65 vertices, 1m spacing)
  // LOD 1: 32 segments (33x33 vertices, 2m spacing)
  // LOD 2: 16 segments (17x17 vertices, 4m spacing)
  let segments = 64;
  if (lod === 1) segments = 32;
  else if (lod >= 2) segments = 16;

  const vertsPerSide = segments + 1;
  const gridVertCount = vertsPerSide * vertsPerSide;

  // Skirt vertices: 4 sides * segments
  // Top, Bottom, Left, Right
  const skirtVertCount = segments * 4;
  const totalVertCount = gridVertCount + skirtVertCount;

  const positions = new Float32Array(totalVertCount * 3);
  const normals = new Float32Array(totalVertCount * 3);
  const uvs = new Float32Array(totalVertCount * 2);

  const startX = chunkX * chunkSize;
  const startZ = chunkZ * chunkSize;
  const step = chunkSize / segments;

  let minY = Infinity;
  let maxY = -Infinity;

  // 1. Generate base grid vertices
  let vIdx = 0;
  let uvIdx = 0;

  for (let iz = 0; iz <= segments; iz++) {
    const worldZ = startZ + iz * step;
    const v = iz / segments;

    for (let ix = 0; ix <= segments; ix++) {
      const worldX = startX + ix * step;
      const u = ix / segments;

      const y = hFunc.getHeight(worldX, worldZ);
      const [nx, ny, nz] = hFunc.getNormal(worldX, worldZ, 0.4);

      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      const pOffset = vIdx * 3;
      positions[pOffset] = worldX;
      positions[pOffset + 1] = y;
      positions[pOffset + 2] = worldZ;

      normals[pOffset] = nx;
      normals[pOffset + 1] = ny;
      normals[pOffset + 2] = nz;

      uvs[uvIdx] = u;
      uvs[uvIdx + 1] = v;

      vIdx++;
      uvIdx += 2;
    }
  }

  // 2. Generate grid indices
  const gridTriangles = segments * segments * 2;
  const skirtTriangles = segments * 4 * 2;
  const totalIndicesCount = (gridTriangles + skirtTriangles) * 3;

  const useUint32 = totalVertCount > 65535;
  const indices = useUint32 ? new Uint32Array(totalIndicesCount) : new Uint16Array(totalIndicesCount);

  let iIdx = 0;
  for (let iz = 0; iz < segments; iz++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = iz * vertsPerSide + ix;
      const b = (iz + 1) * vertsPerSide + ix;
      const c = (iz + 1) * vertsPerSide + (ix + 1);
      const d = iz * vertsPerSide + (ix + 1);

      // Triangle 1: a -> b -> d
      indices[iIdx++] = a;
      indices[iIdx++] = b;
      indices[iIdx++] = d;

      // Triangle 2: b -> c -> d
      indices[iIdx++] = b;
      indices[iIdx++] = c;
      indices[iIdx++] = d;
    }
  }

  // 3. Generate skirts (depth = 3.5m below surface to seal all LOD seams)
  const skirtDepth = 3.5;
  let skirtBaseVertex = gridVertCount;

  // Helper to add skirt quad for edge segment from (vA) to (vB)
  const addSkirtSegment = (vA: number, vB: number) => {
    const sA = skirtBaseVertex++;
    const sB = skirtBaseVertex++;

    // Skirt vertex sA copied from vA with lowered Y
    positions[sA * 3] = positions[vA * 3];
    positions[sA * 3 + 1] = positions[vA * 3 + 1] - skirtDepth;
    positions[sA * 3 + 2] = positions[vA * 3 + 2];

    normals[sA * 3] = normals[vA * 3];
    normals[sA * 3 + 1] = normals[vA * 3 + 1];
    normals[sA * 3 + 2] = normals[vA * 3 + 2];

    uvs[sA * 2] = uvs[vA * 2];
    uvs[sA * 2 + 1] = uvs[vA * 2 + 1];

    // Skirt vertex sB copied from vB with lowered Y
    positions[sB * 3] = positions[vB * 3];
    positions[sB * 3 + 1] = positions[vB * 3 + 1] - skirtDepth;
    positions[sB * 3 + 2] = positions[vB * 3 + 2];

    normals[sB * 3] = normals[vB * 3];
    normals[sB * 3 + 1] = normals[vB * 3 + 1];
    normals[sB * 3 + 2] = normals[vB * 3 + 2];

    uvs[sB * 2] = uvs[vB * 2];
    uvs[sB * 2 + 1] = uvs[vB * 2 + 1];

    // Skirt quad: vA -> sA -> sB, and vA -> sB -> vB
    indices[iIdx++] = vA;
    indices[iIdx++] = sA;
    indices[iIdx++] = sB;

    indices[iIdx++] = vA;
    indices[iIdx++] = sB;
    indices[iIdx++] = vB;
  };

  // Top edge (iz = 0, ix from 0 to segments - 1)
  for (let ix = 0; ix < segments; ix++) {
    const vA = ix;
    const vB = ix + 1;
    addSkirtSegment(vA, vB);
  }

  // Right edge (ix = segments, iz from 0 to segments - 1)
  for (let iz = 0; iz < segments; iz++) {
    const vA = iz * vertsPerSide + segments;
    const vB = (iz + 1) * vertsPerSide + segments;
    addSkirtSegment(vA, vB);
  }

  // Bottom edge (iz = segments, ix from segments down to 1)
  for (let ix = segments; ix > 0; ix--) {
    const vA = segments * vertsPerSide + ix;
    const vB = segments * vertsPerSide + (ix - 1);
    addSkirtSegment(vA, vB);
  }

  // Left edge (ix = 0, iz from segments down to 1)
  for (let iz = segments; iz > 0; iz--) {
    const vA = iz * vertsPerSide;
    const vB = (iz - 1) * vertsPerSide;
    addSkirtSegment(vA, vB);
  }

  const generationTimeMs = performance.now() - start;

  const response: ChunkWorkerResponse = {
    requestId,
    chunkKey,
    chunkX,
    chunkZ,
    lod,
    positions,
    normals,
    uvs,
    indices,
    minY,
    maxY,
    generationTimeMs
  };

  // Transfer buffers directly to eliminate memory copy
  self.postMessage(response, [positions.buffer, normals.buffer, uvs.buffer, indices.buffer]);
};
