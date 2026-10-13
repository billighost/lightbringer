export interface AttackHitboxShape {
  type: 'box';
  halfExtents: { x: number; y: number; z: number };
  offset: { x: number; y: number; z: number }; // local offset in front of attacker
}

export interface CameraShakeConfig {
  amplitude: number;
  duration: number;
}

export interface AttackConfig {
  id: string;
  name: string;
  staminaCost: number;
  damage: number;
  poiseDamage: number;
  staggerOnHit: boolean;
  knockback: number;
  startup: number;           // Seconds before hitbox activates
  active: number;            // Seconds hitbox is active
  recovery: number;          // Seconds after active before full return to locomotion
  comboWindow: {
    start: number;           // Seconds relative to attack start when next attack can be buffered/triggered
    end: number;             // Seconds relative to attack start when combo window expires
  };
  hitboxShape: AttackHitboxShape;
  moveSpeedMultiplier: number;
  lungeDistance: number;     // Forward displacement during attack
  rotationLock: boolean;     // Lock facing direction during active frames
  hitStopDuration: number;   // Seconds to freeze attacker and target
  cameraShake: CameraShakeConfig;
  animationName: string;
}

export const ATTACKS: Record<string, AttackConfig> = {
  light_1: {
    id: 'light_1',
    name: 'Light Swing 1',
    staminaCost: 15,
    damage: 20,
    poiseDamage: 20,
    staggerOnHit: false,
    knockback: 3.0,
    startup: 0.18,
    active: 0.10,
    recovery: 0.28,
    comboWindow: {
      start: 0.20, // During active/early recovery
      end: 0.54    // Until near end of recovery (0.18 + 0.10 + 0.28 = 0.56)
    },
    hitboxShape: {
      type: 'box',
      halfExtents: { x: 0.85, y: 0.75, z: 1.1 },
      offset: { x: 0.2, y: 0.9, z: 1.1 }
    },
    moveSpeedMultiplier: 0.15,
    lungeDistance: 0.4,
    rotationLock: true,
    hitStopDuration: 0.05,
    cameraShake: { amplitude: 0.08, duration: 0.12 },
    animationName: 'attack_light_1'
  },
  light_2: {
    id: 'light_2',
    name: 'Light Swing 2',
    staminaCost: 15,
    damage: 22,
    poiseDamage: 22,
    staggerOnHit: false,
    knockback: 3.5,
    startup: 0.16,
    active: 0.10,
    recovery: 0.30,
    comboWindow: {
      start: 0.18,
      end: 0.54    // 0.16 + 0.10 + 0.30 = 0.56
    },
    hitboxShape: {
      type: 'box',
      halfExtents: { x: 0.9, y: 0.75, z: 1.1 },
      offset: { x: -0.2, y: 0.9, z: 1.1 }
    },
    moveSpeedMultiplier: 0.15,
    lungeDistance: 0.45,
    rotationLock: true,
    hitStopDuration: 0.05,
    cameraShake: { amplitude: 0.1, duration: 0.14 },
    animationName: 'attack_light_2'
  },
  light_3: {
    id: 'light_3',
    name: 'Light Finisher',
    staminaCost: 15,
    damage: 32,
    poiseDamage: 35,
    staggerOnHit: false,
    knockback: 7.0,
    startup: 0.22,
    active: 0.14,
    recovery: 0.50,
    comboWindow: {
      start: 0.99, // Finisher does not combo further
      end: 0.99
    },
    hitboxShape: {
      type: 'box',
      halfExtents: { x: 1.1, y: 0.9, z: 1.3 },
      offset: { x: 0.0, y: 0.9, z: 1.3 }
    },
    moveSpeedMultiplier: 0.1,
    lungeDistance: 0.8,
    rotationLock: true,
    hitStopDuration: 0.07,
    cameraShake: { amplitude: 0.22, duration: 0.24 },
    animationName: 'attack_light_3'
  },
  heavy: {
    id: 'heavy',
    name: 'Heavy Smash',
    staminaCost: 30,
    damage: 55,
    poiseDamage: 70,
    staggerOnHit: true, // Forces stagger on dummy!
    knockback: 8.5,
    startup: 0.55,
    active: 0.16,
    recovery: 0.60,
    comboWindow: {
      start: 0.99,
      end: 0.99
    },
    hitboxShape: {
      type: 'box',
      halfExtents: { x: 1.25, y: 1.0, z: 1.4 },
      offset: { x: 0.0, y: 0.9, z: 1.35 }
    },
    moveSpeedMultiplier: 0.05,
    lungeDistance: 0.9,
    rotationLock: true,
    hitStopDuration: 0.09,
    cameraShake: { amplitude: 0.32, duration: 0.32 },
    animationName: 'attack_heavy'
  }
};
