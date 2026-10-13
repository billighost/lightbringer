import * as THREE from 'three';

export interface LightShaftConfig {
  position: THREE.Vector3;
  height?: number;
  topRadius?: number;
  bottomRadius?: number;
  color?: THREE.Color | string | number;
  intensity?: number;
}

export class LightShaftManager {
  public scene: THREE.Scene;
  public group: THREE.Group;
  private shafts: THREE.Mesh[] = [];
  private material: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x00f2ff) }, // cyan tint
        uIntensity: { value: 0.35 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          // Vertical gradient: brightest at top, fading out at bottom
          float verticalFade = (1.0 - vUv.y) * smoothstep(0.0, 0.25, vUv.y);

          // Soft rim / edge falloff so the cone edges don't look sharp
          float rim = 1.0 - abs(dot(vNormal, vViewDir));
          rim = pow(rim, 1.5);

          // Subtle animated vertical light striations
          float rays = sin(vUv.x * 24.0 + uTime * 0.4) * 0.2 + 0.8;

          float alpha = verticalFade * rim * rays * uIntensity;
          gl_FragColor = vec4(uColor, alpha);
        }
      `
    });
  }

  public createShaft(config: LightShaftConfig): THREE.Mesh {
    const height = config.height ?? 18;
    const topRadius = config.topRadius ?? 1.2;
    const bottomRadius = config.bottomRadius ?? 6.0;

    const geo = new THREE.CylinderGeometry(topRadius, bottomRadius, height, 24, 1, true);
    // Shift geometry origin so bottom sits at position.y
    geo.translate(0, height * 0.5, 0);

    const mat = this.material.clone();
    if (config.color) {
      mat.uniforms.uColor.value.set(config.color);
    }
    if (config.intensity !== undefined) {
      mat.uniforms.uIntensity.value = config.intensity;
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(config.position);
    this.group.add(mesh);
    this.shafts.push(mesh);
    return mesh;
  }

  public spawnDebugShafts(): void {
    // Spawn test shafts near the central wading pool and hills
    this.createShaft({
      position: new THREE.Vector3(0, -0.2, -32),
      height: 22,
      topRadius: 1.5,
      bottomRadius: 7.5,
      color: 0x00f2ff, // cyan shaft over pool
      intensity: 0.38
    });

    this.createShaft({
      position: new THREE.Vector3(25, 4.0, -18),
      height: 18,
      topRadius: 1.0,
      bottomRadius: 5.5,
      color: 0x39ff14, // toxic green shaft
      intensity: 0.3
    });

    this.createShaft({
      position: new THREE.Vector3(-22, 1.5, -12),
      height: 20,
      topRadius: 1.2,
      bottomRadius: 6.0,
      color: 0x9d24db, // violet shaft
      intensity: 0.32
    });
  }

  public update(time: number): void {
    this.material.uniforms.uTime.value = time;
    for (const shaft of this.shafts) {
      (shaft.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    }
  }

  public dispose(): void {
    this.scene.remove(this.group);
    for (const shaft of this.shafts) {
      shaft.geometry.dispose();
      (shaft.material as THREE.ShaderMaterial).dispose();
    }
    this.material.dispose();
    this.shafts = [];
  }
}
