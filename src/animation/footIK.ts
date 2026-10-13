import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../engine/physics';
import { CanonicalBoneMap } from '../data/schemas';

export interface FootIKConfig {
  enabled: boolean;
  rayLength: number;
  maxAdjust: number;
  smoothingSpeed: number;
  footOffset: number; // height of ankle above sole of foot (~0.08m)
}

export const DEFAULT_FOOT_IK_CONFIG: FootIKConfig = {
  enabled: true,
  rayLength: 1.2,
  maxAdjust: 0.45,
  smoothingSpeed: 16.0,
  footOffset: 0.08
};

interface LegBones {
  upperLeg: THREE.Bone | null;
  lowerLeg: THREE.Bone | null;
  foot: THREE.Bone | null;
}

export class FootIKSolver {
  public config: FootIKConfig = { ...DEFAULT_FOOT_IK_CONFIG };

  private hipsBone: THREE.Bone | null = null;
  public baseHipsY = 0;
  private leftLeg: LegBones = { upperLeg: null, lowerLeg: null, foot: null };
  private rightLeg: LegBones = { upperLeg: null, lowerLeg: null, foot: null };

  // Current smoothed state
  private leftFootTargetY = 0;
  private rightFootTargetY = 0;
  private leftGroundNormal = new THREE.Vector3(0, 1, 0);
  private rightGroundNormal = new THREE.Vector3(0, 1, 0);
  private pelvisOffsetY = 0;
  private currentWeight = 1.0;

  // Reusable math objects to avoid per-frame allocations
  private tempVec1 = new THREE.Vector3();
  private tempVec2 = new THREE.Vector3();
  private tempVec3 = new THREE.Vector3();
  private rayOrigin = new THREE.Vector3();
  private rayDir = new THREE.Vector3(0, -1, 0);

  public setup(skeleton: THREE.Skeleton, boneMap: CanonicalBoneMap): void {
    const findBone = (boneName?: string): THREE.Bone | null => {
      if (!boneName) return null;
      const lower = boneName.toLowerCase();
      return skeleton.bones.find((b) => b.name.toLowerCase() === lower) || null;
    };

    this.hipsBone = findBone(boneMap.hips);
    if (this.hipsBone) {
      this.baseHipsY = this.hipsBone.position.y;
    }
    this.leftLeg = {
      upperLeg: findBone(boneMap.leftUpperLeg),
      lowerLeg: findBone(boneMap.leftLowerLeg),
      foot: findBone(boneMap.leftFoot)
    };
    this.rightLeg = {
      upperLeg: findBone(boneMap.rightUpperLeg),
      lowerLeg: findBone(boneMap.rightLowerLeg),
      foot: findBone(boneMap.rightFoot)
    };
  }

  public setWeight(weight: number): void {
    this.currentWeight = THREE.MathUtils.clamp(weight, 0, 1);
  }

  public getWeight(): number {
    return this.currentWeight;
  }

  /**
   * Evaluates Foot IK and adjusts leg bones on the active character skeleton.
   */
  public solve(
    physics: PhysicsWorld,
    dt: number,
    playerCollider?: RAPIER.Collider,
    stateContext?: { isGrounded: boolean; isDodge: boolean; isAirborne: boolean; isLunge: boolean }
  ): void {
    if (!this.config.enabled || !this.hipsBone) return;

    // Check state blend-out conditions
    let targetWeight = 1.0;
    if (stateContext) {
      if (!stateContext.isGrounded || stateContext.isAirborne || stateContext.isDodge || stateContext.isLunge) {
        targetWeight = 0.0;
      }
    }

    // Smooth weight transition
    const smoothFactor = 1.0 - Math.exp(-this.config.smoothingSpeed * dt);
    this.currentWeight = THREE.MathUtils.lerp(this.currentWeight, targetWeight, smoothFactor);

    if (this.currentWeight < 0.01) {
      // Virtually zero weight, skip IK modifications
      return;
    }

    // 1. Raycast ground for Left and Right feet
    const leftHit = this.sampleGround(this.leftLeg.foot, physics, playerCollider);
    const rightHit = this.sampleGround(this.rightLeg.foot, physics, playerCollider);

    // 2. Smooth ground targets
    if (leftHit) {
      this.leftFootTargetY = THREE.MathUtils.lerp(this.leftFootTargetY, leftHit.point.y + this.config.footOffset, smoothFactor);
      this.leftGroundNormal.lerp(leftHit.normal, smoothFactor).normalize();
    }
    if (rightHit) {
      this.rightFootTargetY = THREE.MathUtils.lerp(this.rightFootTargetY, rightHit.point.y + this.config.footOffset, smoothFactor);
      this.rightGroundNormal.lerp(rightHit.normal, smoothFactor).normalize();
    }

    // 3. Pelvis height compensation
    if (this.leftLeg.foot && this.rightLeg.foot) {
      this.leftLeg.foot.getWorldPosition(this.tempVec1);
      this.rightLeg.foot.getWorldPosition(this.tempVec2);

      const leftDelta = this.leftFootTargetY - this.tempVec1.y;
      const rightDelta = this.rightFootTargetY - this.tempVec2.y;

      const targetPelvisOffset = Math.max(-this.config.maxAdjust, Math.min(0, Math.min(leftDelta, rightDelta)));
      this.pelvisOffsetY = THREE.MathUtils.lerp(this.pelvisOffsetY, targetPelvisOffset, smoothFactor);

      // Apply pelvis offset scaled by weight relative to base hips height
      this.hipsBone.position.y = this.baseHipsY + this.pelvisOffsetY * this.currentWeight;
    }

    // 4. Two-bone IK for left and right legs
    this.solveLegIK(this.leftLeg, this.leftFootTargetY, this.leftGroundNormal);
    this.solveLegIK(this.rightLeg, this.rightFootTargetY, this.rightGroundNormal);
  }

