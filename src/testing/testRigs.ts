import * as THREE from 'three';
import { CanonicalBoneMap, SocketDefinition, AnimationEventItem } from '../data/schemas';

export interface GeneratedCharacterResult {
  model: THREE.Group;
  mesh: THREE.SkinnedMesh;
  skeleton: THREE.Skeleton;
  boneMap: CanonicalBoneMap;
  sockets: Record<string, SocketDefinition>;
  clips: THREE.AnimationClip[];
}

/**
 * Builds a code-generated skinned humanoid mesh and skeleton.
 * Type 'mixamo' uses mixamorig bone names and standard proportions.
 * Type 'smpl' uses SMPL academic names and taller/broader proportions.
 */
export function createTestSkinnedMesh(type: 'mixamo' | 'smpl' = 'mixamo'): GeneratedCharacterResult {
  const isMixamo = type === 'mixamo';
  const scaleY = isMixamo ? 1.0 : 1.1; // SMPL is slightly taller
  const shoulderWidth = isMixamo ? 0.32 : 0.40; // SMPL is broader

  // 1. Define bone names
  const names = isMixamo
    ? {
        root: 'Root',
        hips: 'mixamorig_Hips',
        spine: 'mixamorig_Spine',
        chest: 'mixamorig_Spine1',
        neck: 'mixamorig_Neck',
        head: 'mixamorig_Head',
        leftShoulder: 'mixamorig_LeftShoulder',
        rightShoulder: 'mixamorig_RightShoulder',
        leftUpperArm: 'mixamorig_LeftArm',
        rightUpperArm: 'mixamorig_RightArm',
        leftLowerArm: 'mixamorig_LeftForeArm',
        rightLowerArm: 'mixamorig_RightForeArm',
        leftHand: 'mixamorig_LeftHand',
        rightHand: 'mixamorig_RightHand',
        leftUpperLeg: 'mixamorig_LeftUpLeg',
        rightUpperLeg: 'mixamorig_RightUpLeg',
        leftLowerLeg: 'mixamorig_LeftLeg',
        rightLowerLeg: 'mixamorig_RightLeg',
        leftFoot: 'mixamorig_LeftFoot',
        rightFoot: 'mixamorig_RightFoot',
        leftToes: 'mixamorig_LeftToeBase',
        rightToes: 'mixamorig_RightToeBase'
      }
    : {
        root: 'root',
        hips: 'm_avg_Pelvis',
        spine: 'm_avg_Spine1',
        chest: 'm_avg_Spine2',
        neck: 'm_avg_Neck',
        head: 'm_avg_Head',
        leftShoulder: 'm_avg_L_Collar',
        rightShoulder: 'm_avg_R_Collar',
        leftUpperArm: 'm_avg_L_Shoulder',
        rightUpperArm: 'm_avg_R_Shoulder',
        leftLowerArm: 'm_avg_L_Elbow',
        rightLowerArm: 'm_avg_R_Elbow',
        leftHand: 'm_avg_L_Wrist',
        rightHand: 'm_avg_R_Wrist',
        leftUpperLeg: 'm_avg_L_Hip',
        rightUpperLeg: 'm_avg_R_Hip',
        leftLowerLeg: 'm_avg_L_Knee',
        rightLowerLeg: 'm_avg_R_Knee',
        leftFoot: 'm_avg_L_Ankle',
        rightFoot: 'm_avg_R_Ankle',
        leftToes: 'm_avg_L_Foot',
        rightToes: 'm_avg_R_Foot'
      };

  const boneMap: CanonicalBoneMap = {
    hips: names.hips,
    spine: names.spine,
    chest: names.chest,
    neck: names.neck,
    head: names.head,
    leftShoulder: names.leftShoulder,
    rightShoulder: names.rightShoulder,
    leftUpperArm: names.leftUpperArm,
    rightUpperArm: names.rightUpperArm,
    leftLowerArm: names.leftLowerArm,
    rightLowerArm: names.rightLowerArm,
    leftHand: names.leftHand,
    rightHand: names.rightHand,
    leftUpperLeg: names.leftUpperLeg,
    rightUpperLeg: names.rightUpperLeg,
    leftLowerLeg: names.leftLowerLeg,
    rightLowerLeg: names.rightLowerLeg,
    leftFoot: names.leftFoot,
    rightFoot: names.rightFoot,
    leftToes: names.leftToes,
    rightToes: names.rightToes
  };

  // 2. Create Bones Hierarchy
  const bones: THREE.Bone[] = [];
  const boneIndexMap = new Map<string, number>();

  const createBone = (name: string, pos: THREE.Vector3): THREE.Bone => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.copy(pos);
    boneIndexMap.set(name, bones.length);
    bones.push(b);
    return b;
  };

  const rootBone = createBone(names.root, new THREE.Vector3(0, 0, 0));
  const hips = createBone(names.hips, new THREE.Vector3(0, 0.95 * scaleY, 0));
  rootBone.add(hips);

  const spine = createBone(names.spine, new THREE.Vector3(0, 0.22 * scaleY, 0));
  hips.add(spine);

  const chest = createBone(names.chest, new THREE.Vector3(0, 0.22 * scaleY, 0));
  spine.add(chest);

  const neck = createBone(names.neck, new THREE.Vector3(0, 0.20 * scaleY, 0));
  chest.add(neck);

  const head = createBone(names.head, new THREE.Vector3(0, 0.16 * scaleY, 0));
  neck.add(head);

  // Arms
  const leftShoulder = createBone(names.leftShoulder, new THREE.Vector3(-0.16, 0.15 * scaleY, 0));
  chest.add(leftShoulder);
  const leftUpperArm = createBone(names.leftUpperArm, new THREE.Vector3(-(shoulderWidth - 0.16), 0, 0));
  leftShoulder.add(leftUpperArm);
  const leftLowerArm = createBone(names.leftLowerArm, new THREE.Vector3(-0.28, 0, 0));
  leftUpperArm.add(leftLowerArm);
  const leftHand = createBone(names.leftHand, new THREE.Vector3(-0.24, 0, 0));
  leftLowerArm.add(leftHand);

  const rightShoulder = createBone(names.rightShoulder, new THREE.Vector3(0.16, 0.15 * scaleY, 0));
  chest.add(rightShoulder);
  const rightUpperArm = createBone(names.rightUpperArm, new THREE.Vector3(shoulderWidth - 0.16, 0, 0));
  rightShoulder.add(rightUpperArm);
  const rightLowerArm = createBone(names.rightLowerArm, new THREE.Vector3(0.28, 0, 0));
  rightUpperArm.add(rightLowerArm);
  const rightHand = createBone(names.rightHand, new THREE.Vector3(0.24, 0, 0));
  rightLowerArm.add(rightHand);

  // Legs
  const legX = 0.16;
  const leftUpperLeg = createBone(names.leftUpperLeg, new THREE.Vector3(-legX, -0.05 * scaleY, 0));
  hips.add(leftUpperLeg);
  const leftLowerLeg = createBone(names.leftLowerLeg, new THREE.Vector3(0, -0.42 * scaleY, 0));
  leftUpperLeg.add(leftLowerLeg);
  const leftFoot = createBone(names.leftFoot, new THREE.Vector3(0, -0.40 * scaleY, 0));
  leftLowerLeg.add(leftFoot);
  const leftToes = createBone(names.leftToes, new THREE.Vector3(0, -0.08 * scaleY, 0.14));
  leftFoot.add(leftToes);

  const rightUpperLeg = createBone(names.rightUpperLeg, new THREE.Vector3(legX, -0.05 * scaleY, 0));
  hips.add(rightUpperLeg);
  const rightLowerLeg = createBone(names.rightLowerLeg, new THREE.Vector3(0, -0.42 * scaleY, 0));
  rightUpperLeg.add(rightLowerLeg);
  const rightFoot = createBone(names.rightFoot, new THREE.Vector3(0, -0.40 * scaleY, 0));
  rightLowerLeg.add(rightFoot);
  const rightToes = createBone(names.rightToes, new THREE.Vector3(0, -0.08 * scaleY, 0.14));
  rightFoot.add(rightToes);

  const skeleton = new THREE.Skeleton(bones);

  // 3. Build Skinned Mesh Geometry with Segmented Parts
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];

  const addBoxSegment = (
    w: number,
    h: number,
    d: number,
    center: THREE.Vector3,
    boneIndex: number
  ) => {
    const boxGeo = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
    boxGeo.translate(center.x, center.y, center.z);

    const posAttr = boxGeo.attributes.position;
    const normAttr = boxGeo.attributes.normal;
    const uvAttr = boxGeo.attributes.uv;
    const boxIndices = boxGeo.index!;

    const baseVertex = positions.length / 3;

    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
      uvs.push(uvAttr.getX(i), uvAttr.getY(i));
      skinIndices.push(boneIndex, 0, 0, 0);
      skinWeights.push(1.0, 0.0, 0.0, 0.0);
    }

    for (let i = 0; i < boxIndices.count; i++) {
      indices.push(baseVertex + boxIndices.getX(i));
    }
  };

  // Add body boxes attached to bones
  addBoxSegment(0.32, 0.20 * scaleY, 0.22, new THREE.Vector3(0, 0.95 * scaleY, 0), boneIndexMap.get(names.hips)!);
  addBoxSegment(0.30, 0.22 * scaleY, 0.20, new THREE.Vector3(0, 1.15 * scaleY, 0), boneIndexMap.get(names.spine)!);
  addBoxSegment(0.36, 0.24 * scaleY, 0.24, new THREE.Vector3(0, 1.35 * scaleY, 0), boneIndexMap.get(names.chest)!);
  addBoxSegment(0.24, 0.24 * scaleY, 0.24, new THREE.Vector3(0, 1.72 * scaleY, 0), boneIndexMap.get(names.head)!);

  // Left arm
  addBoxSegment(0.24, 0.12, 0.12, new THREE.Vector3(-0.35, 1.45 * scaleY, 0), boneIndexMap.get(names.leftUpperArm)!);
  addBoxSegment(0.22, 0.10, 0.10, new THREE.Vector3(-0.62, 1.45 * scaleY, 0), boneIndexMap.get(names.leftLowerArm)!);
  addBoxSegment(0.12, 0.12, 0.12, new THREE.Vector3(-0.80, 1.45 * scaleY, 0), boneIndexMap.get(names.leftHand)!);

  // Right arm
  addBoxSegment(0.24, 0.12, 0.12, new THREE.Vector3(0.35, 1.45 * scaleY, 0), boneIndexMap.get(names.rightUpperArm)!);
  addBoxSegment(0.22, 0.10, 0.10, new THREE.Vector3(0.62, 1.45 * scaleY, 0), boneIndexMap.get(names.rightLowerArm)!);
  addBoxSegment(0.12, 0.12, 0.12, new THREE.Vector3(0.80, 1.45 * scaleY, 0), boneIndexMap.get(names.rightHand)!);

  // Legs
  addBoxSegment(0.16, 0.38 * scaleY, 0.16, new THREE.Vector3(-legX, 0.70 * scaleY, 0), boneIndexMap.get(names.leftUpperLeg)!);
  addBoxSegment(0.14, 0.38 * scaleY, 0.14, new THREE.Vector3(-legX, 0.28 * scaleY, 0), boneIndexMap.get(names.leftLowerLeg)!);
  addBoxSegment(0.14, 0.10, 0.24, new THREE.Vector3(-legX, 0.05 * scaleY, 0.06), boneIndexMap.get(names.leftFoot)!);

  addBoxSegment(0.16, 0.38 * scaleY, 0.16, new THREE.Vector3(legX, 0.70 * scaleY, 0), boneIndexMap.get(names.rightUpperLeg)!);
  addBoxSegment(0.14, 0.38 * scaleY, 0.14, new THREE.Vector3(legX, 0.28 * scaleY, 0), boneIndexMap.get(names.rightLowerLeg)!);
  addBoxSegment(0.14, 0.10, 0.24, new THREE.Vector3(legX, 0.05 * scaleY, 0.06), boneIndexMap.get(names.rightFoot)!);

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices);

  // Material
  const material = new THREE.MeshStandardMaterial({
    color: isMixamo ? 0x2e3846 : 0x3d4b5e,
    roughness: 0.6,
    metalness: 0.2
  });

  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(rootBone);
  mesh.bind(skeleton);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const model = new THREE.Group();
  model.name = isMixamo ? 'Character_Test_Mixamo' : 'Character_Test_SMPL';
  model.add(mesh);

  // Sockets
  const sockets: Record<string, SocketDefinition> = {
    rightHandSocket: {
      bone: names.rightHand,
      position: [0.05, 0, 0],
      rotation: [0, 0, 0]
    },
    backSocket: {
      bone: names.chest,
      position: [0, 0, -0.16],
      rotation: [0, 0, 0]
    },
    headSocket: {
      bone: names.head,
      position: [0, 0.2, 0],
      rotation: [0, 0, 0]
    },
    chestSocket: {
      bone: names.chest,
      position: [0, 0, 0.16],
      rotation: [0, 0, 0]
    }
  };

  // 4. Generate Procedural Animation Clips for this Rig
  const clips = createProceduralClips(names, scaleY);

  return {
    model,
    mesh,
    skeleton,
    boneMap,
    sockets,
    clips
  };
}

