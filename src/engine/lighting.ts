import * as THREE from 'three';

export interface SunConfig {
  elevation: number; // degrees
  azimuth: number;   // degrees
  intensity: number;
  color: string;
}

export class LightingModule {
  public scene: THREE.Scene;
  public dirLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  public config: SunConfig = {
    elevation: 48,
    azimuth: 40,
    intensity: 1.6,
    color: '#fff9e6'
  };

  private targetObject: THREE.Object3D;
  private shadowDistance = 45;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Sky background & fog
    const skyColor = new THREE.Color(0xcbe0f5);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(skyColor, 0.012);

    // Hemisphere light for soft ambient fill
    this.hemiLight = new THREE.HemisphereLight(0xe8f2ff, 0x3d4450, 0.7);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // Directional light (Sun placeholder)
    this.dirLight = new THREE.DirectionalLight(this.config.color, this.config.intensity);
    this.dirLight.castShadow = true;

    // High quality shadow map setup
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 120;
    this.dirLight.shadow.bias = -0.0004;
    this.dirLight.shadow.normalBias = 0.02;

    const shadowExtent = 28;
    this.dirLight.shadow.camera.left = -shadowExtent;
    this.dirLight.shadow.camera.right = shadowExtent;
    this.dirLight.shadow.camera.top = shadowExtent;
    this.dirLight.shadow.camera.bottom = -shadowExtent;

    this.targetObject = new THREE.Object3D();
    this.scene.add(this.targetObject);
    this.dirLight.target = this.targetObject;

    this.scene.add(this.dirLight);

    this.applySunTransform(new THREE.Vector3(0, 0, 0));
  }

  public update(playerPos: THREE.Vector3): void {
    this.applySunTransform(playerPos);
  }

  public applySunTransform(center: THREE.Vector3): void {
    const phi = THREE.MathUtils.degToRad(90 - this.config.elevation);
    const theta = THREE.MathUtils.degToRad(this.config.azimuth);

    const x = this.shadowDistance * Math.sin(phi) * Math.sin(theta);
    const y = this.shadowDistance * Math.cos(phi);
    const z = this.shadowDistance * Math.sin(phi) * Math.cos(theta);

    this.targetObject.position.set(center.x, center.y, center.z);
    this.dirLight.position.set(center.x + x, center.y + y, center.z + z);

    this.dirLight.intensity = this.config.intensity;
    this.dirLight.color.set(this.config.color);
  }
}
