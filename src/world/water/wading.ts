import * as THREE from 'three';
import { PlayerController } from '../../player/player-controller';
import { RegionData } from '../../data/regions/schema';

export interface ActiveRipple {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
}

export class WadingSystem {
  public scene: THREE.Scene;
  public player: PlayerController;
  public region: RegionData;

  private ripples: ActiveRipple[] = [];
  private ripplePool: THREE.Mesh[] = [];
  private rippleSpawnTimer = 0;
  private ringMaterial: THREE.MeshBasicMaterial;

  public isWading = false;

  constructor(scene: THREE.Scene, player: PlayerController, region: RegionData) {
    this.scene = scene;
    this.player = player;
    this.region = region;

    // Soft glowing cyan ripple ring canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);

    ctx.strokeStyle = '#38e8ec';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);

    this.ringMaterial = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // Pre-allocate 16 pooled ripple meshes
    const ringGeo = new THREE.PlaneGeometry(1.0, 1.0);
    ringGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(ringGeo, this.ringMaterial.clone());
      mesh.visible = false;
      this.scene.add(mesh);
      this.ripplePool.push(mesh);
    }
  }

  public update(dt: number): void {
    const playerPos = this.player.renderPos;
    const waterLevel = this.region.water.level;

    // Check if player is inside any water body bounding radius and submerged below water surface
    let insideBody = false;
    for (const body of this.region.water.bodies) {
      const dx = playerPos.x - body.centerX;
      const dz = playerPos.z - body.centerZ;
      if (dx * dx + dz * dz <= body.radius * body.radius) {
        insideBody = true;
        break;
      }
    }

    const isSubmerged = playerPos.y <= waterLevel + 0.2;
    this.isWading = insideBody && isSubmerged;

    if (this.isWading) {
      // Apply shallow water speed penalty
      this.player.speedModifier = this.region.water.shallowSpeedMultiplier;

      // Spawn ripples while player is moving
      const speed = this.player.horizontalVel.length();
      if (speed > 0.4) {
        this.rippleSpawnTimer += dt;
        const spawnInterval = 1.0 / this.region.water.rippleFrequency;
        if (this.rippleSpawnTimer >= spawnInterval) {
          this.rippleSpawnTimer = 0;
          this.spawnRipple(playerPos.x, waterLevel + 0.02, playerPos.z);
        }
      }
    } else {
      this.player.speedModifier = 1.0;
    }

    // Update active ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.age += dt;
      const progress = r.age / r.maxAge;

      if (progress >= 1.0) {
        r.mesh.visible = false;
        this.ripplePool.push(r.mesh);
        this.ripples.splice(i, 1);
      } else {
        const currentScale = THREE.MathUtils.lerp(r.startScale, r.endScale, progress);
        r.mesh.scale.set(currentScale, 1.0, currentScale);
        const mat = r.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = (1.0 - progress) * 0.75;
      }
    }
  }

  private spawnRipple(x: number, y: number, z: number): void {
    if (this.ripplePool.length === 0) return;

    const mesh = this.ripplePool.pop()!;
    mesh.position.set(x, y, z);
    mesh.scale.set(0.6, 1.0, 0.6);
    mesh.visible = true;

    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.75;

    this.ripples.push({
      mesh,
      age: 0,
      maxAge: 1.2,
      startScale: 0.6,
      endScale: 2.8
    });
  }

  public dispose(): void {
    for (const r of this.ripples) {
      this.scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      (r.mesh.material as THREE.Material).dispose();
    }
    for (const mesh of this.ripplePool) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.ringMaterial.dispose();
    this.ripples = [];
    this.ripplePool = [];
  }
}
