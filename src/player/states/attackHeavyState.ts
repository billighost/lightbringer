import * as THREE from 'three';
import { PlayerState, PlayerStateId, PlayerContext } from '../stateMachine';
import { ATTACKS, AttackConfig } from '../../data/attacks';
import { HitboxManager } from '../../combat/hitboxManager';
import { HitStopManager } from '../../combat/gameFeel';
import { BufferedActionType } from '../inputBuffer';
import { EventBus } from '../../combat/eventBus';

export class AttackHeavyState implements PlayerState {
  public id: PlayerStateId = 'attack_heavy';
  public speedMultiplier = 0.05;
  public rotationLock = true;
  public isInvulnerable = false;

  private attackConfig: AttackConfig;
  private timer = 0;
  private totalDuration = 1.31;
  private swingId = '';
  private lungeDir = new THREE.Vector3();
  private hasHitTarget = false;
  private activeFromAnimEvent: boolean | null = null;
  private eventUnsub: (() => void) | null = null;

  constructor() {
    this.attackConfig = ATTACKS.heavy;
  }

  public enter(ctx: PlayerContext): void {
    this.timer = 0;
    this.hasHitTarget = false;
    this.activeFromAnimEvent = null;
    this.attackConfig = ATTACKS.heavy;
    this.totalDuration = this.attackConfig.startup + this.attackConfig.active + this.attackConfig.recovery;
    this.speedMultiplier = this.attackConfig.moveSpeedMultiplier;

    ctx.stamina.setRegenPaused(true);

    this.eventUnsub = EventBus.getInstance().on('animationEvent', (e) => {
      if (e.entityId !== 'player') return;
      if (e.eventName === 'hitboxOn') {
        this.activeFromAnimEvent = true;
      } else if (e.eventName === 'hitboxOff') {
        this.activeFromAnimEvent = false;
      }
    });

    // Initial facing calculation with aim assist
    const forwardVec = ctx.camera.getForwardVector();
    const rightVec = ctx.camera.getRightVector();

    const aimDir = new THREE.Vector3();
    if (ctx.input.forward !== 0 || ctx.input.right !== 0) {
      aimDir.addScaledVector(forwardVec, ctx.input.forward);
      aimDir.addScaledVector(rightVec, ctx.input.right);
      aimDir.normalize();
    } else {
      aimDir.copy(forwardVec);
    }

    const assistedDir = this.applyAimAssist(ctx.currentPos, aimDir, ctx.combatConfig);
    this.lungeDir.copy(assistedDir);

    const targetFacing = Math.atan2(assistedDir.x, assistedDir.z);
    ctx.setFacingAngle(targetFacing);

    // Start swing
    this.swingId = HitboxManager.getInstance().startSwing('player_heavy');

    // Play animation
    ctx.anim.play(this.attackConfig.animationName, this.totalDuration);
  }

  public exit(ctx: PlayerContext): void {
    if (this.eventUnsub) {
      this.eventUnsub();
      this.eventUnsub = null;
    }
    HitboxManager.getInstance().endSwing(this.swingId);
    ctx.anim.setTrailActive(false);
    ctx.stamina.setRegenPaused(false);
  }

  public canTransitionTo(targetState: PlayerStateId): boolean {
    if (targetState === 'dead') return true;
    if (targetState === 'hit_react' || targetState === 'stagger') return true;

    const startup = this.attackConfig.startup;
    const activeEnd = startup + this.attackConfig.active;

    // Dodge cancel allowed only during recovery
    if (targetState === 'dodge') {
      return this.timer >= activeEnd;
    }

    return this.timer >= this.totalDuration;
  }

  public canCancelInto(action: BufferedActionType): boolean {
    const activeEnd = this.attackConfig.startup + this.attackConfig.active;
    return action === 'dodge' && this.timer >= activeEnd;
  }

  public update(fixedDt: number, ctx: PlayerContext): PlayerStateId | null {
    this.timer += fixedDt;

    const startup = this.attackConfig.startup;
    const activeEnd = startup + this.attackConfig.active;
    const isActive = this.activeFromAnimEvent !== null
      ? this.activeFromAnimEvent
      : (this.timer >= startup && this.timer <= activeEnd);

    // A. Active hitbox phase
    if (isActive) {
      this.rotationLock = true;

      // Heavy forward lunge velocity
      const lungeSpeed = this.attackConfig.lungeDistance / Math.max(0.01, this.attackConfig.active);
      ctx.setHorizontalVel(this.lungeDir.clone().multiplyScalar(lungeSpeed));

      // Query hitbox
      const hits = HitboxManager.getInstance().queryAttackHit(
        'player',
        this.swingId,
        ctx.currentPos,
        ctx.facingAngle,
        this.attackConfig
      );

      if (hits.length > 0 && !this.hasHitTarget) {
        this.hasHitTarget = true;
        // Trigger Hit-stop & Heavy Camera Shake
        HitStopManager.getInstance().trigger(this.attackConfig.hitStopDuration);
        ctx.camera.addTrauma(this.attackConfig.cameraShake.amplitude);
      }
    } else {
      ctx.setHorizontalVel(ctx.horizontalVel.clone().multiplyScalar(0.75));
    }

    // B. Check Dodge-cancel during recovery
    if (this.timer >= activeEnd) {
      if (ctx.input.dodge || ctx.inputBuffer.has('dodge')) {
        ctx.inputBuffer.consume(['dodge']);
        if (ctx.stamina.tryConsume('dodge', 20)) {
          return 'dodge';
        }
      }
    }

    // C. Return to locomotion
    if (this.timer >= this.totalDuration) {
      return 'locomotion';
    }

    return null;
  }

  private applyAimAssist(playerPos: THREE.Vector3, aimDir: THREE.Vector3, combatConfig: any): THREE.Vector3 {
    const range = combatConfig.aimAssistRange;
    const maxAngleRad = THREE.MathUtils.degToRad(combatConfig.aimAssistAngleDegrees);

    const hitboxes = (HitboxManager.getInstance() as any).hurtboxes as Map<string, any>;
    if (!hitboxes) return aimDir;

    let closestDir: THREE.Vector3 | null = null;
    let closestDist = range;

    hitboxes.forEach((target) => {
      if (target.isPlayer) return;

      const center = target.getCenter();
      const toTarget = new THREE.Vector3(center.x - playerPos.x, 0, center.z - playerPos.z);
      const dist = toTarget.length();

      if (dist > 0.3 && dist <= range) {
        toTarget.normalize();
        const angle = aimDir.angleTo(toTarget);
        if (angle <= maxAngleRad && dist < closestDist) {
          closestDist = dist;
          closestDir = toTarget;
        }
      }
    });

    if (closestDir) {
      return aimDir.clone().lerp(closestDir, 0.75).normalize();
    }

    return aimDir;
  }
}
