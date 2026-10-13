import * as THREE from 'three';
import { WindParams } from '../../data/regions/schema';

export class WindSystem {
  private static instance: WindSystem | null = null;

  public direction: THREE.Vector2;
  public baseStrength: number;
  public gustFrequency: number;
  public gustStrength: number;
  public windTime = 0;

  public currentStrength = 0;

  public uniforms: {
    uWindDir: { value: THREE.Vector2 };
    uWindStrength: { value: number };
    uWindTime: { value: number };
  };

  constructor(params?: WindParams) {
    const dir = params ? params.direction : [0.7071, 0.7071];
    this.direction = new THREE.Vector2(dir[0], dir[1]).normalize();
    this.baseStrength = params ? params.baseStrength : 2.5;
    this.gustFrequency = params ? params.gustFrequency : 0.35;
    this.gustStrength = params ? params.gustStrength : 1.5;

    this.uniforms = {
      uWindDir: { value: this.direction.clone() },
      uWindStrength: { value: this.baseStrength },
      uWindTime: { value: 0 }
    };

    WindSystem.instance = this;
  }

  public static getInstance(): WindSystem {
    if (!this.instance) {
      this.instance = new WindSystem();
    }
    return this.instance;
  }

  public update(dt: number): void {
    this.windTime += dt;

    // Animated gusts using layered harmonics
    const gust1 = Math.sin(this.windTime * this.gustFrequency * Math.PI * 2.0);
    const gust2 = Math.sin(this.windTime * this.gustFrequency * 2.7 * Math.PI * 2.0 + 1.2) * 0.5;
    const gustFactor = Math.max(0, (gust1 + gust2) * 0.5);

    this.currentStrength = this.baseStrength + gustFactor * this.gustStrength;

    this.uniforms.uWindDir.value.copy(this.direction);
    this.uniforms.uWindStrength.value = this.currentStrength;
    this.uniforms.uWindTime.value = this.windTime;
  }

  /**
   * Synchronous wind velocity evaluation at world position (x, z)
   */
  public getWindAt(x: number, z: number, time = this.windTime): THREE.Vector3 {
    const spatialPhase = x * 0.08 + z * 0.08;
    const wave = Math.sin(time * 2.2 + spatialPhase) * 0.7 + Math.sin(time * 4.1 + spatialPhase * 2.0) * 0.3;
    const strength = this.currentStrength * (0.8 + wave * 0.4);

    return new THREE.Vector3(this.direction.x * strength, 0.1 * wave, this.direction.y * strength);
  }
}
