import { describe, it, expect } from 'vitest';
import { detectBonePreset } from '../bonePresets';
import { CANONICAL_BONES } from '../canonicalBones';

describe('Bone Preset Auto-Detection', () => {
  it('detects standard Mixamo skeleton bone names', () => {
    const mixamoBones = [
      'mixamorig:Hips',
      'mixamorig:Spine',
      'mixamorig:Spine1',
      'mixamorig:Neck',
      'mixamorig:Head',
      'mixamorig:LeftShoulder',
      'mixamorig:RightShoulder',
      'mixamorig:LeftArm',
      'mixamorig:RightArm',
      'mixamorig:LeftForeArm',
      'mixamorig:RightForeArm',
      'mixamorig:LeftHand',
      'mixamorig:RightHand',
      'mixamorig:LeftUpLeg',
      'mixamorig:RightUpLeg',
      'mixamorig:LeftLeg',
      'mixamorig:RightLeg',
      'mixamorig:LeftFoot',
      'mixamorig:RightFoot',
      'mixamorig:LeftToeBase',
      'mixamorig:RightToeBase'
    ];

    const result = detectBonePreset(mixamoBones);
    expect(result.preset).toBe('mixamo');
    expect(result.matchedCount).toBe(CANONICAL_BONES.length);
    expect(result.confidence).toBe(1.0);
    expect(result.unmappedBones).toHaveLength(0);
    expect(result.boneMap.hips).toBe('mixamorig:Hips');
    expect(result.boneMap.rightHand).toBe('mixamorig:RightHand');
  });

  it('detects Mixamo prefix variations (mixamorig_ or unprefixed)', () => {
    const bones = [
      'mixamorig_Hips',
      'mixamorig_Spine',
      'mixamorig_Spine1',
      'mixamorig_Neck',
      'mixamorig_Head',
      'mixamorig_LeftArm',
      'mixamorig_RightArm',
      'mixamorig_LeftForeArm',
      'mixamorig_RightForeArm',
      'mixamorig_LeftHand',
      'mixamorig_RightHand',
      'mixamorig_LeftUpLeg',
      'mixamorig_RightUpLeg'
    ];

    const result = detectBonePreset(bones);
    expect(result.preset).toBe('mixamo');
    expect(result.matchedCount).toBeGreaterThanOrEqual(10);
    expect(result.boneMap.hips).toBe('mixamorig_Hips');
  });

  it('detects SMPL academic skeleton convention', () => {
    const smplBones = [
      'm_avg_Pelvis',
      'm_avg_Spine1',
      'm_avg_Spine2',
      'm_avg_Neck',
      'm_avg_Head',
      'm_avg_L_Collar',
      'm_avg_R_Collar',
      'm_avg_L_Shoulder',
      'm_avg_R_Shoulder',
      'm_avg_L_Elbow',
      'm_avg_R_Elbow',
      'm_avg_L_Wrist',
      'm_avg_R_Wrist',
      'm_avg_L_Hip',
      'm_avg_R_Hip',
      'm_avg_L_Knee',
      'm_avg_R_Knee',
      'm_avg_L_Ankle',
      'm_avg_R_Ankle',
      'm_avg_L_Foot',
      'm_avg_R_Foot'
    ];

    const result = detectBonePreset(smplBones);
    expect(result.preset).toBe('smpl');
    expect(result.matchedCount).toBe(CANONICAL_BONES.length);
    expect(result.boneMap.hips).toBe('m_avg_Pelvis');
    expect(result.boneMap.leftUpperArm).toBe('m_avg_L_Shoulder');
  });

  it('detects Quaternius / Rigify skeleton convention', () => {
    const quaterniusBones = [
      'DEF-hips',
      'DEF-spine',
      'DEF-chest',
      'DEF-neck',
      'DEF-head',
      'shoulder.L',
      'shoulder.R',
      'upper_arm.L',
      'upper_arm.R',
      'forearm.L',
      'forearm.R',
      'hand.L',
      'hand.R',
      'thigh.L',
      'thigh.R',
      'shin.L',
      'shin.R',
      'foot.L',
      'foot.R'
    ];

    const result = detectBonePreset(quaterniusBones);
    expect(result.preset).toBe('quaternius');
    expect(result.matchedCount).toBeGreaterThanOrEqual(15);
  });

  it('correctly tracks unmapped bones when skeleton is partial', () => {
    const partialBones = [
      'mixamorig:Hips',
      'mixamorig:Spine',
      'mixamorig:Neck',
      'mixamorig:Head',
      'mixamorig:LeftArm',
      'mixamorig:RightArm'
    ];

    const result = detectBonePreset(partialBones);
    expect(result.preset).toBe('mixamo');
    expect(result.unmappedBones).toContain('leftFoot');
    expect(result.unmappedBones).toContain('rightFoot');
    expect(result.unmappedBones).toContain('chest');
  });

  it('falls back to custom when bones do not match any preset', () => {
    const randomBones = ['PropRoot', 'Antenna_01', 'Wheel_FL', 'Wheel_FR'];
    const result = detectBonePreset(randomBones);
    expect(result.preset).toBe('custom');
    expect(result.matchedCount).toBe(0);
    expect(result.confidence).toBe(0);
  });
});
