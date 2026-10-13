import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../engine/physics';
import { EventBus } from '../combat/eventBus';
import { HitboxManager, HurtboxTarget } from '../combat/hitboxManager';
import { HealthComponent, PoiseComponent } from '../combat/damage';

export class TrainingDummy implements HurtboxTarget {
  public static sparringModeEnabled = false;

  public id: string;
  public isPlayer = false;
  public position: THREE.Vector3;
  public root: THREE.Group;
  public pivotGroup: THREE.Group;
  public health: HealthComponent;
  public poise: PoiseComponent;

  private scene: THREE.Scene;
  private physics: PhysicsWorld;
  public collider!: RAPIER.Collider;

  // Visual meshes for materials & flash
  private meshes: THREE.Mesh[] = [];
  private originalEmissives: { mesh: THREE.Mesh; emissive: THREE.Color; intensity: number }[] = [];
  private flashTimer = 0;

  // Spring wobble physics
  private tiltX = 0;
  private tiltZ = 0;
  private tiltVelX = 0;
  private tiltVelZ = 0;
  private readonly springK = 55.0;
  private readonly springDamping = 8.5;

  // Reset timer (5s without damage -> reset)
  private noDamageTimer = 0;
  private isDamaged = false;

  // Stagger state
  public isStaggered = false;
  private staggerTimer = 0;

  // Sparring Mode
  private sparringTimer = 0;
  private sparringState: 'idle' | 'windup' | 'active' | 'recovery' = 'idle';
  private sparringInterval = 3.6;
  private windupDuration = 0.5;
  private activeDuration = 0.15;
  private recoveryDuration = 0.6;
  private telegraphLight!: THREE.PointLight;
  private weaponArm!: THREE.Mesh;

  private facingAngle = 0; // facing direction towards player or default
  private eventBus = EventBus.getInstance();

  constructor(
    id: string,
    position: THREE.Vector3,
    scene: THREE.Scene,
    physics: PhysicsWorld,
    facingAngle = 0
  ) {
    this.id = id;
    this.position = position.clone();
    this.scene = scene;
    this.physics = physics;
    this.facingAngle = facingAngle;

    this.health = new HealthComponent(id, 300);
    this.poise = new PoiseComponent({ maxPoise: 60, decayRate: 15, decayDelay: 2.0 });

    this.root = new THREE.Group();
    this.root.position.copy(this.position);
    this.root.rotation.y = this.facingAngle;

    this.pivotGroup = new THREE.Group();
    this.root.add(this.pivotGroup);

    this.buildMesh();
    this.initPhysics();

    this.scene.add(this.root);
    HitboxManager.getInstance().registerHurtbox(this);
  }

