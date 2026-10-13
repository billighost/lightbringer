import * as THREE from 'three';
import { WaterParams } from '../../data/regions/schema';

export class WaterMaterial extends THREE.ShaderMaterial {
  constructor(waterParams: WaterParams, fogColor: string) {
    // Generate procedural water wave normal texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(256, 256);

    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const nx = Math.sin((x / 256) * Math.PI * 4) * 0.5 + 0.5;
        const ny = Math.cos((y / 256) * Math.PI * 4) * 0.5 + 0.5;
        const idx = (y * 256 + x) * 4;
        imgData.data[idx] = Math.floor(nx * 128 + 64);
        imgData.data[idx + 1] = Math.floor(ny * 128 + 64);
        imgData.data[idx + 2] = 255;
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const waveTex = new THREE.CanvasTexture(canvas);
    waveTex.wrapS = THREE.RepeatWrapping;
    waveTex.wrapT = THREE.RepeatWrapping;

    super({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uWaveTex: { value: waveTex },
          uSurfaceColor: { value: new THREE.Color(waterParams.surfaceColor) }, // teal
          uDeepColor: { value: new THREE.Color(waterParams.deepColor) }, // deep dark
          uFoamColor: { value: new THREE.Color(waterParams.foamColor) }, // glowing cyan
          uFogColor: { value: new THREE.Color(fogColor) },
          uClarity: { value: waterParams.clarity }
        }
      ]),
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vViewDir;
        varying vec2 vUv;
        #include <fog_pars_vertex>

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vViewDir = normalize(cameraPosition - worldPos.xyz);

          vec4 mvPosition = viewMatrix * worldPos;
          gl_Position = projectionMatrix * mvPosition;

          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uWaveTex;
        uniform vec3 uSurfaceColor;
        uniform vec3 uDeepColor;
        uniform vec3 uFoamColor;
        uniform vec3 uFogColor;
        uniform float uClarity;

        varying vec3 vWorldPos;
        varying vec3 vViewDir;
        varying vec2 vUv;
        #include <fog_pars_fragment>

        void main() {
          // Dual scrolling wave normals
          vec2 uv1 = vWorldPos.xz * 0.15 + vec2(uTime * 0.03, uTime * 0.02);
          vec2 uv2 = vWorldPos.xz * 0.22 - vec2(uTime * 0.025, -uTime * 0.015);

          vec3 n1 = texture2D(uWaveTex, uv1).rgb * 2.0 - 1.0;
          vec3 n2 = texture2D(uWaveTex, uv2).rgb * 2.0 - 1.0;
          vec3 normal = normalize(vec3(n1.xy + n2.xy, 1.0));

          // Soft Fresnel reflection
          float fresnel = pow(1.0 - max(0.0, dot(vViewDir, vec3(0.0, 1.0, 0.0))), 3.0);

          // Distance from center of water body disc for shore edge fade
          float distFromCenter = length(vUv - vec2(0.5)) * 2.0;
          float shoreFade = clamp((1.0 - distFromCenter) * 3.5, 0.0, 1.0);

          // Shoreline foam ring
          float shoreFoam = smoothstep(0.85, 0.98, distFromCenter) * (0.8 + 0.2 * sin(uTime * 4.0 + vWorldPos.x * 2.0));

          // Depth-based water coloration
          vec3 waterCol = mix(uDeepColor, uSurfaceColor, fresnel * 0.6 + 0.2);

          // Subtle glowing wave crest lines that bloom
          float waveCrest = clamp(n1.x * n2.y * 2.5, 0.0, 1.0);
          vec3 glowLines = uFoamColor * pow(waveCrest, 4.0) * 1.8;

          // Composite color
          vec3 finalColor = mix(waterCol, uFoamColor, shoreFoam * 0.7) + glowLines;
          finalColor = mix(finalColor, uFogColor, fresnel * 0.35);

          float alpha = clamp(shoreFade * 0.88 + shoreFoam * 0.5, 0.0, 0.95);

          gl_FragColor = vec4(finalColor, alpha);

          #include <fog_fragment>
        }
      `
    });
  }

  public update(time: number): void {
    this.uniforms.uTime.value = time;
  }
}
