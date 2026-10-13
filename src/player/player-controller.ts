import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../engine/physics';
import { CharacterVisual } from './silhouette';
import { MovementInput } from '../core/input';
import { ThirdPersonCamera } from '../engine/camera';
import { StateMachine, PlayerContext } from './stateMachine';
import { LocomotionState } from './states/locomotionState';
import { DodgeState } from './states/dodgeState';
import { AttackLightState } from './states/attackLightState';
import { AttackHeavyState } from './states/attackHeavyState';
import { HitReactState } from './states/hitReactState';
import { StaggerState } from './states/staggerState';
import { DeadState } from './states/deadState';
import { StaminaSystem } from '../combat/stamina';
import { HealthComponent, PoiseComponent } from '../combat/damage';
import { InputBuffer } from './inputBuffer';
import { AnimationController } from './animationController';
import { HitboxManager, HurtboxTarget } from '../combat/hitboxManager';
import { HitStopManager } from '../combat/gameFeel';
import { AssetManager } from '../assets/assetManager';
import {
  PlayerMovementConfig,
  PlayerCombatConfig,
  DEFAULT_MOVEMENT_CONFIG,
  DEFAULT_COMBAT_CONFIG
} from '../data/playerConfig';

export class PlayerController implements HurtboxTarget {
  public id = 'player';
  public isPlayer = true;

  // Configurations
  public config: PlayerMovementConfig = { ...DEFAULT_MOVEMENT_CONFIG };
  public combatConfig: PlayerCombatConfig = { ...DEFAULT_COMBAT_CONFIG };

  // Core Subsystems
  public visual: CharacterVisual;
  public anim: AnimationController;
  public stateMachine: StateMachine;
  public stamina: StaminaSystem;
  public health: HealthComponent;
  public poise: PoiseComponent;
  public inputBuffer: InputBuffer;

  // Rapier Physics
  public body!: RAPIER.RigidBody;
  public collider!: RAPIER.Collider;
  public characterController!: RAPIER.KinematicCharacterController;

  // Kinematic & Ground State
  public isGrounded = false;
  public currentSpeed = 0;
  public previousPos = new THREE.Vector3();
  public currentPos = new THREE.Vector3();
  public renderPos = new THREE.Vector3();

  public horizontalVel = new THREE.Vector3();
  public verticalVel = 0;
  public currentFacingAngle = 0;

  private spawnPosition = new THREE.Vector3(0, 1.5, 0);
  private readonly capsuleRadius = 0.35;
  private readonly capsuleHalfHeight = 0.55; // total height = 2*0.55 + 2*0.35 = 1.8m
  private readonly bodyCenterOffset = 0.9;

  private currentMovementInput: MovementInput = {
    forward: 0,
    right: 0,
    sprint: false,
    jump: false,
    dodge: false,
    lightAttack: false,
    heavyAttack: false
  };
  private currentCamera!: ThirdPersonCamera;
  private physicsWorld: PhysicsWorld;
  public currentCharacterId = 'player_test';

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.physicsWorld = physics;
    this.visual = new CharacterVisual();
    scene.add(this.visual.root);

    this.anim = new AnimationController(this.visual, scene, this.id);
    this.stamina = new StaminaSystem();
    this.health = new HealthComponent('player', this.combatConfig.maxHealth);
    this.poise = new PoiseComponent();
    this.inputBuffer = new InputBuffer();

    this.stateMachine = new StateMachine();
    this.setupStateMachine();
    this.initPhysics(physics);

    HitboxManager.getInstance().registerHurtbox(this);

    // Load initial character model from asset pipeline
    this.switchCharacter(this.currentCharacterId);

