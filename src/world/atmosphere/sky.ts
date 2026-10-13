import * as THREE from 'three';
import { RegionData } from '../../data/regions/schema';

export class SunlessSkyDome {
  public scene: THREE.Scene;
  public mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene, region: RegionData) {
    this.scene = scene;

    const skyGeo = new THREE.SphereGeometry(600, 32, 24);

    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false, // Sky dome provides its own horizon blend matching fog
      uniforms: {
        uTime: { value: 0 },
        uFogColor: { value: new THREE.Color(region.fog.color) }, // #07121b
        uZenithColor: { value: new THREE.Color(0x040308) },
        uAuroraColor: { value: new THREE.Color(0x280d3d) } // deep violet
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uFogColor;
        uniform vec3 uZenithColor;
        uniform vec3 uAuroraColor;
        varying vec3 vWorldPos;

        void main() {
          vec3 dir = normalize(vWorldPos);
          float elevation = clamp(dir.y, 0.0, 1.0);

          // Dark gradient: fog color at horizon to zenith near-black
          vec3 baseSky = mix(uFogColor, uZenithColor, pow(elevation, 0.6));

          // Faint slow-moving aurora-like wave bands in deep violet
          float wave1 = sin(dir.x * 6.0 + dir.z * 4.0 + uTime * 0.06);
          float wave2 = cos(dir.x * 8.0 - dir.z * 5.0 + uTime * 0.04);
          float auroraMask = pow(clamp(wave1 * wave2, 0.0, 1.0), 3.0);

          // Limit aurora to upper sky band
          float bandMask = smoothstep(0.2, 0.5, elevation) * (1.0 - smoothstep(0.7, 0.95, elevation));
          vec3 skyColor = baseSky + uAuroraColor * (auroraMask * bandMask * 0.35);

          gl_FragColor = vec4(skyColor, 1.0);
        }
      `
    });

    this.mesh = new THREE.Mesh(skyGeo, this.material);
    this.mesh.renderOrder = -1000;
    this.scene.add(this.mesh);
  }

  public update(time: number, cameraPos: THREE.Vector3): void {
    this.material.uniforms.uTime.value = time;
    this.mesh.position.copy(cameraPos);
  }

  public dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
