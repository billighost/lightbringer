import { describe, it, expect } from 'vitest';

describe('Chunk LOD Coordinate & Index Math', () => {
  const chunkSize = 64;

  it('correctly computes chunk grid indices from world coordinates including negative space', () => {
    const toChunkCoord = (worldVal: number) => Math.floor(worldVal / chunkSize);

    expect(toChunkCoord(0)).toBe(0);
    expect(toChunkCoord(63.99)).toBe(0);
    expect(toChunkCoord(64.0)).toBe(1);
    expect(toChunkCoord(128.5)).toBe(2);

    expect(toChunkCoord(-0.01)).toBe(-1);
    expect(toChunkCoord(-64.0)).toBe(-1);
    expect(toChunkCoord(-64.01)).toBe(-2);
  });

  it('calculates exact vertex and index counts across LODs with perimeter skirts', () => {
    const getLodStats = (lod: number) => {
      let segments = 64;
      if (lod === 1) segments = 32;
      else if (lod >= 2) segments = 16;

      const vertsPerSide = segments + 1;
      const gridVerts = vertsPerSide * vertsPerSide;
      const skirtVerts = segments * 4;
      const totalVerts = gridVerts + skirtVerts;

      const gridTris = segments * segments * 2;
      const skirtTris = segments * 4 * 2;
      const totalTris = gridTris + skirtTris;
      const totalIndices = totalTris * 3;

      return { segments, totalVerts, totalTris, totalIndices };
    };

    // LOD 0 (High - 64 segments)
    const lod0 = getLodStats(0);
    expect(lod0.segments).toBe(64);
    expect(lod0.totalVerts).toBe(65 * 65 + 64 * 4); // 4481
    expect(lod0.totalTris).toBe(64 * 64 * 2 + 64 * 8); // 8704
    expect(lod0.totalIndices).toBe(8704 * 3); // 26112

    // LOD 1 (Medium - 32 segments)
    const lod1 = getLodStats(1);
    expect(lod1.segments).toBe(32);
    expect(lod1.totalVerts).toBe(33 * 33 + 32 * 4); // 1217
    expect(lod1.totalIndices).toBe((32 * 32 * 2 + 32 * 8) * 3); // 6912

    // LOD 2 (Low - 16 segments)
    const lod2 = getLodStats(2);
    expect(lod2.segments).toBe(16);
    expect(lod2.totalVerts).toBe(17 * 17 + 16 * 4); // 353
    expect(lod2.totalIndices).toBe((16 * 16 * 2 + 16 * 8) * 3); // 1920
  });

  it('selects appropriate LOD based on distance from player', () => {
    const getLodForDistance = (dist: number, cSize: number) => {
      if (dist > cSize * 2.8) return 2;
      if (dist > cSize * 1.5) return 1;
      return 0;
    };

    expect(getLodForDistance(30, chunkSize)).toBe(0); // Near player -> LOD 0
    expect(getLodForDistance(110, chunkSize)).toBe(1); // 110m > 96m -> LOD 1
    expect(getLodForDistance(200, chunkSize)).toBe(2); // 200m > 179.2m -> LOD 2
  });
});
