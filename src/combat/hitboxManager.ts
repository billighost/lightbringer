import * as THREE from 'three';
import { AttackConfig } from '../data/attacks';
import { EventBus } from './eventBus';

export interface HurtboxTarget {
  id: string;
  isPlayer: boolean;
  getCenter(): THREE.Vector3;
  getHalfExtents(): THREE.Vector3;
  isInvulnerable(): boolean;
  onHit(hit: {
    attackerId: string;
    damage: number;
    poiseDamage: number;
    stagger: boolean;
    knockback: number;
    hitPoint: THREE.Vector3;
    isHeavy: boolean;
  }): void;
}

export class HitboxManager {
  private static instance: HitboxManager;
  private scene!: THREE.Scene;
  private hurtboxes: Map<string, HurtboxTarget> = new Map();
  private eventBus = EventBus.getInstance();

  // Debug visualizer
  public debugVisible = false;
  private debugGroup: THREE.Group = new THREE.Group();
  private activeHitboxMesh: THREE.Mesh;
  private hurtboxMeshes: Map<string, THREE.Mesh> = new Map();

  // Active swing tracking: swingId -> set of already hit targetIds
  private hitTargetsPerSwing: Map<string, Set<string>> = new Map();

  // Current active hitbox state
  public isHitboxActive = false;

