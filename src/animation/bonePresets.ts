import { CanonicalBone, CanonicalBoneMap, SkeletonType } from '../data/schemas';
import { CANONICAL_BONES } from './canonicalBones';

export interface PresetPattern {
  name: SkeletonType;
  description: string;
  matchCandidates: Record<CanonicalBone, string[]>;
}

export const BONE_PRESET_PATTERNS: Record<SkeletonType, PresetPattern> = {
  mixamo: {
    name: 'mixamo',
    description: 'Adobe Mixamo humanoid rig with mixamorig: or mixamorig prefix',
    matchCandidates: {
      hips: ['mixamorig:hips', 'mixamorig_hips', 'mixamorighips', 'hips'],
      spine: ['mixamorig:spine', 'mixamorig_spine', 'mixamorigspine', 'spine'],
      chest: ['mixamorig:spine1', 'mixamorig:spine2', 'mixamorig_spine1', 'mixamorigspine1', 'spine1', 'spine2', 'chest'],
      neck: ['mixamorig:neck', 'mixamorig_neck', 'mixamorigneck', 'neck'],
      head: ['mixamorig:head', 'mixamorig_head', 'mixamorighead', 'head'],
      leftShoulder: ['mixamorig:leftshoulder', 'mixamorig_leftshoulder', 'mixamorigleftshoulder', 'leftshoulder'],
      rightShoulder: ['mixamorig:rightshoulder', 'mixamorig_rightshoulder', 'mixamorigrightshoulder', 'rightshoulder'],
      leftUpperArm: ['mixamorig:leftarm', 'mixamorig_leftarm', 'mixamorigleftarm', 'leftarm'],
      rightUpperArm: ['mixamorig:rightarm', 'mixamorig_rightarm', 'mixamorigrightarm', 'rightarm'],
      leftLowerArm: ['mixamorig:leftforearm', 'mixamorig_leftforearm', 'mixamorigleftforearm', 'leftforearm'],
      rightLowerArm: ['mixamorig:rightforearm', 'mixamorig_rightforearm', 'mixamorigrightforearm', 'rightforearm'],
      leftHand: ['mixamorig:lefthand', 'mixamorig_lefthand', 'mixamoriglefthand', 'lefthand'],
      rightHand: ['mixamorig:righthand', 'mixamorig_righthand', 'mixamorigrighthand', 'righthand'],
      leftUpperLeg: ['mixamorig:leftupleg', 'mixamorig_leftupleg', 'mixamorigleftupleg', 'leftupleg'],
      rightUpperLeg: ['mixamorig:rightupleg', 'mixamorig_rightupleg', 'mixamorigrightupleg', 'rightupleg'],
      leftLowerLeg: ['mixamorig:leftleg', 'mixamorig_leftleg', 'mixamorigleftleg', 'leftleg'],
      rightLowerLeg: ['mixamorig:rightleg', 'mixamorig_rightleg', 'mixamorigrightleg', 'rightleg'],
      leftFoot: ['mixamorig:leftfoot', 'mixamorig_leftfoot', 'mixamorigleftfoot', 'leftfoot'],
      rightFoot: ['mixamorig:rightfoot', 'mixamorig_rightfoot', 'mixamorigrightfoot', 'rightfoot'],
      leftToes: ['mixamorig:lefttoebase', 'mixamorig_lefttoebase', 'mixamoriglefttoebase', 'lefttoebase'],
      rightToes: ['mixamorig:righttoebase', 'mixamorig_righttoebase', 'mixamorigrighttoebase', 'righttoebase']
    }
  },
  smpl: {
    name: 'smpl',
    description: 'SMPL / SMPL-X academic body model convention',
    matchCandidates: {
      hips: ['m_avg_pelvis', 'f_avg_pelvis', 'pelvis', 'root'],
      spine: ['m_avg_spine1', 'f_avg_spine1', 'spine1'],
      chest: ['m_avg_spine2', 'f_avg_spine2', 'm_avg_spine3', 'spine2', 'spine3'],
      neck: ['m_avg_neck', 'f_avg_neck', 'neck'],
      head: ['m_avg_head', 'f_avg_head', 'head'],
      leftShoulder: ['m_avg_l_collar', 'f_avg_l_collar', 'l_collar', 'left_collar'],
      rightShoulder: ['m_avg_r_collar', 'f_avg_r_collar', 'r_collar', 'right_collar'],
      leftUpperArm: ['m_avg_l_shoulder', 'f_avg_l_shoulder', 'l_shoulder', 'left_shoulder'],
      rightUpperArm: ['m_avg_r_shoulder', 'f_avg_r_shoulder', 'r_shoulder', 'right_shoulder'],
      leftLowerArm: ['m_avg_l_elbow', 'f_avg_l_elbow', 'l_elbow', 'left_elbow'],
      rightLowerArm: ['m_avg_r_elbow', 'f_avg_r_elbow', 'r_elbow', 'right_elbow'],
      leftHand: ['m_avg_l_wrist', 'f_avg_l_wrist', 'l_wrist', 'left_wrist'],
      rightHand: ['m_avg_r_wrist', 'f_avg_r_wrist', 'r_wrist', 'right_wrist'],
      leftUpperLeg: ['m_avg_l_hip', 'f_avg_l_hip', 'l_hip', 'left_hip'],
      rightUpperLeg: ['m_avg_r_hip', 'f_avg_r_hip', 'r_hip', 'right_hip'],
      leftLowerLeg: ['m_avg_l_knee', 'f_avg_l_knee', 'l_knee', 'left_knee'],
      rightLowerLeg: ['m_avg_r_knee', 'f_avg_r_knee', 'r_knee', 'right_knee'],
      leftFoot: ['m_avg_l_ankle', 'f_avg_l_ankle', 'l_ankle', 'left_ankle'],
      rightFoot: ['m_avg_r_ankle', 'f_avg_r_ankle', 'r_ankle', 'right_ankle'],
      leftToes: ['m_avg_l_foot', 'f_avg_l_foot', 'l_foot', 'left_foot'],
      rightToes: ['m_avg_r_foot', 'f_avg_r_foot', 'r_foot', 'right_foot']
    }
  },
  quaternius: {
    name: 'quaternius',
    description: 'Quaternius / Rigify naming with .L/.R or DEF- prefixes',
    matchCandidates: {
      hips: ['def-hips', 'hips', 'pelvis', 'root_hips'],
      spine: ['def-spine', 'spine', 'spine_01', 'spine.001'],
      chest: ['def-chest', 'chest', 'def-spine.001', 'spine_02', 'spine.002'],
      neck: ['def-neck', 'neck', 'neck.001'],
      head: ['def-head', 'head'],
      leftShoulder: ['def-shoulder.l', 'shoulder.l', 'clavicle.l', 'def-clavicle.l'],
      rightShoulder: ['def-shoulder.r', 'shoulder.r', 'clavicle.r', 'def-clavicle.r'],
      leftUpperArm: ['def-upper_arm.l', 'upper_arm.l', 'arm.l', 'def-arm.l'],
      rightUpperArm: ['def-upper_arm.r', 'upper_arm.r', 'arm.r', 'def-arm.r'],
      leftLowerArm: ['def-forearm.l', 'forearm.l', 'lowerarm.l', 'def-lowerarm.l'],
      rightLowerArm: ['def-forearm.r', 'forearm.r', 'lowerarm.r', 'def-lowerarm.r'],
      leftHand: ['def-hand.l', 'hand.l'],
      rightHand: ['def-hand.r', 'hand.r'],
      leftUpperLeg: ['def-thigh.l', 'thigh.l', 'upperleg.l', 'def-upperleg.l'],
      rightUpperLeg: ['def-thigh.r', 'thigh.r', 'upperleg.r', 'def-upperleg.r'],
      leftLowerLeg: ['def-shin.l', 'shin.l', 'lowerleg.l', 'def-lowerleg.l'],
      rightLowerLeg: ['def-shin.r', 'shin.r', 'lowerleg.r', 'def-lowerleg.r'],
      leftFoot: ['def-foot.l', 'foot.l'],
      rightFoot: ['def-foot.r', 'foot.r'],
      leftToes: ['def-toe.l', 'toe.l', 'toes.l', 'def-toes.l'],
      rightToes: ['def-toe.r', 'toe.r', 'toes.r', 'def-toes.r']
    }
  },
  custom: {
    name: 'custom',
    description: 'Custom user defined bone mapping',
    matchCandidates: {
      hips: ['hips'],
      spine: ['spine'],
      chest: ['chest'],
      neck: ['neck'],
      head: ['head'],
      leftShoulder: ['leftshoulder'],
      rightShoulder: ['rightshoulder'],
      leftUpperArm: ['leftupperarm'],
      rightUpperArm: ['rightupperarm'],
      leftLowerArm: ['leftlowerarm'],
      rightLowerArm: ['rightlowerarm'],
      leftHand: ['lefthand'],
      rightHand: ['righthand'],
      leftUpperLeg: ['leftupperleg'],
      rightUpperLeg: ['rightupperleg'],
      leftLowerLeg: ['leftlowerleg'],
      rightLowerLeg: ['rightlowerleg'],
      leftFoot: ['leftfoot'],
      rightFoot: ['rightfoot'],
      leftToes: ['lefttoes'],
      rightToes: ['righttoes']
    }
  }
};

