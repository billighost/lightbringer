import { describe, it, expect } from 'vitest';
import { PoissonDiscSampler2D } from '../poisson';
import { createMulberry32 } from '../../flora/generators/geometryUtils';

describe('PoissonDiscSampler2D', () => {
  it('enforces minimum distance between all generated samples', () => {
    const minDistance = 5.0;
    const sampler = new PoissonDiscSampler2D(0, 0, 64, 64, minDistance);
    const rng = createMulberry32(12345);

    const points = sampler.generateSamples(25, rng, 20);
    expect(points.length).toBeGreaterThan(5);

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[i][0] - points[j][0];
        const dz = points[i][1] - points[j][1];
        const dist = Math.sqrt(dx * dx + dz * dz);
        // Distance must be >= minDistance (within floating point precision)
        expect(dist).toBeGreaterThanOrEqual(minDistance - 0.001);
      }
    }
  });

  it('respects pre-registered existing points', () => {
    const minDistance = 10.0;
    const sampler = new PoissonDiscSampler2D(0, 0, 50, 50, minDistance);
    const rng = createMulberry32(999);

    // Register a point at center (25, 25)
    sampler.registerExistingPoint(25, 25);

    const points = sampler.generateSamples(15, rng, 20);
    for (const pt of points) {
      const dx = pt[0] - 25;
      const dz = pt[1] - 25;
      const dist = Math.sqrt(dx * dx + dz * dz);
      expect(dist).toBeGreaterThanOrEqual(minDistance - 0.001);
    }
  });
});
