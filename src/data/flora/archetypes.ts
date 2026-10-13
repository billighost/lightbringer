import { ArchetypeDefinition } from './archetypeTypes';

export const FLORA_ARCHETYPES: Record<string, ArchetypeDefinition> = {
  // ==========================================
  // GIANT FUNGI
  // ==========================================
  umbrella_titan: {
    id: 'umbrella_titan',
    name: 'Umbrella Titan',
    category: 'fungi',
    generatorId: 'umbrella_titan',
    paramRanges: {
      height: [12.0, 22.0],
      capRadius: [5.0, 9.5],
      stalkRadius: [0.8, 1.6],
      ruffleHeightRatio: [0.65, 0.75],
      droopFactor: [0.35, 0.65]
    },
    materialId: 'fungus',
    triBudgets: { lod0: 7800, lod1: 2200, lod2: 600 },
    lodSettings: [
      { lod: 0, maxDistance: 35, triangleBudget: 7800 },
      { lod: 1, maxDistance: 80, triangleBudget: 2200 },
      { lod: 2, maxDistance: 160, triangleBudget: 600 }
    ],
    colliderType: 'cylinder',
    colliderDimensions: [1.2, 16.0, 0], // radius, height
    glowSettings: {
      enabled: true,
      color: '#00f2ff', // Cyan gills & dripping nodules
      intensity: 3.8,
      radius: 18.0,
      pulsePeriodRange: [5.5, 8.5],
      emissiveMaskPower: 2.2
    },
    windSettings: {
      enabled: true,
      swayStrength: 0.12,
      heightWeight: 1.8,
      flutter: false
    }
  },

  shelf_fungus: {
    id: 'shelf_fungus',
    name: 'Shelf Fungus Cluster',
    category: 'fungi',
    generatorId: 'shelf_fungus',
    paramRanges: {
      shelfCount: [3, 6],
      radius: [0.6, 1.4],
      curve: [0.2, 0.5]
    },
    materialId: 'fungus',
    triBudgets: { lod0: 1800, lod1: 600, lod2: 180 },
    lodSettings: [
      { lod: 0, maxDistance: 25, triangleBudget: 1800 },
      { lod: 1, maxDistance: 55, triangleBudget: 600 },
      { lod: 2, maxDistance: 100, triangleBudget: 180 }
    ],
    colliderType: 'none',
    glowSettings: {
      enabled: true,
      color: '#2afc64', // Toxic green outer rim
      intensity: 2.6,
      radius: 6.0,
      pulsePeriodRange: [4.0, 6.5],
      emissiveMaskPower: 2.8
    },
    windSettings: {
      enabled: true,
      swayStrength: 0.04,
      heightWeight: 1.0,
      flutter: false
    }
  },

  lumen_cap_cluster: {
    id: 'lumen_cap_cluster',
    name: 'Lumen Cap Cluster',
    category: 'gatherables',
    generatorId: 'lumen_cap_cluster',
    paramRanges: {
      capCount: [5, 9],
      height: [0.35, 0.85],
      capRadius: [0.12, 0.28]
    },
    materialId: 'fungus',
    triBudgets: { lod0: 1600, lod1: 650, lod2: 120 },
    lodSettings: [
      { lod: 0, maxDistance: 20, triangleBudget: 1600 },
      { lod: 1, maxDistance: 45, triangleBudget: 650 },
      { lod: 2, maxDistance: 90, triangleBudget: 120 }
    ],
    colliderType: 'none',
    glowSettings: {
      enabled: true,
      color: '#00f2ff', // Cyan / soft magenta glow
      intensity: 2.8,
      radius: 8.0,
      pulsePeriodRange: [3.8, 6.2],
      emissiveMaskPower: 2.0
    },
    windSettings: {
      enabled: true,
      swayStrength: 0.18,
      heightWeight: 1.2,
      flutter: false
    },
    gatherableConfig: {
      resourceId: 'lumen_cap',
      name: 'Lumen Mushroom',
      respawnSeconds: 20,
      interactionRadius: 2.8
    }
  },

  spore_stalk: {
    id: 'spore_stalk',
    name: 'Spore Stalk',
    category: 'fungi',
    generatorId: 'spore_stalk',
    paramRanges: {
      height: [3.2, 5.8],
      bulbRadius: [0.45, 0.85],
      lean: [0.1, 0.35]
    },
    materialId: 'fungus',
    triBudgets: { lod0: 1500, lod1: 450, lod2: 120 },
    lodSettings: [
      { lod: 0, maxDistance: 28, triangleBudget: 1500 },
      { lod: 1, maxDistance: 60, triangleBudget: 450 },
      { lod: 2, maxDistance: 110, triangleBudget: 120 }
    ],
    colliderType: 'none',
    glowSettings: {
      enabled: true,
      color: '#e0167c', // Magenta core & pore slits
      intensity: 3.2,
      radius: 10.0,
      pulsePeriodRange: [4.5, 7.5],
      emissiveMaskPower: 2.4
    },
    windSettings: {
      enabled: true,
      swayStrength: 0.35,
      heightWeight: 2.0,
      flutter: true
    }
  },

  mycelium_veins: {
    id: 'mycelium_veins',
    name: 'Mycelium Veins',
    category: 'fungi',
    generatorId: 'mycelium_veins',
    paramRanges: {
      radius: [2.5, 5.5],
      branchDensity: [6, 12]
    },
    materialId: 'vein',
    triBudgets: { lod0: 1200, lod1: 400, lod2: 80 },
    lodSettings: [
      { lod: 0, maxDistance: 25, triangleBudget: 1200 },
      { lod: 1, maxDistance: 50, triangleBudget: 400 },
      { lod: 2, maxDistance: 90, triangleBudget: 80 }
    ],
    colliderType: 'none',
    glowSettings: {
      enabled: true,
      color: '#00f2ff', // Cyan glowing veins along terrain
      intensity: 2.2,
      radius: 7.0,
      pulsePeriodRange: [5.0, 8.0],
      emissiveMaskPower: 1.8
    },
    windSettings: {
      enabled: false,
      swayStrength: 0.0,
      heightWeight: 0.0,
      flutter: false
    }
  },

  // ==========================================
  // DEAD TREES
  // ==========================================
  twisted_snag: {
    id: 'twisted_snag',
    name: 'Twisted Snag',
    category: 'trees',
    generatorId: 'twisted_snag',
    paramRanges: {
      height: [6.5, 12.0],
      trunkRadius: [0.55, 1.1],
      twist: [0.8, 2.2],
      branchCount: [3, 6],
      vineCount: [2, 5]
    },
    materialId: 'bark',
    triBudgets: { lod0: 4400, lod1: 1400, lod2: 380 },
    lodSettings: [
      { lod: 0, maxDistance: 35, triangleBudget: 4400 },
      { lod: 1, maxDistance: 80, triangleBudget: 1400 },
      { lod: 2, maxDistance: 150, triangleBudget: 380 }
    ],
    colliderType: 'cylinder',
    colliderDimensions: [0.8, 9.0, 0],
    glowSettings: {
      enabled: false,
      color: '#000000',
      intensity: 0.0,
      radius: 0.0,
      pulsePeriodRange: [0, 0],
      emissiveMaskPower: 1.0
    },
    windSettings: {
      enabled: true,
      swayStrength: 0.02, // Vines flutter in wind
      heightWeight: 1.0,
      flutter: true
    }
  },

  broken_stump: {
    id: 'broken_stump',
    name: 'Broken Stump',
    category: 'trees',
    generatorId: 'broken_stump',
    paramRanges: {
      height: [1.8, 3.8],
      radius: [0.8, 1.6],
      hollowDepth: [0.8, 1.8],
      splinters: [6, 12]
    },
    materialId: 'bark',
    triBudgets: { lod0: 3200, lod1: 1000, lod2: 260 },
    lodSettings: [
      { lod: 0, maxDistance: 30, triangleBudget: 3200 },
      { lod: 1, maxDistance: 70, triangleBudget: 1000 },
      { lod: 2, maxDistance: 130, triangleBudget: 260 }
    ],
    colliderType: 'cylinder',
    colliderDimensions: [1.2, 2.8, 0],
    glowSettings: {
      enabled: true,
      color: '#2afc64', // Faint inner hollow glow
      intensity: 1.8,
      radius: 5.5,
      pulsePeriodRange: [6.0, 9.0],
      emissiveMaskPower: 3.0
    },
    windSettings: {
      enabled: false,
      swayStrength: 0.0,
      heightWeight: 0.0,
      flutter: false
    }
  },

  fallen_log: {
    id: 'fallen_log',
    name: 'Fallen Log',
    category: 'trees',
    generatorId: 'fallen_log',
    paramRanges: {
      length: [4.5, 9.5],
      radius: [0.45, 0.95],
      curve: [0.1, 0.4],
      shelfClusterCount: [2, 4]
    },
    materialId: 'bark',
    triBudgets: { lod0: 3400, lod1: 1100, lod2: 280 },
    lodSettings: [
      { lod: 0, maxDistance: 30, triangleBudget: 3400 },
      { lod: 1, maxDistance: 70, triangleBudget: 1100 },
      { lod: 2, maxDistance: 130, triangleBudget: 280 }
    ],
    colliderType: 'box',
    colliderDimensions: [1.2, 1.1, 7.0],
    glowSettings: {
      enabled: true,
      color: '#00f2ff', // Log shelf brackets glow softly
      intensity: 2.0,
      radius: 6.0,
      pulsePeriodRange: [5.0, 8.0],
      emissiveMaskPower: 2.5
    },
    windSettings: {
      enabled: false,
      swayStrength: 0.0,
      heightWeight: 0.0,
      flutter: false
    }
  },

  root_mass: {
    id: 'root_mass',
    name: 'Root Mass',
    category: 'trees',
    generatorId: 'root_mass',
    paramRanges: {
      radius: [2.5, 5.0],
      height: [1.6, 3.2],
      archCount: [4, 8]
    },
    materialId: 'bark',
    triBudgets: { lod0: 3800, lod1: 1200, lod2: 320 },
    lodSettings: [
      { lod: 0, maxDistance: 30, triangleBudget: 3800 },
      { lod: 1, maxDistance: 70, triangleBudget: 1200 },
      { lod: 2, maxDistance: 130, triangleBudget: 320 }
    ],
    colliderType: 'cylinder',
    colliderDimensions: [2.0, 2.2, 0],
    glowSettings: {
      enabled: false,
      color: '#000000',
      intensity: 0.0,
      radius: 0.0,
      pulsePeriodRange: [0, 0],
      emissiveMaskPower: 1.0
    },
    windSettings: {
      enabled: false,
      swayStrength: 0.0,
      heightWeight: 0.0,
      flutter: false
    }
  },

  // ==========================================
  // ROCKS
  // ==========================================
  boulder: {
    id: 'boulder',
    name: 'Boulder',
    category: 'rocks',
    generatorId: 'boulder',
    paramRanges: {
      scaleX: [1.5, 3.8],
      scaleY: [1.2, 3.0],
      scaleZ: [1.5, 3.8],
      roughnessNoise: [0.25, 0.55]
    },
    materialId: 'rock',
    triBudgets: { lod0: 1200, lod1: 420, lod2: 120 },
    lodSettings: [
      { lod: 0, maxDistance: 30, triangleBudget: 1200 },
      { lod: 1, maxDistance: 75, triangleBudget: 420 },
      { lod: 2, maxDistance: 140, triangleBudget: 120 }
    ],
    colliderType: 'capsule',
    colliderDimensions: [1.6, 2.2, 0],
    glowSettings: {
      enabled: false,
      color: '#000000',
      intensity: 0.0,
      radius: 0.0,
      pulsePeriodRange: [0, 0],
      emissiveMaskPower: 1.0
    },
    windSettings: {
      enabled: false,
      swayStrength: 0.0,
      heightWeight: 0.0,
      flutter: false
    }
  },

  slab: {
    id: 'slab',
    name: 'Stone Slab',
    category: 'rocks',
    generatorId: 'slab',
    paramRanges: {
      width: [2.5, 5.5],
      height: [0.5, 1.4],
      depth: [2.2, 4.8],
      tilt: [0.15, 0.45]
    },
    materialId: 'rock',
    triBudgets: { lod0: 850, lod1: 280, lod2: 80 },
    lodSettings: [
      { lod: 0, maxDistance: 30, triangleBudget: 850 },
      { lod: 1, maxDistance: 70, triangleBudget: 280 },
      { lod: 2, maxDistance: 130, triangleBudget: 80 }
    ],
    colliderType: 'box',
    colliderDimensions: [3.8, 1.0, 3.2],
    glowSettings: {
      enabled: false,
      color: '#000000',
      intensity: 0.0,
      radius: 0.0,
      pulsePeriodRange: [0, 0],
      emissiveMaskPower: 1.0
    },
    windSettings: {
      enabled: false,
      swayStrength: 0.0,
      heightWeight: 0.0,
      flutter: false
    }
  },

  spire: {
    id: 'spire',
    name: 'Rock Spire',
    category: 'rocks',
    generatorId: 'spire',
    paramRanges: {
      height: [6.0, 14.0],
      baseRadius: [1.2, 2.8],
      taper: [0.65, 0.85],
      ridgeCount: [5, 8]
    },
    materialId: 'rock',
    triBudgets: { lod0: 1400, lod1: 520, lod2: 150 },
    lodSettings: [
      { lod: 0, maxDistance: 40, triangleBudget: 1400 },
      { lod: 1, maxDistance: 90, triangleBudget: 520 },
      { lod: 2, maxDistance: 170, triangleBudget: 150 }
    ],
    colliderType: 'cylinder',
    colliderDimensions: [1.8, 10.0, 0],
    glowSettings: {
      enabled: true,
      color: '#00f2ff', // Embedded crystal glints
      intensity: 1.6,
      radius: 6.0,
      pulsePeriodRange: [4.0, 7.0],
      emissiveMaskPower: 3.5
    },
    windSettings: {
      enabled: false,
      swayStrength: 0.0,
      heightWeight: 0.0,
      flutter: false
    }
  },

  scree_cluster: {
    id: 'scree_cluster',
    name: 'Scree Cluster',
    category: 'rocks',
    generatorId: 'scree_cluster',
    paramRanges: {
      rockCount: [7, 14],
      radius: [1.8, 3.6],
      rockSize: [0.2, 0.75]
    },
    materialId: 'rock',
    triBudgets: { lod0: 1100, lod1: 360, lod2: 90 },
    lodSettings: [
      { lod: 0, maxDistance: 25, triangleBudget: 1100 },
      { lod: 1, maxDistance: 55, triangleBudget: 360 },
      { lod: 2, maxDistance: 100, triangleBudget: 90 }
    ],
    colliderType: 'none',
    glowSettings: {
      enabled: false,
      color: '#000000',
      intensity: 0.0,
      radius: 0.0,
      pulsePeriodRange: [0, 0],
      emissiveMaskPower: 1.0
    },
    windSettings: {
      enabled: false,
      swayStrength: 0.0,
      heightWeight: 0.0,
      flutter: false
    }
  },

  // ==========================================
  // GROUND COVER
  // ==========================================
  dead_grass: {
    id: 'dead_grass',
    name: 'Dead Grass Clump',
    category: 'ground_cover',
    generatorId: 'dead_grass',
    paramRanges: {
      bladeCount: [12, 22],
      height: [0.6, 1.4],
      clumpRadius: [0.35, 0.75]
    },
    materialId: 'foliage',
    triBudgets: { lod0: 380, lod1: 140, lod2: 36 },
    lodSettings: [
      { lod: 0, maxDistance: 20, triangleBudget: 380 },
      { lod: 1, maxDistance: 45, triangleBudget: 140 },
      { lod: 2, maxDistance: 80, triangleBudget: 36 }
    ],
    colliderType: 'none',
    glowSettings: {
      enabled: false,
      color: '#000000',
      intensity: 0.0,
      radius: 0.0,
      pulsePeriodRange: [0, 0],
      emissiveMaskPower: 1.0
    },
    windSettings: {
      enabled: true,
      swayStrength: 1.25,
      heightWeight: 2.0,
      flutter: true
    }
  },

  glow_fern: {
    id: 'glow_fern',
    name: 'Glow Fern',
    category: 'ground_cover',
    generatorId: 'glow_fern',
    paramRanges: {
      frondCount: [4, 7],
      frondLength: [0.8, 1.6],
      curl: [0.3, 0.65]
    },
    materialId: 'foliage',
    triBudgets: { lod0: 480, lod1: 180, lod2: 44 },
    lodSettings: [
      { lod: 0, maxDistance: 22, triangleBudget: 480 },
      { lod: 1, maxDistance: 48, triangleBudget: 180 },
      { lod: 2, maxDistance: 85, triangleBudget: 44 }
    ],
    colliderType: 'none',
    glowSettings: {
      enabled: true,
      color: '#2afc64', // Toxic green emissive frond tips
      intensity: 2.4,
      radius: 6.5,
      pulsePeriodRange: [4.2, 6.8],
      emissiveMaskPower: 2.5
    },
    windSettings: {
      enabled: true,
      swayStrength: 0.85,
      heightWeight: 1.5,
      flutter: true
    }
  },

  thorn_bramble: {
    id: 'thorn_bramble',
    name: 'Thorn Bramble',
    category: 'ground_cover',
    generatorId: 'thorn_bramble',
    paramRanges: {
      branchCount: [5, 9],
      radius: [0.9, 1.8],
      height: [0.4, 0.95]
    },
    materialId: 'bark',
    triBudgets: { lod0: 520, lod1: 190, lod2: 50 },
    lodSettings: [
      { lod: 0, maxDistance: 22, triangleBudget: 520 },
      { lod: 1, maxDistance: 48, triangleBudget: 190 },
      { lod: 2, maxDistance: 85, triangleBudget: 50 }
    ],
    colliderType: 'none',
    glowSettings: {
      enabled: false,
      color: '#000000',
      intensity: 0.0,
      radius: 0.0,
      pulsePeriodRange: [0, 0],
      emissiveMaskPower: 1.0
    },
    windSettings: {
      enabled: true,
      swayStrength: 0.25,
      heightWeight: 1.2,
      flutter: false
    }
  },

  bone_reeds: {
    id: 'bone_reeds',
    name: 'Bone Reeds',
    category: 'ground_cover',
    generatorId: 'bone_reeds',
    paramRanges: {
      reedCount: [10, 18],
      height: [2.2, 4.0],
      stalkRadius: [0.03, 0.07]
    },
    materialId: 'foliage',
    triBudgets: { lod0: 420, lod1: 160, lod2: 40 },
    lodSettings: [
      { lod: 0, maxDistance: 25, triangleBudget: 420 },
      { lod: 1, maxDistance: 55, triangleBudget: 160 },
      { lod: 2, maxDistance: 95, triangleBudget: 40 }
    ],
    colliderType: 'none',
    glowSettings: {
      enabled: true,
      color: '#00f2ff', // Faint pale tip glow
      intensity: 1.4,
      radius: 4.5,
      pulsePeriodRange: [5.0, 7.5],
      emissiveMaskPower: 2.0
    },
    windSettings: {
      enabled: true,
      swayStrength: 1.4,
      heightWeight: 2.2,
      flutter: true
    }
  },

  // ==========================================
  // GATHERABLE RESOURCE NODES
  // ==========================================
  lumen_shard: {
    id: 'lumen_shard',
    name: 'Lumen Shard Node',
    category: 'gatherables',
    generatorId: 'lumen_shard',
    paramRanges: {
      crystalCount: [4, 8],
      height: [0.8, 1.8],
      spread: [0.35, 0.75]
    },
    materialId: 'crystal',
    triBudgets: { lod0: 950, lod1: 340, lod2: 80 },
    lodSettings: [
      { lod: 0, maxDistance: 25, triangleBudget: 950 },
      { lod: 1, maxDistance: 60, triangleBudget: 340 },
      { lod: 2, maxDistance: 120, triangleBudget: 80 }
    ],
    colliderType: 'none',
    glowSettings: {
      enabled: true,
      color: '#00f2ff', // Brilliant cyan crystal glow
      intensity: 4.5,
      radius: 12.0,
      pulsePeriodRange: [3.5, 5.5],
      emissiveMaskPower: 1.5
    },
    windSettings: {
      enabled: false,
      swayStrength: 0.0,
      heightWeight: 0.0,
      flutter: false
    },
    gatherableConfig: {
      resourceId: 'lumen_shard',
      name: 'Lumen Crystal Shard',
      respawnSeconds: 25,
      interactionRadius: 2.8
    }
  },

  glow_spore_plant: {
    id: 'glow_spore_plant',
    name: 'Glow-Spore Plant',
    category: 'gatherables',
    generatorId: 'glow_spore_plant',
    paramRanges: {
      podCount: [3, 5],
      height: [0.9, 1.6],
      podRadius: [0.22, 0.42]
    },
    materialId: 'fungus',
    triBudgets: { lod0: 1400, lod1: 450, lod2: 110 },
    lodSettings: [
      { lod: 0, maxDistance: 25, triangleBudget: 1400 },
      { lod: 1, maxDistance: 55, triangleBudget: 450 },
      { lod: 2, maxDistance: 110, triangleBudget: 110 }
    ],
    colliderType: 'none',
    glowSettings: {
      enabled: true,
      color: '#e0167c', // Vibrant magenta bulb sacs
      intensity: 4.0,
      radius: 11.0,
      pulsePeriodRange: [3.2, 5.0],
      emissiveMaskPower: 2.0
    },
    windSettings: {
      enabled: true,
      swayStrength: 0.35,
      heightWeight: 1.6,
      flutter: false
    },
    gatherableConfig: {
      resourceId: 'glow_spore',
      name: 'Glow-Spore Essence',
      respawnSeconds: 20,
      interactionRadius: 2.8
    }
  }
};
