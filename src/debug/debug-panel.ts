import Stats from 'stats.js';
import GUI from 'lil-gui';
import * as THREE from 'three';
import { PlayerController } from '../player/player-controller';
import { ThirdPersonCamera } from '../engine/camera';
import { LightingModule } from '../engine/lighting';
import { RapierDebugRenderer } from './rapier-debug';
import { GrayboxWorld } from '../world/graybox';
import { HitboxManager } from '../combat/hitboxManager';
import { TrainingDummy } from '../entities/trainingDummy';
import { ATTACKS } from '../data/attacks';
import { EventBus } from '../combat/eventBus';
import { AssetManager } from '../assets/assetManager';
import { AnimationRetargeter } from '../animation/retargeter';
import { ChunkManager } from '../world/terrain/chunkManager';
import { TerrainMaterial } from '../world/terrain/terrainMaterial';
import { WaterBodiesManager } from '../world/water/waterBodies';
import { WindSystem } from '../world/wind/windSystem';
import { PostPipeline, QualityPreset } from '../engine/post/postPipeline';
import { FlyCam } from './flyCam';
import { SporeAtmosphere } from '../world/atmosphere/spores';
import { ProceduralTextureGenerator } from '../world/terrain/proceduralTextures';
import { ChunkScatterManager } from '../world/scatter/chunkScatterManager';

export interface WorldDebugOptions {
  chunkManager?: ChunkManager;
  terrainMaterial?: TerrainMaterial;
  waterBodies?: WaterBodiesManager;
  wind?: WindSystem;
  postPipeline?: PostPipeline | null;
  flyCam?: FlyCam | null;
  spores?: SporeAtmosphere;
  renderer?: THREE.WebGLRenderer;
  scatterManager?: ChunkScatterManager;
}

export class DebugPanel {
  private stats: Stats;
  private gui: GUI;
  private isVisible = true;

  private playerController: PlayerController;
  private camera: ThirdPersonCamera;
  private lighting: LightingModule;
  private rapierDebug: RapierDebugRenderer;
  private graybox: GrayboxWorld;
  private worldOpts?: WorldDebugOptions;

  private combatMonitor = {
    currentState: 'locomotion',
    previousState: 'none',
    timeInState: '0.00s',
    stamina: '100.0 / 100',
    iFrameActive: false,
    inputBuffer: '(empty)',
    lastHitResult: 'None'
  };

  private playerMonitor = {
    position: '0.00, 0.00, 0.00',
    grounded: false,
    speed: '0.00 m/s',
    inWater: false
  };

  private terrainMonitor = {
    activeChunks: 0,
    pooledChunks: 0,
    triangles: 0,
    workerTime: '0.0 ms',
    freezeStreaming: false
  };

  private floraMonitor = {
    activeChunks: 0,
    totalInstances: 0,
    drawCalls: 0,
    triangles: 0,
    glowLights: 0,
    openFloraShowcase: () => {
      window.open('/flora.html', '_blank');
    }
  };

  private perfMonitor = {
    drawCalls: 0,
    renderedTriangles: 0,
    geometries: 0,
    textures: 0
  };

  private qualityState = {
    preset: 'high' as QualityPreset
  };

  private lightingMonitor = {
    preset: 'sunless',
    showPoolHelpers: false,
    playerLightFlicker: true
  };

  private combatActions = {
    resetDummies: () => {
      this.graybox.resetAllDummies();
    },
    toggleSparring: () => {
      TrainingDummy.sparringModeEnabled = !TrainingDummy.sparringModeEnabled;
    },
    toggleHitboxDebug: () => {
      HitboxManager.getInstance().setDebugVisible(!HitboxManager.getInstance().debugVisible);
    },
    refillStamina: () => {
      this.playerController.stamina.refill();
    },
    toggleGodMode: () => {
      this.playerController.combatConfig.godMode = !this.playerController.combatConfig.godMode;
    }
  };

  private physicsDebug = {
    showWireframes: false,
    grayboxArea: false,
    respawn: () => {
      this.playerController.respawn();
    }
  };

  private animationMonitor = {
    logicalAnim: 'idle',
    baseLayer: 'idle (1.00)',
    upperLayer: 'none (0.00)',
    additiveLayer: 'none (0.00)',
    fallbackActive: 'No',
    fallbackReason: 'None',
    retargetStats: '0 hits / 0 miss',
    assetMemory: '0 assets'
  };

