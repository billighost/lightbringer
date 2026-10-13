import { describe, it, expect, beforeEach } from 'vitest';
import { AnimationEventManager } from '../animationEvents';
import { EventBus } from '../../combat/eventBus';

describe('AnimationEventManager', () => {
  let eventManager: AnimationEventManager;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.getInstance();
    eventBus.clear();
    eventManager = new AnimationEventManager('player');
  });

  it('dispatches animation events in chronological order', () => {
    const firedEvents: string[] = [];
    eventBus.on('animationEvent', (e) => {
      firedEvents.push(e.eventName);
    });

    eventManager.registerEvents('attack_light_1', [
      { time: 0.18, event: 'hitboxOn' },
      { time: 0.20, event: 'comboWindowOpen' },
      { time: 0.28, event: 'hitboxOff' }
    ]);

    // t: 0.0 -> 0.10: nothing should fire
    eventManager.update('attack_light_1', 0.10, 0.56, false);
    expect(firedEvents).toHaveLength(0);

    // t: 0.10 -> 0.19: hitboxOn should fire
    eventManager.update('attack_light_1', 0.19, 0.56, false);
    expect(firedEvents).toEqual(['hitboxOn']);

    // t: 0.19 -> 0.25: comboWindowOpen should fire
    eventManager.update('attack_light_1', 0.25, 0.56, false);
    expect(firedEvents).toEqual(['hitboxOn', 'comboWindowOpen']);

    // t: 0.25 -> 0.35: hitboxOff should fire
    eventManager.update('attack_light_1', 0.35, 0.56, false);
    expect(firedEvents).toEqual(['hitboxOn', 'comboWindowOpen', 'hitboxOff']);
  });

  it('handles large delta time skips without dropping events', () => {
    const firedEvents: string[] = [];
    eventBus.on('animationEvent', (e) => {
      firedEvents.push(e.eventName);
    });

    eventManager.registerEvents('attack_heavy', [
      { time: 0.55, event: 'hitboxOn' },
      { time: 0.71, event: 'hitboxOff' }
    ]);

    // Single large step from 0.0 to 0.80s crosses both events
    eventManager.update('attack_heavy', 0.80, 1.31, false);
    expect(firedEvents).toEqual(['hitboxOn', 'hitboxOff']);
  });

  it('handles looping clips wrapping around 0', () => {
    const firedEvents: string[] = [];
    eventBus.on('animationEvent', (e) => {
      firedEvents.push(e.eventName);
    });

    eventManager.registerEvents('walk', [
      { time: 0.25, event: 'footstepLeft' },
      { time: 0.75, event: 'footstepRight' }
    ]);

    // Advance to 0.85s (both footsteps fired)
    eventManager.update('walk', 0.85, 1.0, true);
    expect(firedEvents).toEqual(['footstepLeft', 'footstepRight']);

    // Loop wraps around: 0.85 -> 0.30s (footstepLeft should fire again)
    eventManager.update('walk', 0.30, 1.0, true);
    expect(firedEvents).toEqual(['footstepLeft', 'footstepRight', 'footstepLeft']);
  });
});
