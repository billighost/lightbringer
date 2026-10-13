import * as THREE from 'three';
import { CharacterVisual } from '../player/silhouette';
import { CharacterDefinition, ClipMapping, CanonicalBoneMap } from '../data/schemas';
import { UPPER_BODY_BONES } from './canonicalBones';
import { warpAnimationClipToCombat } from './timeWarp';
import { AnimationEventManager } from './animationEvents';
import { FootIKSolver } from './footIK';
import { ATTACKS } from '../data/attacks';
import { TEST_ANIMATION_EVENTS } from '../testing/testRigs';
import { PhysicsWorld } from '../engine/physics';
import RAPIER from '@dimforge/rapier3d-compat';

export interface LayerState {
  baseWeight: number;
  upperWeight: number;
  additiveWeight: number;
  activeBaseClip: string;
  activeUpperClip: string;
  activeAdditiveClip: string;
}

export class AnimationController {
  private visual: CharacterVisual;
  private mixer: THREE.AnimationMixer | null = null;

  // Character Data
  private definition: CharacterDefinition | null = null;
  private skeleton: THREE.Skeleton | null = null;
  private clipsByName: Map<string, THREE.AnimationClip> = new Map();

  // Active Actions
  private baseAction: THREE.AnimationAction | null = null;
  private upperAction: THREE.AnimationAction | null = null;
  private additiveAction: THREE.AnimationAction | null = null;

  private currentLogicalAnim = 'idle';
  private previousBaseLogicalAnim = 'idle';
  private animTime = 0;
  private animDuration = 1.0;

  // Layer Weights
  private baseWeight = 1.0;
  private upperWeight = 0.0;
  private additiveWeight = 0.0;
  private targetUpperWeight = 0.0;
  private targetAdditiveWeight = 0.0;

  // Procedural Fallback State
  private fallbackActive = false;
  private fallbackReason = 'Procedural fallback';

  // Subsystems
  public readonly footIK: FootIKSolver;
  public readonly eventManager: AnimationEventManager;

  // Weapon Ribbon Trail
  private trailEnabled = false;
  private trailGeometry: THREE.BufferGeometry;
  private trailMaterial: THREE.MeshBasicMaterial;
  private trailMesh: THREE.Mesh;
  private maxTrailPoints = 30;
  private trailHistory: { top: THREE.Vector3; bottom: THREE.Vector3; time: number }[] = [];
  private trailPositions: Float32Array;
  private trailColors: Float32Array;

  // Temporary vectors
  private tempVec1 = new THREE.Vector3();
  private tempVec2 = new THREE.Vector3();

  constructor(visual: CharacterVisual, scene: THREE.Scene, entityId = 'player') {
    this.visual = visual;
    this.footIK = new FootIKSolver();
    this.eventManager = new AnimationEventManager(entityId);

    // Register built-in test animation events
    for (const [clipName, events] of Object.entries(TEST_ANIMATION_EVENTS)) {
      this.eventManager.registerEvents(clipName, events);
    }

    // Initialize ribbon trail mesh
    const vertexCount = (this.maxTrailPoints - 1) * 6;
    this.trailPositions = new Float32Array(vertexCount * 3);
    this.trailColors = new Float32Array(vertexCount * 3);

    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    this.trailGeometry.setAttribute('color', new THREE.BufferAttribute(this.trailColors, 3));

    this.trailMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.trailMesh = new THREE.Mesh(this.trailGeometry, this.trailMaterial);
    this.trailMesh.frustumCulled = false;
    scene.add(this.trailMesh);
  }

