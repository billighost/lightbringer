import * as THREE from 'three';
import { SunlessLighting, type SunConfig, type LightingPreset, type PlayerLightConfig } from './lighting/sunlessLighting';
import { GLIMMERWOOD_REGION } from '../data/regions/glimmerwood';

export { SunlessLighting, type LightingPreset, type PlayerLightConfig, type SunConfig };

/**
 * LightingModule wrapper extending SunlessLighting for backward compatibility
 */
export class LightingModule extends SunlessLighting {
  constructor(scene: THREE.Scene) {
    super(scene, GLIMMERWOOD_REGION);
  }
}