  private assetActions = {
    switchToSilhouette: () => {
      this.playerController.switchCharacter('silhouette');
    },
    switchToMixamo: () => {
      this.playerController.switchCharacter('player_test');
    },
    switchToSMPL: () => {
      this.playerController.switchCharacter('player_smpl');
    },
    hotReload: async () => {
      await AssetManager.getInstance().hotReloadAll();
    },
    openViewer: () => {
      window.open('/viewer.html', '_blank');
    }
  };

  constructor(
    playerController: PlayerController,
    camera: ThirdPersonCamera,
    lighting: LightingModule,
    rapierDebug: RapierDebugRenderer,
    graybox: GrayboxWorld,
    worldOpts?: WorldDebugOptions
  ) {
    this.playerController = playerController;
    this.camera = camera;
    this.lighting = lighting;
    this.rapierDebug = rapierDebug;
    this.graybox = graybox;
    this.worldOpts = worldOpts;

    // 1. Stats.js
    this.stats = new Stats();
    this.stats.showPanel(0);
    this.stats.dom.style.position = 'fixed';
    this.stats.dom.style.top = '10px';
    this.stats.dom.style.left = '10px';
    this.stats.dom.style.zIndex = '35';
    document.body.appendChild(this.stats.dom);

    // 2. lil-gui
    this.gui = new GUI({ title: 'Lightbringer: Dark World Debug [F1]' });
    this.gui.domElement.style.position = 'fixed';
    this.gui.domElement.style.top = '10px';
    this.gui.domElement.style.right = '10px';
    this.gui.domElement.style.zIndex = '35';

    // Event bus listener for last hit info
    EventBus.getInstance().on('hit', (e) => {
      this.combatMonitor.lastHitResult = `${e.attackerId} -> ${e.targetId} (${e.damage} dmg, poise ${e.poiseDamage}${e.stagger ? ' [STAGGER]' : ''})`;
    });

    this.setupQualityFolder();
    this.setupTerrainFolder();
    this.setupFloraScatterFolder();
    this.setupLightingFolder();
    this.setupPostProcessingFolder();
    this.setupAtmosphereWaterWindFolder();
    this.setupFlyCamFolder();
    this.setupPerformanceFolder();
    this.setupCombatMonitorFolder();
    this.setupCombatActionsFolder();
    this.setupAttackTuningFolder();
    this.setupStaminaDodgeFolder();
    this.setupMovementFolder();
    this.setupCameraFolder();
    this.setupPhysicsFolder();
    this.setupAssetAnimationFolder();
  }

  private setupQualityFolder(): void {
    const f = this.gui.addFolder('Quality Presets');
    f.add(this.qualityState, 'preset', ['low', 'medium', 'high'])
      .name('Preset')
      .onChange((preset: QualityPreset) => {
        this.applyQualityPreset(preset);
      });
    f.open();
  }

  private applyQualityPreset(preset: QualityPreset): void {
    this.qualityState.preset = preset;
    this.lighting.setQuality(preset);

    if (this.worldOpts?.terrainMaterial) {
      this.worldOpts.terrainMaterial.setQuality(preset);
    }
    if (this.worldOpts?.postPipeline) {
      this.worldOpts.postPipeline.setQuality(preset);
    }
    if (this.worldOpts?.spores) {
      this.worldOpts.spores.setQuality(preset);
    }
    if (this.worldOpts?.chunkManager) {
      this.worldOpts.chunkManager.renderRadius = preset === 'low' ? 2 : preset === 'medium' ? 3 : 4;
    }
  }

  private setupTerrainFolder(): void {
    const f = this.gui.addFolder('Streamed Terrain');
    f.add(this.terrainMonitor, 'activeChunks').name('Active Chunks').listen().disable();
    f.add(this.terrainMonitor, 'pooledChunks').name('Pooled Chunks').listen().disable();
    f.add(this.terrainMonitor, 'triangles').name('Total Triangles').listen().disable();
    f.add(this.terrainMonitor, 'workerTime').name('Worker Gen Time').listen().disable();

    if (this.worldOpts?.chunkManager) {
      const cm = this.worldOpts.chunkManager;
      f.add(this.terrainMonitor, 'freezeStreaming')
        .name('Freeze Streaming')
        .onChange((val: boolean) => {
          cm.freezeStreaming = val;
        });
      f.add(cm, 'renderRadius', 1, 5, 1).name('Render Radius (chunks)');
    }

    // Ground layer procedural fallback report
    const fbReport = ProceduralTextureGenerator.getInstance().getTerrainTextures().fallbackReport;
    const reportStr = Object.entries(fbReport)
      .map(([k, isFb]) => `${k}: ${isFb ? 'Procedural Fallback' : 'Texture File'}`)
      .join('\n');
    f.add({ report: reportStr }, 'report').name('Layer Textures').listen().disable();
    f.open();
  }

