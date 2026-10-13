export type SkeletonType = 'mixamo' | 'smpl' | 'quaternius' | 'custom';

export type CanonicalBone =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftUpperArm'
  | 'rightUpperArm'
  | 'leftLowerArm'
  | 'rightLowerArm'
  | 'leftHand'
  | 'rightHand'
  | 'leftUpperLeg'
  | 'rightUpperLeg'
  | 'leftLowerLeg'
  | 'rightLowerLeg'
  | 'leftFoot'
  | 'rightFoot'
  | 'leftToes'
  | 'rightToes';

export type CanonicalBoneMap = Partial<Record<CanonicalBone, string>>;

export interface SocketDefinition {
  bone: string;
  position: [number, number, number];
  rotation: [number, number, number]; // Euler angles in radians
  scale?: [number, number, number];
}

export type AnimationLayerType = 'base' | 'upper' | 'additive';
export type RootMotionType = 'none' | 'xz' | 'full';

export interface ClipMapping {
  library: string;
  clipName: string;
  speed?: number;
  loop?: boolean;
  blendIn?: number;
  blendOut?: number;
  layer?: AnimationLayerType;
  strideLength?: number; // meters per cycle for foot sliding mitigation
  activeStart?: number; // time in clip where active hitbox starts
  activeEnd?: number;   // time in clip where active hitbox ends
  rootMotion?: RootMotionType;
}

export type LogicalAnimationName =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sprint'
  | 'jump_start'
  | 'airborne'
  | 'land'
  | 'dodge'
  | 'attack_light_1'
  | 'attack_light_2'
  | 'attack_light_3'
  | 'attack_heavy'
  | 'cast'
  | 'hit'
  | 'stagger'
  | 'death'
  | 'boss_idle'
  | 'boss_swing_1'
  | 'boss_swing_2'
  | 'boss_slam'
  | 'boss_phase_transition'
  | 'boss_death'
  | 'enemy_idle'
  | 'enemy_walk'
  | 'enemy_attack_1'
  | 'enemy_hit'
  | 'enemy_death'
  | string;

export interface CharacterDefinition {
  id: string;
  name: string;
  modelAssetId: string;
  targetHeight: number; // in meters (e.g. 1.8)
  forwardFix: number;   // Y rotation in radians (e.g. 0, Math.PI, etc.)
  skeletonType: SkeletonType;
  boneMap: CanonicalBoneMap;
  sockets: Record<string, SocketDefinition>;
  animationMap: Record<LogicalAnimationName, ClipMapping>;
}

export interface CharacterAssetEntry {
  id: string;
  name: string;
  glbPath: string;
  definitionPath: string;
  scale?: number;
  forwardFix?: number;
  metadata?: Record<string, unknown>;
}

export interface PropAssetEntry {
  id: string;
  name: string;
  glbPath: string;
  scale?: number;
  metadata?: Record<string, unknown>;
}

export interface AnimationLibraryEntry {
  id: string;
  name: string;
  glbPath: string;
  eventsPath?: string;
  metadata?: Record<string, unknown>;
}

export interface AssetManifest {
  version: string;
  characters: Record<string, CharacterAssetEntry>;
  props: Record<string, PropAssetEntry>;
  animationLibraries: Record<string, AnimationLibraryEntry>;
}

export interface AnimationEventItem {
  time: number;
  event: 'hitboxOn' | 'hitboxOff' | 'footstepLeft' | 'footstepRight' | 'vfxSpawn' | 'soundCue' | 'comboWindowOpen' | string;
  payload?: Record<string, unknown>;
}

export interface AnimationEventsFile {
  libraryId: string;
  events: Record<string, AnimationEventItem[]>; // clipName -> events
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
}

export function validateManifest(data: unknown): { valid: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, issues: [{ type: 'error', message: 'Manifest must be an object' }] };
  }

  const manifest = data as Partial<AssetManifest>;
  if (!manifest.version) {
    issues.push({ type: 'warning', message: 'Manifest missing version string', field: 'version' });
  }
  if (!manifest.characters || typeof manifest.characters !== 'object') {
    issues.push({ type: 'error', message: 'Manifest missing "characters" map', field: 'characters' });
  } else {
    for (const [id, char] of Object.entries(manifest.characters)) {
      if (!char.glbPath) {
        issues.push({ type: 'error', message: `Character "${id}" missing glbPath`, field: `characters.${id}.glbPath` });
      }
      if (!char.definitionPath) {
        issues.push({ type: 'error', message: `Character "${id}" missing definitionPath`, field: `characters.${id}.definitionPath` });
      }
    }
  }

  if (!manifest.animationLibraries || typeof manifest.animationLibraries !== 'object') {
    issues.push({ type: 'warning', message: 'Manifest missing "animationLibraries" map', field: 'animationLibraries' });
  }

  return {
    valid: !issues.some((i) => i.type === 'error'),
    issues
  };
}

export function validateCharacterDefinition(data: unknown): { valid: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, issues: [{ type: 'error', message: 'Character definition must be an object' }] };
  }

  const def = data as Partial<CharacterDefinition>;
  if (!def.id) issues.push({ type: 'error', message: 'Character definition missing id', field: 'id' });
  if (!def.modelAssetId) issues.push({ type: 'error', message: 'Character definition missing modelAssetId', field: 'modelAssetId' });
  if (typeof def.targetHeight !== 'number' || def.targetHeight <= 0) {
    issues.push({ type: 'error', message: 'targetHeight must be a positive number', field: 'targetHeight' });
  }
  if (!def.boneMap || typeof def.boneMap !== 'object') {
    issues.push({ type: 'error', message: 'Character definition missing boneMap', field: 'boneMap' });
  }
  if (!def.sockets || typeof def.sockets !== 'object') {
    issues.push({ type: 'warning', message: 'Character definition missing sockets map', field: 'sockets' });
  }
  if (!def.animationMap || typeof def.animationMap !== 'object') {
    issues.push({ type: 'warning', message: 'Character definition missing animationMap', field: 'animationMap' });
  }

  return {
    valid: !issues.some((i) => i.type === 'error'),
    issues
  };
}
