export interface PlayerMovementConfig {
  walkSpeed: number;
  sprintSpeed: number;
  acceleration: number;
  deceleration: number;
  jumpHeight: number;
  gravity: number;
  coyoteTime: number;
  jumpBufferTime: number;
  autostepHeight: number;
  maxSlopeAngle: number;
  rotationSpeed: number;
}

export interface PlayerCombatConfig {
  maxHealth: number;
  godMode: boolean;
  dodgeDuration: number;
  dodgeDistance: number;
  dodgeIFrameStart: number;
  dodgeIFrameEnd: number;
  dodgeRecoveryCancelStart: number;
  aimAssistRange: number;
  aimAssistAngleDegrees: number;
  aimAssistSpeed: number;
}

export const DEFAULT_MOVEMENT_CONFIG: PlayerMovementConfig = {
  walkSpeed: 4.8,
  sprintSpeed: 9.0,
  acceleration: 45.0,
  deceleration: 32.0,
  jumpHeight: 1.4,
  gravity: -26.0,
  coyoteTime: 0.16,
  jumpBufferTime: 0.15,
  autostepHeight: 0.35,
  maxSlopeAngle: 45.0,
  rotationSpeed: 14.0
};

export const DEFAULT_COMBAT_CONFIG: PlayerCombatConfig = {
  maxHealth: 100,
  godMode: false,
  dodgeDuration: 0.45,
  dodgeDistance: 4.5,
  dodgeIFrameStart: 0.05,
  dodgeIFrameEnd: 0.25,
  dodgeRecoveryCancelStart: 0.25,
  aimAssistRange: 3.2,
  aimAssistAngleDegrees: 45.0,
  aimAssistSpeed: 16.0
};
