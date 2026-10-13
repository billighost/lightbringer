import * as THREE from 'three';
import { WindSystem } from '../wind/windSystem';

export class GroundMist {
  public scene: THREE.Scene;
  public group: THREE.Group;
  private mistPlanes: THREE.Mesh[] = [];
  private material: THREE.ShaderMaterial;
  private wind: WindSystem;

  constructor(scene: THREE.Scene, layerCount = 3) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.wind = WindSystem.getInstance();

    // Procedural swirling smoke/mist canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 40; i++) {
      const rx = Math.random() * 256;
      const ry = Math.random() * 256;
      const rRad = 20 + Math.random() * 50;
      const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, rRad);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(rx, ry, rRad, 0, Math.PI * 2);
      ctx.fill();
    }
    const mistTex = new THREE.CanvasTexture(canvas);
    mistTex.wrapS = THREE.RepeatWrapping;
    mistTex.wrapT = THREE.RepeatWrapping;

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uWindDir: this.wind.uniforms.uWindDir,
        uWindStrength: this.wind.uniforms.uWindStrength,
        uTexture: { value: mistTex },
        uMistColor: { value: new THREE.Color(0x071520) } // deep teal mist tint
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec2 uWindDir;
        uniform float uWindStrength;
        uniform sampler2D uTexture;
        uniform vec3 uMistColor;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          vec2 flow1 = vUv * 3.0 + uWindDir * uTime * 0.02 * uWindStrength;
          vec2 flow2 = vUv * 2.5 - uWindDir * uTime * 0.015 * uWindStrength;

          float n1 = texture2D(uTexture, flow1).r;
          float n2 = texture2D(uTexture, flow2).r;
          float mist = n1 * n2 * 1.8;

          // Radial fade from center of mist card
          float distFromCenter = length(vUv - vec2(0.5)) * 2.0;
          float radialFade = 1.0 - smoothstep(0.4, 1.0, distFromCenter);

          float alpha = clamp(mist * radialFade * 0.45, 0.0, 1.0);
          gl_FragColor = vec4(uMistColor, alpha);
        }
      `
    });

    // Create layered mist cards around center
    const planeGeo = new THREE.PlaneGeometry(60, 60);
    planeGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < layerCount; i++) {
      const mesh = new THREE.Mesh(planeGeo, this.material);
      mesh.position.y = 0.5 + i * 0.6;
      this.group.add(mesh);
      this.mistPlanes.push(mesh);
    }

    this.scene.add(this.group);
  }

  public update(time: number, playerPos: THREE.Vector3): void {
    this.material.uniforms.uTime.value = time;
    // Follow player smoothly on ground
    this.group.position.set(playerPos.x, playerPos.y + 0.3, playerPos.z);
  }

  public dispose(): void {
    this.scene.remove(this.group);
    this.material.dispose();
  }
}