    // Dev hot-reload listener
    AssetManager.getInstance().onHotReload(() => {
      this.switchCharacter(this.currentCharacterId);
    });
  }

  public async switchCharacter(characterId: string): Promise<void> {
    this.currentCharacterId = characterId;
    try {
      const asset = await AssetManager.getInstance().loadCharacter(characterId);
      this.visual.setModel(asset.model);
      this.anim.setupCharacter(asset.model, asset.definition, asset.clips, asset.skeleton);
    } catch (err) {
      console.warn(`[PlayerController] Failed to switch character to "${characterId}":`, err);
    }
  }

  private setupStateMachine(): void {
    this.stateMachine.registerState(new LocomotionState());
    this.stateMachine.registerState(new DodgeState());
    this.stateMachine.registerState(new AttackLightState(1));
    this.stateMachine.registerState(new AttackLightState(2));
    this.stateMachine.registerState(new AttackLightState(3));
    this.stateMachine.registerState(new AttackHeavyState());
    this.stateMachine.registerState(new HitReactState());
    this.stateMachine.registerState(new StaggerState());
    this.stateMachine.registerState(new DeadState());

    // Initialize in locomotion state
    this.stateMachine.transitionTo('locomotion', this.getContext());
  }

  public getContext(): PlayerContext {
    return {
      movementConfig: this.config,
      combatConfig: this.combatConfig,
      stamina: this.stamina,
      health: this.health,
      poise: this.poise,
      inputBuffer: this.inputBuffer,
      anim: this.anim,
      camera: this.currentCamera,
      input: this.currentMovementInput,
      horizontalVel: this.horizontalVel,
      verticalVel: this.verticalVel,
      facingAngle: this.currentFacingAngle,
      isGrounded: this.isGrounded,
      currentPos: this.currentPos,
      setFacingAngle: (angle: number) => {
        this.currentFacingAngle = angle;
        this.visual.root.rotation.y = angle;
      },
      setHorizontalVel: (v: THREE.Vector3) => {
        this.horizontalVel.copy(v);
      },
      setVerticalVel: (vy: number) => {
        this.verticalVel = vy;
      },
      respawn: () => {
        this.respawn();
      }
    };
  }

  private initPhysics(physics: PhysicsWorld): void {
    const rapier = physics.rapier;
    const world = physics.world;

    const bodyDesc = rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(this.spawnPosition.x, this.spawnPosition.y, this.spawnPosition.z);
    this.body = world.createRigidBody(bodyDesc);

    const colliderDesc = rapier.ColliderDesc.capsule(this.capsuleHalfHeight, this.capsuleRadius)
      .setFriction(0.0)
      .setRestitution(0.0);
    this.collider = world.createCollider(colliderDesc, this.body);

    const skinOffset = 0.02;
    this.characterController = world.createCharacterController(skinOffset);
    this.applyControllerSettings();

    const t = this.body.translation();
    this.currentPos.set(t.x, t.y, t.z);
    this.previousPos.copy(this.currentPos);
    this.renderPos.copy(this.currentPos);
  }

  public applyControllerSettings(): void {
    this.characterController.enableAutostep(this.config.autostepHeight, 0.2, false);
    const maxSlopeRad = THREE.MathUtils.degToRad(this.config.maxSlopeAngle);
    this.characterController.setMaxSlopeClimbAngle(maxSlopeRad);
    this.characterController.setMinSlopeSlideAngle(maxSlopeRad + THREE.MathUtils.degToRad(5));
    this.characterController.enableSnapToGround(0.3);
    this.characterController.setSlideEnabled(true);
  }

  // HurtboxTarget implementation
  public getCenter(): THREE.Vector3 {
    return new THREE.Vector3(this.renderPos.x, this.renderPos.y, this.renderPos.z);
  }

  public getHalfExtents(): THREE.Vector3 {
    return new THREE.Vector3(0.4, 0.9, 0.4);
  }

  public isInvulnerable(): boolean {
    return this.combatConfig.godMode || this.stateMachine.isInvulnerable();
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
    if (this.isInvulnerable()) return;

    this.health.takeDamage(hit.damage);

    if (this.health.currentHp <= 0) {
      this.stateMachine.transitionTo('dead', this.getContext());
    } else {
      this.stateMachine.transitionTo('hit_react', this.getContext(), {
        knockback: hit.knockback,
        hitPoint: hit.hitPoint
      });
    }
  }

  public fixedUpdate(fixedDt: number, input: MovementInput, camera: ThirdPersonCamera): void {
    this.currentMovementInput = input;
    this.currentCamera = camera;

    // Check Hit-Stop freeze
    if (HitStopManager.getInstance().isActive()) {
      return; // Freeze attacker physics update
    }

    // Store previous position for render interpolation
    this.previousPos.copy(this.currentPos);

    // Update Input Buffer with current time
    const currentTime = performance.now() * 0.001;
    this.inputBuffer.update(currentTime);

    // Update Stamina regeneration
    this.stamina.update(fixedDt);

    // Update State Machine
    const ctx = this.getContext();
    this.stateMachine.update(fixedDt, ctx);

    // Apply gravity unless dead or airborne handled
    this.verticalVel += this.config.gravity * fixedDt;
    this.verticalVel = Math.max(this.verticalVel, -45.0);

    // Speed multiplier from state
    const speedMult = this.stateMachine.getSpeedMultiplier();
    this.currentSpeed = this.horizontalVel.length() * speedMult;

    // Calculate displacement for Rapier character controller
    const displacement = {
      x: this.horizontalVel.x * speedMult * fixedDt,
      y: this.verticalVel * fixedDt,
      z: this.horizontalVel.z * speedMult * fixedDt
    };

    // Compute collision response
    this.characterController.computeColliderMovement(this.collider, displacement);
    const computedMovement = this.characterController.computedMovement();
    this.isGrounded = this.characterController.computedGrounded();

    if (this.isGrounded && this.verticalVel < 0) {
      this.verticalVel = 0;
    }

    // Update kinematic rigid body position
    const t = this.body.translation();
    const nextX = t.x + computedMovement.x;
    const nextY = t.y + computedMovement.y;
    const nextZ = t.z + computedMovement.z;

    this.body.setNextKinematicTranslation({ x: nextX, y: nextY, z: nextZ });
    this.currentPos.set(nextX, nextY, nextZ);

    // Boundary check / Respawn
    if (this.currentPos.y < -30) {
      this.respawn();
    }
  }

  public respawn(): void {
    this.body.setTranslation(
      { x: this.spawnPosition.x, y: this.spawnPosition.y, z: this.spawnPosition.z },
      true
    );
    this.currentPos.copy(this.spawnPosition);
    this.previousPos.copy(this.spawnPosition);
    this.renderPos.copy(this.spawnPosition);
    this.horizontalVel.set(0, 0, 0);
    this.verticalVel = 0;
    this.isGrounded = false;
    this.health.reset();
    this.stamina.refill();
    this.poise.reset();
    this.stateMachine.transitionTo('locomotion', this.getContext());
  }

  public renderUpdate(alpha: number, dt: number): void {
    // Interpolate physics position for rendering
    this.renderPos.lerpVectors(this.previousPos, this.currentPos, alpha);

    // Position visual at player feet
    this.visual.root.position.set(
      this.renderPos.x,
      this.renderPos.y - this.bodyCenterOffset,
      this.renderPos.z
    );

    // Smoothly rotate character to face horizontal movement if rotation is not locked
    if (!this.stateMachine.isRotationLocked() && this.horizontalVel.lengthSq() > 0.1) {
      const targetAngle = Math.atan2(this.horizontalVel.x, this.horizontalVel.z);
      const angleDiff = Math.atan2(
        Math.sin(targetAngle - this.currentFacingAngle),
        Math.cos(targetAngle - this.currentFacingAngle)
      );
      const turnAmount = 1.0 - Math.exp(-this.config.rotationSpeed * dt);
      this.currentFacingAngle += angleDiff * turnAmount;
      this.visual.root.rotation.y = this.currentFacingAngle;
    }

    // Update animation controller (respects hit-stop)
    const effectiveDt = HitStopManager.getInstance().isActive() ? 0 : dt;
    this.anim.update(effectiveDt, {
      currentSpeed: this.currentSpeed,
      physics: this.physicsWorld,
      playerCollider: this.collider,
      stateContext: {
        isGrounded: this.isGrounded,
        isDodge: this.stateMachine.getCurrentStateId() === 'dodge',
        isAirborne: !this.isGrounded,
        isLunge: this.stateMachine.getCurrentStateId().startsWith('attack_')
      }
    });
  }
}
