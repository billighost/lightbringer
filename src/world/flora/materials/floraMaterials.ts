import * as THREE from 'three';
import { WindSystem } from '../../wind/windSystem';
import { WIND_GLSL_CHUNK } from '../../wind/windShaderChunk';
import { FloraMaterialId, GlowSettings, WindSettings } from '../../../data/flora/archetypeTypes';
import { RegionData } from '../../../data/regions/schema';

// 4x4 Bayer Dither Matrix for cross-fade LOD transitions
const BAYER_DITHER_CHUNK = `
  float bayerDither(vec2 screenPos) {
    int x = int(mod(screenPos.x, 4.0));
    int y = int(mod(screenPos.y, 4.0));
    int index = x + y * 4;
    float limit = 0.0;
    if (index == 0) limit = 1.0 / 16.0;
    else if (index == 1) limit = 9.0 / 16.0;
    else if (index == 2) limit = 3.0 / 16.0;
    else if (index == 3) limit = 11.0 / 16.0;
    else if (index == 4) limit = 13.0 / 16.0;
    else if (index == 5) limit = 5.0 / 16.0;
    else if (index == 6) limit = 15.0 / 16.0;
    else if (index == 7) limit = 7.0 / 16.0;
    else if (index == 8) limit = 4.0 / 16.0;
    else if (index == 9) limit = 12.0 / 16.0;
    else if (index == 10) limit = 2.0 / 16.0;
    else if (index == 11) limit = 10.0 / 16.0;
    else if (index == 12) limit = 16.0 / 16.0;
    else if (index == 13) limit = 8.0 / 16.0;
    else if (index == 14) limit = 14.0 / 16.0;
    else if (index == 15) limit = 6.0 / 16.0;
    return limit;
  }
`;

export class FloraMaterialManager {
  private static instance: FloraMaterialManager | null = null;

  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private timeUniform = { value: 0 };
  private sharedTextures: Record<string, THREE.CanvasTexture> = {};

  public static getInstance(): FloraMaterialManager {
    if (!this.instance) {
      this.instance = new FloraMaterialManager();
    }
    return this.instance;
  }

  constructor() {
    this.createProceduralFallbackTextures();
  }

