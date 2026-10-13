import { describe, it, expect } from 'vitest';
import { GLIMMERWOOD_REGION } from '../../../data/regions/glimmerwood';
import { HeightFunction } from '../../terrain/heightFunction';
import { ExclusionManager } from '../exclusion';
import { ScatterGenerator } from '../scatterGenerator';

describe('ScatterGenerator', () => {
  const heightFunc = new HeightFunction(GLIMMERWOOD_REGION);
  const exclusionMgr = new ExclusionManager(GLIMMERWOOD_REGION.features);

  it('produces 100% deterministic scatter results for the same chunk', () => {
    const genA = new ScatterGenerator(GLIMMERWOOD_REGION, heightFunc, exclusionMgr);
    const genB = new ScatterGenerator(GLIMMERWOOD_REGION, heightFunc, exclusionMgr);

    const chunkX = 1;
    const chunkZ = -1;

    const resA = genA.generateChunk(chunkX, chunkZ);
    const resB = genB.generateChunk(chunkX, chunkZ);

    expect(resA.instances.length).toBe(resB.instances.length);
    expect(resA.instances.length).toBeGreaterThan(0);

    for (let i = 0; i < resA.instances.length; i++) {
      const instA = resA.instances[i];
      const instB = resB.instances[i];
      expect(instA.id).toBe(instB.id);
      expect(instA.archetypeId).toBe(instB.archetypeId);
      expect(instA.variantIndex).toBe(instB.variantIndex);
      expect(instA.position[0]).toBeCloseTo(instB.position[0], 5);
      expect(instA.position[1]).toBeCloseTo(instB.position[1], 5);
      expect(instA.position[2]).toBeCloseTo(instB.position[2], 5);
    }
  });

  it('respects exclusion zones during chunk generation', () => {
    const customExclusion = new ExclusionManager();
    // Exclude the entire center of chunk (0, 0)
    customExclusion.addExclusion({
      id: 'test_zone',
      type: 'circle',
      x: 32,
      z: 32,
      radius: 20
    });

    const gen = new ScatterGenerator(GLIMMERWOOD_REGION, heightFunc, customExclusion);
    const res = gen.generateChunk(0, 0);

    for (const inst of res.instances) {
      const dx = inst.position[0] - 32;
      const dz = inst.position[2] - 32;
      const dist = Math.sqrt(dx * dx + dz * dz);
      // No instance should be inside the 20m circle
      expect(dist).toBeGreaterThan(20);
    }
  });

  it('respects height bounds for placed flora', () => {
    const gen = new ScatterGenerator(GLIMMERWOOD_REGION, heightFunc, exclusionMgr);
    const res = gen.generateChunk(0, 0);

    for (const inst of res.instances) {
      const y = inst.position[1];
      // Terrain height at placed position should match position.y
      const expectedH = heightFunc.getHeight(inst.position[0], inst.position[2]);
      expect(y).toBeCloseTo(expectedH, 2);
    }
  });
});