  private sampleGround(
    footBone: THREE.Bone | null,
    physics: PhysicsWorld,
    playerCollider?: RAPIER.Collider
  ): { point: THREE.Vector3; normal: THREE.Vector3 } | null {
    if (!footBone) return null;

    footBone.getWorldPosition(this.rayOrigin);
    // Cast from 0.4m above foot down to rayLength below
    this.rayOrigin.y += 0.4;

    const hit = physics.castRay(this.rayOrigin, this.rayDir, this.config.rayLength, playerCollider);
    if (hit && hit.hit) {
      return {
        point: hit.point,
        normal: hit.normal
      };
    }
    return null;
  }

  private solveLegIK(
    leg: LegBones,
    targetFootY: number,
    groundNormal: THREE.Vector3
  ): void {
    if (!leg.upperLeg || !leg.lowerLeg || !leg.foot) return;

    // Get current world positions
    leg.upperLeg.getWorldPosition(this.tempVec1); // Hip position A
    leg.lowerLeg.getWorldPosition(this.tempVec2); // Knee position B
    leg.foot.getWorldPosition(this.tempVec3);     // Foot position C

    const footDelta = targetFootY - this.tempVec3.y;
    // On flat ground or when foot is already close to target ground height, preserve locomotion swing
    if (Math.abs(footDelta) < 0.02) {
      return;
    }

    const boneB = leg.lowerLeg;
    const boneC = leg.foot;

    const lenThigh = this.tempVec1.distanceTo(this.tempVec2);
    const lenShin = this.tempVec2.distanceTo(this.tempVec3);

    // Target foot position in world space
    const targetFootPos = this.tempVec3.clone();
    targetFootPos.y = targetFootY;

    // Distance from hip to target foot
    const distToTarget = this.tempVec1.distanceTo(targetFootPos);
    const maxReach = (lenThigh + lenShin) * 0.999;
    const minReach = Math.abs(lenThigh - lenShin) + 0.001;
    const clampedDist = THREE.MathUtils.clamp(distToTarget, minReach, maxReach);

    // Law of cosines for knee angle
    // c^2 = a^2 + b^2 - 2ab * cos(angle)
    const cosKnee = (lenThigh * lenThigh + lenShin * lenShin - clampedDist * clampedDist) / (2 * lenThigh * lenShin);
    const kneeAngle = Math.acos(THREE.MathUtils.clamp(cosKnee, -1, 1));

    // Knee bend delta (blend by current weight)
    const kneeDelta = (Math.PI - kneeAngle) * this.currentWeight;
    boneB.rotation.x = THREE.MathUtils.lerp(boneB.rotation.x, kneeDelta, this.currentWeight);

    // Align foot rotation with ground normal
    if (groundNormal.y > 0.5) {
      const up = new THREE.Vector3(0, 1, 0);
      const alignQ = new THREE.Quaternion().setFromUnitVectors(up, groundNormal);
      boneC.quaternion.slerp(boneC.quaternion.clone().multiply(alignQ), this.currentWeight * 0.5);
    }
  }
}
