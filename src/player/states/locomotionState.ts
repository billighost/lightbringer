import * as THREE from 'three';
import { PlayerState, PlayerStateId, PlayerContext } from '../stateMachine';
import { BufferedActionType } from '../inputBuffer';

export class LocomotionState implements PlayerState {
  public id: PlayerStateId = 'locomotion';
  public speedMultiplier = 1.0;
  public rotationLock = false;
  public isInvulnerable = false;

  private coyoteTimer = 0;
  private jumpBufferTimer = 0;

  public enter(ctx: PlayerContext): void {
    ctx.stamina.setRegenPaused(false);
  }

  public exit(_ctx: PlayerContext): void {
    // Reset jump/coyote if leaving
  }

  public canTransitionTo(_targetState: PlayerStateId): boolean {
    // From locomotion you can transition into any action or reaction
    return true;
  }

  public canCancelInto(_action: BufferedActionType): boolean {
    return true;
  }

  public update(fixedDt: number, ctx: PlayerContext): PlayerStateId | null {
    // 1. Check buffered or direct attacks / dodge first
    // Check Dodge
    if (ctx.input.dodge || ctx.inputBuffer.has('dodge')) {
      if (ctx.isGrounded) {
        ctx.inputBuffer.consume(['dodge']);
        if (ctx.stamina.tryConsume('dodge', 20)) {
          return 'dodge';
        }
      }
    }

    // Check Light Attack
    if (ctx.input.lightAttack || ctx.inputBuffer.has('light_attack')) {
      ctx.inputBuffer.consume(['light_attack']);
      if (ctx.stamina.tryConsume('light_attack', 15)) {
        return 'attack_light_1';
      }
    }

    // Check Heavy Attack
    if (ctx.input.heavyAttack || ctx.inputBuffer.has('heavy_attack')) {
      ctx.inputBuffer.consume(['heavy_attack']);
      if (ctx.stamina.tryConsume('heavy_attack', 30)) {
        return 'attack_heavy';
      }
    }

    // 2. Jump buffer & coyote tracking
    if (ctx.input.jump || ctx.inputBuffer.has('jump')) {
      ctx.inputBuffer.consume(['jump']);
      this.jumpBufferTimer = ctx.movementConfig.jumpBufferTime;
    } else if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= fixedDt;
    }

    if (ctx.isGrounded) {
      this.coyoteTimer = ctx.movementConfig.coyoteTime;
    } else {
      this.coyoteTimer -= fixedDt;
    }

    // 3. Movement direction relative to camera yaw
    const forwardVec = ctx.camera.getForwardVector();
    const rightVec = ctx.camera.getRightVector();

    const moveDir = new THREE.Vector3();
    if (ctx.input.forward !== 0 || ctx.input.right !== 0) {
      moveDir.addScaledVector(forwardVec, ctx.input.forward);
      moveDir.addScaledVector(rightVec, ctx.input.right);
      moveDir.normalize();
    }

    const isMoving = moveDir.lengthSq() > 0.001;

    // Sprinting stamina handling
    let isSprinting = ctx.input.sprint && isMoving && ctx.isGrounded;
    if (isSprinting) {
      const canSprint = ctx.stamina.drainContinuous(ctx.stamina.config.sprintCostPerSecond, fixedDt);
      if (!canSprint) {
        isSprinting = false;
      }
      ctx.stamina.setRegenPaused(true);
    } else {
      ctx.stamina.setRegenPaused(false);
    }

    // Target speed (scaled by external modifiers such as shallow water wading)
    const speedMod = ctx.speedModifier ?? 1.0;
    const baseTargetSpeed = isMoving
      ? (isSprinting ? ctx.movementConfig.sprintSpeed : ctx.movementConfig.walkSpeed)
      : 0;
    const targetSpeed = baseTargetSpeed * speedMod;

    const targetVelocity = moveDir.clone().multiplyScalar(targetSpeed);

    // Acceleration / Deceleration
    const isAccelerating = targetSpeed > 0;
    const accelRate = isAccelerating ? ctx.movementConfig.acceleration : ctx.movementConfig.deceleration;
    const maxSpeedDelta = accelRate * fixedDt;

    const diff = targetVelocity.clone().sub(ctx.horizontalVel);
    const diffLen = diff.length();
    if (diffLen <= maxSpeedDelta) {
      ctx.setHorizontalVel(targetVelocity);
    } else {
      ctx.setHorizontalVel(ctx.horizontalVel.clone().add(diff.normalize().multiplyScalar(maxSpeedDelta)));
    }

    // Jump handling
    const canJump = (ctx.isGrounded || this.coyoteTimer > 0) && this.jumpBufferTimer > 0;
    if (canJump) {
      const jumpImpulse = Math.sqrt(2 * ctx.movementConfig.jumpHeight * Math.abs(ctx.movementConfig.gravity));
      ctx.setVerticalVel(jumpImpulse);
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
    }

    // Animation update
    if (isMoving && ctx.isGrounded) {
      ctx.anim.play('run');
    } else {
      ctx.anim.play('idle');
    }

    return null;
  }
}
