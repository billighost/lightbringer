export type EcologicalPattern = 'fungal_grove' | 'dead_timber' | 'marsh_edge' | 'barren_rock';

export interface ArchetypeWeight {
  archetypeId: string;
  weight: number;
}

export interface ScatterRule {
  id: string;
  name: string;
  archetypeWeights: ArchetypeWeight[];
  priority: number; // 1 = biggest landmarks (Titans), 10 = small ground cover
  density: number; // Target instances per chunk (64x64m)
  minDistance: number; // Poisson minimum disc radius in meters
  slopeRange: [number, number]; // [minSlope, maxSlope] (0 = flat, 1.0 = ~45 deg, 2.0 = steep)
  heightRange: [number, number]; // World height [minY, maxY]
  waterDistanceRange?: [number, number]; // Distance from water [minDist, maxDist]
  noiseMask?: {
    scale: number;
    threshold: number;
    invert?: boolean;
  };
  scaleRange: [number, number];
  tiltRange: [number, number]; // Max random tilt in radians
  ecologicalPattern?: EcologicalPattern | 'all';
}

export const GLIMMERWOOD_SCATTER_RULES: ScatterRule[] = [
  // ==========================================
  // PRIORITY 1: GIANT SILHOUETTES & LANDMARKS
  // ==========================================
  {
    id: 'titan_groves',
    name: 'Umbrella Titan Groves',
    archetypeWeights: [{ archetypeId: 'umbrella_titan', weight: 1.0 }],
    priority: 1,
    density: 3,
    minDistance: 18.0,
    slopeRange: [0.0, 0.45],
    heightRange: [0.5, 18.0],
    waterDistanceRange: [6.0, 500.0],
    noiseMask: { scale: 0.012, threshold: 0.45 },
    scaleRange: [0.85, 1.35],
    tiltRange: [0.0, 0.08],
    ecologicalPattern: 'fungal_grove'
  },
  {
    id: 'monolithic_spires',
    name: 'Barren Rock Spires',
    archetypeWeights: [{ archetypeId: 'spire', weight: 1.0 }],
    priority: 1,
    density: 2,
    minDistance: 22.0,
    slopeRange: [0.1, 0.9],
    heightRange: [2.0, 24.0],
    waterDistanceRange: [10.0, 500.0],
    noiseMask: { scale: 0.015, threshold: 0.52 },
    scaleRange: [0.9, 1.4],
    tiltRange: [0.0, 0.12],
    ecologicalPattern: 'barren_rock'
  },

  // ==========================================
  // PRIORITY 2: LARGE DEAD TREES & BULKY ROCKS
  // ==========================================
  {
    id: 'dead_timber_trees',
    name: 'Twisted Snags and Broken Stumps',
    archetypeWeights: [
      { archetypeId: 'twisted_snag', weight: 0.55 },
      { archetypeId: 'broken_stump', weight: 0.3 },
      { archetypeId: 'root_mass', weight: 0.15 }
    ],
    priority: 2,
    density: 5,
    minDistance: 11.0,
    slopeRange: [0.0, 0.65],
    heightRange: [0.2, 20.0],
    waterDistanceRange: [5.0, 500.0],
    noiseMask: { scale: 0.018, threshold: 0.4 },
    scaleRange: [0.8, 1.25],
    tiltRange: [0.0, 0.15],
    ecologicalPattern: 'dead_timber'
  },
  {
    id: 'barren_boulders',
    name: 'Boulders and Stone Slabs',
    archetypeWeights: [
      { archetypeId: 'boulder', weight: 0.6 },
      { archetypeId: 'slab', weight: 0.4 }
    ],
    priority: 2,
    density: 6,
    minDistance: 9.0,
    slopeRange: [0.05, 1.1],
    heightRange: [1.0, 25.0],
    waterDistanceRange: [4.0, 500.0],
    noiseMask: { scale: 0.02, threshold: 0.38 },
    scaleRange: [0.85, 1.3],
    tiltRange: [0.0, 0.2],
    ecologicalPattern: 'barren_rock'
  },
  {
    id: 'fallen_logs_timber',
    name: 'Fallen Logs with Shelf Fungus',
    archetypeWeights: [{ archetypeId: 'fallen_log', weight: 1.0 }],
    priority: 2,
    density: 3,
    minDistance: 12.0,
    slopeRange: [0.0, 0.4],
    heightRange: [0.0, 18.0],
    waterDistanceRange: [4.0, 500.0],
    scaleRange: [0.85, 1.2],
    tiltRange: [0.0, 0.1],
    ecologicalPattern: 'dead_timber'
  },

  // ==========================================
  // PRIORITY 3: MID-SIZED CLUTTER & GATHERABLES
  // ==========================================
  {
    id: 'fungal_mid_clutter',
    name: 'Shelf Fungus and Spore Stalks',
    archetypeWeights: [
      { archetypeId: 'shelf_fungus', weight: 0.5 },
      { archetypeId: 'spore_stalk', weight: 0.35 },
      { archetypeId: 'mycelium_veins', weight: 0.15 }
    ],
    priority: 3,
    density: 10,
    minDistance: 4.5,
    slopeRange: [0.0, 0.7],
    heightRange: [-0.1, 19.0],
    waterDistanceRange: [2.0, 500.0],
    noiseMask: { scale: 0.022, threshold: 0.35 },
    scaleRange: [0.75, 1.25],
    tiltRange: [0.0, 0.25],
    ecologicalPattern: 'fungal_grove'
  },
  {
    id: 'scree_rock_clutter',
    name: 'Scree Stone Clusters',
    archetypeWeights: [{ archetypeId: 'scree_cluster', weight: 1.0 }],
    priority: 3,
    density: 7,
    minDistance: 6.0,
    slopeRange: [0.1, 1.2],
    heightRange: [1.5, 24.0],
    scaleRange: [0.8, 1.3],
    tiltRange: [0.0, 0.2],
    ecologicalPattern: 'barren_rock'
  },
  {
    id: 'gatherable_lumen_caps',
    name: 'Gatherable Lumen Cap Clusters',
    archetypeWeights: [{ archetypeId: 'lumen_cap_cluster', weight: 1.0 }],
    priority: 3,
    density: 3,
    minDistance: 10.0,
    slopeRange: [0.0, 0.35],
    heightRange: [0.0, 16.0],
    waterDistanceRange: [3.0, 200.0],
    noiseMask: { scale: 0.03, threshold: 0.55 }, // Clustered in glowing patches
    scaleRange: [0.9, 1.2],
    tiltRange: [0.0, 0.15],
    ecologicalPattern: 'fungal_grove'
  },
  {
    id: 'gatherable_lumen_shards',
    name: 'Gatherable Lumen Shards',
    archetypeWeights: [{ archetypeId: 'lumen_shard', weight: 1.0 }],
    priority: 3,
    density: 2,
    minDistance: 14.0,
    slopeRange: [0.05, 0.8],
    heightRange: [2.0, 22.0],
    noiseMask: { scale: 0.035, threshold: 0.6 },
    scaleRange: [0.85, 1.25],
    tiltRange: [0.0, 0.2],
    ecologicalPattern: 'barren_rock'
  },
  {
    id: 'gatherable_glow_spores',
    name: 'Gatherable Glow-Spore Plants',
    archetypeWeights: [{ archetypeId: 'glow_spore_plant', weight: 1.0 }],
    priority: 3,
    density: 2,
    minDistance: 12.0,
    slopeRange: [0.0, 0.45],
    heightRange: [-0.1, 15.0],
    waterDistanceRange: [2.0, 100.0],
    noiseMask: { scale: 0.03, threshold: 0.58 },
    scaleRange: [0.85, 1.2],
    tiltRange: [0.0, 0.15],
    ecologicalPattern: 'marsh_edge'
  },

  // ==========================================
  // PRIORITY 4: MARSH EDGE COVER (Near water)
  // ==========================================
  {
    id: 'marsh_reeds_and_ferns',
    name: 'Bone Reeds and Glow Ferns',
    archetypeWeights: [
      { archetypeId: 'bone_reeds', weight: 0.65 },
      { archetypeId: 'glow_fern', weight: 0.35 }
    ],
    priority: 4,
    density: 16,
    minDistance: 2.5,
    slopeRange: [0.0, 0.35],
    heightRange: [-0.4, 2.5],
    waterDistanceRange: [0.0, 14.0], // Clustered tightly along water edges
    scaleRange: [0.8, 1.3],
    tiltRange: [0.0, 0.15],
    ecologicalPattern: 'marsh_edge'
  },

  // ==========================================
  // PRIORITY 5: GROUND COVER / UNDERFOOT
  // ==========================================
  {
    id: 'dead_grass_cover',
    name: 'Wind-swaying Dead Grass',
    archetypeWeights: [{ archetypeId: 'dead_grass', weight: 1.0 }],
    priority: 5,
    density: 22,
    minDistance: 2.2,
    slopeRange: [0.0, 0.6],
    heightRange: [-0.1, 24.0],
    waterDistanceRange: [1.5, 500.0],
    noiseMask: { scale: 0.025, threshold: 0.3 },
    scaleRange: [0.75, 1.35],
    tiltRange: [0.0, 0.25],
    ecologicalPattern: 'all'
  },
  {
    id: 'thorn_bramble_cover',
    name: 'Thorn Bramble Undergrowth',
    archetypeWeights: [{ archetypeId: 'thorn_bramble', weight: 1.0 }],
    priority: 5,
    density: 8,
    minDistance: 4.0,
    slopeRange: [0.0, 0.5],
    heightRange: [0.0, 18.0],
    waterDistanceRange: [3.0, 500.0],
    scaleRange: [0.8, 1.25],
    tiltRange: [0.0, 0.2],
    ecologicalPattern: 'dead_timber'
  },
  {
    id: 'glow_fern_groves',
    name: 'Glow Fern Undergrowth',
    archetypeWeights: [{ archetypeId: 'glow_fern', weight: 1.0 }],
    priority: 5,
    density: 9,
    minDistance: 3.5,
    slopeRange: [0.0, 0.5],
    heightRange: [0.0, 16.0],
    waterDistanceRange: [2.0, 100.0],
    noiseMask: { scale: 0.028, threshold: 0.42 },
    scaleRange: [0.75, 1.25],
    tiltRange: [0.0, 0.2],
    ecologicalPattern: 'fungal_grove'
  }
];
