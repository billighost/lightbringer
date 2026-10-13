import { CanonicalBone } from '../data/schemas';

export const CANONICAL_BONES: readonly CanonicalBone[] = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'leftShoulder',
  'rightShoulder',
  'leftUpperArm',
  'rightUpperArm',
  'leftLowerArm',
  'rightLowerArm',
  'leftHand',
  'rightHand',
  'leftUpperLeg',
  'rightUpperLeg',
  'leftLowerLeg',
  'rightLowerLeg',
  'leftFoot',
  'rightFoot',
  'leftToes',
  'rightToes'
] as const;

export const UPPER_BODY_BONES: readonly CanonicalBone[] = [
  'spine',
  'chest',
  'neck',
  'head',
  'leftShoulder',
  'rightShoulder',
  'leftUpperArm',
  'rightUpperArm',
  'leftLowerArm',
  'rightLowerArm',
  'leftHand',
  'rightHand'
] as const;

export const LOWER_BODY_BONES: readonly CanonicalBone[] = [
  'hips',
  'leftUpperLeg',
  'rightUpperLeg',
  'leftLowerLeg',
  'rightLowerLeg',
  'leftFoot',
  'rightFoot',
  'leftToes',
  'rightToes'
] as const;
