import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { LightPool } from '../lightPool';

describe('LightPool Dynamic Assignment', () => {
  let scene: THREE.Scene;
  let pool: LightPool;

  beforeEach(() => {
    scene = new THREE.Scene();
    pool = new LightPool(scene, 6);
  });

  it('initializes with exact fixed count of PointLight instances', () => {
    expect(pool.maxLights).toBe(6);
    const assignments = pool.getActiveAssignments();
    expect(assignments).toHaveLength(6);
    expect(assignments.every((a) => a.sourceId === null)).toBe(true);
  });

  it('assigns real lights to the closest glow sources within capacity', () => {
    const origin = new THREE.Vector3(0, 0, 0);

    // Register 3 glow sources at different distances
    pool.registerGlowSource('source_near', new THREE.Vector3(5, 0, 0), 0x00f2ff, 3.0, 15);
    pool.registerGlowSource('source_mid', new THREE.Vector3(15, 0, 0), 0x2afc64, 2.0, 12);
    pool.registerGlowSource('source_far', new THREE.Vector3(30, 0, 0), 0x9d24db, 1.5, 10);

    // Step pool with dt
    pool.update(0.1, origin);

    const assignments = pool.getActiveAssignments();
    const assignedIds = assignments.map((a) => a.sourceId).filter(Boolean);

    expect(assignedIds).toContain('source_near');
    expect(assignedIds).toContain('source_mid');
    expect(assignedIds).toContain('source_far');
  });

  it('caps assignment to maxLights (6) and chooses nearest when more are registered', () => {
    const origin = new THREE.Vector3(0, 0, 0);

    // Register 8 sources along X axis
    for (let i = 1; i <= 8; i++) {
      pool.registerGlowSource(`src_${i}`, new THREE.Vector3(i * 5, 0, 0), 0xffffff, 2.0, 10);
    }

    pool.update(0.1, origin);

    const assignments = pool.getActiveAssignments();
    const assignedIds = assignments.map((a) => a.sourceId).filter(Boolean);

    // Only 6 sources should receive lights
    expect(assignedIds).toHaveLength(6);
    // Nearest 6 should be src_1 through src_6
    expect(assignedIds).toContain('src_1');
    expect(assignedIds).toContain('src_2');
    expect(assignedIds).toContain('src_3');
    expect(assignedIds).toContain('src_4');
    expect(assignedIds).toContain('src_5');
    expect(assignedIds).toContain('src_6');
    // Farthest src_7 and src_8 should NOT receive lights
    expect(assignedIds).not.toContain('src_7');
    expect(assignedIds).not.toContain('src_8');
  });

  it('gracefully reallocates slot when a source is unregistered', () => {
    const origin = new THREE.Vector3(0, 0, 0);

    pool.registerGlowSource('source_1', new THREE.Vector3(5, 0, 0), 0xffffff, 2.0, 10);
    pool.update(0.1, origin);

    let assignments = pool.getActiveAssignments();
    expect(assignments.some((a) => a.sourceId === 'source_1')).toBe(true);

    pool.unregisterGlowSource('source_1');
    // Simulate fade out over multiple ticks
    for (let t = 0; t < 10; t++) {
      pool.update(0.1, origin);
    }

    assignments = pool.getActiveAssignments();
    expect(assignments.some((a) => a.sourceId === 'source_1')).toBe(false);
  });
});
