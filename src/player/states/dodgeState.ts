import * as THREE from 'three';
import { PlayerState, PlayerStateId, PlayerContext } from '../stateMachine';
import { BufferedActionType } from '../inputBuffer';

export class DodgeState implements PlayerState {
  public id: PlayerStateId = 'dodge';
  public speedMultiplier = 1.0;
  public rotationLock = true;
  public isInvulnerable = false;

  private timer = 0;
  private duration = 0.45;
  private distance = 4.5;
  private rollDirection = new THREE.Vector3();
  public isHopBack = false;

  public enter(ctx: PlayerContext): void {
    this.timer = 0;
    this.isInvulnerable = false;
    ctx.stamina.setRegenPaused(true);

    this.duration = ctx.combatConfig.dodgeDuration;
    this.distance = ctx.combatConfig.dodgeDistance;

    // Determine roll direction
    const forwardVec = ctx.camera.getForwardVector();
    const rightVec = ctx.camera.getRightVector();

    const inputDir = new THREE.Vector3();
    if (ctx.input.forward !== 0 || ctx.input.right !== 0) {
      inputDir.addScaledVector(forwardVec, ctx.input.forward);
      inputDir.addScaledVector(rightVec, ctx.input.right);
      inputDir.normalize();
      this.rollDirection.copy(inputDir);
      this.isHopBack = false;

      // Face the roll direction
      const facing = Math.atan2(this.rollDirection.x, this.rollDirection.z);
      ctx.setFacingAngle(facing);
    } else {
      // No input -> hop-back (backward from current facing angle or camera forward)
      this.rollDirection.copy(forwardVec).multiplyScalar(-1).normalize();
      this.isHopBack = true;
    }

    ctx.anim.play('dodge', this.duration);
  }

  public exit(ctx: PlayerContext): void {
    this.isInvulnerable = false;
    ctx.stamina.setRegenPaused(false);
  }

  public canTransitionTo(targetState: PlayerStateId): boolean {
    if (targetState === 'dead') return true;
    if (targetState === 'hit_react' || targetState === 'stagger') {
      // Only hit if not currently in i-frames
      return !this.isInvulnerable;
    }
    // Can cancel into attack only during recovery (after i-frames end at 0.25s)
    if (targetState.startsWith('attack_')) {
      return this.timer >= 0.25;
    }
    return this.timer >= this.duration;
  }

  public canCancelInto(action: BufferedActionType): boolean {
    return this.timer >= 0.25 && (action === 'light_attack' || action === 'heavy_attack');
  }

  public update(fixedDt: number, ctx: PlayerContext): PlayerStateId | null {
    this.timer += fixedDt;

    // 1. Invulnerability window: 0.05s to 0.25s
    this.isInvulnerable = this.timer >= ctx.combatConfig.dodgeIFrameStart &&
                          this.timer <= ctx.combatConfig.dodgeIFrameEnd;

    // 2. Velocity calculation with ease-out curve
    const progress = Math.min(1.0, this.timer / this.duration);
    // Linear deceleration speed = (2 * distance / duration) * (1 - progress)
    const initialSpeed = (2 * this.distance) / this.duration; // 20 m/s
    const currentSpeed = Math.max(0, initialSpeed * (1 - progress));

    const vel = this.rollDirection.clone().multiplyScalar(currentSpeed);
    ctx.setHorizontalVel(vel);

    // 3. Recovery cancel window (after i-frames end at 0.25s): can buffer/cancel into attacks
    if (this.timer >= ctx.combatConfig.dodgeRecoveryCancelStart) {
      if (ctx.inputBuffer.has('light_attack') || ctx.input.lightAttack) {
        ctx.inputBuffer.consume(['light_attack']);
        if (ctx.stamina.tryConsume('light_attack', 15)) {
          return 'attack_light_1';
        }
      }
      if (ctx.inputBuffer.has('heavy_attack') || ctx.input.heavyAttack) {
        ctx.inputBuffer.consume(['heavy_attack']);
        if (ctx.stamina.tryConsume('heavy_attack', 30)) {
          return 'attack_heavy';
        }
      }
    }

    // 4. End of dodge
    if (this.timer >= this.duration) {
      return 'locomotion';
    }

    return null;
  }
}
