import * as THREE from 'three';
import { EngineRenderer } from './engine/renderer';
import { PhysicsWorld } from './engine/physics';
import { LightingModule } from './engine/lighting';
import { ThirdPersonCamera } from './engine/camera';
import { GrayboxWorld } from './world/graybox';
import { PlayerController } from './player/player-controller';
import { InputManager } from './core/input';
import { GameLoop } from './core/game-loop';
import { RapierDebugRenderer } from './debug/rapier-debug';
import { DebugPanel } from './debug/debug-panel';
import { HitboxManager } from './combat/hitboxManager';
import { ImpactVfxManager, HitStopManager } from './combat/gameFeel';
import { HUD } from './ui/hud';
import { GLIMMERWOOD_REGION } from './data/regions/glimmerwood';
import { HeightFunction } from './world/terrain/heightFunction';
import { TerrainMaterial } from './world/terrain/terrainMaterial';
import { ChunkManager } from './world/terrain/chunkManager';
import { TerrainColliderManager } from './world/terrain/colliders';
import { WindSystem } from './world/wind/windSystem';
import { createWindTestCards } from './world/wind/windShaderChunk';
import { WaterBodiesManager } from './world/water/waterBodies';
import { WadingSystem } from './world/water/wading';
import { SporeAtmosphere } from './world/atmosphere/spores';
import { GroundMist } from './world/atmosphere/mist';
import { LightShaftManager } from './world/atmosphere/lightShafts';
import { SunlessSkyDome } from './world/atmosphere/sky';
import { FlyCam } from './debug/flyCam';

