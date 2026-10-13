import * as THREE from 'three';
import { RegionData } from '../../data/regions/schema';
import { WindSystem } from '../wind/windSystem';

export class SporeAtmosphere {
  public scene: THREE.Scene;
  public instancedMesh: THREE.InstancedMesh;
  public count: number;

  private offsets: Float32Array;
  private velocities: Float32Array;
  private dummy = new THREE.Object3D();
  private wind: WindSystem;

  private boxRadius = 36;
  private boxHeight = 16;

  constructor(scene: THREE.Scene, region: RegionData, count = 1200) {
    this.scene = scene;
    this.count = count;
    this.wind = WindSystem.getInstance();

    const sporeGeo = new THREE.PlaneGeometry(0.18, 0.18);

    // Circular soft glowing particle canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(200, 255, 240, 0.8)');
    grad.addColorStop(0.7, 'rgba(0, 240, 255, 0.2)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);

    const sporeMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.instancedMesh = new THREE.InstancedMesh(sporeGeo, sporeMat, count);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.offsets = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);

    // Palette colors
    const paletteColors = [
      new THREE.Color(region.palette.cyan),
      new THREE.Color(region.palette.toxicGreen),
      new THREE.Color(region.palette.violet),
      new THREE.Color(region.palette.magenta)
    ];

    for (let i = 0; i < count; i++) {
      // Random initial distribution in volume around origin
      const rx = (Math.random() - 0.5) * this.boxRadius * 2;
      const ry = Math.random() * this.boxHeight;
      const rz = (Math.random() - 0.5) * this.boxRadius * 2;

      this.offsets[i * 3] = rx;
      this.offsets[i * 3 + 1] = ry;
      this.offsets[i * 3 + 2] = rz;

      this.velocities[i * 3] = (Math.random() - 0.5) * 0.4;
      this.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.4;

      const col = paletteColors[Math.floor(Math.random() * paletteColors.length)];
      this.instancedMesh.setColorAt(i, col);
    }

    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }

    this.scene.add(this.instancedMesh);
  }

  public update(dt: number, playerPos: THREE.Vector3, camera: THREE.Camera): void {
    const windVec = this.wind.getWindAt(playerPos.x, playerPos.z);
    const camQuat = camera.quaternion;

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;

      // Update position with wind drift + micro-turbulence
      this.offsets[idx] += (windVec.x * 0.7 + this.velocities[idx]) * dt;
      this.offsets[idx + 1] += (windVec.y * 0.4 + this.velocities[idx + 1]) * dt;
      this.offsets[idx + 2] += (windVec.z * 0.7 + this.velocities[idx + 2]) * dt;

      // Wrap coordinates around player
      const relX = this.offsets[idx] - playerPos.x;
      const relY = this.offsets[idx + 1] - playerPos.y;
      const relZ = this.offsets[idx + 2] - playerPos.z;

      if (relX > this.boxRadius) this.offsets[idx] -= this.boxRadius * 2;
      if (relX < -this.boxRadius) this.offsets[idx] += this.boxRadius * 2;
      if (relY > this.boxHeight) this.offsets[idx + 1] -= this.boxHeight;
      if (relY < 0.2) this.offsets[idx + 1] += this.boxHeight;
      if (relZ > this.boxRadius) this.offsets[idx + 2] -= this.boxRadius * 2;
      if (relZ < -this.boxRadius) this.offsets[idx + 2] += this.boxRadius * 2;

      this.dummy.position.set(this.offsets[idx], this.offsets[idx + 1], this.offsets[idx + 2]);
      this.dummy.quaternion.copy(camQuat); // Billboard to face camera
      this.dummy.updateMatrix();

      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  public setQuality(quality: 'low' | 'medium' | 'high'): void {
    const active = quality === 'low' ? 300 : quality === 'medium' ? 700 : 1200;
    this.instancedMesh.count = Math.min(this.count, active);
  }

  public dispose(): void {
    this.scene.remove(this.instancedMesh);
    this.instancedMesh.geometry.dispose();
  }
}
