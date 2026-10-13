import * as THREE from 'three';
import { PhysicsWorld } from './physics';
import type RAPIER from '@dimforge/rapier3d-compat';

export interface CameraConfig {
  distance: number;
  minDistance: number;
  maxDistance: number;
  shoulderOffsetX: number;
  targetHeight: number;
  mouseSensitivity: number;
  pitchMin: number; // degrees
  pitchMax: number; // degrees
  damping: number;
}

export class ThirdPersonCamera {
  public camera: THREE.PerspectiveCamera;
  public config: CameraConfig = {
    distance: 3.8,
    minDistance: 1.5,
    maxDistance: 7.0,
    shoulderOffsetX: 0.55,
    targetHeight: 1.5,
    mouseSensitivity: 0.0022,
    pitchMin: -55,
    pitchMax: 75,
    damping: 18.0
  };

  public yaw = 0;   // Radians
  public pitch = 0.15; // Radians

  private currentCamPos = new THREE.Vector3();
  private currentLookTarget = new THREE.Vector3();
  private isFirstUpdate = true;

  // Camera Shake
  private trauma = 0;
  private shakeTimer = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );

    window.addEventListener('resize', this.onResize.bind(this));
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  public handleMouseMove(dx: number, dy: number): void {
    this.yaw -= dx * this.config.mouseSensitivity;

    // Pitch: positive dy moves mouse down -> pitch up or down?
    // In standard third-person, mouse moving up (negative dy) tilts camera up (positive pitch)
    this.pitch -= dy * this.config.mouseSensitivity;

    const minRad = THREE.MathUtils.degToRad(this.config.pitchMin);
    const maxRad = THREE.MathUtils.degToRad(this.config.pitchMax);
    this.pitch = Math.max(minRad, Math.min(maxRad, this.pitch));
  }

  public handleMouseWheel(deltaY: number): void {
    const zoomStep = deltaY * 0.003;
    this.config.distance = Math.max(
      this.config.minDistance,
      Math.min(this.config.maxDistance, this.config.distance + zoomStep)
    );
  }

  /**
   * Get horizontal forward vector (yaw only, y = 0) for character movement
   */
  public getForwardVector(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
  }

  /**
   * Get horizontal right vector (yaw only, y = 0) for character movement
   */
  public getRightVector(): THREE.Vector3 {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    physics: PhysicsWorld,
    playerCollider?: RAPIER.Collider
  ): void {
    // Calculate right vector based on current yaw
    const rightDir = this.getRightVector();

    // Pivot point at player's upper body / head with shoulder offset
    const shoulderPivot = new THREE.Vector3(
      playerPos.x + rightDir.x * this.config.shoulderOffsetX,
      playerPos.y + this.config.targetHeight,
      playerPos.z + rightDir.z * this.config.shoulderOffsetX
    );

    // Look direction vector
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const lookDir = new THREE.Vector3(
      -Math.sin(this.yaw) * cosPitch,
      sinPitch,
      -Math.cos(this.yaw) * cosPitch
    ).normalize();

    // Desired camera position without collision
    const desiredCamPos = shoulderPivot.clone().sub(lookDir.clone().multiplyScalar(this.config.distance));

    // Collision check: raycast from shoulderPivot to desiredCamPos
    const rayDir = desiredCamPos.clone().sub(shoulderPivot);
    const fullDist = rayDir.length();
    rayDir.normalize();

    let finalDistance = this.config.distance;
    const hit = physics.castRay(shoulderPivot, rayDir, fullDist, playerCollider);
    if (hit) {
      // Pull camera closer with a safety margin (at least 0.35m away from shoulder)
      const safeMargin = 0.25;
      finalDistance = Math.max(0.35, hit.distance - safeMargin);
    }

    const targetCamPos = shoulderPivot.clone().sub(lookDir.clone().multiplyScalar(finalDistance));
    const targetLookAt = shoulderPivot.clone().add(lookDir.clone().multiplyScalar(10.0));

    if (this.isFirstUpdate) {
      this.currentCamPos.copy(targetCamPos);
      this.currentLookTarget.copy(targetLookAt);
      this.isFirstUpdate = false;
    } else {
      // Smooth exponential damping
      const t = 1.0 - Math.exp(-this.config.damping * dt);
      this.currentCamPos.lerp(targetCamPos, t);
      this.currentLookTarget.lerp(targetLookAt, t);
    }

    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookTarget);

    // Apply additive camera trauma shake
    if (this.trauma > 0.001) {
      this.trauma = Math.max(0, this.trauma - dt * 2.2);
      this.shakeTimer += dt;
      const intensity = this.trauma * this.trauma;

      const shakeYaw = Math.sin(this.shakeTimer * 45) * 0.04 * intensity;
      const shakePitch = Math.cos(this.shakeTimer * 55) * 0.03 * intensity;
      const shakeY = Math.sin(this.shakeTimer * 35) * 0.08 * intensity;

      this.camera.position.y += shakeY;

      const shakenLook = this.currentLookTarget.clone();
      shakenLook.x += Math.cos(this.yaw) * shakeYaw * 10;
      shakenLook.y += shakePitch * 10;
      shakenLook.z += -Math.sin(this.yaw) * shakeYaw * 10;
      this.camera.lookAt(shakenLook);
    }
  }

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  public snapToTarget(playerPos: THREE.Vector3): void {
    const rightDir = this.getRightVector();
    const shoulderPivot = new THREE.Vector3(
      playerPos.x + rightDir.x * this.config.shoulderOffsetX,
      playerPos.y + this.config.targetHeight,
      playerPos.z + rightDir.z * this.config.shoulderOffsetX
    );
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const lookDir = new THREE.Vector3(
      -Math.sin(this.yaw) * cosPitch,
      sinPitch,
      -Math.cos(this.yaw) * cosPitch
    ).normalize();
    const targetCamPos = shoulderPivot.clone().sub(lookDir.clone().multiplyScalar(this.config.distance));
    const targetLookAt = shoulderPivot.clone().add(lookDir.clone().multiplyScalar(10.0));
    this.currentCamPos.copy(targetCamPos);
    this.currentLookTarget.copy(targetLookAt);
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookTarget);
  }
}
