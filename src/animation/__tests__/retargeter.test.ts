import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { AnimationRetargeter } from '../retargeter';
import { CanonicalBoneMap } from '../../data/schemas';

describe('Animation Retargeter', () => {
  let retargeter: AnimationRetargeter;

  const mixamoMap: CanonicalBoneMap = {
    hips: 'mixamorig:Hips',
    spine: 'mixamorig:Spine',
    rightUpperArm: 'mixamorig:RightArm',
    leftUpperLeg: 'mixamorig:LeftUpLeg'
  };

  const smplMap: CanonicalBoneMap = {
    hips: 'm_avg_Pelvis',
    spine: 'm_avg_Spine1',
    rightUpperArm: 'm_avg_R_Shoulder',
    leftUpperLeg: 'm_avg_L_Hip'
  };

  beforeEach(() => {
    retargeter = AnimationRetargeter.getInstance();
    retargeter.clearCache();
  });

  it('retargets rotation track between different bone names', () => {
    const times = [0, 0.5, 1.0];
    const quats = [0, 0, 0, 1, 0, 0.707, 0, 0.707, 0, 0, 0, 1];
    const rotTrack = new THREE.QuaternionKeyframeTrack('mixamorig:RightArm.quaternion', times, quats);
    const sourceClip = new THREE.AnimationClip('attack', 1.0, [rotTrack]);

    const retargeted = retargeter.retargetClip(sourceClip, {
      sourceBoneMap: mixamoMap,
      targetBoneMap: smplMap
    });

    expect(retargeted.tracks).toHaveLength(1);
    expect(retargeted.tracks[0].name).toBe('m_avg_R_Shoulder.quaternion');
    expect(retargeted.tracks[0].times).toEqual(new Float32Array(times));
  });

  it('strips horizontal root motion when rootMotion is "none"', () => {
    const times = [0, 0.5, 1.0];
    // X, Y, Z translations: moving forward along Z from 0 to 2 meters
    const positions = [
      0.0, 1.0, 0.0,
      0.1, 1.05, 1.0,
      0.2, 1.0, 2.0
    ];
    const posTrack = new THREE.VectorKeyframeTrack('mixamorig:Hips.position', times, positions);
    const sourceClip = new THREE.AnimationClip('walk', 1.0, [posTrack]);

    const retargeted = retargeter.retargetClip(sourceClip, {
      sourceBoneMap: mixamoMap,
      targetBoneMap: smplMap,
      rootMotion: 'none'
    });

    const outTrack = retargeted.tracks[0];
    expect(outTrack.name).toBe('m_avg_Pelvis.position');

    // Initial X=0, Z=0 must be locked across all frames (in-place)
    expect(outTrack.values[0]).toBeCloseTo(0.0);
    expect(outTrack.values[2]).toBeCloseTo(0.0);
    expect(outTrack.values[3]).toBeCloseTo(0.0); // X at t=0.5
    expect(outTrack.values[5]).toBeCloseTo(0.0); // Z at t=0.5
    expect(outTrack.values[6]).toBeCloseTo(0.0); // X at t=1.0
    expect(outTrack.values[8]).toBeCloseTo(0.0); // Z at t=1.0

    // Y bobbing is preserved
    expect(outTrack.values[4]).toBeCloseTo(1.05);
  });

  it('scales hip height according to character height ratio', () => {
    const times = [0, 1.0];
    const positions = [0, 1.0, 0, 0, 1.0, 0];
    const posTrack = new THREE.VectorKeyframeTrack('mixamorig:Hips.position', times, positions);
    const sourceClip = new THREE.AnimationClip('idle', 1.0, [posTrack]);

    const retargeted = retargeter.retargetClip(sourceClip, {
      sourceBoneMap: mixamoMap,
      targetBoneMap: smplMap,
      sourceHipsHeight: 1.0,
      targetHipsHeight: 1.25 // 25% taller character
    });

    const outTrack = retargeted.tracks[0];
    expect(outTrack.values[1]).toBeCloseTo(1.25);
  });

  it('caches retargeted clips by cacheKey and reports hits/misses', () => {
    const track = new THREE.QuaternionKeyframeTrack('mixamorig:Spine.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]);
    const clip = new THREE.AnimationClip('idle', 1.0, [track]);

    const cacheKey = 'lib1_smpl_idle_none';
    const firstResult = retargeter.retargetClip(clip, { sourceBoneMap: mixamoMap, targetBoneMap: smplMap }, cacheKey);
    const secondResult = retargeter.retargetClip(clip, { sourceBoneMap: mixamoMap, targetBoneMap: smplMap }, cacheKey);

    expect(firstResult).toBe(secondResult);
    const stats = retargeter.getStats();
    expect(stats.cacheHits).toBe(1);
    expect(stats.cacheMisses).toBe(1);
    expect(stats.cachedClipCount).toBe(1);
  });
});
