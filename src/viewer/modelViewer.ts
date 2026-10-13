import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

import { AssetManager } from '../assets/assetManager';
import { ModelValidator, ModelValidationReport } from './validator';
import { CharacterDefinition } from '../data/schemas';
import { AnimationRetargeter } from '../animation/retargeter';
import { createTestSkinnedMesh } from '../testing/testRigs';

export class ModelViewerApp {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

  private currentModel: THREE.Group | null = null;
  public currentSkeleton: THREE.Skeleton | null = null;
  private currentClips: THREE.AnimationClip[] = [];
  private currentDef: CharacterDefinition | null = null;

  // Animation mixer & active action
  private mixer: THREE.AnimationMixer | null = null;
  private activeAction: THREE.AnimationAction | null = null;
  private isPlaying = true;
  private playbackSpeed = 1.0;
  private isLooping = true;

  // Visual Helpers
  private skeletonHelper: THREE.SkeletonHelper | null = null;
  private showSkeleton = false;
  private showWireframe = false;
  private showUVChecker = false;
  private uvCheckerTexture: THREE.CanvasTexture | null = null;
  private originalMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]> = new Map();

  // Socket Editor & Test Object
  private testStaff: THREE.Group;
  private activeSocketKey = 'rightHandSocket';

  // UI Elements
  private uiContainer!: HTMLDivElement;
  private validationPanel!: HTMLDivElement;
  private scrubSlider!: HTMLInputElement;
  private timeLabel!: HTMLSpanElement;

  private clock = new THREE.Clock();

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x131720);

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 1.6, 3.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    // 2. Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 15;

    // 3. Environment & Lighting
    this.setupLighting();
    this.setupGroundAndGrid();
    this.setupHeightReference();

    // 4. Test Staff Object for Socket Editor
    this.testStaff = this.buildTestStaff();

    // 5. Build Checkerboard Texture
    this.uvCheckerTexture = this.buildUVCheckerTexture();

    // 6. UI Overlay & Drag-and-drop
    this.buildUI();
    this.setupDragAndDrop();

    window.addEventListener('resize', () => this.onWindowResize());

    // 7. Start render loop
    this.animate();

    // 8. Load default character
    this.loadCharacter('player_test');
  }

  private setupLighting(): void {
    // Ambient
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambient);

    // Key Light
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.8);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    this.scene.add(keyLight);

    // Fill Light
    const fillLight = new THREE.DirectionalLight(0xb4cded, 0.8);
    fillLight.position.set(-4, 3, -2);
    this.scene.add(fillLight);

    // Rim Light
    const rimLight = new THREE.DirectionalLight(0x7aa2f7, 1.2);
    rimLight.position.set(0, 4, -4);
    this.scene.add(rimLight);
  }

  private setupGroundAndGrid(): void {
    const grid = new THREE.GridHelper(10, 10, 0x5a6a85, 0x273142);
    grid.position.y = 0.001;
    this.scene.add(grid);

    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x181e28,
      roughness: 0.85,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private setupHeightReference(): void {
    // 1.8m height reference figure
    const group = new THREE.Group();
    group.position.set(-1.4, 0, 0);

    const poleGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.8, 12);
    poleGeo.translate(0, 0.9, 0);
    const poleMat = new THREE.MeshBasicMaterial({ color: 0x4fd1c5, wireframe: true });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    group.add(pole);

    // Ring markers at 0.5m, 1.0m, 1.5m, 1.8m
    const markers = [0.5, 1.0, 1.5, 1.8];
    for (const h of markers) {
      const ringGeo = new THREE.RingGeometry(0.12, 0.14, 24);
      ringGeo.rotateX(Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, poleMat);
      ring.position.y = h;
      group.add(ring);
    }

    this.scene.add(group);
  }

  private buildTestStaff(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'TestStaff';

    const staffGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.9, 12);
    const staffMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 });
    const staff = new THREE.Mesh(staffGeo, staffMat);
    group.add(staff);

    const tipGeo = new THREE.OctahedronGeometry(0.08, 0);
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      emissive: 0x2563eb,
      emissiveIntensity: 0.8
    });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.y = 0.95;
    group.add(tip);

    return group;
  }

  private buildUVCheckerTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const tiles = 8;
    const size = 512 / tiles;
    for (let x = 0; x < tiles; x++) {
      for (let y = 0; y < tiles; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#e2e8f0' : '#475569';
        ctx.fillRect(x * size, y * size, size, size);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  public async loadCharacter(characterId: string): Promise<void> {
    const asset = await AssetManager.getInstance().loadCharacter(characterId);
    this.setModel(asset.model, asset.definition, asset.clips, asset.skeleton);
  }

  public setModel(
    model: THREE.Group,
    def: CharacterDefinition,
    clips: THREE.AnimationClip[],
    skeleton?: THREE.Skeleton,
    fileSizeBytes?: number
  ): void {
    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      if (this.skeletonHelper) {
        this.scene.remove(this.skeletonHelper);
        this.skeletonHelper = null;
      }
    }

    this.currentModel = model;
    this.currentDef = def;
    this.currentClips = clips;
    this.originalMaterials.clear();

    // Cache original materials
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        this.originalMaterials.set(child, child.material);
      }
      if (child instanceof THREE.SkinnedMesh && child.skeleton) {
        this.currentSkeleton = child.skeleton;
      }
    });

    if (skeleton) {
      this.currentSkeleton = skeleton;
    }

    this.scene.add(model);

    // Setup Animation Mixer
    this.mixer = new THREE.AnimationMixer(model);
    this.populateClipSelector(clips);

    if (clips.length > 0) {
      this.playClip(clips[0].name);
    }

    // Attach SkeletonHelper
    this.skeletonHelper = new THREE.SkeletonHelper(model);
    this.skeletonHelper.visible = this.showSkeleton;
    this.scene.add(this.skeletonHelper);

    // Update Socket attachment
    this.updateSocketAttachment();

    // Run Validation
    const report = ModelValidator.validate(model, clips, 'hero', fileSizeBytes);
    this.renderValidationReport(report);
  }

  private populateClipSelector(clips: THREE.AnimationClip[]): void {
    const select = document.getElementById('viewer-clip-select') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '';
    for (const clip of clips) {
      const opt = document.createElement('option');
      opt.value = clip.name;
      opt.textContent = `${clip.name} (${clip.duration.toFixed(2)}s)`;
      select.appendChild(opt);
    }
  }

  public playClip(clipName: string): void {
    if (!this.mixer) return;

    const clip = this.currentClips.find((c) => c.name === clipName);
    if (!clip) return;

    if (this.activeAction) {
      this.activeAction.stop();
    }

    this.activeAction = this.mixer.clipAction(clip);
    this.activeAction.setLoop(this.isLooping ? THREE.LoopRepeat : THREE.LoopOnce, this.isLooping ? Infinity : 1);
    this.activeAction.timeScale = this.playbackSpeed;
    this.activeAction.play();
    this.isPlaying = true;
  }

  private updateSocketAttachment(): void {
    if (!this.currentModel || !this.currentDef?.sockets) return;

    const socket = this.currentDef.sockets[this.activeSocketKey];
    if (!socket) return;

    let foundBone: THREE.Object3D | null = null;
    this.currentModel.traverse((child) => {
      if (child.name.toLowerCase() === socket.bone.toLowerCase()) {
        foundBone = child;
      }
    });

    const targetBone = foundBone as THREE.Object3D | null;
    if (targetBone) {
      (targetBone as THREE.Object3D).add(this.testStaff);
      this.testStaff.position.set(socket.position[0], socket.position[1], socket.position[2]);
      this.testStaff.rotation.set(socket.rotation[0], socket.rotation[1], socket.rotation[2]);
      this.testStaff.visible = true;
    } else {
      this.testStaff.visible = false;
    }
  }

  private setupDragAndDrop(): void {
    ['dragenter', 'dragover'].forEach((eventName) => {
      window.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!file.name.toLowerCase().endsWith('.glb') && !file.name.toLowerCase().endsWith('.gltf')) {
        alert('Please drop a .glb or .gltf 3D file.');
        return;
      }

      const buffer = await file.arrayBuffer();
      const loader = new GLTFLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
      loader.setDRACOLoader(draco);
      loader.setMeshoptDecoder(MeshoptDecoder);

      loader.parse(
        buffer,
        '',
        (gltf) => {
          AssetManager.getInstance().applyPostLoadFixups(gltf.scene, { targetHeight: 1.8 });
          const def: CharacterDefinition = {
            id: file.name.replace(/\.[^/.]+$/, ''),
            name: file.name,
            modelAssetId: file.name,
            targetHeight: 1.8,
            forwardFix: 0,
            skeletonType: 'custom',
            boneMap: {},
            sockets: {
              rightHandSocket: { bone: 'RightHand', position: [0.05, 0, 0], rotation: [0, 0, 0] }
            },
            animationMap: {}
          };

          this.setModel(gltf.scene, def, gltf.animations || [], undefined, file.size);
        },
        (err) => {
          console.error('[ModelViewer] Failed to parse dropped file:', err);
          alert('Failed to parse 3D file: ' + err);
        }
      );
    });
  }

  private buildUI(): void {
    this.uiContainer = document.createElement('div');
    this.uiContainer.id = 'viewer-ui';
    this.uiContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #f1f5f9;
      z-index: 50;
    `;

    // Left Control Panel
    const leftPanel = document.createElement('div');
    leftPanel.style.cssText = `
      position: absolute;
      top: 16px;
      left: 16px;
      width: 320px;
      max-height: calc(100vh - 32px);
      overflow-y: auto;
      background: rgba(18, 24, 34, 0.88);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 16px;
      pointer-events: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    leftPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
        <h2 style="font-size: 16px; font-weight: 700; letter-spacing: 0.5px;">LIGHTBRINGER VIEWER</h2>
        <a href="/" style="color: #60a5fa; font-size: 12px; text-decoration: none; font-weight: 600;">← Back to Game</a>
      </div>

      <!-- Character Selector -->
      <div style="margin-bottom: 14px;">
        <label style="font-size: 12px; font-weight: 600; color: #94a3b8; display: block; margin-bottom: 4px;">LOAD CHARACTER</label>
        <select id="viewer-char-select" style="width: 100%; background: #0f172a; color: #f8fafc; border: 1px solid #334155; border-radius: 6px; padding: 6px 10px; font-size: 13px;">
          <option value="player_test">Hero Test (Mixamo Rig)</option>
          <option value="player_smpl">Hero Test (SMPL Rig)</option>
        </select>
      </div>

      <!-- Animation Clip Player -->
      <div style="margin-bottom: 14px; background: rgba(15, 23, 42, 0.6); padding: 10px; border-radius: 8px; border: 1px solid #1e293b;">
        <label style="font-size: 12px; font-weight: 600; color: #94a3b8; display: block; margin-bottom: 6px;">ANIMATIONS</label>
        <select id="viewer-clip-select" style="width: 100%; background: #0f172a; color: #f8fafc; border: 1px solid #334155; border-radius: 6px; padding: 6px 10px; font-size: 13px; margin-bottom: 8px;">
        </select>

        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
          <button id="viewer-btn-play" style="flex: 1; background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 6px 12px; font-weight: 600; font-size: 12px; cursor: pointer;">Pause</button>
          <label style="font-size: 12px; color: #cbd5e1; display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="checkbox" id="viewer-chk-loop" checked /> Loop
          </label>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; margin-bottom: 2px;">
            <span>Timeline</span>
            <span id="viewer-time-label">0.00s / 0.00s</span>
          </div>
          <input type="range" id="viewer-scrub" min="0" max="1" step="0.01" value="0" style="width: 100%;" />
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
          <span style="font-size: 11px; color: #94a3b8;">Speed</span>
          <select id="viewer-speed-select" style="background: #0f172a; color: #f8fafc; border: 1px solid #334155; border-radius: 4px; padding: 2px 8px; font-size: 11px;">
            <option value="0.25">0.25x</option>
            <option value="0.5">0.5x</option>
            <option value="1.0" selected>1.0x</option>
            <option value="1.5">1.5x</option>
            <option value="2.0">2.0x</option>
          </select>
        </div>
      </div>

      <!-- Retargeting Tester -->
      <div style="margin-bottom: 14px; background: rgba(15, 23, 42, 0.6); padding: 10px; border-radius: 8px; border: 1px solid #1e293b;">
        <label style="font-size: 12px; font-weight: 600; color: #94a3b8; display: block; margin-bottom: 4px;">RETARGETING TEST</label>
        <button id="viewer-btn-retarget" style="width: 100%; background: #3b82f6; color: #fff; border: none; border-radius: 6px; padding: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
          Apply Retargeted Walk Clip
        </button>
      </div>

      <!-- Display Toggles -->
      <div style="margin-bottom: 14px; background: rgba(15, 23, 42, 0.6); padding: 10px; border-radius: 8px; border: 1px solid #1e293b;">
        <label style="font-size: 12px; font-weight: 600; color: #94a3b8; display: block; margin-bottom: 6px;">DISPLAY TOGGLES</label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px;">
          <label style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" id="viewer-chk-skeleton" /> Skeleton</label>
          <label style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" id="viewer-chk-wireframe" /> Wireframe</label>
          <label style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" id="viewer-chk-uv" /> UV Checker</label>
        </div>
      </div>

      <!-- Socket Editor -->
      <div style="background: rgba(15, 23, 42, 0.6); padding: 10px; border-radius: 8px; border: 1px solid #1e293b;">
        <label style="font-size: 12px; font-weight: 600; color: #94a3b8; display: block; margin-bottom: 6px;">SOCKET EDITOR</label>
        <select id="viewer-socket-select" style="width: 100%; background: #0f172a; color: #f8fafc; border: 1px solid #334155; border-radius: 6px; padding: 4px 8px; font-size: 12px; margin-bottom: 8px;">
          <option value="rightHandSocket">rightHandSocket (Staff/Sword)</option>
          <option value="backSocket">backSocket</option>
          <option value="headSocket">headSocket</option>
          <option value="chestSocket">chestSocket</option>
        </select>
        <div style="display: flex; gap: 6px; margin-top: 6px;">
          <button id="viewer-btn-savesocket" style="flex: 1; background: #10b981; color: #fff; border: none; border-radius: 6px; padding: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
            Export / Save JSON
          </button>
        </div>
      </div>
    `;

    // Right Validation Report Panel
    this.validationPanel = document.createElement('div');
    this.validationPanel.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      width: 360px;
      max-height: calc(100vh - 32px);
      overflow-y: auto;
      background: rgba(18, 24, 34, 0.92);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 16px;
      pointer-events: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    this.uiContainer.appendChild(leftPanel);
    this.uiContainer.appendChild(this.validationPanel);
    this.container.appendChild(this.uiContainer);

    this.scrubSlider = document.getElementById('viewer-scrub') as HTMLInputElement;
    this.timeLabel = document.getElementById('viewer-time-label') as HTMLSpanElement;

    // Attach Event Listeners
    this.setupUIListeners();
  }

  private setupUIListeners(): void {
    const charSelect = document.getElementById('viewer-char-select') as HTMLSelectElement;
    charSelect?.addEventListener('change', () => {
      this.loadCharacter(charSelect.value);
    });

    const clipSelect = document.getElementById('viewer-clip-select') as HTMLSelectElement;
    clipSelect?.addEventListener('change', () => {
      this.playClip(clipSelect.value);
    });

    const btnPlay = document.getElementById('viewer-btn-play') as HTMLButtonElement;
    btnPlay?.addEventListener('click', () => {
      if (!this.activeAction) return;
      this.isPlaying = !this.isPlaying;
      this.activeAction.paused = !this.isPlaying;
      btnPlay.textContent = this.isPlaying ? 'Pause' : 'Play';
    });

    const chkLoop = document.getElementById('viewer-chk-loop') as HTMLInputElement;
    chkLoop?.addEventListener('change', () => {
      this.isLooping = chkLoop.checked;
      if (this.activeAction) {
        this.activeAction.setLoop(this.isLooping ? THREE.LoopRepeat : THREE.LoopOnce, this.isLooping ? Infinity : 1);
      }
    });

    const speedSelect = document.getElementById('viewer-speed-select') as HTMLSelectElement;
    speedSelect?.addEventListener('change', () => {
      this.playbackSpeed = parseFloat(speedSelect.value);
      if (this.activeAction) {
        this.activeAction.timeScale = this.playbackSpeed;
      }
    });

    this.scrubSlider?.addEventListener('input', () => {
      if (!this.activeAction) return;
      const clip = this.activeAction.getClip();
      const progress = parseFloat(this.scrubSlider.value);
      this.activeAction.time = progress * clip.duration;
      this.activeAction.paused = true;
      this.isPlaying = false;
      const btnPlay = document.getElementById('viewer-btn-play') as HTMLButtonElement;
      if (btnPlay) btnPlay.textContent = 'Play';
    });

    // Retargeting button
    const btnRetarget = document.getElementById('viewer-btn-retarget') as HTMLButtonElement;
    btnRetarget?.addEventListener('click', () => {
      if (!this.currentDef || !this.currentModel) return;

      // Create a foreign rig (SMPL if current is Mixamo, Mixamo if current is SMPL)
      const foreignType = this.currentDef.skeletonType === 'mixamo' ? 'smpl' : 'mixamo';
      const foreignRig = createTestSkinnedMesh(foreignType);
      const foreignWalkClip = foreignRig.clips.find((c) => c.name === 'walk') || foreignRig.clips[0];

      // Retarget to current character
      const retargeted = AnimationRetargeter.getInstance().retargetClip(foreignWalkClip, {
        sourceBoneMap: foreignRig.boneMap,
        targetBoneMap: this.currentDef.boneMap,
        rootMotion: 'none'
      });

      this.currentClips.push(retargeted);
      this.populateClipSelector(this.currentClips);
      this.playClip(retargeted.name);
      alert(`Retargeted "${foreignWalkClip.name}" from ${foreignType.toUpperCase()} skeleton onto ${this.currentDef.skeletonType.toUpperCase()} skeleton!`);
    });

    // Toggles
    const chkSkeleton = document.getElementById('viewer-chk-skeleton') as HTMLInputElement;
    chkSkeleton?.addEventListener('change', () => {
      this.showSkeleton = chkSkeleton.checked;
      if (this.skeletonHelper) this.skeletonHelper.visible = this.showSkeleton;
    });

    const chkWireframe = document.getElementById('viewer-chk-wireframe') as HTMLInputElement;
    chkWireframe?.addEventListener('change', () => {
      this.showWireframe = chkWireframe.checked;
      this.currentModel?.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const m of mats) m.wireframe = this.showWireframe;
        }
      });
    });

    const chkUV = document.getElementById('viewer-chk-uv') as HTMLInputElement;
    chkUV?.addEventListener('change', () => {
      this.showUVChecker = chkUV.checked;
      this.currentModel?.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (this.showUVChecker && this.uvCheckerTexture) {
            child.material = new THREE.MeshStandardMaterial({ map: this.uvCheckerTexture });
          } else {
            const orig = this.originalMaterials.get(child);
            if (orig) child.material = orig;
          }
        }
      });
    });

    // Save JSON
    const btnSave = document.getElementById('viewer-btn-savesocket') as HTMLButtonElement;
    btnSave?.addEventListener('click', () => {
      if (!this.currentDef) return;
      const jsonStr = JSON.stringify(this.currentDef, null, 2);
      navigator.clipboard.writeText(jsonStr).then(() => {
        alert('Character definition copied to clipboard! You can also download it.');
      });

      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.currentDef.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  private renderValidationReport(report: ModelValidationReport): void {
    const badgeColor = report.overallStatus === 'PASS' ? '#10b981' : report.overallStatus === 'WARN' ? '#f59e0b' : '#ef4444';

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
        <h3 style="font-size: 14px; font-weight: 700; margin: 0;">VALIDATION REPORT</h3>
        <span style="background: ${badgeColor}; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">
          ${report.overallStatus}
        </span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; font-size: 11px; background: rgba(15,23,42,0.6); padding: 8px; border-radius: 6px;">
        <div><strong style="color: #94a3b8;">Triangles:</strong> ${report.totalTriangles.toLocaleString()}</div>
        <div><strong style="color: #94a3b8;">Vertices:</strong> ${report.totalVertices.toLocaleString()}</div>
        <div><strong style="color: #94a3b8;">Materials:</strong> ${report.materialCount}</div>
        <div><strong style="color: #94a3b8;">Bones:</strong> ${report.boneCount}</div>
        <div><strong style="color: #94a3b8;">Preset:</strong> ${report.detectedPreset}</div>
        <div><strong style="color: #94a3b8;">Max Tex:</strong> ${report.maxTextureDim}px</div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
    `;

    for (const item of report.items) {
      const itemColor = item.status === 'PASS' ? '#10b981' : item.status === 'WARN' ? '#f59e0b' : '#ef4444';
      html += `
        <div style="border-left: 3px solid ${itemColor}; background: rgba(15,23,42,0.4); padding: 6px 10px; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600;">
            <span>${item.title}</span>
            <span style="color: ${itemColor};">${item.status}</span>
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
            Actual: <span style="color: #f1f5f9;">${item.actual}</span> (Target: ${item.budget})
          </div>
          ${item.hint ? `<div style="font-size: 10px; color: #fbbf24; margin-top: 3px;">💡 ${item.hint}</div>` : ''}
        </div>
      `;
    }

    html += `</div>`;
    this.validationPanel.innerHTML = html;
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();

    if (this.mixer && this.isPlaying) {
      this.mixer.update(dt * this.playbackSpeed);
    }

    if (this.activeAction && this.scrubSlider) {
      const clip = this.activeAction.getClip();
      const progress = this.activeAction.time / Math.max(0.001, clip.duration);
      this.scrubSlider.value = progress.toString();
      if (this.timeLabel) {
        this.timeLabel.textContent = `${this.activeAction.time.toFixed(2)}s / ${clip.duration.toFixed(2)}s`;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