  private setupFloraScatterFolder(): void {
    const f = this.gui.addFolder('Flora & Scatter Engine');
    f.add(this.floraMonitor, 'activeChunks').name('Active Flora Chunks').listen().disable();
    f.add(this.floraMonitor, 'totalInstances').name('Flora Instances').listen().disable();
    f.add(this.floraMonitor, 'drawCalls').name('Flora Draw Calls').listen().disable();
    f.add(this.floraMonitor, 'triangles').name('Flora Triangles').listen().disable();
    f.add(this.floraMonitor, 'glowLights').name('Registered Glow Lights').listen().disable();
    f.add(this.floraMonitor, 'openFloraShowcase').name('Open Flora Showcase [/flora]');
    f.open();
  }

  private setupLightingFolder(): void {
    const f = this.gui.addFolder('Sunless Lighting Model');
    f.add(this.lightingMonitor, 'preset', ['sunless', 'daylight'])
      .name('Lighting Mode')
      .onChange((mode: 'sunless' | 'daylight') => {
        this.lighting.applyPreset(mode);
      });

    // Player Light Controls
    const pl = this.lighting.playerConfig;
    f.addColor(pl, 'color').name('Player Light Color');
    f.add(pl, 'intensity', 0.5, 10.0, 0.1).name('Player Intensity');
    f.add(pl, 'distance', 5.0, 50.0, 1.0).name('Player Distance');
    f.add(pl, 'flickerIntensity', 0.0, 0.5, 0.02).name('Flicker Amount');
    f.add(pl, 'flickerSpeed', 0.5, 10.0, 0.5).name('Flicker Speed');

    // Light Pool Controls
    f.add(this.lightingMonitor, 'showPoolHelpers')
      .name('Show Light Pool Helpers')
      .onChange((val: boolean) => {
        this.lighting.lightPool.setDebugVisible(val);
      });

    // Daylight Preset Sun Tuning
    const sunCfg = this.lighting.config;
    const updateSun = () => {
      this.lighting.applySunTransform(this.playerController.renderPos);
    };
    f.add(sunCfg, 'elevation', 5.0, 85.0, 1.0).name('Daylight Sun Elevation').onChange(updateSun);
    f.add(sunCfg, 'azimuth', 0.0, 360.0, 1.0).name('Daylight Sun Azimuth').onChange(updateSun);
    f.add(sunCfg, 'intensity', 0.0, 4.0, 0.1).name('Daylight Sun Intensity').onChange(updateSun);
    f.open();
  }

  private setupPostProcessingFolder(): void {
    if (!this.worldOpts?.postPipeline) return;
    const pp = this.worldOpts.postPipeline;
    const cfg = pp.config;
    const f = this.gui.addFolder('Post-Processing (pmndrs)');

    const apply = () => pp.applyConfig();

    f.add(cfg, 'bloomIntensity', 0.0, 3.5, 0.05).name('Bloom Intensity').onChange(apply);
    f.add(cfg, 'bloomThreshold', 0.0, 1.0, 0.02).name('Bloom Threshold').onChange(apply);
    f.add(cfg, 'bloomSmoothing', 0.0, 0.5, 0.02).name('Bloom Smoothing').onChange(apply);
    f.add(cfg, 'vignetteDarkness', 0.0, 1.0, 0.05).name('Vignette Darkness').onChange(apply);
    f.add(cfg, 'vignetteOffset', 0.0, 1.0, 0.05).name('Vignette Offset').onChange(apply);
    f.add(cfg, 'grainOpacity', 0.0, 0.3, 0.01).name('Film Grain').onChange(apply);
    f.add(cfg, 'chromaticAberration', 0.0, 0.005, 0.0002).name('Chromatic Aberration').onChange(apply);
    f.add(cfg, 'contrast', -0.5, 0.5, 0.02).name('Contrast').onChange(apply);
    f.add(cfg, 'saturation', -1.0, 1.0, 0.05).name('Saturation').onChange(apply);
    f.add(cfg, 'depthOfFieldEnabled').name('Depth of Field').onChange(apply);
    f.close();
  }

