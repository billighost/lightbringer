import { RegionData } from './schema';

export const GLIMMERWOOD_REGION: RegionData = {
  id: 'glimmerwood',
  name: 'The Glimmerwood',
  size: {
    width: 1400,
    depth: 1400
  },
  seed: 421337,
  terrain: {
    chunkSize: 64,
    heightScale: 16.0,
    baseFrequency: 0.005,
    octaves: 4,
    persistence: 0.48,
    lacunarity: 2.1,
    ridgedWeight: 0.35,
    warpScale: 0.007,
    warpStrength: 10.0,
    erosionStrength: 0.45,
    layers: {
      deadSoil: {
        name: 'Dead Soil',
        texturePath: '/assets/textures/ground/dead_soil',
        roughness: 0.95,
        metalness: 0.02,
        tint: '#1a1815',
        tileScale: 6.0
      },
      wetMud: {
        name: 'Wet Mud',
        texturePath: '/assets/textures/ground/wet_mud',
        roughness: 0.25,
        metalness: 0.05,
        tint: '#12191a',
        tileScale: 5.5
      },
      crackedRock: {
        name: 'Cracked Rock',
        texturePath: '/assets/textures/ground/cracked_rock',
        roughness: 0.85,
        metalness: 0.12,
        tint: '#222830',
        tileScale: 8.0
      },
      glowingMoss: {
        name: 'Glowing Mycelium Moss',
        texturePath: '/assets/textures/ground/glowing_moss',
        roughness: 0.65,
        metalness: 0.08,
        tint: '#0d2d2a',
        tileScale: 4.5
      }
    }
  },
  fog: {
    color: '#07121b', // dark teal-violet
    density: 0.016
  },
  ambient: {
    skyColor: '#0c1b26', // deep teal sky
    groundColor: '#060a0f', // near-black violet ground
    intensity: 0.32
  },
  palette: {
    cyan: '#00f2ff',
    toxicGreen: '#2afc64',
    magenta: '#e0167c',
    deepTeal: '#052b36',
    violet: '#391252',
    goldWarm: '#ffc86b'
  },
  water: {
    level: -0.2, // Shallow water level across basins
    maxDepth: 1.0,
    shallowSpeedMultiplier: 0.65,
    deepWarningThreshold: 1.0,
    rippleFrequency: 1.5,
    surfaceColor: '#07333d',
    deepColor: '#02161c',
    foamColor: '#38e8ec',
    clarity: 0.75,
    bodies: [
      {
        id: 'glimmer_pool_central',
        name: 'Central Glimmer Pool',
        level: -0.2,
        centerX: 0,
        centerZ: -32,
        radius: 24,
        maxDepth: 0.75
      },
      {
        id: 'shrine_depression_pool',
        name: 'Sunken Shallows',
        level: -0.2,
        centerX: 64,
        centerZ: 32,
        radius: 20,
        maxDepth: 0.85
      }
    ]
  },
  wind: {
    direction: [0.7071, 0.7071],
    baseStrength: 2.4,
    gustFrequency: 0.35,
    gustStrength: 1.6
  },
  musicThemeId: 'glimmerwood_ambient_01',
  combatThemeId: 'glimmerwood_combat_01',
  features: [
    // 1. Central spawn clearing (flattened plateau with gentle slope)
    {
      id: 'spawn_clearing',
      type: 'flatten_circle',
      x: 0,
      z: 0,
      radius: 18,
      blendRadius: 14,
      targetHeight: 0.0,
      strength: 0.95
    },
    // 2. Central shallow wading basin
    {
      id: 'central_basin',
      type: 'radial_basin',
      x: 0,
      z: -32,
      radius: 16,
      blendRadius: 12,
      depth: 0.75
    },
    // 3. Ancient lookout hill (South-East)
    {
      id: 'lookout_hill',
      type: 'radial_hill',
      x: 52,
      z: -48,
      radius: 36,
      blendRadius: 24,
      height: 9.5
    },
    // 4. Sunken depression pool (North-East)
    {
      id: 'sunken_pool_feature',
      type: 'radial_basin',
      x: 64,
      z: 32,
      radius: 18,
      blendRadius: 10,
      depth: 0.8
    },
    // 5. Winding carved path through terrain
    {
      id: 'test_carved_path',
      type: 'spline_path',
      x: 0,
      z: 0,
      radius: 6,
      blendRadius: 4,
      points: [
        [0, 5],
        [15, 20],
        [35, 28],
        [55, 32]
      ],
      width: 5.5,
      targetDepth: 0.4
    }
  ],
  stamps: [],
  zones: [],
  scatterRules: [],
  landmarks: []
};