  private createProceduralFallbackTextures(): void {
    // 1. Bark texture (rough cracked vertical grain)
    const barkCanvas = document.createElement('canvas');
    barkCanvas.width = 256;
    barkCanvas.height = 256;
    const bCtx = barkCanvas.getContext('2d')!;
    bCtx.fillStyle = '#1c1815';
    bCtx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x += 4) {
        const grain = Math.sin(x * 0.15) * 0.5 + Math.random() * 0.25;
        const shade = Math.floor(25 + grain * 22);
        bCtx.fillStyle = `rgb(${shade}, ${Math.floor(shade * 0.85)}, ${Math.floor(shade * 0.7)})`;
        bCtx.fillRect(x, y, 3, 1);
      }
    }
    const barkTex = new THREE.CanvasTexture(barkCanvas);
    barkTex.wrapS = THREE.RepeatWrapping;
    barkTex.wrapT = THREE.RepeatWrapping;
    this.sharedTextures['bark'] = barkTex;

    // 2. Fungus flesh texture (soft mottled spore specks)
    const fungusCanvas = document.createElement('canvas');
    fungusCanvas.width = 256;
    fungusCanvas.height = 256;
    const fCtx = fungusCanvas.getContext('2d')!;
    fCtx.fillStyle = '#0a1d22';
    fCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 400; i++) {
      const rx = Math.random() * 256;
      const ry = Math.random() * 256;
      const rad = 2 + Math.random() * 6;
      fCtx.fillStyle = Math.random() > 0.5 ? 'rgba(0, 242, 255, 0.08)' : 'rgba(224, 22, 124, 0.08)';
      fCtx.beginPath();
      fCtx.arc(rx, ry, rad, 0, Math.PI * 2);
      fCtx.fill();
    }
    const fungusTex = new THREE.CanvasTexture(fungusCanvas);
    fungusTex.wrapS = THREE.RepeatWrapping;
    fungusTex.wrapT = THREE.RepeatWrapping;
    this.sharedTextures['fungus'] = fungusTex;
  }

  /**
   * Gets or creates a material configured for the specific material type, glow, and wind settings
   */
  public getMaterial(
    materialId: FloraMaterialId,
    glow: GlowSettings,
    wind: WindSettings,
    region?: RegionData
  ): THREE.MeshStandardMaterial {
    const key = `${materialId}_${glow.enabled ? glow.color : 'noglow'}_${wind.swayStrength.toFixed(2)}`;
    if (this.materials.has(key)) {
      return this.materials.get(key)!;
    }

    const mat = this.createMaterial(materialId, glow, wind, region);
    this.materials.set(key, mat);
    return mat;
  }

  private createMaterial(
    materialId: FloraMaterialId,
    glow: GlowSettings,
    wind: WindSettings,
    region?: RegionData
  ): THREE.MeshStandardMaterial {
    const baseColor = new THREE.Color();
    let roughness = 0.8;
    let metalness = 0.05;

    switch (materialId) {
      case 'fungus':
        baseColor.set(region?.palette.deepTeal || '#08252c');
        roughness = 0.45; // Wet specular
        metalness = 0.08;
        break;
      case 'bark':
        baseColor.set('#161412'); // Dark gnarled dead bark
        roughness = 0.92;
        metalness = 0.02;
        break;
      case 'rock':
        baseColor.set('#1a2128'); // Deep basalt rock
        roughness = 0.85;
        metalness = 0.12;
        break;
      case 'foliage':
        baseColor.set('#12221c'); // Withered deep teal/green
        roughness = 0.75;
        metalness = 0.02;
        break;
      case 'crystal':
        baseColor.set('#0a323a'); // Translucent crystal tint
        roughness = 0.15; // Glassy crystalline sheen
        metalness = 0.45;
        break;
      case 'vein':
        baseColor.set('#041217');
        roughness = 0.6;
        metalness = 0.05;
        break;
    }

    const mat = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness,
      metalness,
      map: this.sharedTextures[materialId] || null,
      side: materialId === 'foliage' || materialId === 'vein' ? THREE.DoubleSide : THREE.FrontSide,
      transparent: materialId === 'vein',
      opacity: materialId === 'vein' ? 0.85 : 1.0,
      depthWrite: true
    });

    const windSys = WindSystem.getInstance();
    const glowColor = new THREE.Color(glow.color);
    const glowIntensity = glow.intensity;
    const pulsePeriod = (glow.pulsePeriodRange[0] + glow.pulsePeriodRange[1]) * 0.5;
    const swayStrength = wind.swayStrength;

    mat.onBeforeCompile = (shader) => {
      // Uniforms
      shader.uniforms.uWindDir = windSys.uniforms.uWindDir;
      shader.uniforms.uWindStrength = windSys.uniforms.uWindStrength;
      shader.uniforms.uWindTime = windSys.uniforms.uWindTime;
      shader.uniforms.uFloraTime = this.timeUniform;
      shader.uniforms.uGlowColor = { value: glowColor };
      shader.uniforms.uGlowIntensity = { value: glowIntensity };
      shader.uniforms.uPulsePeriod = { value: pulsePeriod };
      shader.uniforms.uArchetypeSway = { value: swayStrength };
      shader.uniforms.uMossColor = { value: new THREE.Color(region?.palette.toxicGreen || '#2afc64') };

      // Vertex Shader extensions
      shader.vertexShader = `
        attribute float aWindWeight;
        attribute float aGlowMask;
        attribute float aVertexAo;

        varying float vWindWeight;
        varying float vGlowMask;
        varying float vVertexAo;
        varying vec3 vFloraWorldPos;
        varying vec3 vFloraWorldNormal;

        uniform float uFloraTime;
        uniform float uArchetypeSway;
        ${WIND_GLSL_CHUNK}

        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>

        // Forward vertex attributes or unpack from color
        #ifdef USE_COLOR
          vWindWeight = color.r;
          vGlowMask = color.g;
          vVertexAo = color.b;
        #else
          vWindWeight = aWindWeight;
          vGlowMask = aGlowMask;
          vVertexAo = aVertexAo;
        #endif

        // World-space orientation
        vec4 floraWorldPos = modelMatrix * vec4(position, 1.0);
        vFloraWorldPos = floraWorldPos.xyz;
        vFloraWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

        // Wind displacement based on archetype sway strength and vertex weight
        if (uArchetypeSway > 0.001) {
          transformed = applyWindDisplacement(transformed, vWindWeight * uArchetypeSway, 0.0);
        }
        `
      );

      // Fragment Shader extensions
      shader.fragmentShader = `
        varying float vWindWeight;
        varying float vGlowMask;
        varying float vVertexAo;
        varying vec3 vFloraWorldPos;
        varying vec3 vFloraWorldNormal;

        uniform float uFloraTime;
        uniform vec3 uGlowColor;
        uniform float uGlowIntensity;
        uniform float uPulsePeriod;
        uniform vec3 uMossColor;

        ${BAYER_DITHER_CHUNK}

        ${shader.fragmentShader}
      `;

      // Inject Ambient Occlusion & Ground Moss
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>

        // Apply baked vertex Ambient Occlusion to diffuse
        diffuseColor.rgb *= clamp(vVertexAo, 0.15, 1.0);

        // Subtle moss on upward-facing rock normals
        #if defined(USE_ROUGHNESS)
          float upFactor = clamp(vFloraWorldNormal.y - 0.45, 0.0, 1.0);
          if (upFactor > 0.0) {
            diffuseColor.rgb = mix(diffuseColor.rgb, uMossColor * 0.18, upFactor * 0.45);
          }
        #endif
        `
      );

      // Inject HDR Glowing Pulsing Emissive Radiance
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `
        #include <emissivemap_fragment>

        if (vGlowMask > 0.01 && uGlowIntensity > 0.01) {
          // Slow breathing cycle (4-9s)
          float pulseFreq = 6.28318 / max(1.0, uPulsePeriod);
          float spatialPhase = vFloraWorldPos.x * 0.15 + vFloraWorldPos.z * 0.15;
          float pulse = sin(uFloraTime * pulseFreq + spatialPhase) * 0.35 + 0.65;

          // HDR emissive boost for bloom pickup
          vec3 floraEmissive = uGlowColor * (uGlowIntensity * vGlowMask * pulse);
          totalEmissiveRadiance += floraEmissive;
        }
        `
      );
    };

    return mat;
  }

  public update(time: number): void {
    this.timeUniform.value = time;
  }

  public dispose(): void {
    for (const mat of this.materials.values()) {
      mat.dispose();
    }
    this.materials.clear();
    for (const tex of Object.values(this.sharedTextures)) {
      tex.dispose();
    }
    this.sharedTextures = {};
  }
}
