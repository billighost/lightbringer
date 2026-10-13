import { describe, it, expect } from 'vitest';
import { ExclusionManager } from '../exclusion';

describe('ExclusionManager', () => {
  it('correctly filters points within circular exclusion zone', () => {
    const mgr = new ExclusionManager();
    mgr.addExclusion({ id: 'clearing', type: 'circle', x: 10, z: 10, radius: 5 });

    expect(mgr.isExcluded(10, 10)).toBe(true);
    expect(mgr.isExcluded(12, 12)).toBe(true); // Distance ~2.82 <= 5
    expect(mgr.isExcluded(10, 15)).toBe(true); // Distance 5 <= 5
    expect(mgr.isExcluded(10, 16)).toBe(false); // Distance 6 > 5
    expect(mgr.isExcluded(0, 0)).toBe(false);
  });

  it('correctly filters points within rectangular exclusion zone', () => {
    const mgr = new ExclusionManager();
    mgr.addExclusion({ id: 'building', type: 'rect', x: 20, z: 20, width: 10, depth: 6 });

    expect(mgr.isExcluded(20, 20)).toBe(true);
    expect(mgr.isExcluded(24, 22)).toBe(true); // Within halfW=5, halfD=3
    expect(mgr.isExcluded(26, 20)).toBe(false); // dx=6 > halfW
    expect(mgr.isExcluded(20, 24)).toBe(false); // dz=4 > halfD
  });

  it('correctly filters points along path/spline exclusion zone', () => {
    const mgr = new ExclusionManager();
    mgr.addExclusion({
      id: 'road',
      type: 'path',
      points: [
        [0, 0],
        [0, 30]
      ],
      width: 6 // halfW = 3
    });

    expect(mgr.isExcluded(0, 15)).toBe(true);
    expect(mgr.isExcluded(2, 15)).toBe(true); // dx = 2 <= 3
    expect(mgr.isExcluded(4, 15)).toBe(false); // dx = 4 > 3
  });

  it('allows adding and removing exclusions dynamically', () => {
    const mgr = new ExclusionManager();
    mgr.addExclusion({ id: 'temp', type: 'circle', x: 0, z: 0, radius: 4 });
    expect(mgr.isExcluded(0, 0)).toBe(true);

    mgr.removeExclusion('temp');
    expect(mgr.isExcluded(0, 0)).toBe(false);
  });
});
