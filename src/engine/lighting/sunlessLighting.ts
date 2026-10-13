import * as THREE from 'three';
import { LightPool } from './lightPool';
import { RegionData } from '../../data/regions/schema';

export type LightingPreset = 'sunless' | 'daylight';

export interface PlayerLightConfig {
  color: string;
  intensity: number;
  distance: number;
  decay: number;
  flickerIntensity: number;
  flickerSpeed: number;
  heightOffset: number;
  castShadow: boolean;
}

export class SunlessLighting {
  public scene: THREE.Scene;
  public hemiLight: THREE.HemisphereLight;
  public playerLight: THREE.PointLight;
  public lightPool: LightPool;

  // Debug daylight directional sun
  public dirLight: THREE.DirectionalLight;
  private targetObject: THREE.Object3D;

  public activePreset: LightingPreset = 'sunless';

  public playerConfig: PlayerLightConfig = {
    color: '#ffc86b', // warm gold-white
    intensity: 4.2,
    distance: 26,
    decay: 2.0,
    flickerIntensity: 0.18,
    flickerSpeed: 4.0,
    heightOffset: 1.35,
    castShadow: true
  };

  private baseFogColor: THREE.Color;
  private daylightSkyColor = new THREE.Color(0xcbe0f5);

  constructor(scene: THREE.Scene, region: RegionData) {
    this.scene = scene;

    // 1. Fog and Background
    this.baseFogColor = new THREE.Color(region.fog.color);
    this.scene.background = this.baseFogColor;
    this.scene.fog = new THREE.FogExp2(this.baseFogColor, region.fog.density);

    // 2. Cold Sunless Hemisphere Ambient
    const skyCol = new THREE.Color(region.ambient.skyColor);
    const gndCol = new THREE.Color(region.ambient.groundColor);
    this.hemiLight = new THREE.HemisphereLight(skyCol, gndCol, region.ambient.intensity);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // 3. Dominant Player Point Light
    this.playerLight = new THREE.PointLight(
      this.playerConfig.color,
      this.playerConfig.intensity,
      this.playerConfig.distance,
      this.playerConfig.decay
    );
    this.playerLight.castShadow = this.playerConfig.castShadow;
    this.playerLight.shadow.mapSize.width = 1024;
    this.playerLight.shadow.mapSize.height = 1024;
    this.playerLight.shadow.camera.near = 0.2;
    this.playerLight.shadow.camera.far = 28;
    this.playerLight.shadow.bias = -0.001;
    this.playerLight.shadow.normalBias = 0.05;
    this.scene.add(this.playerLight);

    // 4. Light Pool for surrounding glow sources
    this.lightPool = new LightPool(this.scene, 6);

    // 5. Preserved Directional Light for "Debug Daylight" preset
    this.dirLight = new THREE.DirectionalLight(0xfff9e6, 1.6);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 120;
    this.targetObject = new THREE.Object3D();
    this.scene.add(this.targetObject);
    this.dirLight.target = this.targetObject;
    this.scene.add(this.dirLight);

    // Default to Sunless mode (directional sun disabled)
    this.applyPreset('sunless');
  }

  public applyPreset(preset: LightingPreset): void {
    this.activePreset = preset;

    if (preset === 'sunless') {
      this.dirLight.visible = false;
      this.dirLight.intensity = 0;
      this.scene.background = this.baseFogColor;
      (this.scene.fog as THREE.FogExp2).color.copy(this.baseFogColor);
      (this.scene.fog as THREE.FogExp2).density = 0.016;

      this.hemiLight.color.set(0x0c1b26);
      this.hemiLight.groundColor.set(0x060a0f);
      this.hemiLight.intensity = 0.32;

      this.playerLight.visible = true;
    } else {
      // Debug Daylight
      this.dirLight.visible = true;
      this.dirLight.intensity = 1.6;
      this.scene.background = this.daylightSkyColor;
      (this.scene.fog as THREE.FogExp2).color.copy(this.daylightSkyColor);
      (this.scene.fog as THREE.FogExp2).density = 0.012;

      this.hemiLight.color.set(0xe8f2ff);
      this.hemiLight.groundColor.set(0x3d4450);
      this.hemiLight.intensity = 0.7;

      this.playerLight.visible = true;
    }
  }

  public update(playerPos: THREE.Vector3, dt = 0.016, time = 0): void {
    // 1. Position player light at player's chest height
    this.playerLight.position.set(
      playerPos.x,
      playerPos.y + this.playerConfig.heightOffset,
      playerPos.z
    );

    // 2. Subtle organic flicker on player light
    const flickerNoise = Math.sin(time * this.playerConfig.flickerSpeed * 2.1) *
      Math.cos(time * this.playerConfig.flickerSpeed * 3.7);
    const flicker = 1.0 + flickerNoise * this.playerConfig.flickerIntensity;

    this.playerLight.intensity = this.playerConfig.intensity * flicker;
    this.playerLight.color.set(this.playerConfig.color);
    this.playerLight.distance = this.playerConfig.distance;
    this.playerLight.decay = this.playerConfig.decay;

    // 3. Directional sun follows player when in daylight debug mode
    if (this.activePreset === 'daylight') {
      this.targetObject.position.copy(playerPos);
      this.dirLight.position.set(playerPos.x + 28, playerPos.y + 36, playerPos.z + 28);
    }

    // 4. Update light pool
    this.lightPool.update(dt, playerPos);
  }

  public setQuality(quality: 'low' | 'medium' | 'high'): void {
    if (quality === 'low') {
      this.playerLight.castShadow = false;
    } else {
      this.playerLight.castShadow = this.playerConfig.castShadow;
      this.playerLight.shadow.mapSize.width = quality === 'medium' ? 512 : 1024;
      this.playerLight.shadow.mapSize.height = quality === 'medium' ? 512 : 1024;
    }
  }

  public dispose(): void {
    this.scene.remove(this.hemiLight);
    this.scene.remove(this.playerLight);
    this.scene.remove(this.dirLight);
    this.scene.remove(this.targetObject);
    this.lightPool.dispose();
  }
}
