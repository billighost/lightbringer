import Stats from 'stats.js';
import GUI from 'lil-gui';
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

export class DebugPanel {
  private stats: Stats;
  private gui: GUI;
  private isVisible = true;

  private playerController: PlayerController;
  private camera: ThirdPersonCamera;
  private lighting: LightingModule;
  private rapierDebug: RapierDebugRenderer;
  private graybox: GrayboxWorld;

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
    speed: '0.00 m/s'
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
    graybox: GrayboxWorld
  ) {
    this.playerController = playerController;
    this.camera = camera;
    this.lighting = lighting;
    this.rapierDebug = rapierDebug;
    this.graybox = graybox;

    // 1. Stats.js
    this.stats = new Stats();
    this.stats.showPanel(0);
    this.stats.dom.style.position = 'fixed';
    this.stats.dom.style.top = '10px';
    this.stats.dom.style.left = '10px';
    this.stats.dom.style.zIndex = '35';
    document.body.appendChild(this.stats.dom);

    // 2. lil-gui
    this.gui = new GUI({ title: 'Lightbringer Combat Debug [F1]' });
    this.gui.domElement.style.position = 'fixed';
    this.gui.domElement.style.top = '10px';
    this.gui.domElement.style.right = '10px';
    this.gui.domElement.style.zIndex = '35';

    // Event bus listener for last hit info
    EventBus.getInstance().on('hit', (e) => {
      this.combatMonitor.lastHitResult = `${e.attackerId} -> ${e.targetId} (${e.damage} dmg, poise ${e.poiseDamage}${e.stagger ? ' [STAGGER]' : ''})`;
    });

    this.setupCombatMonitorFolder();
    this.setupCombatActionsFolder();
    this.setupAttackTuningFolder();
    this.setupStaminaDodgeFolder();
    this.setupMovementFolder();
    this.setupCameraFolder();
    this.setupLightingFolder();
    this.setupPhysicsFolder();
    this.setupAssetAnimationFolder();
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
    f.open();
  }

  private setupCombatActionsFolder(): void {
    const f = this.gui.addFolder('Combat Control Buttons');
    f.add(this.combatActions, 'resetDummies').name('Reset Dummies');
    f.add(this.combatActions, 'toggleSparring').name('Toggle Sparring Mode');
    f.add(this.combatActions, 'toggleHitboxDebug').name('Toggle Hitbox Debug');
    f.add(this.combatActions, 'refillStamina').name('Give 100% Stamina');
    f.add(this.combatActions, 'toggleGodMode').name('Toggle God Mode');
    f.open();
  }

  private setupAttackTuningFolder(): void {
    const f = this.gui.addFolder('Attack Tuning (Live Data)');

    // Helper to add attack controls
    const addAttackControls = (folderName: string, attackKey: string) => {
      const sub = f.addFolder(folderName);
      const att = ATTACKS[attackKey];

      sub.add(att, 'damage', 5, 120, 1).name('Damage');
      sub.add(att, 'poiseDamage', 5, 120, 1).name('Poise Dmg');
      sub.add(att, 'startup', 0.05, 1.2, 0.01).name('Startup (s)');
      sub.add(att, 'active', 0.05, 0.6, 0.01).name('Active (s)');
      sub.add(att, 'recovery', 0.1, 1.5, 0.01).name('Recovery (s)');
      sub.add(att, 'lungeDistance', 0.0, 3.0, 0.05).name('Lunge (m)');
      sub.add(att, 'hitStopDuration', 0.0, 0.3, 0.01).name('Hit Stop (s)');
      sub.add(att.cameraShake, 'amplitude', 0.0, 0.8, 0.02).name('Shake Amp');
      sub.close();
    };

    addAttackControls('Light Attack 1', 'light_1');
    addAttackControls('Light Attack 2', 'light_2');
    addAttackControls('Light Attack 3 (Finisher)', 'light_3');
    addAttackControls('Heavy Attack', 'heavy');
  }

  private setupStaminaDodgeFolder(): void {
    const f = this.gui.addFolder('Stamina & Dodge Tuning');
    const stm = this.playerController.stamina.config;
    const cbt = this.playerController.combatConfig;

    f.add(stm, 'regenRate', 5, 80, 1).name('Stamina Regen (/s)');
    f.add(stm, 'regenDelay', 0.1, 3.0, 0.1).name('Regen Delay (s)');
    f.add(stm, 'exhaustedDelay', 0.2, 3.0, 0.1).name('Exhausted Delay (s)');
    f.add(stm, 'lightAttackCost', 0, 40, 1).name('Light Cost');
    f.add(stm, 'heavyAttackCost', 0, 60, 1).name('Heavy Cost');
    f.add(stm, 'dodgeCost', 0, 50, 1).name('Dodge Cost');

    f.add(cbt, 'dodgeDistance', 1.0, 8.0, 0.2).name('Dodge Distance (m)');
    f.add(cbt, 'dodgeDuration', 0.2, 1.0, 0.02).name('Dodge Duration (s)');
    f.add(cbt, 'dodgeIFrameStart', 0.0, 0.2, 0.01).name('i-Frame Start (s)');
    f.add(cbt, 'dodgeIFrameEnd', 0.1, 0.45, 0.01).name('i-Frame End (s)');

    f.add(cbt, 'aimAssistRange', 1.0, 8.0, 0.2).name('Aim Assist Dist (m)');
    f.add(cbt, 'aimAssistAngleDegrees', 10, 90, 5).name('Aim Assist Angle (°)');
  }

  private setupMovementFolder(): void {
    const f = this.gui.addFolder('Movement Tuning');
    const cfg = this.playerController.config;

    f.add(this.playerMonitor, 'position').name('Pos (X, Y, Z)').listen().disable();
    f.add(this.playerMonitor, 'grounded').name('Grounded').listen().disable();
    f.add(this.playerMonitor, 'speed').name('Speed').listen().disable();

    f.add(cfg, 'walkSpeed', 1.0, 15.0, 0.1).name('Walk Speed (m/s)');
    f.add(cfg, 'sprintSpeed', 2.0, 25.0, 0.1).name('Sprint Speed (m/s)');
    f.add(cfg, 'acceleration', 5.0, 100.0, 1.0).name('Acceleration (m/s²)');
    f.add(cfg, 'deceleration', 5.0, 100.0, 1.0).name('Deceleration (m/s²)');
    f.add(cfg, 'jumpHeight', 0.5, 3.5, 0.05).name('Jump Height (m)');
    f.add(cfg, 'gravity', -60.0, -5.0, 1.0).name('Gravity (m/s²)');
    f.add(cfg, 'coyoteTime', 0.0, 0.4, 0.01).name('Coyote Time (s)');
    f.add(cfg, 'jumpBufferTime', 0.0, 0.4, 0.01).name('Jump Buffer (s)');

    f.add(cfg, 'autostepHeight', 0.05, 0.6, 0.05)
      .name('Autostep Height (m)')
      .onChange(() => {
        this.playerController.applyControllerSettings();
      });

    f.add(cfg, 'maxSlopeAngle', 15.0, 75.0, 1.0)
      .name('Max Slope Angle (°)')
      .onChange(() => {
        this.playerController.applyControllerSettings();
      });
  }

  private setupCameraFolder(): void {
    const f = this.gui.addFolder('Camera Rig');
    const cfg = this.camera.config;

    f.add(cfg, 'distance', 1.5, 8.0, 0.1).name('Distance (m)').listen();
    f.add(cfg, 'shoulderOffsetX', -1.0, 1.5, 0.05).name('Shoulder Offset X');
    f.add(cfg, 'targetHeight', 0.5, 2.5, 0.05).name('Target Height Y');
    f.add(cfg, 'mouseSensitivity', 0.0005, 0.008, 0.0002).name('Sensitivity');
    f.add(cfg, 'damping', 2.0, 35.0, 1.0).name('Follow Damping');
  }

  private setupLightingFolder(): void {
    const f = this.gui.addFolder('Lighting & Sun');
    const cfg = this.lighting.config;

    const updateLight = () => {
      this.lighting.applySunTransform(this.playerController.renderPos);
    };

    f.add(cfg, 'elevation', 5.0, 85.0, 1.0).name('Sun Elevation (°)').onChange(updateLight);
    f.add(cfg, 'azimuth', 0.0, 360.0, 1.0).name('Sun Azimuth (°)').onChange(updateLight);
    f.add(cfg, 'intensity', 0.0, 4.0, 0.1).name('Sun Intensity').onChange(updateLight);
    f.addColor(cfg, 'color').name('Sun Color').onChange(updateLight);
  }

  private setupPhysicsFolder(): void {
    const f = this.gui.addFolder('Physics & Colliders');
    f.add(this.physicsDebug, 'showWireframes')
      .name('Collider Wireframes')
      .onChange((val: boolean) => {
        this.rapierDebug.setVisible(val);
      });

    f.add(this.physicsDebug, 'respawn').name('Respawn Player');
  }

  private setupAssetAnimationFolder(): void {
    const f = this.gui.addFolder('Asset & Animation Pipeline');

    // Live Monitors
    const mon = f.addFolder('Live Status');
    mon.add(this.animationMonitor, 'logicalAnim').name('Logical Anim').listen().disable();
    mon.add(this.animationMonitor, 'baseLayer').name('Base Layer (Weight)').listen().disable();
    mon.add(this.animationMonitor, 'upperLayer').name('Upper Layer (Weight)').listen().disable();
    mon.add(this.animationMonitor, 'additiveLayer').name('Additive (Weight)').listen().disable();
    mon.add(this.animationMonitor, 'fallbackActive').name('Procedural Fallback?').listen().disable();
    mon.add(this.animationMonitor, 'fallbackReason').name('Fallback Reason').listen().disable();
    mon.add(this.animationMonitor, 'retargetStats').name('Retarget Hits/Miss').listen().disable();
    mon.add(this.animationMonitor, 'assetMemory').name('Assets in Memory').listen().disable();
    mon.open();

    // Foot IK Controls
    const ik = f.addFolder('Foot IK Tuning');
    const ikCfg = this.playerController.anim.footIK.config;
    ik.add(ikCfg, 'enabled').name('Foot IK Enabled');
    ik.add(ikCfg, 'rayLength', 0.4, 2.0, 0.05).name('Ray Length (m)');
    ik.add(ikCfg, 'smoothingSpeed', 4.0, 30.0, 1.0).name('Smoothing Speed');
    ik.add(ikCfg, 'maxAdjust', 0.1, 0.8, 0.05).name('Max Adjust (m)');
    ik.add(ikCfg, 'footOffset', 0.0, 0.2, 0.01).name('Foot Offset (m)');
    ik.close();

    // Model & Pipeline Actions
    const acts = f.addFolder('Asset Controls');
    acts.add(this.assetActions, 'switchToMixamo').name('Switch: Mixamo Rig');
    acts.add(this.assetActions, 'switchToSMPL').name('Switch: SMPL Rig');
    acts.add(this.assetActions, 'hotReload').name('Hot-Reload All Assets');
    acts.add(this.assetActions, 'openViewer').name('Open Model Viewer [/viewer]');
    acts.open();

    f.open();
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
    // Update live monitor display
    const p = this.playerController.renderPos;
    this.playerMonitor.position = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`;
    this.playerMonitor.grounded = this.playerController.isGrounded;
    this.playerMonitor.speed = `${this.playerController.currentSpeed.toFixed(2)} m/s`;

    // Combat monitor
    this.combatMonitor.currentState = this.playerController.stateMachine.getCurrentStateId();
    const prev = this.playerController.stateMachine.getPreviousStateId();
    this.combatMonitor.previousState = prev || 'none';
    this.combatMonitor.timeInState = `${this.playerController.stateMachine.getTimeInState().toFixed(2)}s`;
    this.combatMonitor.stamina = `${this.playerController.stamina.current.toFixed(1)} / ${this.playerController.stamina.config.maxStamina}`;
    this.combatMonitor.iFrameActive = this.playerController.stateMachine.isInvulnerable();
    this.combatMonitor.inputBuffer = this.playerController.inputBuffer.getQueueSummary();

    // Animation & Asset monitor
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
