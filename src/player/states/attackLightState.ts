import * as THREE from 'three';
import { PlayerState, PlayerStateId, PlayerContext } from '../stateMachine';
import { ATTACKS, AttackConfig } from '../../data/attacks';
import { HitboxManager } from '../../combat/hitboxManager';
import { HitStopManager } from '../../combat/gameFeel';
import { BufferedActionType } from '../inputBuffer';
import { EventBus } from '../../combat/eventBus';

export class AttackLightState implements PlayerState {
  public id: PlayerStateId;
  public speedMultiplier = 0.15;
  public rotationLock = true;
  public isInvulnerable = false;

  private stage: 1 | 2 | 3;
  private attackConfig: AttackConfig;
  private timer = 0;
  private totalDuration = 0.56;
  private swingId = '';
  private lungeDir = new THREE.Vector3();
  private hasHitTarget = false;
  private activeFromAnimEvent: boolean | null = null;
  private eventUnsub: (() => void) | null = null;

  constructor(stage: 1 | 2 | 3) {
    this.stage = stage;
    this.id = `attack_light_${stage}` as PlayerStateId;
    this.attackConfig = ATTACKS[`light_${stage}`];
  }

  public enter(ctx: PlayerContext): void {
    this.timer = 0;
    this.hasHitTarget = false;
    this.activeFromAnimEvent = null;
    this.attackConfig = ATTACKS[`light_${this.stage}`];
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

    // 1. Initial facing calculation (camera aim or movement input)
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

    // 2. Soft Aim Assist towards nearest dummy within range & angle
    const assistedDir = this.applyAimAssist(ctx.currentPos, aimDir, ctx.combatConfig);
    this.lungeDir.copy(assistedDir);

    const targetFacing = Math.atan2(assistedDir.x, assistedDir.z);
    ctx.setFacingAngle(targetFacing);

    // 3. Start swing in HitboxManager
    this.swingId = HitboxManager.getInstance().startSwing(`player_light_${this.stage}`);

    // 4. Play logical animation
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

    // Combo chaining to next light attack allowed during combo window
    const nextLightId = `attack_light_${this.stage + 1}` as PlayerStateId;
    if (targetState === nextLightId) {
      return this.timer >= this.attackConfig.comboWindow.start &&
             this.timer <= this.attackConfig.comboWindow.end;
    }

    // Heavy attack during recovery
    if (targetState === 'attack_heavy') {
      return this.timer >= activeEnd;
    }

    return this.timer >= this.totalDuration;
  }

  public canCancelInto(action: BufferedActionType): boolean {
    const activeEnd = this.attackConfig.startup + this.attackConfig.active;
    if (action === 'dodge') {
      return this.timer >= activeEnd;
    }
    if (action === 'light_attack') {
      return this.timer >= this.attackConfig.comboWindow.start &&
             this.timer <= this.attackConfig.comboWindow.end;
    }
    return false;
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
      // Rotation is strictly locked during active frames
      this.rotationLock = true;

      // Forward lunge velocity
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
        // Trigger Hit-stop & Camera Shake
        HitStopManager.getInstance().trigger(this.attackConfig.hitStopDuration);
        ctx.camera.addTrauma(this.attackConfig.cameraShake.amplitude);
      }
    } else {
      // Decelerate outside active frames
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

    // C. Check Combo chain during combo window
    if (this.timer >= this.attackConfig.comboWindow.start && this.timer <= this.attackConfig.comboWindow.end) {
      if (ctx.input.lightAttack || ctx.inputBuffer.has('light_attack')) {
        ctx.inputBuffer.consume(['light_attack']);
        if (this.stage < 3) {
          const nextStage = (this.stage + 1) as 2 | 3;
          if (ctx.stamina.tryConsume(`light_${nextStage}`, 15)) {
            return `attack_light_${nextStage}` as PlayerStateId;
          }
        }
      }
    }

    // D. Return to locomotion when recovery completes
    if (this.timer >= this.totalDuration) {
      return 'locomotion';
    }

    return null;
  }

  private applyAimAssist(playerPos: THREE.Vector3, aimDir: THREE.Vector3, combatConfig: any): THREE.Vector3 {
    // Find nearest target within range and max angle
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
      // Blend gently toward target direction (75% snap)
      return aimDir.clone().lerp(closestDir, 0.75).normalize();
    }

    return aimDir;
  }
}
