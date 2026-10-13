import { describe, it, expect, beforeEach } from 'vitest';
import { WindSystem } from '../windSystem';

describe('WindSystem Dynamics & Shader Uniforms', () => {
  let wind: WindSystem;

  beforeEach(() => {
    wind = new WindSystem({
      direction: [0.7071, 0.7071],
      baseStrength: 3.0,
      gustFrequency: 0.5,
      gustStrength: 2.0
    });
  });

  it('normalizes direction vector upon initialization', () => {
    const len = wind.direction.length();
    expect(len).toBeCloseTo(1.0, 4);
    expect(wind.direction.x).toBeCloseTo(0.7071, 3);
    expect(wind.direction.y).toBeCloseTo(0.7071, 3);
  });

  it('updates wind time and scales strength with animated gusts', () => {
    wind.update(0.5);
    expect(wind.windTime).toBe(0.5);
    expect(wind.uniforms.uWindTime.value).toBe(0.5);

    // Current strength must stay at or above baseStrength
    expect(wind.currentStrength).toBeGreaterThanOrEqual(3.0);
    // Current strength cannot exceed baseStrength + gustStrength
    expect(wind.currentStrength).toBeLessThanOrEqual(3.0 + 2.0);
  });

  it('provides spatial 3D wind velocity queries at world coordinates', () => {
    wind.update(1.0);
    const vecA = wind.getWindAt(0, 0);
    const vecB = wind.getWindAt(100, 50);

    expect(vecA.x).toBeGreaterThan(0);
    expect(vecA.z).toBeGreaterThan(0);
    expect(Number.isFinite(vecA.y)).toBe(true);

    expect(Number.isFinite(vecB.x)).toBe(true);
    expect(Number.isFinite(vecB.z)).toBe(true);
  });
});
