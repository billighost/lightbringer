import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTimeWarpMapping, warpAnimationClipToCombat } from '../timeWarp';

describe('Attack Time-Warp Mapping', () => {
  it('maps clip times precisely to combat startup, active, and recovery phases', () => {
    const clipDuration = 1.0;
    const markers = {
      activeStart: 0.25, // clip windup takes 25% of clip
      activeEnd: 0.50    // clip swing takes 25% of clip
    };
    const combat = {
      startup: 0.18,     // data says startup is 0.18s
      active: 0.10,      // data says active is 0.10s
      recovery: 0.28     // data says recovery is 0.28s -> total 0.56s
    };

    const { mappingFn, isPiecewise, totalDuration } = createTimeWarpMapping(
      clipDuration,
      markers,
      combat
    );

    expect(isPiecewise).toBe(true);
    expect(totalDuration).toBeCloseTo(0.56, 3);

    // Startup boundary (t = 0.25 in clip must map exactly to t = 0.18 in combat)
    expect(mappingFn(0.0)).toBeCloseTo(0.0, 3);
    expect(mappingFn(0.125)).toBeCloseTo(0.09, 3); // midpoint of startup
    expect(mappingFn(0.25)).toBeCloseTo(0.18, 3);  // activeStart -> startup

    // Active boundary (t = 0.50 in clip must map exactly to t = 0.28 in combat: startup + active)
    expect(mappingFn(0.375)).toBeCloseTo(0.23, 3); // midpoint of active
    expect(mappingFn(0.50)).toBeCloseTo(0.28, 3);  // activeEnd -> startup + active

    // Recovery boundary (t = 1.00 in clip must map to total combat duration 0.56s)
    expect(mappingFn(0.75)).toBeCloseTo(0.42, 3);  // midpoint of recovery
    expect(mappingFn(1.0)).toBeCloseTo(0.56, 3);
  });

  it('falls back to uniform stretch when markers are missing', () => {
    const clipDuration = 1.0;
    const markers = {}; // no markers
    const combat = {
      startup: 0.2,
      active: 0.2,
      recovery: 0.6 // total 1.0s
    };

    const { mappingFn, isPiecewise, totalDuration } = createTimeWarpMapping(
      clipDuration,
      markers,
      combat
    );

    expect(isPiecewise).toBe(false);
    expect(totalDuration).toBe(1.0);
    expect(mappingFn(0.5)).toBeCloseTo(0.5);
  });

  it('produces warped AnimationClip with updated keyframe timestamps', () => {
    const times = [0, 0.25, 0.5, 1.0];
    const quats = [
      0, 0, 0, 1,
      0, 0.5, 0, 0.866,
      0, 0.707, 0, 0.707,
      0, 0, 0, 1
    ];
    const track = new THREE.QuaternionKeyframeTrack('mixamorig:RightArm.quaternion', times, quats);
    const clip = new THREE.AnimationClip('swing', 1.0, [track]);

    const result = warpAnimationClipToCombat(
      clip,
      { activeStart: 0.25, activeEnd: 0.50 },
      { startup: 0.18, active: 0.10, recovery: 0.28 }
    );

    expect(result.warpedClip.duration).toBeCloseTo(0.56, 3);
    const outTimes = result.warpedClip.tracks[0].times;
    expect(outTimes[0]).toBeCloseTo(0.0);
    expect(outTimes[1]).toBeCloseTo(0.18, 3); // activeStart mapped to startup
    expect(outTimes[2]).toBeCloseTo(0.28, 3); // activeEnd mapped to startup + active
    expect(outTimes[3]).toBeCloseTo(0.56, 3); // end mapped to total combat duration
  });
});
