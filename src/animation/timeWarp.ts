import * as THREE from 'three';

export interface CombatTimingTarget {
  startup: number;
  active: number;
  recovery: number;
}

export interface TimeWarpMarkers {
  activeStart?: number;
  activeEnd?: number;
}

export interface TimeWarpResult {
  warpedClip: THREE.AnimationClip;
  isPiecewise: boolean;
  totalDuration: number;
  mappingFn: (clipTime: number) => number;
}

/**
 * Creates a piecewise or uniform time-mapping function mapping source clip time to combat target time.
 */
export function createTimeWarpMapping(
  clipDuration: number,
  markers: TimeWarpMarkers,
  combat: CombatTimingTarget
): { mappingFn: (t: number) => number; isPiecewise: boolean; totalDuration: number } {
  const totalCombat = Math.max(0.01, combat.startup + combat.active + combat.recovery);

  const { activeStart, activeEnd } = markers;
  const hasValidMarkers =
    typeof activeStart === 'number' &&
    typeof activeEnd === 'number' &&
    activeStart > 0 &&
    activeEnd > activeStart &&
    activeEnd < clipDuration;

  if (!hasValidMarkers) {
    if (activeStart !== undefined || activeEnd !== undefined) {
      console.warn(
        `[TimeWarp] Invalid active markers (${activeStart}, ${activeEnd}) for clip duration ${clipDuration}. Falling back to uniform stretch.`
      );
    }
    const uniformScale = totalCombat / Math.max(0.001, clipDuration);
    return {
      mappingFn: (t: number) => t * uniformScale,
      isPiecewise: false,
      totalDuration: totalCombat
    };
  }

  const cStartup = combat.startup;
  const cActive = combat.active;
  const cRecovery = combat.recovery;
  const cActiveEnd = cStartup + cActive;

  const mappingFn = (t: number): number => {
    if (t <= 0) return 0;
    if (t >= clipDuration) return totalCombat;

    if (t <= activeStart) {
      const alpha = t / activeStart;
      return alpha * cStartup;
    } else if (t <= activeEnd) {
      const alpha = (t - activeStart) / (activeEnd - activeStart);
      return cStartup + alpha * cActive;
    } else {
      const alpha = (t - activeEnd) / (clipDuration - activeEnd);
      return cActiveEnd + alpha * cRecovery;
    }
  };

  return {
    mappingFn,
    isPiecewise: true,
    totalDuration: totalCombat
  };
}

/**
 * Creates a new AnimationClip whose keyframes have been time-warped to precisely match combat timing.
 */
export function warpAnimationClipToCombat(
  sourceClip: THREE.AnimationClip,
  markers: TimeWarpMarkers,
  combat: CombatTimingTarget
): TimeWarpResult {
  const { mappingFn, isPiecewise, totalDuration } = createTimeWarpMapping(
    sourceClip.duration,
    markers,
    combat
  );

  const warpedTracks: THREE.KeyframeTrack[] = [];

  for (const track of sourceClip.tracks) {
    const newTimes = new Float32Array(track.times.length);
    for (let i = 0; i < track.times.length; i++) {
      newTimes[i] = mappingFn(track.times[i]);
    }

    // Clone values safely
    const newValues = new Float32Array(track.values);

    let newTrack: THREE.KeyframeTrack;
    if (track instanceof THREE.QuaternionKeyframeTrack) {
      newTrack = new THREE.QuaternionKeyframeTrack(track.name, newTimes as unknown as number[], newValues as unknown as number[], track.getInterpolation());
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      newTrack = new THREE.VectorKeyframeTrack(track.name, newTimes as unknown as number[], newValues as unknown as number[], track.getInterpolation());
    } else if (track instanceof THREE.NumberKeyframeTrack) {
      newTrack = new THREE.NumberKeyframeTrack(track.name, newTimes as unknown as number[], newValues as unknown as number[], track.getInterpolation());
    } else {
      newTrack = track.clone();
      newTrack.times = newTimes as unknown as Float32Array;
    }

    warpedTracks.push(newTrack);
  }

  const warpedClip = new THREE.AnimationClip(
    `${sourceClip.name}_warped`,
    totalDuration,
    warpedTracks
  );

  return {
    warpedClip,
    isPiecewise,
    totalDuration,
    mappingFn
  };
}