  private buildMesh(): THREE.Group {
    // Materials
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5d4037,
      roughness: 0.8,
      metalness: 0.1
    });

    const strawMat = new THREE.MeshStandardMaterial({
      color: 0xd7ccc8,
      roughness: 0.9,
      metalness: 0.05
    });

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x78909c,
      roughness: 0.4,
      metalness: 0.7
    });

    const redClothMat = new THREE.MeshStandardMaterial({
      color: 0xb71c1c,
      roughness: 0.7,
      metalness: 0.1
    });

    // 1. Base Stand (ground mount)
    const baseGeo = new THREE.CylinderGeometry(0.45, 0.55, 0.2, 16);
    const baseMesh = new THREE.Mesh(baseGeo, woodMat);
    baseMesh.position.y = 0.1;
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    this.root.add(baseMesh); // stays grounded, doesn't wobble

    // 2. Central Post (pivots above base)
    const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.8, 12);
    const postMesh = new THREE.Mesh(postGeo, woodMat);
    postMesh.position.y = 0.9;
    postMesh.castShadow = true;
    postMesh.receiveShadow = true;
    this.pivotGroup.add(postMesh);
    this.registerMeshForFlash(postMesh);

    // 3. Torso (Burlap sack / straw dummy body)
    const torsoGeo = new THREE.CapsuleGeometry(0.34, 0.65, 8, 16);
    const torsoMesh = new THREE.Mesh(torsoGeo, strawMat);
    torsoMesh.position.y = 1.15;
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.pivotGroup.add(torsoMesh);
    this.registerMeshForFlash(torsoMesh);

    // Red sash around torso
    const sashGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 16);
    const sashMesh = new THREE.Mesh(sashGeo, redClothMat);
    sashMesh.position.y = 1.05;
    sashMesh.castShadow = true;
    this.pivotGroup.add(sashMesh);
    this.registerMeshForFlash(sashMesh);

    // 4. Horizontal Crossbar (Wooden arms)
    const barGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.4, 12);
    const barMesh = new THREE.Mesh(barGeo, woodMat);
    barMesh.rotation.z = Math.PI / 2;
    barMesh.position.y = 1.35;
    barMesh.castShadow = true;
    this.pivotGroup.add(barMesh);
    this.registerMeshForFlash(barMesh);

    // 5. Head with metal bucket / helmet
    const headGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const headMesh = new THREE.Mesh(headGeo, strawMat);
    headMesh.position.y = 1.72;
    headMesh.castShadow = true;
    this.pivotGroup.add(headMesh);
    this.registerMeshForFlash(headMesh);

    // Helmet
    const helmGeo = new THREE.CylinderGeometry(0.25, 0.26, 0.28, 16);
    const helmMesh = new THREE.Mesh(helmGeo, metalMat);
    helmMesh.position.y = 1.82;
    helmMesh.castShadow = true;
    this.pivotGroup.add(helmMesh);
    this.registerMeshForFlash(helmMesh);

    // 6. Sparring Weapon Stick attached to right crossbar
    const stickGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8);
    const stickMat = new THREE.MeshStandardMaterial({
      color: 0xef5350,
      emissive: 0x000000,
      emissiveIntensity: 0.0,
      roughness: 0.5
    });
    this.weaponArm = new THREE.Mesh(stickGeo, stickMat);
    this.weaponArm.position.set(0.65, 1.35, 0.4);
    this.weaponArm.rotation.x = Math.PI * 0.4;
    this.weaponArm.castShadow = true;
    this.pivotGroup.add(this.weaponArm);
    this.registerMeshForFlash(this.weaponArm);

    // Sparring telegraph warning light
    this.telegraphLight = new THREE.PointLight(0xff3300, 0, 4.0);
    this.telegraphLight.position.set(0, 1.8, 0.4);
    this.pivotGroup.add(this.telegraphLight);

    return this.root;
  }

  private registerMeshForFlash(mesh: THREE.Mesh): void {
    this.meshes.push(mesh);
    const mat = mesh.material as THREE.MeshStandardMaterial;
    this.originalEmissives.push({
      mesh,
      emissive: mat.emissive.clone(),
      intensity: mat.emissiveIntensity
    });
  }

  private initPhysics(): void {
    // Static Rapier cylinder collider (radius 0.45, halfHeight 0.95, center at y = 0.95)
    this.collider = this.physics.createStaticCylinder(
      0.95,
      0.45,
      this.position.x,
      this.position.y + 0.95,
      this.position.z
    );
  }

  public getCenter(): THREE.Vector3 {
    return new THREE.Vector3(this.position.x, this.position.y + 1.15, this.position.z);
  }

  public getHalfExtents(): THREE.Vector3 {
    return new THREE.Vector3(0.55, 0.95, 0.55);
  }

  public isInvulnerable(): boolean {
    return false;
  }

  public onHit(hit: {
    attackerId: string;
    damage: number;
    poiseDamage: number;
    stagger: boolean;
    knockback: number;
    hitPoint: THREE.Vector3;
    isHeavy: boolean;
  }): void {
    // 1. Take damage
    const actualDamage = this.health.takeDamage(hit.damage);
    this.isDamaged = true;
    this.noDamageTimer = 5.0; // Reset 5s recovery window

    // 2. Poise damage & stagger check
    const poiseBroken = this.poise.takePoiseDamage(hit.poiseDamage, hit.stagger);
    if (poiseBroken || hit.stagger) {
      this.triggerStagger(hit.isHeavy ? 1.4 : 1.0);
      this.eventBus.emit('dummyPoiseBreak', { dummyId: this.id });
    }

    // 3. Trigger white flash
    this.flashTimer = 0.09; // 5-6 frames
    this.setFlashColor(0xffffff, 2.5);

    // 4. Spring wobble physics impulse
    // Calculate knockback direction in local dummy space
    const impulse = Math.min(12.0, hit.knockback * 1.8);
    // Knock away from hit point towards dummy center
    const hitDir = this.getCenter().sub(hit.hitPoint).normalize();

    this.tiltVelX += hitDir.z * impulse * 0.8;
    this.tiltVelZ -= hitDir.x * impulse * 0.8;

    // 5. Emit event for HUD floating combat text
    this.eventBus.emit('dummyDamaged', {
      dummyId: this.id,
      damage: actualDamage,
      currentHp: this.health.currentHp,
      maxHp: this.health.maxHp,
      position: { x: this.position.x, y: this.position.y + 1.6, z: this.position.z }
    });
  }

  private triggerStagger(duration = 1.0): void {
    this.isStaggered = true;
    this.staggerTimer = duration;
    this.sparringState = 'idle';
    this.sparringTimer = 0;
    this.telegraphLight.intensity = 0;
    if (this.weaponArm.material instanceof THREE.MeshStandardMaterial) {
      this.weaponArm.material.emissive.setHex(0x000000);
      this.weaponArm.material.emissiveIntensity = 0;
    }
  }

  private setFlashColor(hex: number, intensity: number): void {
    for (const item of this.originalEmissives) {
      const mat = item.mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(hex);
      mat.emissiveIntensity = intensity;
    }
  }

  private resetFlashColor(): void {
    for (const item of this.originalEmissives) {
      const mat = item.mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.copy(item.emissive);
      mat.emissiveIntensity = item.intensity;
    }
  }

  public update(dt: number, playerPos: THREE.Vector3): void {
    // 1. Flash update
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.resetFlashColor();
      }
    }

    // 2. Poise decay
    this.poise.update(dt);

    // 3. Stagger state
    if (this.isStaggered) {
      this.staggerTimer -= dt;
      if (this.staggerTimer <= 0) {
        this.isStaggered = false;
        this.poise.reset();
      }
    }

    // 4. Spring wobble physics (Damped harmonic oscillator)
    // Accel = -k * x - damping * v
    const accelX = -this.springK * this.tiltX - this.springDamping * this.tiltVelX;
    const accelZ = -this.springK * this.tiltZ - this.springDamping * this.tiltVelZ;

    this.tiltVelX += accelX * dt;
    this.tiltVelZ += accelZ * dt;

    this.tiltX += this.tiltVelX * dt;
    this.tiltZ += this.tiltVelZ * dt;

    // Apply wobble rotation to pivotGroup
    let extraStaggerTilt = 0;
    if (this.isStaggered) {
      extraStaggerTilt = 0.35 * Math.min(1.0, this.staggerTimer);
    }
    this.pivotGroup.rotation.x = this.tiltX + extraStaggerTilt;
    this.pivotGroup.rotation.z = this.tiltZ;

    // 5. Auto-heal and reset after 5s of no damage
    if (this.isDamaged) {
      this.noDamageTimer -= dt;
      if (this.noDamageTimer <= 0) {
        this.reset();
      }
    }

    // 6. Sparring Mode (Telegraphed swing to test player i-frames)
    if (TrainingDummy.sparringModeEnabled && !this.isStaggered) {
      this.updateSparring(dt, playerPos);
    } else {
      this.telegraphLight.intensity = 0;
    }
  }

  private updateSparring(dt: number, playerPos: THREE.Vector3): void {
    // Turn dummy towards player if within 8 meters
    const toPlayer = new THREE.Vector3(playerPos.x - this.position.x, 0, playerPos.z - this.position.z);
    const distToPlayer = toPlayer.length();

    if (distToPlayer <= 8.0 && this.sparringState === 'idle') {
      toPlayer.normalize();
      this.facingAngle = Math.atan2(toPlayer.x, toPlayer.z);
      this.root.rotation.y = this.facingAngle;
    }

    this.sparringTimer += dt;

    switch (this.sparringState) {
      case 'idle': {
        if (this.sparringTimer >= this.sparringInterval && distToPlayer <= 5.0) {
          // Enter Windup telegraph
          this.sparringState = 'windup';
          this.sparringTimer = 0;
        }
        break;
      }

      case 'windup': {
        // 0.5s windup glow: weapon arm raises high and glows warning orange/red
        const progress = Math.min(1.0, this.sparringTimer / this.windupDuration);
        this.telegraphLight.intensity = progress * 3.5;
        this.weaponArm.rotation.x = Math.PI * 0.4 - progress * 1.2; // raise stick back

        const armMat = this.weaponArm.material as THREE.MeshStandardMaterial;
        armMat.emissive.setHex(0xff3300);
        armMat.emissiveIntensity = progress * 2.0;

        if (this.sparringTimer >= this.windupDuration) {
          // Enter Active swing
          this.sparringState = 'active';
          this.sparringTimer = 0;
        }
        break;
      }

      case 'active': {
        // Active swing hitbox for 0.15s
        const progress = Math.min(1.0, this.sparringTimer / this.activeDuration);
        this.weaponArm.rotation.x = (Math.PI * 0.4 - 1.2) + progress * 2.2; // swing down and forward

        // Query swing against player hurtbox
        HitboxManager.getInstance().queryDummySwing(
          this.id,
          this.position,
          this.facingAngle,
          15, // Damage
          4.5 // Knockback
        );

        if (this.sparringTimer >= this.activeDuration) {
          this.sparringState = 'recovery';
          this.sparringTimer = 0;
          this.telegraphLight.intensity = 0;
        }
        break;
      }

      case 'recovery': {
        const progress = Math.min(1.0, this.sparringTimer / this.recoveryDuration);
        const ease = 1.0 - progress;
        this.weaponArm.rotation.x = Math.PI * 0.4 + ease * 0.5;

        const armMat = this.weaponArm.material as THREE.MeshStandardMaterial;
        armMat.emissiveIntensity = ease * 0.5;

        if (this.sparringTimer >= this.recoveryDuration) {
          this.sparringState = 'idle';
          this.sparringTimer = 0;
          armMat.emissive.setHex(0x000000);
          armMat.emissiveIntensity = 0;
        }
        break;
      }
    }
  }

  public reset(): void {
    this.health.reset();
    this.poise.reset();
    this.isDamaged = false;
    this.isStaggered = false;
    this.noDamageTimer = 0;
    this.tiltX = 0;
    this.tiltZ = 0;
    this.tiltVelX = 0;
    this.tiltVelZ = 0;
    this.sparringState = 'idle';
    this.sparringTimer = 0;
    this.telegraphLight.intensity = 0;
    this.resetFlashColor();

    this.eventBus.emit('dummyReset', { dummyId: this.id });
  }

  public dispose(): void {
    HitboxManager.getInstance().unregisterHurtbox(this.id);
    this.scene.remove(this.root);
  }
}
