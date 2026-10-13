import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StaminaSystem } from '../stamina';
import { InputBuffer } from '../../player/inputBuffer';
import { HealthComponent, PoiseComponent } from '../damage';
import { ATTACKS } from '../../data/attacks';
import { EventBus } from '../eventBus';

describe('StaminaSystem (Souls Rules)', () => {
  let stamina: StaminaSystem;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.getInstance();
    eventBus.clear();
    stamina = new StaminaSystem();
  });

  it('initializes with 100 max stamina', () => {
    expect(stamina.current).toBe(100);
    expect(stamina.isExhausted).toBe(false);
  });

  it('consumes stamina and applies regen delay', () => {
    const success = stamina.tryConsume('light_attack', 15);
    expect(success).toBe(true);
    expect(stamina.current).toBe(85);

    // Should not regenerate before 1.0s delay
    stamina.update(0.5);
    expect(stamina.current).toBe(85);

    // After remaining 0.5s delay + 0.4s regen: 25 * 0.4 = 10 -> 95
    stamina.update(0.5); // delay reaches 0
    stamina.update(0.4); // 25 * 0.4 = 10
    expect(stamina.current).toBeCloseTo(95, 1);
  });

  it('allows actions to dip stamina to 0 when stamina >= 1 (Souls rule)', () => {
    stamina.current = 5; // Less than 15 required for light attack, but >= 1
    const success = stamina.tryConsume('light_attack', 15);

    expect(success).toBe(true);
    expect(stamina.current).toBe(0);
    expect(stamina.isExhausted).toBe(true);
  });

  it('denies action and emits staminaDenied when stamina < 1', () => {
    stamina.current = 0;
    const deniedSpy = vi.fn();
    eventBus.on('staminaDenied', deniedSpy);

    const success = stamina.tryConsume('dodge', 20);
    expect(success).toBe(false);
    expect(deniedSpy).toHaveBeenCalledWith({
      action: 'dodge',
      required: 20,
      current: 0
    });
  });

  it('applies exhausted penalty delay (~1.2s extra) when dipped to 0', () => {
    stamina.current = 10;
    stamina.tryConsume('heavy_attack', 30);
    expect(stamina.current).toBe(0);
    expect(stamina.isExhausted).toBe(true);

    // Normal delay is 1.0s, exhausted adds 1.2s -> total 2.2s delay
    stamina.update(1.0);
    expect(stamina.current).toBe(0);
    expect(stamina.isExhausted).toBe(true);

    stamina.update(1.2);
    expect(stamina.current).toBe(0);
    expect(stamina.isExhausted).toBe(false); // Delay finished

    stamina.update(0.2); // Now starts regenerating at 25/s
    expect(stamina.current).toBeCloseTo(5.0, 1);
  });

  it('pauses regeneration while paused (e.g. sprinting or attacking)', () => {
    stamina.current = 50;
    stamina.setRegenPaused(true);
    stamina.update(2.0);
    expect(stamina.current).toBe(50);

    stamina.setRegenPaused(false);
    stamina.update(1.0);
    expect(stamina.current).toBe(75);
  });
});

describe('InputBuffer', () => {
  let buffer: InputBuffer;

  beforeEach(() => {
    buffer = new InputBuffer();
  });

  it('queues and consumes actions', () => {
    buffer.queue('dodge', 1.0);
    expect(buffer.has('dodge')).toBe(true);

    const consumed = buffer.consume(['dodge']);
    expect(consumed?.type).toBe('dodge');
    expect(buffer.has('dodge')).toBe(false);
  });

  it('expires inputs after maxLifetime (0.25s)', () => {
    buffer.queue('light_attack', 1.0);
    buffer.update(1.20); // 0.20s elapsed -> still valid
    expect(buffer.has('light_attack')).toBe(true);

    buffer.update(1.30); // 0.30s elapsed -> expired!
    expect(buffer.has('light_attack')).toBe(false);
  });

  it('does not duplicate identical spam within 0.05s', () => {
    buffer.queue('light_attack', 1.0);
    buffer.queue('light_attack', 1.02);
    expect(buffer.consume()?.type).toBe('light_attack');
    expect(buffer.consume()).toBeNull();
  });
});

describe('Combo Window Rules', () => {
  it('defines valid combo window inside attack duration', () => {
    const light1 = ATTACKS.light_1;
    const totalDuration = light1.startup + light1.active + light1.recovery;

    expect(light1.comboWindow.start).toBeGreaterThanOrEqual(light1.startup);
    expect(light1.comboWindow.end).toBeLessThanOrEqual(totalDuration);
    expect(light1.comboWindow.start).toBeLessThan(light1.comboWindow.end);
  });

  it('allows chaining from Light 1 to Light 2 only within combo window', () => {
    const light1 = ATTACKS.light_1;
    const isInsideWindow = (t: number) => t >= light1.comboWindow.start && t <= light1.comboWindow.end;

    expect(isInsideWindow(0.10)).toBe(false); // during startup -> false
    expect(isInsideWindow(0.35)).toBe(true);  // during recovery combo window -> true
    expect(isInsideWindow(0.55)).toBe(false); // after combo window -> false
  });
});

describe('Damage and Poise Calculation', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.getInstance();
    eventBus.clear();
  });

  it('takes damage, clamps to 0, and triggers death', () => {
    const health = new HealthComponent('dummy', 100);
    const deathSpy = vi.fn();
    eventBus.on('death', deathSpy);

    health.takeDamage(40);
    expect(health.currentHp).toBe(60);
    expect(health.isDead).toBe(false);

    health.takeDamage(80);
    expect(health.currentHp).toBe(0);
    expect(health.isDead).toBe(true);
    expect(deathSpy).toHaveBeenCalledWith({ entityId: 'dummy' });
  });

  it('breaks poise when poise damage exceeds max poise', () => {
    const poise = new PoiseComponent({ maxPoise: 60 });
    const broken1 = poise.takePoiseDamage(25);
    expect(broken1).toBe(false);
    expect(poise.currentPoise).toBe(35);
    expect(poise.isBroken).toBe(false);

    const broken2 = poise.takePoiseDamage(40);
    expect(broken2).toBe(true);
    expect(poise.currentPoise).toBe(0);
    expect(poise.isBroken).toBe(true);
  });

  it('forces immediate stagger when forceStagger is true (Heavy attack)', () => {
    const poise = new PoiseComponent({ maxPoise: 60 });
    const broken = poise.takePoiseDamage(10, true);
    expect(broken).toBe(true);
    expect(poise.isBroken).toBe(true);
  });

  it('recovers poise after decay delay', () => {
    const poise = new PoiseComponent({ maxPoise: 60, decayRate: 20, decayDelay: 1.0 });
    poise.takePoiseDamage(30);
    expect(poise.currentPoise).toBe(30);

    // During delay (0.8s), no recovery
    poise.update(0.8);
    expect(poise.currentPoise).toBe(30);

    // After delay finishes (0.2s + 0.5s): 20 * 0.5 = 10 -> 40
    poise.update(0.2);
    poise.update(0.5);
    expect(poise.currentPoise).toBeCloseTo(40, 1);
  });
});
