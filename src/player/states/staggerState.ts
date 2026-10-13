import { PlayerState, PlayerStateId, PlayerContext } from '../stateMachine';
import { BufferedActionType } from '../inputBuffer';

export class StaggerState implements PlayerState {
  public id: PlayerStateId = 'stagger';
  public speedMultiplier = 0.0;
  public rotationLock = true;
  public isInvulnerable = false;

  private timer = 0;
  private duration = 1.0;

  public enter(ctx: PlayerContext): void {
    this.timer = 0;
    this.duration = 1.0;
    ctx.stamina.setRegenPaused(true);
    ctx.setHorizontalVel(ctx.horizontalVel.clone().multiplyScalar(0.2));

    ctx.anim.play('stagger', this.duration);
  }

  public exit(ctx: PlayerContext): void {
    ctx.stamina.setRegenPaused(false);
    ctx.poise.reset();
  }

  public canTransitionTo(targetState: PlayerStateId): boolean {
    if (targetState === 'dead') return true;
    // Strictly illegal to dodge, attack, or jump while staggered
    return this.timer >= this.duration;
  }

  public canCancelInto(_action: BufferedActionType): boolean {
    return false; // Cannot cancel out of stagger
  }

  public update(fixedDt: number, ctx: PlayerContext): PlayerStateId | null {
    this.timer += fixedDt;

    // Zero out horizontal velocity
    ctx.setHorizontalVel(ctx.horizontalVel.clone().multiplyScalar(0.7));

    if (this.timer >= this.duration) {
      return 'locomotion';
    }

    return null;
  }
}