export interface DetectionResult {
  preset: SkeletonType;
  boneMap: CanonicalBoneMap;
  unmappedBones: CanonicalBone[];
  confidence: number; // 0 to 1
  matchedCount: number;
}

/**
 * Auto-detects the best humanoid skeleton preset for a given set of bone names.
 */
export function detectBonePreset(rawBoneNames: string[]): DetectionResult {
  if (rawBoneNames.length === 0) {
    return {
      preset: 'custom',
      boneMap: {},
      unmappedBones: [...CANONICAL_BONES],
      confidence: 0,
      matchedCount: 0
    };
  }

  // Pre-normalize names for fast matching
  const nameMap = new Map<string, string>(); // lowercase -> original
  for (const name of rawBoneNames) {
    nameMap.set(name.toLowerCase(), name);
  }

  const presetsToTest: SkeletonType[] = ['mixamo', 'smpl', 'quaternius'];
  let bestPreset: SkeletonType = 'custom';
  let bestCount = -1;
  let bestMap: CanonicalBoneMap = {};
  let bestUnmapped: CanonicalBone[] = [...CANONICAL_BONES];

  for (const presetKey of presetsToTest) {
    const pattern = BONE_PRESET_PATTERNS[presetKey];
    const candidateMap: CanonicalBoneMap = {};
    const unmapped: CanonicalBone[] = [];
    let matchCount = 0;

    for (const canonical of CANONICAL_BONES) {
      const candidates = pattern.matchCandidates[canonical];
      let matchedOriginalName: string | null = null;

      // 1. Direct match with candidate names
      for (const cand of candidates) {
        if (nameMap.has(cand)) {
          matchedOriginalName = nameMap.get(cand)!;
          break;
        }
      }

      // 2. Fallback fuzzy match (e.g. mixamorig:Prefix stripped)
      if (!matchedOriginalName) {
        for (const [lowerName, origName] of nameMap.entries()) {
          const stripped = lowerName.replace(/^mixamorig[:_]?/, '').replace(/^def-/, '');
          if (candidates.some((c) => c.replace(/^mixamorig[:_]?/, '').replace(/^def-/, '') === stripped)) {
            matchedOriginalName = origName;
            break;
          }
        }
      }

      if (matchedOriginalName) {
        candidateMap[canonical] = matchedOriginalName;
        matchCount++;
      } else {
        unmapped.push(canonical);
      }
    }

    if (matchCount > bestCount) {
      bestCount = matchCount;
      bestPreset = presetKey;
      bestMap = candidateMap;
      bestUnmapped = unmapped;
    }
  }

  const confidence = bestCount / CANONICAL_BONES.length;
  return {
    preset: bestCount >= 5 ? bestPreset : 'custom',
    boneMap: bestMap,
    unmappedBones: bestUnmapped,
    confidence,
    matchedCount: bestCount
  };
}
