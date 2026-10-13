import * as THREE from 'three';
import { EventBus } from '../combat/eventBus';
import { MovementInput } from '../core/input';
import { ThirdPersonCamera } from '../engine/camera';
import { StaminaSystem } from '../combat/stamina';
import { HealthComponent, PoiseComponent } from '../combat/damage';
import { InputBuffer, BufferedActionType } from './inputBuffer';
import { AnimationController } from './animationController';
import { PlayerMovementConfig, PlayerCombatConfig } from '../data/playerConfig';

export type PlayerStateId =
  | 'locomotion'
  | 'dodge'
  | 'attack_light_1'
  | 'attack_light_2'
  | 'attack_light_3'
  | 'attack_heavy'
  | 'hit_react'
  | 'stagger'
  | 'dead';

export interface PlayerContext {
  movementConfig: PlayerMovementConfig;
  combatConfig: PlayerCombatConfig;
  stamina: StaminaSystem;
  health: HealthComponent;
  poise: PoiseComponent;
  inputBuffer: InputBuffer;
  anim: AnimationController;
  camera: ThirdPersonCamera;
  input: MovementInput;
  horizontalVel: THREE.Vector3;
  verticalVel: number;
  facingAngle: number;
  isGrounded: boolean;
  currentPos: THREE.Vector3;
  setFacingAngle: (angle: number) => void;
  setHorizontalVel: (v: THREE.Vector3) => void;
  setVerticalVel: (vy: number) => void;
  respawn: () => void;
}

export interface PlayerState {
  id: PlayerStateId;
  speedMultiplier: number;
  rotationLock: boolean;
  isInvulnerable: boolean;

  enter(ctx: PlayerContext, prevState?: PlayerStateId, payload?: any): void;
  exit(ctx: PlayerContext, nextState?: PlayerStateId): void;
  update(fixedDt: number, ctx: PlayerContext): PlayerStateId | null;
  canTransitionTo(targetState: PlayerStateId): boolean;
  canCancelInto?(action: BufferedActionType): boolean;
}

export class StateMachine {
  private states: Map<PlayerStateId, PlayerState> = new Map();
  private currentState: PlayerState | null = null;
  private previousStateId: PlayerStateId | null = null;
  private timeInCurrentState = 0;
  private eventBus = EventBus.getInstance();

  // History log for debug panel
  public transitionLog: { from: string; to: string; duration: number; time: string }[] = [];

  public registerState(state: PlayerState): void {
    this.states.set(state.id, state);
  }

  public getCurrentState(): PlayerState | null {
    return this.currentState;
  }

  public getCurrentStateId(): PlayerStateId {
    return this.currentState ? this.currentState.id : 'locomotion';
  }

  public getPreviousStateId(): PlayerStateId | null {
    return this.previousStateId;
  }

  public getTimeInState(): number {
    return this.timeInCurrentState;
  }

  public isInvulnerable(): boolean {
    return this.currentState ? this.currentState.isInvulnerable : false;
  }

  public getSpeedMultiplier(): number {
    return this.currentState ? this.currentState.speedMultiplier : 1.0;
  }

  public isRotationLocked(): boolean {
    return this.currentState ? this.currentState.rotationLock : false;
  }

  public transitionTo(targetId: PlayerStateId, ctx: PlayerContext, payload?: any): boolean {
    const nextState = this.states.get(targetId);
    if (!nextState) {
      console.warn(`[StateMachine] Unknown target state: ${targetId}`);
      return false;
    }

    if (this.currentState) {
      // Validate transition legality
      if (!this.currentState.canTransitionTo(targetId)) {
        return false;
      }

      this.currentState.exit(ctx, targetId);
      this.previousStateId = this.currentState.id;

      // Log transition
      const logEntry = {
        from: this.currentState.id,
        to: targetId,
        duration: this.timeInCurrentState,
        time: new Date().toLocaleTimeString()
      };
      this.transitionLog.unshift(logEntry);
      if (this.transitionLog.length > 20) this.transitionLog.pop();

      this.eventBus.emit('stateChange', {
        previousState: this.currentState.id,
        currentState: targetId,
        timeInPreviousState: this.timeInCurrentState
      });
    }

    this.currentState = nextState;
    this.timeInCurrentState = 0;
    this.currentState.enter(ctx, this.previousStateId || undefined, payload);
    return true;
  }

  public update(fixedDt: number, ctx: PlayerContext): void {
    if (!this.currentState) return;

    this.timeInCurrentState += fixedDt;

    const nextStateId = this.currentState.update(fixedDt, ctx);
    if (nextStateId && nextStateId !== this.currentState.id) {
      this.transitionTo(nextStateId, ctx);
    }
  }
}
