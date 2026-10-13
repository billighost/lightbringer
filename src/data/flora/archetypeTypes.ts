import * as THREE from 'three';

export type FloraCategory = 'fungi' | 'trees' | 'rocks' | 'ground_cover' | 'gatherables';

export type ColliderType = 'none' | 'capsule' | 'cylinder' | 'box';

export type FloraMaterialId = 'fungus' | 'bark' | 'rock' | 'foliage' | 'crystal' | 'vein';

export interface LodBudget {
  lod0: number; // Max tri budget at LOD0
  lod1: number; // Max tri budget at LOD1
  lod2?: number; // Max tri budget at LOD2 / impostor
}

export interface LodSettings {
  lod: number;
  maxDistance: number;
  triangleBudget: number;
}

export interface GlowSettings {
  enabled: boolean;
  color: string; // Hex color (e.g. cyan #00f2ff, toxicGreen #2afc64, magenta #e0167c)
  intensity: number; // Base emissive HDR intensity
  radius: number; // Light pool influence radius in meters
  pulsePeriodRange: [number, number]; // Breathing period in seconds (e.g. [4.0, 8.5])
  emissiveMaskPower: number; // Contrast exponent on vertex glow mask
}

export interface WindSettings {
  enabled: boolean;
  swayStrength: number; // 0 for rocks/stout trees, ~0.15 for giant fungi, ~0.8-1.5 for grass/reeds
  heightWeight: number; // Exponent for height-based sway weight
  flutter: boolean; // Vine/leaf high-frequency flutter
}

export interface GatherableConfig {
  resourceId: string; // e.g. 'lumen_shard', 'glow_spore', 'lumen_cap'
  name: string;
  respawnSeconds: number;
  interactionRadius: number; // In meters
}

export interface ArchetypeDefinition {
  id: string;
  name: string;
  category: FloraCategory;
  generatorId: string;
  paramRanges: Record<string, [number, number]>;
  materialId: FloraMaterialId;
  triBudgets: LodBudget;
  lodSettings: LodSettings[];
  colliderType: ColliderType;
  colliderDimensions?: [number, number, number]; // [width, height, depth] or [radius, height, 0]
  glowSettings: GlowSettings;
  windSettings: WindSettings;
  gatherableConfig?: GatherableConfig;
}

export interface GeneratedGeometryResult {
  geometry: THREE.BufferGeometry;
  triangleCount: number;
  boundingBox: THREE.Box3;
}
