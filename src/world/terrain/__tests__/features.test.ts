import { describe, it, expect } from 'vitest';
import { HeightFunction } from '../heightFunction';
import { RegionData } from '../../../data/regions/schema';

describe('Terrain Features & Stamps Blending', () => {
  const baseTestRegion: RegionData = {
    id: 'test_region',
    name: 'Test',
    size: { width: 400, depth: 400 },
    seed: 12345,
    terrain: {
      chunkSize: 64,
      heightScale: 10.0,
      baseFrequency: 0.01,
      octaves: 2,
      persistence: 0.5,
      lacunarity: 2.0,
      ridgedWeight: 0.2,
      warpScale: 0.01,
      warpStrength: 2.0,
      erosionStrength: 0.1,
      layers: {} as any
    },
    fog: { color: '#000', density: 0.01 },
    ambient: { skyColor: '#000', groundColor: '#000', intensity: 0.5 },
    palette: {} as any,
    water: { level: 0, maxDepth: 1, shallowSpeedMultiplier: 0.65, deepWarningThreshold: 1, rippleFrequency: 1, surfaceColor: '#000', deepColor: '#000', foamColor: '#000', clarity: 1, bodies: [] },
    wind: { direction: [1, 0], baseStrength: 2, gustFrequency: 0.5, gustStrength: 1 },
    musicThemeId: '',
    combatThemeId: '',
    features: [],
    stamps: [],
    zones: [],
    scatterRules: [],
    landmarks: []
  };

  it('correctly elevates terrain within a radial hill feature', () => {
    const hillRegion: RegionData = {
      ...baseTestRegion,
      features: [
        {
          id: 'test_hill',
          type: 'radial_hill',
          x: 50,
          z: 50,
          radius: 20,
          blendRadius: 10,
          height: 15.0
        }
      ]
    };

    const hBase = new HeightFunction(baseTestRegion);
    const hHill = new HeightFunction(hillRegion);

    // Peak of hill at center (50, 50)
    const baseAtCenter = hBase.getHeight(50, 50);
    const hillAtCenter = hHill.getHeight(50, 50);
    expect(hillAtCenter).toBeCloseTo(baseAtCenter + 15.0, 1);

    // Outside influence zone (> 30m away)
    const baseOutside = hBase.getHeight(100, 100);
    const hillOutside = hHill.getHeight(100, 100);
    expect(hillOutside).toBeCloseTo(baseOutside, 2);
  });

  it('correctly lowers terrain within a radial basin feature', () => {
    const basinRegion: RegionData = {
      ...baseTestRegion,
      features: [
        {
          id: 'test_basin',
          type: 'radial_basin',
          x: 0,
          z: 0,
          radius: 15,
          blendRadius: 10,
          depth: 5.0
        }
      ]
    };

    const hBase = new HeightFunction(baseTestRegion);
    const hBasin = new HeightFunction(basinRegion);

    const baseCenter = hBase.getHeight(0, 0);
    const basinCenter = hBasin.getHeight(0, 0);
    expect(basinCenter).toBeCloseTo(baseCenter - 5.0, 1);
  });

  it('correctly flattens terrain towards target height with falloff in flatten_circle', () => {
    const targetH = 2.5;
    const flatRegion: RegionData = {
      ...baseTestRegion,
      features: [
        {
          id: 'test_flat',
          type: 'flatten_circle',
          x: 0,
          z: 0,
          radius: 10,
          blendRadius: 5,
          targetHeight: targetH,
          strength: 1.0
        }
      ]
    };

    const hFlat = new HeightFunction(flatRegion);
    const heightAtCenter = hFlat.getHeight(0, 0);
    expect(heightAtCenter).toBeCloseTo(targetH, 2);
  });

  it('carves terrain along a spline path', () => {
    const pathRegion: RegionData = {
      ...baseTestRegion,
      features: [
        {
          id: 'test_path',
          type: 'spline_path',
          x: 0,
          z: 0,
          radius: 4,
          blendRadius: 2,
          points: [
            [0, 0],
            [20, 0]
          ],
          width: 4,
          targetDepth: 1.5
        }
      ]
    };

    const hBase = new HeightFunction(baseTestRegion);
    const hPath = new HeightFunction(pathRegion);

    // Midway on the segment (10, 0)
    const baseMid = hBase.getHeight(10, 0);
    const pathMid = hPath.getHeight(10, 0);
    expect(pathMid).toBeCloseTo(baseMid - 1.5, 1);
  });
});