  private constructor() {
    // Red translucent box for active hitbox
    const redMat = new THREE.MeshBasicMaterial({
      color: 0xff3344,
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
    const redBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.activeHitboxMesh = new THREE.Mesh(redBoxGeo, redMat);
    this.activeHitboxMesh.visible = false;
    this.debugGroup.add(this.activeHitboxMesh);
  }

  public static getInstance(): HitboxManager {
    if (!HitboxManager.instance) {
      HitboxManager.instance = new HitboxManager();
    }
    return HitboxManager.instance;
  }

  public init(scene: THREE.Scene): void {
    this.scene = scene;
    this.scene.add(this.debugGroup);
  }

  public registerHurtbox(target: HurtboxTarget): void {
    this.hurtboxes.set(target.id, target);

    // Create green wireframe mesh for hurtbox debug
    const greenMat = new THREE.MeshBasicMaterial({
      color: 0x33ff66,
      wireframe: true,
      transparent: true,
      opacity: 0.6
    });
    const dims = target.getHalfExtents();
    const geo = new THREE.BoxGeometry(dims.x * 2, dims.y * 2, dims.z * 2);
    const mesh = new THREE.Mesh(geo, greenMat);
    mesh.visible = this.debugVisible;
    this.debugGroup.add(mesh);
    this.hurtboxMeshes.set(target.id, mesh);
  }

  public unregisterHurtbox(id: string): void {
    this.hurtboxes.delete(id);
    const mesh = this.hurtboxMeshes.get(id);
    if (mesh) {
      this.debugGroup.remove(mesh);
      mesh.geometry.dispose();
      this.hurtboxMeshes.delete(id);
    }
  }

  public setDebugVisible(visible: boolean): void {
    this.debugVisible = visible;
    this.debugGroup.visible = visible;
    this.hurtboxMeshes.forEach((mesh) => {
      mesh.visible = visible;
    });
    if (!visible) {
      this.activeHitboxMesh.visible = false;
    }
  }

  /**
   * Start a new swing. Returns unique swing ID.
   */
  public startSwing(prefix: string): string {
    const swingId = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.hitTargetsPerSwing.set(swingId, new Set());
    return swingId;
  }

  public endSwing(swingId: string): void {
    this.hitTargetsPerSwing.delete(swingId);
    this.isHitboxActive = false;
    this.activeHitboxMesh.visible = false;
  }

  /**
   * Perform hit query for an attack during active frame
   */
  public queryAttackHit(
    attackerId: string,
    swingId: string,
    attackerPos: THREE.Vector3,
    attackerFacingAngle: number,
    attack: AttackConfig
  ): HurtboxTarget[] {
    const hitSet = this.hitTargetsPerSwing.get(swingId);
    if (!hitSet) return [];

    this.isHitboxActive = true;

    // Transform attack hitbox local shape to world space
    const shape = attack.hitboxShape;
    const half = shape.halfExtents;
    const offset = shape.offset;

    // Local offset rotated by facing angle around Y axis
    const cosA = Math.cos(attackerFacingAngle);
    const sinA = Math.sin(attackerFacingAngle);

    const worldOffsetX = offset.x * cosA + offset.z * sinA;
    const worldOffsetY = offset.y;
    const worldOffsetZ = -offset.x * sinA + offset.z * cosA;

    const hitboxCenter = new THREE.Vector3(
      attackerPos.x + worldOffsetX,
      attackerPos.y + worldOffsetY,
      attackerPos.z + worldOffsetZ
    );

    // Update debug hitbox mesh
    if (this.debugVisible) {
      this.activeHitboxMesh.visible = true;
      this.activeHitboxMesh.scale.set(half.x * 2, half.y * 2, half.z * 2);
      this.activeHitboxMesh.position.copy(hitboxCenter);
      this.activeHitboxMesh.rotation.y = attackerFacingAngle;
    }

    // World AABB or OBB check against targets
    const hitsThisTick: HurtboxTarget[] = [];

    this.hurtboxes.forEach((target) => {
      if (target.id === attackerId) return; // Cannot hit self
      if (hitSet.has(target.id)) return;    // Hit at most once per swing!

      const targetCenter = target.getCenter();
      const targetHalf = target.getHalfExtents();

      // Check distance in horizontal plane and vertical tolerance
      const toTarget = targetCenter.clone().sub(hitboxCenter);

      // Rotate toTarget by -facingAngle into hitbox local space
      const localX = toTarget.x * cosA - toTarget.z * sinA;
      const localY = toTarget.y;
      const localZ = toTarget.x * sinA + toTarget.z * cosA;

      // Box overlap test:
      const maxOverlapX = half.x + targetHalf.x;
      const maxOverlapY = half.y + targetHalf.y;
      const maxOverlapZ = half.z + targetHalf.z;

      if (
        Math.abs(localX) <= maxOverlapX &&
        Math.abs(localY) <= maxOverlapY &&
        Math.abs(localZ) <= maxOverlapZ
      ) {
        // Overlap confirmed!
        hitSet.add(target.id);
        hitsThisTick.push(target);

        // Approximate contact point on surface
        const contactPoint = targetCenter.clone().add(hitboxCenter).multiplyScalar(0.5);

        target.onHit({
          attackerId,
          damage: attack.damage,
          poiseDamage: attack.poiseDamage,
          stagger: attack.staggerOnHit,
          knockback: attack.knockback,
          hitPoint: contactPoint,
          isHeavy: attack.id === 'heavy'
        });

        this.eventBus.emit('hit', {
          attackerId,
          targetId: target.id,
          damage: attack.damage,
          poiseDamage: attack.poiseDamage,
          hitPoint: { x: contactPoint.x, y: contactPoint.y, z: contactPoint.z },
          isHeavy: attack.id === 'heavy',
          stagger: attack.staggerOnHit
        });
      }
    });

    return hitsThisTick;
  }

  /**
   * Sparring dummy attack query against player hurtbox
   */
  public queryDummySwing(
    dummyId: string,
    dummyPos: THREE.Vector3,
    dummyFacingAngle: number,
    damage: number,
    knockback: number
  ): boolean {
    const reach = 1.6;
    const forwardX = Math.sin(dummyFacingAngle);
    const forwardZ = Math.cos(dummyFacingAngle);

    const hitboxCenter = new THREE.Vector3(
      dummyPos.x + forwardX * (reach * 0.7),
      dummyPos.y + 1.2,
      dummyPos.z + forwardZ * (reach * 0.7)
    );

    if (this.debugVisible) {
      this.activeHitboxMesh.visible = true;
      this.activeHitboxMesh.scale.set(1.4, 1.2, reach);
      this.activeHitboxMesh.position.copy(hitboxCenter);
      this.activeHitboxMesh.rotation.y = dummyFacingAngle;
    }

    let hitPlayer = false;
    this.hurtboxes.forEach((target) => {
      if (!target.isPlayer) return;

      const pCenter = target.getCenter();
      const dist = pCenter.distanceTo(hitboxCenter);
      if (dist <= 1.6) {
        if (target.isInvulnerable()) {
          // Player is inside dodge i-frames! Avoided!
          this.eventBus.emit('dodged', {
            position: { x: pCenter.x, y: pCenter.y, z: pCenter.z }
          });
        } else {
          target.onHit({
            attackerId: dummyId,
            damage,
            poiseDamage: 25,
            stagger: false,
            knockback,
            hitPoint: pCenter.clone(),
            isHeavy: false
          });
          hitPlayer = true;
        }
      }
    });

    return hitPlayer;
  }

  public updateDebug(): void {
    if (!this.debugVisible) return;

    // Update hurtbox positions
    this.hurtboxes.forEach((target, id) => {
      const mesh = this.hurtboxMeshes.get(id);
      if (mesh) {
        mesh.position.copy(target.getCenter());
      }
    });
  }
}