  /**
   * Configures the animation controller with a character model, skeleton, and clips.
   */
  public setupCharacter(
    model: THREE.Object3D,
    definition: CharacterDefinition,
    clips: THREE.AnimationClip[],
    skeleton?: THREE.Skeleton
  ): void {
    this.definition = definition;
    this.clipsByName.clear();

    // Find skeleton if not provided
    if (!skeleton) {
      model.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.skeleton) {
          skeleton = child.skeleton;
        }
      });
    }
    this.skeleton = skeleton || null;

    // Create AnimationMixer on model root
    this.mixer = new THREE.AnimationMixer(model);

    // Setup Foot IK if skeleton is present
    if (this.skeleton && this.definition.boneMap) {
      this.footIK.setup(this.skeleton, this.definition.boneMap);
    }

    // Process and index clips
    for (const clip of clips) {
      this.clipsByName.set(clip.name, clip);
    }

    // Setup sockets (attach visual staff to right hand socket if present)
    this.attachSockets(model);

    // Listen to mixer finished events for one-shot transitions
    this.mixer.addEventListener('finished', (e: any) => {
      this.handleActionFinished(e.action);
    });

    // Reset playback to idle
    this.play('idle');
  }

  private attachSockets(model: THREE.Object3D): void {
    if (!this.definition?.sockets) return;

    const rightHandSocket = this.definition.sockets.rightHandSocket;
    if (rightHandSocket && this.visual.staffPivot) {
      let foundBone: THREE.Object3D | null = null;
      model.traverse((child) => {
        if (child.name.toLowerCase() === rightHandSocket.bone.toLowerCase()) {
          foundBone = child;
        }
      });

      const handBone = foundBone as THREE.Object3D | null;
      if (handBone) {
        (handBone as THREE.Object3D).add(this.visual.staffPivot);
        this.visual.staffPivot.position.set(
          rightHandSocket.position[0],
          rightHandSocket.position[1],
          rightHandSocket.position[2]
        );
        this.visual.staffPivot.rotation.set(
          rightHandSocket.rotation[0],
          rightHandSocket.rotation[1],
          rightHandSocket.rotation[2]
        );
      }
    }
  }

  public play(logicalName: string, duration?: number): void {
    if (this.currentLogicalAnim === logicalName && (logicalName === 'run' || logicalName === 'walk' || logicalName === 'idle')) {
      return;
    }

    this.currentLogicalAnim = logicalName;
    this.animTime = 0;
    this.animDuration = duration || this.getDefaultDuration(logicalName);

    // Check weapon trail
    if (logicalName.startsWith('attack_')) {
      // Activated during active attack phase
    } else {
      this.trailEnabled = false;
    }

    // If no mixer or model is missing, use procedural fallback directly
    if (!this.mixer || this.clipsByName.size === 0) {
      this.fallbackActive = true;
      this.fallbackReason = !this.mixer ? 'No AnimationMixer attached' : 'No clips loaded';
      return;
    }

    // Find mapped clip or fallback to logicalName
    const mapping: ClipMapping | undefined = this.definition?.animationMap?.[logicalName];
    const clipName = mapping?.clipName || logicalName;
    let clip = this.clipsByName.get(clipName);

    // Check if retargeting or library mapping is needed
    if (!clip && mapping?.library) {
      // Try to find clip by logical name
      clip = this.clipsByName.get(logicalName);
    }

    if (!clip) {
      // Missing clip: trigger procedural fallback
      this.fallbackActive = true;
      this.fallbackReason = `Clip "${clipName}" missing for "${logicalName}"`;
      return;
    }

    this.fallbackActive = false;
    this.eventManager.resetPlayback(clipName);

    // Determine target layer: 'base' | 'upper' | 'additive'
    const layer = mapping?.layer || (logicalName.startsWith('attack_') ? 'upper' : logicalName === 'hit' ? 'additive' : 'base');

    if (layer === 'upper') {
      this.playUpperBodyClip(clip, mapping, logicalName);
    } else if (layer === 'additive') {
      this.playAdditiveClip(clip, mapping);
    } else {
      this.playBaseClip(clip, mapping, logicalName);
    }
  }

  private playBaseClip(clip: THREE.AnimationClip, mapping?: ClipMapping, logicalName?: string): void {
    if (!this.mixer) return;

    const blendIn = mapping?.blendIn ?? 0.2;
    const isLoop = mapping?.loop ?? (logicalName === 'idle' || logicalName === 'walk' || logicalName === 'run');

    const newAction = this.mixer.clipAction(clip);
    newAction.reset();
    newAction.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
    newAction.clampWhenFinished = !isLoop;
    newAction.setEffectiveWeight(1.0);

    if (this.baseAction && this.baseAction !== newAction) {
      newAction.crossFadeFrom(this.baseAction, blendIn, true);
    }
    newAction.play();
    this.baseAction = newAction;

    if (isLoop && logicalName) {
      this.previousBaseLogicalAnim = logicalName;
    }

    // Ease out upper body layer when entering a full base animation
    if (!logicalName?.startsWith('attack_')) {
      this.targetUpperWeight = 0.0;
    }
  }

  private playUpperBodyClip(clip: THREE.AnimationClip, mapping?: ClipMapping, logicalName?: string): void {
    if (!this.mixer || !this.definition?.boneMap) return;

    // Time-warp attack clip to combat data if attack config exists
    let activeClip = clip;
    const attackKey = logicalName?.replace('attack_', '') || '';
    const attackConfig = ATTACKS[attackKey];

    if (attackConfig) {
      const markers = {
        activeStart: mapping?.activeStart,
        activeEnd: mapping?.activeEnd
      };
      const combatTimings = {
        startup: attackConfig.startup,
        active: attackConfig.active,
        recovery: attackConfig.recovery
      };
      const warpRes = warpAnimationClipToCombat(clip, markers, combatTimings);
      activeClip = warpRes.warpedClip;
    }

    // Filter tracks to upper-body bones only
    const upperMaskClip = this.createUpperBodyMaskedClip(activeClip, this.definition.boneMap);

    const action = this.mixer.clipAction(upperMaskClip);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.setEffectiveWeight(1.0);

    if (this.upperAction && this.upperAction !== action) {
      action.crossFadeFrom(this.upperAction, mapping?.blendIn ?? 0.1, true);
    }
    action.play();
    this.upperAction = action;
    this.targetUpperWeight = 1.0;
    this.upperWeight = 1.0;
  }

  private playAdditiveClip(clip: THREE.AnimationClip, mapping?: ClipMapping): void {
    if (!this.mixer) return;

    const action = this.mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.blendMode = THREE.AdditiveAnimationBlendMode;
    action.timeScale = mapping?.speed ?? 1.0;
    action.setEffectiveWeight(1.0);
    action.play();

    this.additiveAction = action;
    this.targetAdditiveWeight = 1.0;
    this.additiveWeight = 1.0;
  }

  private createUpperBodyMaskedClip(clip: THREE.AnimationClip, boneMap: CanonicalBoneMap): THREE.AnimationClip {
    const upperBoneNames = new Set<string>();
    for (const canonical of UPPER_BODY_BONES) {
      const mapped = boneMap[canonical];
      if (mapped) upperBoneNames.add(mapped.toLowerCase());
    }

    const filteredTracks: THREE.KeyframeTrack[] = [];
    for (const track of clip.tracks) {
      const dotIndex = track.name.lastIndexOf('.');
      const boneName = (dotIndex !== -1 ? track.name.substring(0, dotIndex) : track.name).toLowerCase();

      if (upperBoneNames.has(boneName)) {
        filteredTracks.push(track.clone());
      }
    }

    return new THREE.AnimationClip(`${clip.name}_upper`, clip.duration, filteredTracks.length > 0 ? filteredTracks : clip.tracks);
  }

  private handleActionFinished(finishedAction: THREE.AnimationAction): void {
    if (finishedAction === this.upperAction) {
      this.targetUpperWeight = 0.0;
      this.upperAction = null;
      // Return smoothly to previous base locomotion
      if (this.baseAction && !this.baseAction.isRunning()) {
        this.baseAction.play();
      }
    } else if (finishedAction === this.additiveAction) {
      this.targetAdditiveWeight = 0.0;
      this.additiveAction = null;
    } else if (finishedAction === this.baseAction) {
      // Return one-shot base actions (e.g. death/stagger/dodge) to idle
      if (this.currentLogicalAnim === 'dodge' || this.currentLogicalAnim === 'stagger') {
        this.play(this.previousBaseLogicalAnim || 'idle');
      }
    }
  }

  public update(
    dt: number,
    options?: {
      currentSpeed?: number;
      physics?: PhysicsWorld;
      playerCollider?: RAPIER.Collider;
      stateContext?: { isGrounded: boolean; isDodge: boolean; isAirborne: boolean; isLunge: boolean };
    }
  ): void {
    this.animTime += dt;

    // 1. Foot-sliding mitigation (adjust playback speed to locomotion speed)
    if (this.baseAction && options?.currentSpeed !== undefined) {
      const mapping = this.definition?.animationMap?.[this.currentLogicalAnim];
      const stride = mapping?.strideLength || 2.0;
      if (this.currentLogicalAnim === 'walk' || this.currentLogicalAnim === 'run') {
        const speedScale = Math.max(0.4, options.currentSpeed / stride);
        this.baseAction.timeScale = speedScale;
      } else {
        this.baseAction.timeScale = 1.0;
      }
    }

    // 2. Update Three.js AnimationMixer
    if (this.mixer) {
      this.mixer.update(dt);

      // Smooth layer weights
      this.upperWeight = THREE.MathUtils.lerp(this.upperWeight, this.targetUpperWeight, 10.0 * dt);
      if (this.upperAction) {
        this.upperAction.setEffectiveWeight(this.upperWeight);
      }

      this.additiveWeight = THREE.MathUtils.lerp(this.additiveWeight, this.targetAdditiveWeight, 12.0 * dt);
      if (this.additiveAction) {
        this.additiveAction.setEffectiveWeight(this.additiveWeight);
      }

      // Update Animation Events
      if (this.baseAction) {
        const clip = this.baseAction.getClip();
        this.eventManager.update(clip.name, this.baseAction.time, clip.duration, this.baseAction.loop === THREE.LoopRepeat);
      }
      if (this.upperAction) {
        const clip = this.upperAction.getClip();
        this.eventManager.update(clip.name, this.upperAction.time, clip.duration, false);
      }

      // 3. Foot IK post-mixer update
      if (options?.physics && this.skeleton) {
        this.footIK.solve(options.physics, dt, options.playerCollider, options.stateContext);
      }
    }

    // 4. Procedural Fallback Update (applied if fallback is active or missing real clips)
    if (this.fallbackActive) {
      this.updateProceduralFallback(dt);
    }

    // 5. Update Ribbon Weapon Trail
    this.updateTrail(dt);
  }

  private updateProceduralFallback(_dt: number): void {
    const t = this.animTime;
    const dur = this.animDuration;
    const progress = Math.min(1.0, t / Math.max(0.001, dur));

    const body = this.visual.bodyGroup;
    const staff = this.visual.staffPivot;
    const bodyMesh = this.visual.bodyMesh;

    if (!body || !staff || !bodyMesh) return;

    body.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    bodyMesh.scale.set(1, 1, 1);
    staff.position.set(0.38, 0.95, 0.1);
    staff.rotation.set(0, 0, 0);

    switch (this.currentLogicalAnim) {
      case 'idle': {
        const breath = Math.sin(t * 3.0) * 0.02;
        bodyMesh.scale.set(1 - breath * 0.5, 1 + breath, 1 - breath * 0.5);
        staff.rotation.x = 0.05 + Math.sin(t * 1.5) * 0.03;
        staff.rotation.z = -0.05;
        this.trailEnabled = false;
        break;
      }
      case 'walk':
      case 'run': {
        const stride = Math.sin(t * 12.0);
        body.position.y = Math.abs(stride) * 0.08;
        body.rotation.x = 0.12;
        body.rotation.y = Math.sin(t * 6.0) * 0.08;
        staff.rotation.x = Math.sin(t * 12.0) * 0.35;
        this.trailEnabled = false;
        break;
      }
      case 'attack_light_1': {
        const pStartup = 0.18 / dur;
        const pActive = (0.18 + 0.10) / dur;
        if (progress < pStartup) {
          const windupP = progress / pStartup;
          body.rotation.y = -0.35 * windupP;
          staff.rotation.x = -0.8 * windupP;
          this.trailEnabled = false;
        } else if (progress < pActive) {
          const activeP = (progress - pStartup) / (pActive - pStartup);
          body.rotation.y = -0.35 + 0.7 * activeP;
          staff.rotation.x = -0.8 + 2.2 * activeP;
          this.trailEnabled = true;
        } else {
          const recP = (progress - pActive) / (1.0 - pActive);
          body.rotation.y = 0.35 * (1.0 - recP);
          staff.rotation.x = 1.4 - 1.4 * recP;
          this.trailEnabled = false;
        }
        break;
      }
      case 'dodge': {
        const rollAngle = progress * Math.PI * 2;
        body.rotation.x = rollAngle;
        const squash = Math.sin(progress * Math.PI);
        bodyMesh.scale.set(1 + squash * 0.25, 1 - squash * 0.4, 1 + squash * 0.25);
        body.position.y = -squash * 0.35;
        staff.rotation.x = rollAngle;
        this.trailEnabled = false;
        break;
      }
      case 'hit': {
        const recoil = Math.sin(progress * Math.PI);
        body.rotation.x = -0.35 * recoil;
        staff.rotation.z = 0.4 * recoil;
        this.trailEnabled = false;
        break;
      }
      case 'stagger': {
        body.rotation.x = 0.35;
        body.position.y = -0.15;
        staff.rotation.x = 0.8;
        this.trailEnabled = false;
        break;
      }
      case 'death': {
        const fallP = Math.min(1.0, progress * 2.0);
        body.rotation.x = -Math.PI * 0.5 * fallP;
        body.position.y = -0.75 * fallP;
        this.trailEnabled = false;
        break;
      }
    }
  }

  private updateTrail(dt: number): void {
    if (this.trailEnabled && this.visual.staffTip && this.visual.staffMesh) {
      this.visual.staffTip.getWorldPosition(this.tempVec1);
      this.visual.staffMesh.getWorldPosition(this.tempVec2);

      this.trailHistory.unshift({
        top: this.tempVec1.clone(),
        bottom: this.tempVec2.clone(),
        time: 0.2
      });

      if (this.trailHistory.length > this.maxTrailPoints) {
        this.trailHistory.pop();
      }
    }

    for (let i = this.trailHistory.length - 1; i >= 0; i--) {
      this.trailHistory[i].time -= dt;
      if (this.trailHistory[i].time <= 0) {
        this.trailHistory.splice(i, 1);
      }
    }

    const count = this.trailHistory.length;
    let vIdx = 0;
    const baseColor = this.currentLogicalAnim === 'attack_heavy'
      ? new THREE.Color(0xffaa22)
      : new THREE.Color(0x64b5f6);

    for (let i = 0; i < count - 1; i++) {
      const p0 = this.trailHistory[i];
      const p1 = this.trailHistory[i + 1];
      const alpha0 = Math.max(0, p0.time / 0.2);
      const alpha1 = Math.max(0, p1.time / 0.2);

      this.setVertex(vIdx++, p0.top, baseColor, alpha0);
      this.setVertex(vIdx++, p0.bottom, baseColor, alpha0 * 0.5);
      this.setVertex(vIdx++, p1.top, baseColor, alpha1);

      this.setVertex(vIdx++, p1.top, baseColor, alpha1);
      this.setVertex(vIdx++, p0.bottom, baseColor, alpha0 * 0.5);
      this.setVertex(vIdx++, p1.bottom, baseColor, alpha1 * 0.5);
    }

    const totalVertices = (this.maxTrailPoints - 1) * 6;
    for (let i = vIdx; i < totalVertices; i++) {
      this.trailPositions[i * 3 + 1] = -9999;
    }

    this.trailGeometry.attributes.position.needsUpdate = true;
    this.trailGeometry.attributes.color.needsUpdate = true;
  }

  private setVertex(idx: number, pos: THREE.Vector3, col: THREE.Color, alpha: number): void {
    this.trailPositions[idx * 3] = pos.x;
    this.trailPositions[idx * 3 + 1] = pos.y;
    this.trailPositions[idx * 3 + 2] = pos.z;

    this.trailColors[idx * 3] = col.r * alpha;
    this.trailColors[idx * 3 + 1] = col.g * alpha;
    this.trailColors[idx * 3 + 2] = col.b * alpha;
  }

  public getCurrentAnim(): string {
    return this.currentLogicalAnim;
  }

  public setTrailActive(active: boolean): void {
    this.trailEnabled = active;
  }

  public isFallbackActive(): boolean {
    return this.fallbackActive;
  }

  public getFallbackReason(): string {
    return this.fallbackReason;
  }

  public getLayerState(): LayerState {
    return {
      baseWeight: this.baseWeight,
      upperWeight: this.upperWeight,
      additiveWeight: this.additiveWeight,
      activeBaseClip: this.baseAction?.getClip().name || 'none',
      activeUpperClip: this.upperAction?.getClip().name || 'none',
      activeAdditiveClip: this.additiveAction?.getClip().name || 'none'
    };
  }

  private getDefaultDuration(anim: string): number {
    switch (anim) {
      case 'attack_light_1': return 0.56;
      case 'attack_light_2': return 0.56;
      case 'attack_light_3': return 0.86;
      case 'attack_heavy': return 1.31;
      case 'dodge': return 0.45;
      case 'hit': return 0.25;
      case 'stagger': return 1.0;
      case 'death': return 2.0;
      default: return 1.0;
    }
  }

  public dispose(): void {
    this.trailGeometry.dispose();
    this.trailMaterial.dispose();
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
  }
}
