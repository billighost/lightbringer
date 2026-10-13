export interface GroundLayerConfig {
  name: string;
  texturePath: string;
  roughness: number;
  metalness: number;
  tint: string;
  tileScale: number;
}

export type FeatureType = 'radial_hill' | 'radial_basin' | 'flatten_circle' | 'flatten_rect' | 'spline_path';

export interface BaseFeature {
  id: string;
  type: FeatureType;
  x: number;
  z: number;
  radius: number;
  blendRadius: number; // Falloff margin
}

export interface RadialHillFeature extends BaseFeature {
  type: 'radial_hill';
  height: number;
}

export interface RadialBasinFeature extends BaseFeature {
  type: 'radial_basin';
  depth: number;
}

export interface FlattenCircleFeature extends BaseFeature {
  type: 'flatten_circle';
  targetHeight: number;
  strength: number; // 0 to 1
}

export interface FlattenRectFeature extends BaseFeature {
  type: 'flatten_rect';
  targetHeight: number;
  width: number;
  depth: number;
  rotation: number; // radians
  strength: number;
}

export interface SplinePathFeature extends BaseFeature {
  type: 'spline_path';
  points: [number, number][]; // x, z
  width: number;
  targetDepth: number; // carving depth
}

export type TerrainFeature =
  | RadialHillFeature
  | RadialBasinFeature
  | FlattenCircleFeature
  | FlattenRectFeature
  | SplinePathFeature;

export interface TerrainStamp {
  id: string;
  x: number;
  z: number;
  scale: number;
  rotation: number;
  heightMapId: string;
  weight: number;
}

export interface TerrainParams {
  chunkSize: number;
  heightScale: number;
  baseFrequency: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  ridgedWeight: number;
  warpScale: number;
  warpStrength: number;
  erosionStrength: number;
  layers: {
    deadSoil: GroundLayerConfig;
    wetMud: GroundLayerConfig;
    crackedRock: GroundLayerConfig;
    glowingMoss: GroundLayerConfig;
  };
}

export interface FogConfig {
  color: string;
  density: number;
}

export interface AmbientConfig {
  skyColor: string;
  groundColor: string;
  intensity: number;
}

export interface ColorPalette {
  cyan: string;
  toxicGreen: string;
  magenta: string;
  deepTeal: string;
  violet: string;
  goldWarm: string;
}

export interface WaterBodyConfig {
  id: string;
  name: string;
  level: number;
  centerX: number;
  centerZ: number;
  radius: number;
  maxDepth: number;
}

export interface WaterParams {
  level: number;
  maxDepth: number;
  shallowSpeedMultiplier: number;
  deepWarningThreshold: number;
  rippleFrequency: number;
  surfaceColor: string;
  deepColor: string;
  foamColor: string;
  clarity: number;
  bodies: WaterBodyConfig[];
}

export interface WindParams {
  direction: [number, number];
  baseStrength: number;
  gustFrequency: number;
  gustStrength: number;
}

import { ScatterRule } from '../flora/scatterPresets';

export interface RegionData {
  id: string;
  name: string;
  size: {
    width: number;
    depth: number;
  };
  seed: number;
  terrain: TerrainParams;
  fog: FogConfig;
  ambient: AmbientConfig;
  palette: ColorPalette;
  water: WaterParams;
  wind: WindParams;
  musicThemeId: string;
  combatThemeId: string;
  features: TerrainFeature[];
  stamps: TerrainStamp[];
  zones: unknown[];
  scatterRules: ScatterRule[];
  landmarks: unknown[];
}

