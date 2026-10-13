import { PlayerState, PlayerStateId, PlayerContext } from '../stateMachine';
import { BufferedActionType } from '../inputBuffer';

export class DeadState implements PlayerState {
  public id: PlayerStateId = 'dead';
  public speedMultiplier = 0.0;
  public rotationLock = true;
  public isInvulnerable = true;

  private timer = 0;
  private duration = 2.0;

  public enter(ctx: PlayerContext): void {
    this.timer = 0;
    this.duration = 2.0;
    ctx.stamina.setRegenPaused(true);
    ctx.setHorizontalVel(ctx.horizontalVel.clone().multiplyScalar(0));
    ctx.anim.play('death', this.duration);
  }

  public exit(ctx: PlayerContext): void {
    ctx.stamina.setRegenPaused(false);
  }

  public canTransitionTo(targetState: PlayerStateId): boolean {
    // Only transition back to locomotion after respawn
    return this.timer >= this.duration && targetState === 'locomotion';
  }

  public canCancelInto(_action: BufferedActionType): boolean {
    return false;
  }

  public update(fixedDt: number, ctx: PlayerContext): PlayerStateId | null {
    this.timer += fixedDt;

    ctx.setHorizontalVel(ctx.horizontalVel.clone().multiplyScalar(0));

    if (this.timer >= this.duration) {
      ctx.respawn();
      return 'locomotion';
    }

    return null;
  }
}