  private setupAtmosphereWaterWindFolder(): void {
    const f = this.gui.addFolder('Atmosphere, Water & Wind');

    if (this.worldOpts?.wind) {
      const wind = this.worldOpts.wind;
      f.add(wind, 'baseStrength', 0.0, 10.0, 0.2).name('Wind Strength (m/s)');
      f.add(wind, 'gustStrength', 0.0, 6.0, 0.2).name('Gust Strength');
      f.add(wind, 'gustFrequency', 0.05, 1.0, 0.05).name('Gust Frequency (Hz)');
    }

    if (this.worldOpts?.waterBodies) {
      const regWater = this.worldOpts.waterBodies.region.water;
      f.add(regWater, 'shallowSpeedMultiplier', 0.2, 1.0, 0.05).name('Wading Speed Multiplier');
      f.add(regWater, 'rippleFrequency', 0.5, 4.0, 0.1).name('Ripple Frequency');
    }
    f.close();
  }

  private setupFlyCamFolder(): void {
    if (!this.worldOpts?.flyCam) return;
    const fc = this.worldOpts.flyCam;
    const f = this.gui.addFolder('Fly-Cam Free Camera');
    f.add(fc, 'enabled').name('Enable Detached FlyCam').onChange((val: boolean) => {
      if (val) {
        fc.syncFromCamera();
      }
    });
    f.add(fc, 'speed', 4.0, 50.0, 1.0).name('FlyCam Speed (m/s)');
    f.close();
  }

  private setupPerformanceFolder(): void {
    const f = this.gui.addFolder('Performance Diagnostics');
    f.add(this.perfMonitor, 'drawCalls').name('Draw Calls').listen().disable();
    f.add(this.perfMonitor, 'renderedTriangles').name('Rendered Tris').listen().disable();
    f.add(this.perfMonitor, 'geometries').name('Memory Geometries').listen().disable();
    f.add(this.perfMonitor, 'textures').name('Memory Textures').listen().disable();
    f.close();
  }

  private setupCombatMonitorFolder(): void {
    const f = this.gui.addFolder('Combat State Monitor');
    f.add(this.combatMonitor, 'currentState').name('Current State').listen().disable();
    f.add(this.combatMonitor, 'previousState').name('Prev State').listen().disable();
    f.add(this.combatMonitor, 'timeInState').name('Time in State').listen().disable();
    f.add(this.combatMonitor, 'stamina').name('Stamina').listen().disable();
    f.add(this.combatMonitor, 'iFrameActive').name('i-Frames Active').listen().disable();
    f.add(this.combatMonitor, 'inputBuffer').name('Input Buffer').listen().disable();
    f.add(this.combatMonitor, 'lastHitResult').name('Last Hit Result').listen().disable();
    f.close();
  }

  private setupCombatActionsFolder(): void {
    const f = this.gui.addFolder('Combat Control Buttons');
    f.add(this.combatActions, 'resetDummies').name('Reset Dummies');
    f.add(this.combatActions, 'toggleSparring').name('Toggle Sparring Mode');
    f.add(this.combatActions, 'toggleHitboxDebug').name('Toggle Hitbox Debug');
    f.add(this.combatActions, 'refillStamina').name('Give 100% Stamina');
    f.add(this.combatActions, 'toggleGodMode').name('Toggle God Mode');
    f.close();
  }

  private setupAttackTuningFolder(): void {
    const f = this.gui.addFolder('Combat Attack Timing');
    for (const [, def] of Object.entries(ATTACKS)) {
      const sub = f.addFolder(def.name);
      sub.add(def, 'damage', 5, 80, 1).name('Damage');
      sub.add(def, 'poiseDamage', 5, 60, 1).name('Poise Dmg');
      sub.add(def, 'startup', 0.05, 0.8, 0.01).name('Startup (s)');
      sub.add(def, 'active', 0.05, 0.5, 0.01).name('Active (s)');
      sub.add(def, 'recovery', 0.05, 1.0, 0.01).name('Recovery (s)');
      sub.close();
    }
    f.close();
  }

