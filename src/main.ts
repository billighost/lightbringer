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

  // 2. Initialize Three.js Scene & Renderer
  const scene = new THREE.Scene();
  const engineRenderer = new EngineRenderer(canvas);

  // 3. Isolated Lighting Module (Directional Sun + Sky + Fog + Hemisphere)
  const lighting = new LightingModule(scene);

  // 4. Third-person Over-The-Shoulder Camera Rig
  const camera = new ThirdPersonCamera();

  // 5. Initialize Combat Hitboxes & Particle VFX
  HitboxManager.getInstance().init(scene);
  ImpactVfxManager.getInstance().init(scene);

  // 6. Build Graybox Scene (Stairs, ramp, platforms, and Training Dummies)
  const graybox = new GrayboxWorld(scene, physics);
  graybox.build();

  // 7. Character Controller with Dark Silhouette Rig & Combat State Machine
  const playerController = new PlayerController(scene, physics);
  camera.snapToTarget(playerController.currentPos);

  // 8. Rapier Wireframe Debug Renderer
  const rapierDebug = new RapierDebugRenderer(scene, physics);

  // 9. Input Manager
  const input = new InputManager(canvas, overlay);

  // Buffer inputs immediately on press/click
  input.setOnActionListener((action) => {
    playerController.inputBuffer.queue(action, performance.now() * 0.001);
  });

  // 10. Minimal Dark Combat HUD
  const hud = new HUD();
  hud.setCamera(camera.camera);

  // 11. Debug Panel (lil-gui + stats.js)
  const debugPanel = new DebugPanel(playerController, camera, lighting, rapierDebug, graybox);

  // Toggle debug panel on F1
  input.onToggleDebug(() => {
    debugPanel.toggle();
  });

  // 12. Game Loop (Fixed Physics Timestep + Render Interpolation)
  const gameLoop = new GameLoop(
    (fixedDt: number) => {
      // Fixed physics update
      const movementInput = input.getMovementInput();
      playerController.fixedUpdate(fixedDt, movementInput, camera);
      physics.step();
    },
    (alpha: number, dt: number) => {
      debugPanel.beginFrame();

      // Consume mouse delta for immediate high-refresh camera response
      const { dx, dy } = input.consumeMouseDelta();
      if (dx !== 0 || dy !== 0) {
        camera.handleMouseMove(dx, dy);
      }

      const wheelDelta = input.consumeWheelDelta();
      if (wheelDelta !== 0) {
        camera.handleMouseWheel(wheelDelta);
      }

      // Hit-stop timer & particle VFX updates
      HitStopManager.getInstance().update(dt);
      ImpactVfxManager.getInstance().update(dt);
      HitboxManager.getInstance().updateDebug();

      // Dummies spring wobble and sparring logic
      graybox.update(dt, playerController.renderPos);

      // Render interpolation of player position & facing rotation
      playerController.renderUpdate(alpha, dt);

      // Camera collision & smooth follow
      camera.update(dt, playerController.renderPos, physics, playerController.collider);

      // HUD trailing health and combat popups
      hud.update(dt);

      // Shadow camera follows player
      lighting.update(playerController.renderPos);

      // Live collider wireframes
      rapierDebug.update();

      // Three.js Render
      engineRenderer.render(scene, camera.camera);

      debugPanel.endFrame();
    },
    60 // 60Hz physics ticks
  );

  gameLoop.start();
}

bootstrap().catch((err) => {
  console.error('Fatal initialization error:', err);
});
