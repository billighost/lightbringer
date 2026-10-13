import * as THREE from 'three';

export class EngineRenderer {
  public renderer: THREE.WebGLRenderer;
  public canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private onWindowResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.dispose();
  }
}