  private setupStaminaDodgeFolder(): void {
    const f = this.gui.addFolder('Stamina & Dodge');
    const stam = this.playerController.stamina.config;
    f.add(stam, 'maxStamina', 50, 200, 5).name('Max Stamina');
    f.add(stam, 'regenRate', 5, 60, 2).name('Regen Rate /s');
    f.add(stam, 'regenDelay', 0.1, 2.0, 0.05).name('Regen Delay (s)');
    f.add(stam, 'dodgeCost', 5, 40, 1).name('Dodge Cost');
    f.add(stam, 'sprintCostPerSecond', 5, 30, 1).name('Sprint Cost /s');

    const dodge = this.playerController.combatConfig;
    f.add(dodge, 'dodgeDuration', 0.2, 0.8, 0.02).name('Dodge Time (s)');
    f.add(dodge, 'dodgeDistance', 1.0, 10.0, 0.5).name('Dodge Distance (m)');
    f.add(dodge, 'dodgeIFrameStart', 0.0, 0.2, 0.01).name('i-Frame Start (s)');
    f.add(dodge, 'dodgeIFrameEnd', 0.1, 0.5, 0.01).name('i-Frame End (s)');
    f.close();
  }

  private setupMovementFolder(): void {
    const f = this.gui.addFolder('Locomotion & Controller');
    const cfg = this.playerController.config;
    f.add(this.playerMonitor, 'position').name('Player Position').listen().disable();
    f.add(this.playerMonitor, 'speed').name('Live Speed').listen().disable();
    f.add(this.playerMonitor, 'grounded').name('Grounded').listen().disable();
    f.add(cfg, 'walkSpeed', 2.0, 10.0, 0.2).name('Walk Speed');
    f.add(cfg, 'sprintSpeed', 5.0, 18.0, 0.5).name('Sprint Speed');
    f.add(cfg, 'acceleration', 10.0, 80.0, 2.0).name('Acceleration');
    f.add(cfg, 'deceleration', 10.0, 80.0, 2.0).name('Deceleration');
    f.add(cfg, 'jumpHeight', 0.5, 3.5, 0.1).name('Jump Height');
    f.add(cfg, 'maxSlopeAngle', 25.0, 60.0, 1.0)
      .name('Max Slope Angle')
      .onChange(() => this.playerController.applyControllerSettings());
    f.close();
  }

  private setupCameraFolder(): void {
    const f = this.gui.addFolder('Camera Rig');
    const cfg = this.camera.config;
    f.add(cfg, 'distance', 1.5, 8.0, 0.1).name('Distance (m)').listen();
    f.add(cfg, 'shoulderOffsetX', -1.0, 1.5, 0.05).name('Shoulder Offset X');
    f.add(cfg, 'targetHeight', 0.5, 2.5, 0.05).name('Target Height Y');
    f.add(cfg, 'mouseSensitivity', 0.0005, 0.008, 0.0002).name('Sensitivity');
    f.add(cfg, 'damping', 2.0, 35.0, 1.0).name('Follow Damping');
    f.close();
  }

  private setupPhysicsFolder(): void {
    const f = this.gui.addFolder('Physics & Test Areas');
    f.add(this.physicsDebug, 'showWireframes')
      .name('Collider Wireframes')
      .onChange((val: boolean) => {
        this.rapierDebug.setVisible(val);
      });

    // Step 1 graybox test area toggle
    f.add(this.physicsDebug, 'grayboxArea')
      .name('Graybox test area (Stairs/Ramp)')
      .onChange((val: boolean) => {
        this.graybox.setVisible(val);
      });

    f.add(this.physicsDebug, 'respawn').name('Respawn Player');
    f.close();
  }

  private setupAssetAnimationFolder(): void {
    const f = this.gui.addFolder('Animation & Asset Pipeline');
    f.add(this.animationMonitor, 'logicalAnim').name('Logical State').listen().disable();
    f.add(this.animationMonitor, 'baseLayer').name('Base Layer').listen().disable();
    f.add(this.animationMonitor, 'upperLayer').name('Upper Layer').listen().disable();
    f.add(this.animationMonitor, 'additiveLayer').name('Additive Layer').listen().disable();
    f.add(this.animationMonitor, 'fallbackActive').name('Procedural Fallback').listen().disable();
    f.add(this.animationMonitor, 'fallbackReason').name('Fallback Reason').listen().disable();
    f.add(this.animationMonitor, 'retargetStats').name('Retarget Cache').listen().disable();
    f.add(this.animationMonitor, 'assetMemory').name('Asset Cache').listen().disable();

    const acts = f.addFolder('Asset Actions');
    acts.add(this.assetActions, 'switchToSilhouette').name('Switch: Silhouette Hero');
    acts.add(this.assetActions, 'switchToMixamo').name('Switch: Mixamo Rig');
    acts.add(this.assetActions, 'switchToSMPL').name('Switch: SMPL Rig');
    acts.add(this.assetActions, 'hotReload').name('Hot-Reload All Assets');
    acts.add(this.assetActions, 'openViewer').name('Open Model Viewer [/viewer]');
    acts.close();
    f.close();
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    this.stats.dom.style.display = this.isVisible ? 'block' : 'none';
    this.gui.domElement.style.display = this.isVisible ? 'block' : 'none';
  }

