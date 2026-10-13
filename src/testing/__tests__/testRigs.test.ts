import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTestSkinnedMesh } from '../testRigs';
import { AnimationController } from '../../animation/animationController';
import { CharacterVisual } from '../../player/silhouette';

describe('TestRig Animation Check', () => {
  it('animates SkinnedMesh bones when clip plays', () => {
    const visual = new CharacterVisual();
    const scene = new THREE.Scene();
    const controller = new AnimationController(visual, scene, 'player');

    const rig = createTestSkinnedMesh('mixamo');
    controller.setupCharacter(rig.model, {
      id: 'test',
      name: 'test',
      modelAssetId: 'test',
      targetHeight: 1.8,
      forwardFix: 0,
      skeletonType: 'mixamo',
      boneMap: rig.boneMap,
      sockets: rig.sockets,
      animationMap: {}
    }, rig.clips, rig.skeleton);

    controller.play('run');
    expect(controller.getCurrentAnim()).toBe('run');
    expect(controller.isFallbackActive()).toBe(false);

    const legBone = rig.skeleton.bones.find((b) => b.name === 'mixamorig_LeftUpLeg');
    expect(legBone).toBeDefined();
    const initialRotX = legBone!.rotation.x;

    // Advance mixer by 0.2s
    controller.update(0.2);
    const updatedRotX = legBone!.rotation.x;

    console.log('Leg initial rotX:', initialRotX, 'updated rotX:', updatedRotX);
    expect(updatedRotX).not.toBe(initialRotX);
  });
});
