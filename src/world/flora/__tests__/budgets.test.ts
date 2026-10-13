import { describe, it, expect } from 'vitest';
import { FLORA_ARCHETYPES } from '../../../data/flora/archetypes';
import { VariantCache } from '../generators/variantCache';

describe('Flora Triangle Budgets', () => {
  const variantCache = VariantCache.getInstance();

  it('verifies that all archetypes at LOD0 adhere strictly to budget limits', async () => {
    await variantCache.init(421337);

    for (const [id, def] of Object.entries(FLORA_ARCHETYPES)) {
      const budget0 = def.triBudgets.lod0;

      for (let v = 0; v < 4; v++) {
        const triCount = variantCache.getTriangleCount(id, v, 0);
        if (triCount === 0 || triCount > budget0) {
          console.error(`TRI COUNT ISSUE: ${id} v${v} = ${triCount} (budget: ${budget0})`);
        }
        expect(triCount).toBeGreaterThan(0);
        expect(triCount).toBeLessThanOrEqual(budget0);
      }
    }
  });

  it('verifies that LOD1 simplifies geometry significantly compared to LOD0', () => {
    for (const [id, def] of Object.entries(FLORA_ARCHETYPES)) {
      const avgLod0 = variantCache.getAverageTriangleCount(id, 0);
      const avgLod1 = variantCache.getAverageTriangleCount(id, 1);

      // LOD1 must have fewer triangles than LOD0
      expect(avgLod1).toBeLessThan(avgLod0);
      expect(avgLod1).toBeLessThanOrEqual(def.triBudgets.lod1);
    }
  });

  it('verifies specific core archetypes meet prompt budgets', () => {
    // Umbrella Titan: <= 8000 tris
    const titanTris = variantCache.getAverageTriangleCount('umbrella_titan', 0);
    expect(titanTris).toBeLessThanOrEqual(8000);

    // Other fungi: <= 2000 tris
    expect(variantCache.getAverageTriangleCount('shelf_fungus', 0)).toBeLessThanOrEqual(2000);
    expect(variantCache.getAverageTriangleCount('lumen_cap_cluster', 0)).toBeLessThanOrEqual(2000);
    expect(variantCache.getAverageTriangleCount('spore_stalk', 0)).toBeLessThanOrEqual(2000);

    // Trees: <= 5000 tris
    expect(variantCache.getAverageTriangleCount('twisted_snag', 0)).toBeLessThanOrEqual(5000);
    expect(variantCache.getAverageTriangleCount('broken_stump', 0)).toBeLessThanOrEqual(5000);
    expect(variantCache.getAverageTriangleCount('fallen_log', 0)).toBeLessThanOrEqual(5000);
    expect(variantCache.getAverageTriangleCount('root_mass', 0)).toBeLessThanOrEqual(5000);

    // Rocks: <= 1500 tris
    expect(variantCache.getAverageTriangleCount('boulder', 0)).toBeLessThanOrEqual(1500);
    expect(variantCache.getAverageTriangleCount('slab', 0)).toBeLessThanOrEqual(1500);
    expect(variantCache.getAverageTriangleCount('spire', 0)).toBeLessThanOrEqual(1500);
    expect(variantCache.getAverageTriangleCount('scree_cluster', 0)).toBeLessThanOrEqual(1500);

    // Ground cover: < 600 tris per clump
    expect(variantCache.getAverageTriangleCount('dead_grass', 0)).toBeLessThan(600);
    expect(variantCache.getAverageTriangleCount('glow_fern', 0)).toBeLessThan(600);
    expect(variantCache.getAverageTriangleCount('thorn_bramble', 0)).toBeLessThan(600);
    expect(variantCache.getAverageTriangleCount('bone_reeds', 0)).toBeLessThan(600);
  });
});