  public beginFrame(): void {
    this.stats.begin();
  }

  public endFrame(): void {
    // 1. Live player status
    const p = this.playerController.renderPos;
    this.playerMonitor.position = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`;
    this.playerMonitor.grounded = this.playerController.isGrounded;
    this.playerMonitor.speed = `${this.playerController.currentSpeed.toFixed(2)} m/s`;

    // 2. Terrain statistics
    if (this.worldOpts?.chunkManager) {
      const stats = this.worldOpts.chunkManager.stats;
      this.terrainMonitor.activeChunks = stats.activeChunks;
      this.terrainMonitor.pooledChunks = stats.pooledChunks;
      this.terrainMonitor.triangles = stats.totalTriangles;
      this.terrainMonitor.workerTime = `${stats.lastWorkerTimeMs.toFixed(1)} ms`;
    }

    // 2b. Flora & Scatter statistics
    if (this.worldOpts?.scatterManager) {
      const sStats = this.worldOpts.scatterManager.stats;
      this.floraMonitor.activeChunks = sStats.activeChunks;
      this.floraMonitor.totalInstances = sStats.totalInstances;
      this.floraMonitor.drawCalls = sStats.totalDrawCalls;
      this.floraMonitor.triangles = sStats.totalTriangles;
      this.floraMonitor.glowLights = sStats.registeredGlowLights;
    }

    // 3. Renderer performance statistics
    if (this.worldOpts?.renderer) {
      const rInfo = this.worldOpts.renderer.info;
      this.perfMonitor.drawCalls = rInfo.render.calls;
      this.perfMonitor.renderedTriangles = rInfo.render.triangles;
      this.perfMonitor.geometries = rInfo.memory.geometries;
      this.perfMonitor.textures = rInfo.memory.textures;
    }

    // 4. Combat monitor
    this.combatMonitor.currentState = this.playerController.stateMachine.getCurrentStateId();
    const prev = this.playerController.stateMachine.getPreviousStateId();
    this.combatMonitor.previousState = prev || 'none';
    this.combatMonitor.timeInState = `${this.playerController.stateMachine.getTimeInState().toFixed(2)}s`;
    this.combatMonitor.stamina = `${this.playerController.stamina.current.toFixed(1)} / ${this.playerController.stamina.config.maxStamina}`;
    this.combatMonitor.iFrameActive = this.playerController.stateMachine.isInvulnerable();
    this.combatMonitor.inputBuffer = this.playerController.inputBuffer.getQueueSummary();

    // 5. Animation monitor
    const anim = this.playerController.anim;
    this.animationMonitor.logicalAnim = anim.getCurrentAnim();
    const layers = anim.getLayerState();
    this.animationMonitor.baseLayer = `${layers.activeBaseClip} (${layers.baseWeight.toFixed(2)})`;
    this.animationMonitor.upperLayer = `${layers.activeUpperClip} (${layers.upperWeight.toFixed(2)})`;
    this.animationMonitor.additiveLayer = `${layers.activeAdditiveClip} (${layers.additiveWeight.toFixed(2)})`;
    this.animationMonitor.fallbackActive = anim.isFallbackActive() ? 'YES (Active)' : 'No (Clip Driven)';
    this.animationMonitor.fallbackReason = anim.getFallbackReason();

    const retargetStats = AnimationRetargeter.getInstance().getStats();
    this.animationMonitor.retargetStats = `${retargetStats.cacheHits} hits / ${retargetStats.cacheMisses} miss (${retargetStats.cachedClipCount} cached)`;

    const mem = AssetManager.getInstance().getLoadedAssetMemoryEstimate();
    this.animationMonitor.assetMemory = `${mem.count} GLBs, ${mem.geometries} geos, ${mem.textures} tex`;

    this.stats.end();
  }
}
