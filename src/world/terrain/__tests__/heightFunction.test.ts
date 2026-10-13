import { describe, it, expect } from 'vitest';
import { HeightFunction } from '../heightFunction';
import { GLIMMERWOOD_REGION } from '../../../data/regions/glimmerwood';

describe('Height Function Determinism & Normal Math', () => {
  it('produces 100% deterministic height values for identical coordinates and seed', () => {
    const hFuncA = new HeightFunction(GLIMMERWOOD_REGION);
    const hFuncB = new HeightFunction(GLIMMERWOOD_REGION);

    const testCoords: [number, number][] = [
      [0, 0],
      [12.34, -56.78],
      [-128.5, 256.25],
      [512.1, -333.3],
      [0.001, -0.001]
    ];

    for (const [x, z] of testCoords) {
      const hA1 = hFuncA.getHeight(x, z);
      const hA2 = hFuncA.getHeight(x, z);
      const hB1 = hFuncB.getHeight(x, z);

      expect(hA1).toBe(hA2);
      expect(hA1).toBe(hB1);
    }
  });

  it('produces different landscapes when seed is changed', () => {
    const regionAlt = {
      ...GLIMMERWOOD_REGION,
      seed: 999999
    };

    const hFuncOriginal = new HeightFunction(GLIMMERWOOD_REGION);
    const hFuncAlt = new HeightFunction(regionAlt);

    let differenceFound = false;
    for (let x = 100; x <= 300; x += 50) {
      for (let z = 100; z <= 300; z += 50) {
        if (Math.abs(hFuncOriginal.getHeight(x, z) - hFuncAlt.getHeight(x, z)) > 0.5) {
          differenceFound = true;
          break;
        }
      }
    }

    expect(differenceFound).toBe(true);
  });

  it('calculates unit-length surface normals pointing upward', () => {
    const hFunc = new HeightFunction(GLIMMERWOOD_REGION);

    const testCoords: [number, number][] = [
      [0, 0],
      [25, 25],
      [-40, 80],
      [120, -120]
    ];

    for (const [x, z] of testCoords) {
      const [nx, ny, nz] = hFunc.getNormal(x, z);
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz);

      // Normal length must be approximately 1.0
      expect(length).toBeCloseTo(1.0, 3);

      // Normal Y must point upward
      expect(ny).toBeGreaterThan(0.0);
    }
  });
});
