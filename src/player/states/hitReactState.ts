import * as THREE from 'three';
import { PlayerState, PlayerStateId, PlayerContext } from '../stateMachine';
import { BufferedActionType } from '../inputBuffer';

export class HitReactState implements PlayerState {
  public id: PlayerStateId = 'hit_react';
  public speedMultiplier = 0.0;
  public rotationLock = true;
  public isInvulnerable = false;

  private timer = 0;
  private duration = 0.25;
  private knockbackDir = new THREE.Vector3();
  private knockbackSpeed = 0;

  public enter(ctx: PlayerContext, _prevState?: PlayerStateId, payload?: any): void {
    this.timer = 0;
    this.duration = 0.25;
    ctx.stamina.setRegenPaused(true);

    if (payload && payload.knockback) {
      this.knockbackSpeed = payload.knockback;
      if (payload.knockbackDir) {
        this.knockbackDir.copy(payload.knockbackDir);
      } else {
        // Default knock backward from current facing
        const forwardX = Math.sin(ctx.facingAngle);
        const forwardZ = Math.cos(ctx.facingAngle);
        this.knockbackDir.set(-forwardX, 0, -forwardZ).normalize();
      }
    } else {
      this.knockbackSpeed = 2.0;
      const forwardX = Math.sin(ctx.facingAngle);
      const forwardZ = Math.cos(ctx.facingAngle);
      this.knockbackDir.set(-forwardX, 0, -forwardZ).normalize();
    }

    ctx.anim.play('hit', this.duration);
  }

  public exit(ctx: PlayerContext): void {
    ctx.stamina.setRegenPaused(false);
  }

  public canTransitionTo(targetState: PlayerStateId): boolean {
    if (targetState === 'dead') return true;
    if (targetState === 'stagger') return true;
    // Cannot attack or dodge mid-hitreact
    return this.timer >= this.duration;
  }

  public canCancelInto(_action: BufferedActionType): boolean {
    return false;
  }

  public update(fixedDt: number, ctx: PlayerContext): PlayerStateId | null {
    this.timer += fixedDt;

    // Apply decaying knockback
    const decay = Math.max(0, 1.0 - this.timer / this.duration);
    ctx.setHorizontalVel(this.knockbackDir.clone().multiplyScalar(this.knockbackSpeed * decay));

    if (this.timer >= this.duration) {
      return 'locomotion';
    }

    return null;
  }
}
