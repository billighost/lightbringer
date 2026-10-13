import * as THREE from 'three';
import { PostPipeline } from './post/postPipeline';

export class EngineRenderer {
  public renderer: THREE.WebGLRenderer;
  public canvas: HTMLCanvasElement;
  public postPipeline: PostPipeline | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // Antialiasing handled by SMAA/FXAA in postprocessing
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  public initPostProcessing(scene: THREE.Scene, camera: THREE.Camera): PostPipeline | null {
    try {
      this.postPipeline = new PostPipeline(this.renderer, scene, camera);
      return this.postPipeline;
    } catch (err) {
      console.warn('[EngineRenderer] Post-processing initialization failed, falling back to standard renderer:', err);
      this.postPipeline = null;
      return null;
    }
  }

  private onWindowResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (this.postPipeline) {
      this.postPipeline.setSize(width, height);
    }
  }

  public render(scene: THREE.Scene, camera: THREE.Camera, dt = 0.016): void {
    if (this.postPipeline) {
      this.postPipeline.render(dt);
    } else {
      this.renderer.render(scene, camera);
    }
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    if (this.postPipeline) {
      this.postPipeline.dispose();
    }
    this.renderer.dispose();
  }
}
