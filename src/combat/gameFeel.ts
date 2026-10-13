import * as THREE from 'three';
import { EventBus } from './eventBus';

export class HitStopManager {
  private static instance: HitStopManager;
  public enabled = true;
  private hitStopTimer = 0;

  public static getInstance(): HitStopManager {
    if (!HitStopManager.instance) {
      HitStopManager.instance = new HitStopManager();
    }
    return HitStopManager.instance;
  }

  public trigger(duration: number): void {
    if (!this.enabled) return;
    this.hitStopTimer = Math.max(this.hitStopTimer, duration);
  }

  public update(dt: number): void {
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      if (this.hitStopTimer < 0) {
        this.hitStopTimer = 0;
      }
    }
  }

  public isActive(): boolean {
    return this.hitStopTimer > 0;
  }
}

export class ImpactVfxManager {
  private static instance: ImpactVfxManager;
  public enabled = true;
  private scene!: THREE.Scene;

  // Particle pool
  private readonly maxParticles = 200;
  private positions: Float32Array;
  private velocities: Float32Array;
  private lifetimes: Float32Array;
  private maxLifetimes: Float32Array;
  private colors: Float32Array;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private points: THREE.Points;
  private nextParticleIndex = 0;

  private constructor() {
    this.positions = new Float32Array(this.maxParticles * 3);
    this.velocities = new Float32Array(this.maxParticles * 3);
    this.lifetimes = new Float32Array(this.maxParticles);
    this.maxLifetimes = new Float32Array(this.maxParticles);
    this.colors = new Float32Array(this.maxParticles * 3);

    for (let i = 0; i < this.maxParticles; i++) {
      this.lifetimes[i] = -1; // Inactive
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.material = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  public static getInstance(): ImpactVfxManager {
    if (!ImpactVfxManager.instance) {
      ImpactVfxManager.instance = new ImpactVfxManager();
    }
    return ImpactVfxManager.instance;
  }

  public init(scene: THREE.Scene): void {
    this.scene = scene;
    this.scene.add(this.points);

    // Listen to hit events
    EventBus.getInstance().on('hit', (e) => {
      this.burst(e.hitPoint, e.isHeavy ? 30 : 18, e.isHeavy ? 0xffcc44 : 0x7aa2f7);
    });
  }

  public burst(pos: { x: number; y: number; z: number }, count = 20, hexColor = 0xffe066): void {
    if (!this.enabled) return;

    const col = new THREE.Color(hexColor);

    for (let i = 0; i < count; i++) {
      const idx = this.nextParticleIndex;
      this.nextParticleIndex = (this.nextParticleIndex + 1) % this.maxParticles;

      // Position at contact
      this.positions[idx * 3] = pos.x + (Math.random() - 0.5) * 0.1;
      this.positions[idx * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.1;
      this.positions[idx * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.1;

      // Random spherical velocity with upward bias
      const speed = 2.5 + Math.random() * 4.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      this.velocities[idx * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      this.velocities[idx * 3 + 1] = Math.abs(Math.cos(phi)) * speed * 0.8 + 1.2;
      this.velocities[idx * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;

      const life = 0.25 + Math.random() * 0.2;
      this.lifetimes[idx] = life;
      this.maxLifetimes[idx] = life;

      this.colors[idx * 3] = col.r;
      this.colors[idx * 3 + 1] = col.g;
      this.colors[idx * 3 + 2] = col.b;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  public update(dt: number): void {
    let hasActive = false;
    const gravity = -14.0;

    for (let i = 0; i < this.maxParticles; i++) {
      if (this.lifetimes[i] > 0) {
        hasActive = true;
        this.lifetimes[i] -= dt;

        if (this.lifetimes[i] <= 0) {
          this.lifetimes[i] = -1;
          // Hide particle off-screen
          this.positions[i * 3 + 1] = -9999;
          continue;
        }

        // Apply velocity & gravity
        this.velocities[i * 3 + 1] += gravity * dt;
        this.positions[i * 3] += this.velocities[i * 3] * dt;
        this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
        this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;

        // Fade color towards white/smoke
        const lifeRatio = this.lifetimes[i] / this.maxLifetimes[i];
        this.colors[i * 3] *= lifeRatio;
        this.colors[i * 3 + 1] *= lifeRatio;
        this.colors[i * 3 + 2] *= lifeRatio;
      }
    }

    if (hasActive) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
    }
  }
}
