import { describe, it, expect } from 'vitest';
import { GatherableComponent } from '../gatherableComponent';
import { EventBus } from '../../../combat/eventBus';

describe('GatherableComponent', () => {
  it('starts in available state with default scale factor', () => {
    const node = new GatherableComponent({
      id: 'test_node_1',
      resourceId: 'lumen_shard',
      name: 'Lumen Shard Node',
      position: [10, 0, 10],
      respawnSeconds: 15
    });

    expect(node.state).toBe('available');
    expect(node.currentScaleFactor).toBe(1.0);
    expect(node.respawnTimer).toBe(0);
  });

  it('transitions from available to depleted upon gathering and emits bus events', () => {
    const bus = EventBus.getInstance();
    let attemptedEmitted = false;
    let gatheredEmitted = false;
    let payloadResourceId = '';

    const unsubAttempt = bus.on('gatherAttempted', (e) => {
      attemptedEmitted = true;
      payloadResourceId = e.resourceId;
    });
    const unsubGathered = bus.on('gathered', () => {
      gatheredEmitted = true;
    });

    const node = new GatherableComponent({
      id: 'test_crystal',
      resourceId: 'lumen_shard',
      name: 'Lumen Crystal',
      position: [5, 1, 5],
      respawnSeconds: 10
    });

    const success = node.gather();
    expect(success).toBe(true);
    expect(node.state).toBe('depleted');
    expect(node.respawnTimer).toBe(10);
    expect(attemptedEmitted).toBe(true);
    expect(gatheredEmitted).toBe(true);
    expect(payloadResourceId).toBe('lumen_shard');

    // Cannot gather while depleted
    const repeatSuccess = node.gather();
    expect(repeatSuccess).toBe(false);

    unsubAttempt();
    unsubGathered();
  });

  it('progresses from depleted to respawning and then back to available over time', () => {
    const node = new GatherableComponent({
      id: 'test_pod',
      resourceId: 'glow_spore',
      name: 'Glow Pod',
      position: [0, 0, 0],
      respawnSeconds: 10
    });

    node.gather();
    expect(node.state).toBe('depleted');

    // Advance 5 seconds (5s remaining)
    node.update(5.0);
    expect(node.state).toBe('depleted');
    expect(node.respawnTimer).toBe(5.0);

    // Advance 3 more seconds (2s remaining -> <= 3s triggers 'respawning')
    node.update(3.0);
    expect(node.state).toBe('respawning');
    expect(node.respawnTimer).toBe(2.0);

    // Advance remaining 2 seconds -> transitions back to 'available'
    node.update(2.5);
    expect(node.state).toBe('available');
    expect(node.respawnTimer).toBe(0);

    // Can be gathered again
    expect(node.gather()).toBe(true);
    expect(node.state).toBe('depleted');
  });
});