/**
 * Creates procedural test animation clips (idle, walk, run, attack swings, hit, etc.)
 */
export function createProceduralClips(
  names: Record<string, string>,
  scaleY = 1.0
): THREE.AnimationClip[] {
  const clips: THREE.AnimationClip[] = [];

  // Helper for rotation tracks
  const makeRotTrack = (boneName: string, times: number[], quats: number[]) => {
    return new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, quats);
  };

  // Helper for position tracks
  const makePosTrack = (boneName: string, times: number[], pos: number[]) => {
    return new THREE.VectorKeyframeTrack(`${boneName}.position`, times, pos);
  };

  const eulerToQuat = (x: number, y: number, z: number) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
    return [q.x, q.y, q.z, q.w];
  };

  // 1. Idle (2s loop)
  {
    const times = [0, 1.0, 2.0];
    const spineQuats = [
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(0.04, 0, 0),
      ...eulerToQuat(0, 0, 0)
    ];
    const chestQuats = [
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(0.03, 0, 0),
      ...eulerToQuat(0, 0, 0)
    ];
    const leftArmIdle = [
      ...eulerToQuat(0, 0, -1.25),
      ...eulerToQuat(0, 0, -1.22),
      ...eulerToQuat(0, 0, -1.25)
    ];
    const rightArmIdle = [
      ...eulerToQuat(0, 0, 1.25),
      ...eulerToQuat(0, 0, 1.22),
      ...eulerToQuat(0, 0, 1.25)
    ];
    const idleTracks: THREE.KeyframeTrack[] = [
      makeRotTrack(names.spine, times, spineQuats),
      makeRotTrack(names.chest, times, chestQuats),
      makeRotTrack(names.leftUpperArm, times, leftArmIdle),
      makeRotTrack(names.rightUpperArm, times, rightArmIdle)
    ];
    clips.push(new THREE.AnimationClip('idle', 2.0, idleTracks));
  }

  // 2. Walk (1.0s in-place loop)
  {
    const times = [0, 0.25, 0.5, 0.75, 1.0];
    const leftLegQuats = [
      ...eulerToQuat(0.4, 0, 0),
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(-0.4, 0, 0),
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(0.4, 0, 0)
    ];
    const rightLegQuats = [
      ...eulerToQuat(-0.4, 0, 0),
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(0.4, 0, 0),
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(-0.4, 0, 0)
    ];
    const leftArmQuats = [
      ...eulerToQuat(-0.3, 0, -1.1),
      ...eulerToQuat(0, 0, -1.1),
      ...eulerToQuat(0.3, 0, -1.1),
      ...eulerToQuat(0, 0, -1.1),
      ...eulerToQuat(-0.3, 0, -1.1)
    ];
    const rightArmQuats = [
      ...eulerToQuat(0.3, 0, 1.1),
      ...eulerToQuat(0, 0, 1.1),
      ...eulerToQuat(-0.3, 0, 1.1),
      ...eulerToQuat(0, 0, 1.1),
      ...eulerToQuat(0.3, 0, 1.1)
    ];
    // In-place hips bob (Y bob only, X and Z are strictly 0)
    const baseHipsY = 0.95 * scaleY;
    const hipsPositions = [
      0, baseHipsY, 0,
      0, baseHipsY + 0.04, 0,
      0, baseHipsY, 0,
      0, baseHipsY + 0.04, 0,
      0, baseHipsY, 0
    ];

    clips.push(
      new THREE.AnimationClip('walk', 1.0, [
        makeRotTrack(names.leftUpperLeg, times, leftLegQuats),
        makeRotTrack(names.rightUpperLeg, times, rightLegQuats),
        makeRotTrack(names.leftUpperArm, times, leftArmQuats),
        makeRotTrack(names.rightUpperArm, times, rightArmQuats),
        makePosTrack(names.hips, times, hipsPositions)
      ])
    );
  }

  // 3. Run (0.7s in-place loop)
  {
    const times = [0, 0.175, 0.35, 0.525, 0.7];
    const leftLegQuats = [
      ...eulerToQuat(0.7, 0, 0),
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(-0.7, 0, 0),
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(0.7, 0, 0)
    ];
    const rightLegQuats = [
      ...eulerToQuat(-0.7, 0, 0),
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(0.7, 0, 0),
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(-0.7, 0, 0)
    ];
    const leftArmQuats = [
      ...eulerToQuat(-0.6, 0, -1.0),
      ...eulerToQuat(0, 0, -1.0),
      ...eulerToQuat(0.6, 0, -1.0),
      ...eulerToQuat(0, 0, -1.0),
      ...eulerToQuat(-0.6, 0, -1.0)
    ];
    const rightArmQuats = [
      ...eulerToQuat(0.6, 0, 1.0),
      ...eulerToQuat(0, 0, 1.0),
      ...eulerToQuat(-0.6, 0, 1.0),
      ...eulerToQuat(0, 0, 1.0),
      ...eulerToQuat(0.6, 0, 1.0)
    ];
    const spineQuats = [
      ...eulerToQuat(0.15, 0, 0),
      ...eulerToQuat(0.15, 0.05, 0),
      ...eulerToQuat(0.15, 0, 0),
      ...eulerToQuat(0.15, -0.05, 0),
      ...eulerToQuat(0.15, 0, 0)
    ];
    const baseHipsY = 0.95 * scaleY;
    const hipsPositions = [
      0, baseHipsY, 0,
      0, baseHipsY + 0.05, 0,
      0, baseHipsY, 0,
      0, baseHipsY + 0.05, 0,
      0, baseHipsY, 0
    ];
    clips.push(
      new THREE.AnimationClip('run', 0.7, [
        makeRotTrack(names.leftUpperLeg, times, leftLegQuats),
        makeRotTrack(names.rightUpperLeg, times, rightLegQuats),
        makeRotTrack(names.leftUpperArm, times, leftArmQuats),
        makeRotTrack(names.rightUpperArm, times, rightArmQuats),
        makeRotTrack(names.spine, times, spineQuats),
        makePosTrack(names.hips, times, hipsPositions)
      ])
    );
  }

  // 4. Attack Light 1 (0.56s one-shot, startup 0.18s, active 0.10s, recovery 0.28s)
  {
    const times = [0, 0.18, 0.28, 0.56];
    const rightArmQuats = [
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(-0.8, 0.4, -0.4), // windup
      ...eulerToQuat(1.2, -0.4, 0.2),  // active forward swing
      ...eulerToQuat(0, 0, 0)          // recovery neutral
    ];
    const spineQuats = [
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(0, -0.3, 0),
      ...eulerToQuat(0.1, 0.4, 0),
      ...eulerToQuat(0, 0, 0)
    ];
    clips.push(
      new THREE.AnimationClip('attack_light_1', 0.56, [
        makeRotTrack(names.rightUpperArm, times, rightArmQuats),
        makeRotTrack(names.spine, times, spineQuats)
      ])
    );
  }

  // 5. Attack Light 2 (0.56s one-shot)
  {
    const times = [0, 0.16, 0.26, 0.56];
    const rightArmQuats = [
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(0.5, 0, 0.6),
      ...eulerToQuat(-0.7, 1.2, -0.5),
      ...eulerToQuat(0, 0, 0)
    ];
    clips.push(
      new THREE.AnimationClip('attack_light_2', 0.56, [
        makeRotTrack(names.rightUpperArm, times, rightArmQuats)
      ])
    );
  }

  // 6. Attack Light 3 (0.86s one-shot, overhead slam)
  {
    const times = [0, 0.22, 0.36, 0.86];
    const rightArmQuats = [
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(-2.0, 0, 0), // raised high overhead
      ...eulerToQuat(1.1, 0, 0),  // slammed down
      ...eulerToQuat(0, 0, 0)
    ];
    clips.push(
      new THREE.AnimationClip('attack_light_3', 0.86, [
        makeRotTrack(names.rightUpperArm, times, rightArmQuats)
      ])
    );
  }

  // 7. Attack Heavy (1.31s one-shot)
  {
    const times = [0, 0.55, 0.71, 1.31];
    const rightArmQuats = [
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(-1.2, 0.8, -0.6), // deep windup
      ...eulerToQuat(1.3, -1.2, 0.6),  // heavy smash
      ...eulerToQuat(0, 0, 0)
    ];
    clips.push(
      new THREE.AnimationClip('attack_heavy', 1.31, [
        makeRotTrack(names.rightUpperArm, times, rightArmQuats)
      ])
    );
  }

  // 8. Hit (0.25s flinch)
  {
    const times = [0, 0.12, 0.25];
    const spineQuats = [
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(-0.35, 0, 0), // recoil back
      ...eulerToQuat(0, 0, 0)
    ];
    clips.push(
      new THREE.AnimationClip('hit', 0.25, [
        makeRotTrack(names.spine, times, spineQuats)
      ])
    );
  }

  // 9. Stagger (1.0s heavy stun)
  {
    const times = [0, 0.2, 0.8, 1.0];
    const spineQuats = [
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(0.4, 0, 0),
      ...eulerToQuat(0.35, 0, 0),
      ...eulerToQuat(0, 0, 0)
    ];
    clips.push(
      new THREE.AnimationClip('stagger', 1.0, [
        makeRotTrack(names.spine, times, spineQuats)
      ])
    );
  }

  // 10. Death (2.0s collapse)
  {
    const times = [0, 0.8, 2.0];
    const spineQuats = [
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(-1.4, 0, 0),
      ...eulerToQuat(-1.5, 0, 0)
    ];
    clips.push(
      new THREE.AnimationClip('death', 2.0, [
        makeRotTrack(names.spine, times, spineQuats)
      ])
    );
  }

  // 11. Dodge (0.45s roll)
  {
    const times = [0, 0.22, 0.45];
    const spineQuats = [
      ...eulerToQuat(0, 0, 0),
      ...eulerToQuat(Math.PI, 0, 0),
      ...eulerToQuat(Math.PI * 2, 0, 0)
    ];
    clips.push(
      new THREE.AnimationClip('dodge', 0.45, [
        makeRotTrack(names.spine, times, spineQuats)
      ])
    );
  }

  return clips;
}

export const TEST_ANIMATION_EVENTS: Record<string, AnimationEventItem[]> = {
  attack_light_1: [
    { time: 0.18, event: 'hitboxOn' },
    { time: 0.28, event: 'hitboxOff' },
    { time: 0.20, event: 'comboWindowOpen' }
  ],
  attack_light_2: [
    { time: 0.16, event: 'hitboxOn' },
    { time: 0.26, event: 'hitboxOff' },
    { time: 0.18, event: 'comboWindowOpen' }
  ],
  attack_light_3: [
    { time: 0.22, event: 'hitboxOn' },
    { time: 0.36, event: 'hitboxOff' }
  ],
  attack_heavy: [
    { time: 0.55, event: 'hitboxOn' },
    { time: 0.71, event: 'hitboxOff' }
  ],
  walk: [
    { time: 0.25, event: 'footstepLeft' },
    { time: 0.75, event: 'footstepRight' }
  ]
};