async function bootstrap(): Promise<void> {
  if (window.location.pathname.includes('/viewer') || window.location.search.includes('viewer')) {
    window.location.href = '/viewer.html';
    return;
  }

  const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
  const overlay = document.getElementById('click-to-play-overlay');

  if (!canvas) {
    throw new Error('Canvas element #webgl-canvas not found.');
  }

  // 1. Initialize Physics Engine (Rapier WASM)
  const physics = new PhysicsWorld();
  await physics.init({ x: 0, y: -26.0, z: 0 });

  // 2. Initialize Three.js Scene & Renderer with Post-Processing
  const scene = new THREE.Scene();
  const engineRenderer = new EngineRenderer(canvas);

  // 3. Isolated Sunless Lighting Module (Cold teal-violet fog, dim ambient, warm player light & light pool)
  const lighting = new LightingModule(scene);

  // 4. Third-person Over-The-Shoulder Camera Rig
  const camera = new ThirdPersonCamera();
  const flyCam = new FlyCam(camera.camera);

  // 5. Post-Processing Pipeline (ACES Filmic, selective bloom, SMAA, subtle vignette, film grain)
  const postPipeline = engineRenderer.initPostProcessing(scene, camera.camera);

  // 6. Global Wind System
  const wind = new WindSystem(GLIMMERWOOD_REGION.wind);

  // 7. Terrain Foundation: Deterministic Height Function, Material, Streaming Chunks & Colliders
  const heightFunction = new HeightFunction(GLIMMERWOOD_REGION);
  const terrainMaterial = new TerrainMaterial({ region: GLIMMERWOOD_REGION, quality: 'high' });
  const chunkManager = new ChunkManager(scene, GLIMMERWOOD_REGION, heightFunction, terrainMaterial);
  const terrainColliders = new TerrainColliderManager(physics, GLIMMERWOOD_REGION, heightFunction);

  // 8. Water System: Shallow Basin Water Bodies & Player Wading
  const waterBodies = new WaterBodiesManager(scene, GLIMMERWOOD_REGION, heightFunction);

  // 9. Sunless Atmosphere: Spores, Ground Mist, Volumetric Light Shafts, Gradient Sky Dome
  const spores = new SporeAtmosphere(scene, GLIMMERWOOD_REGION, 1200);
  const groundMist = new GroundMist(scene, 3);
  const lightShafts = new LightShaftManager(scene);
  lightShafts.spawnDebugShafts();
  const skyDome = new SunlessSkyDome(scene, GLIMMERWOOD_REGION);

  // Demonstration test banners with wind sway shader
  createWindTestCards(scene, 4, new THREE.Vector3(8, 0, 8));

  // 10. Register initial surrounding glow sources into the Light Pool
  lighting.lightPool.registerGlowSource('pool_lantern', new THREE.Vector3(0, 0.4, -32), '#00f2ff', 3.2, 18);
  lighting.lightPool.registerGlowSource('lookout_shrine', new THREE.Vector3(52, 9.8, -48), '#39ff14', 3.0, 16);
  lighting.lightPool.registerGlowSource('sunken_shallows', new THREE.Vector3(64, 0.5, 32), '#9d24db', 2.8, 14);

  // 11. Combat Hitboxes & Particle VFX
  HitboxManager.getInstance().init(scene);
  ImpactVfxManager.getInstance().init(scene);

  // 12. Build Graybox Scene (Stairs, ramp, platforms, and Training Dummies)
  // Initially hidden behind debug toggle ("Graybox test area")
  const graybox = new GrayboxWorld(scene, physics);
  graybox.build();

  // 13. Character Controller with Dark Silhouette Rig & Combat State Machine
  const playerController = new PlayerController(scene, physics);
  camera.snapToTarget(playerController.currentPos);

  // 14. Shallow Wading Controller System
  const wading = new WadingSystem(scene, playerController, GLIMMERWOOD_REGION);

  // 15. Rapier Wireframe Debug Renderer
  const rapierDebug = new RapierDebugRenderer(scene, physics);

  // 16. Input Manager
  const input = new InputManager(canvas, overlay);

  // Buffer inputs immediately on press/click
  input.setOnActionListener((action) => {
    playerController.inputBuffer.queue(action, performance.now() * 0.001);
  });

  // 17. Minimal Dark Combat HUD
  const hud = new HUD();
  hud.setCamera(camera.camera);

  // 18. Comprehensive Debug Panel (lil-gui + stats.js + Dark World controls)
  const debugPanel = new DebugPanel(playerController, camera, lighting, rapierDebug, graybox, {
    chunkManager,
    terrainMaterial,
    waterBodies,
    wind,
    postPipeline,
    flyCam,
    spores,
    renderer: engineRenderer.renderer
  });

  // Toggle debug panel on F1
  input.onToggleDebug(() => {
    debugPanel.toggle();
  });

  // 19. Unified Game Loop (Fixed Physics Timestep + Render Interpolation)
  let elapsedTime = 0;

  const gameLoop = new GameLoop(
    (fixedDt: number) => {
      // Fixed physics update
      const movementInput = input.getMovementInput();
      playerController.fixedUpdate(fixedDt, movementInput, camera);

      // Stream Rapier terrain colliders near player
      terrainColliders.update(playerController.currentPos.x, playerController.currentPos.z);

      physics.step();
    },
    (alpha: number, dt: number) => {
      debugPanel.beginFrame();
      elapsedTime += dt;

      // Handle mouse look: route to FlyCam if active, otherwise ThirdPersonCamera
      const { dx, dy } = input.consumeMouseDelta();
      if (dx !== 0 || dy !== 0) {
        if (flyCam.enabled) {
          flyCam.handleMouseMove(dx, dy);
        } else {
          camera.handleMouseMove(dx, dy);
        }
      }

      const wheelDelta = input.consumeWheelDelta();
      if (wheelDelta !== 0 && !flyCam.enabled) {
        camera.handleMouseWheel(wheelDelta);
      }

      // Update Wind
      wind.update(dt);

      // Hit-stop timer & particle VFX updates
      HitStopManager.getInstance().update(dt);
      ImpactVfxManager.getInstance().update(dt);
      HitboxManager.getInstance().updateDebug();

      // Dummies spring wobble and sparring logic
      graybox.update(dt, playerController.renderPos);

      // Render interpolation of player position & facing rotation
      playerController.renderUpdate(alpha, dt);

      // Update Wading System (speed modifier & foot ripples)
      wading.update(dt);

      // Camera follow (or detached FlyCam update)
      if (flyCam.enabled) {
        flyCam.update(dt);
      } else {
        camera.update(dt, playerController.renderPos, physics, playerController.collider);
      }

      // Stream terrain chunks around player
      chunkManager.update(playerController.renderPos);
      terrainMaterial.update(elapsedTime, playerController.renderPos);

      // Update atmosphere systems
      waterBodies.update(elapsedTime);
      spores.update(dt, playerController.renderPos, camera.camera);
      groundMist.update(elapsedTime, playerController.renderPos);
      lightShafts.update(elapsedTime);
      skyDome.update(elapsedTime, camera.camera.position);

      // Sunless Lighting & Player Light update
      lighting.update(playerController.renderPos, dt, elapsedTime);

      // HUD trailing health and combat popups
      hud.update(dt);

      // Live collider wireframes
      rapierDebug.update();

      // Three.js Render with Post-Processing
      engineRenderer.render(scene, camera.camera, dt);

      debugPanel.endFrame();
    },
    60 // 60Hz physics ticks
  );

  (window as any).__DEBUG__ = {
    playerController,
    camera,
    lighting,
    scene,
    postPipeline,
    heightFunction,
    engineRenderer
  };

  gameLoop.start();
}

bootstrap().catch((err) => {
  console.error('Fatal initialization error:', err);
});
