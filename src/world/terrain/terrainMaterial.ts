import * as THREE from 'three';
import { ProceduralTextureGenerator, TerrainTextureSets } from './proceduralTextures';
import { RegionData } from '../../data/regions/schema';

export interface TerrainMaterialOptions {
  region: RegionData;
  quality?: 'low' | 'medium' | 'high';
}

export class TerrainMaterial extends THREE.MeshStandardMaterial {
  public uniforms: {
    uTime: { value: number };
    uPlayerPos: { value: THREE.Vector3 };
    uWaterLevel: { value: number };
    uQuality: { value: number }; // 0: low, 1: medium, 2: high
    uDeadSoilAlbedo: { value: THREE.Texture };
    uDeadSoilNormal: { value: THREE.Texture };
    uDeadSoilRoughAo: { value: THREE.Texture };
    uWetMudAlbedo: { value: THREE.Texture };
    uWetMudNormal: { value: THREE.Texture };
    uWetMudRoughAo: { value: THREE.Texture };
    uCrackedRockAlbedo: { value: THREE.Texture };
    uCrackedRockNormal: { value: THREE.Texture };
    uCrackedRockRoughAo: { value: THREE.Texture };
    uGlowingMossAlbedo: { value: THREE.Texture };
    uGlowingMossNormal: { value: THREE.Texture };
    uGlowingMossRoughAo: { value: THREE.Texture };
    uVeinTexture: { value: THREE.Texture };
    uVeinColor1: { value: THREE.Color };
    uVeinColor2: { value: THREE.Color };
  };

  private textures: TerrainTextureSets;

  constructor(options: TerrainMaterialOptions) {
    super({
      roughness: 0.8,
      metalness: 0.05
    });

    this.textures = ProceduralTextureGenerator.getInstance().getTerrainTextures();

    const qualityVal = options.quality === 'low' ? 0 : options.quality === 'medium' ? 1 : 2;

    this.uniforms = {
      uTime: { value: 0 },
      uPlayerPos: { value: new THREE.Vector3() },
      uWaterLevel: { value: options.region.water.level },
      uQuality: { value: qualityVal },
      uDeadSoilAlbedo: { value: this.textures.deadSoil.albedo },
      uDeadSoilNormal: { value: this.textures.deadSoil.normal },
      uDeadSoilRoughAo: { value: this.textures.deadSoil.roughnessAo },
      uWetMudAlbedo: { value: this.textures.wetMud.albedo },
      uWetMudNormal: { value: this.textures.wetMud.normal },
      uWetMudRoughAo: { value: this.textures.wetMud.roughnessAo },
      uCrackedRockAlbedo: { value: this.textures.crackedRock.albedo },
      uCrackedRockNormal: { value: this.textures.crackedRock.normal },
      uCrackedRockRoughAo: { value: this.textures.crackedRock.roughnessAo },
      uGlowingMossAlbedo: { value: this.textures.glowingMoss.albedo },
      uGlowingMossNormal: { value: this.textures.glowingMoss.normal },
      uGlowingMossRoughAo: { value: this.textures.glowingMoss.roughnessAo },
      uVeinTexture: { value: this.textures.myceliumVeins },
      uVeinColor1: { value: new THREE.Color(options.region.palette.cyan) },
      uVeinColor2: { value: new THREE.Color(options.region.palette.toxicGreen) }
    };

    this.onBeforeCompile = (shader) => {
      // Pass custom uniforms into shader
      Object.assign(shader.uniforms, this.uniforms);

      // Vertex shader modifications
      shader.vertexShader = `
        varying vec3 vWorldPos;
        varying vec3 vWorldNorm;
        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWorldNorm = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        `
      );

      // Fragment shader modifications
      shader.fragmentShader = `
        varying vec3 vWorldPos;
        varying vec3 vWorldNorm;

        uniform float uTime;
        uniform vec3 uPlayerPos;
        uniform float uWaterLevel;
        uniform int uQuality;

        uniform sampler2D uDeadSoilAlbedo;
        uniform sampler2D uDeadSoilNormal;
        uniform sampler2D uDeadSoilRoughAo;

        uniform sampler2D uWetMudAlbedo;
        uniform sampler2D uWetMudNormal;
        uniform sampler2D uWetMudRoughAo;

        uniform sampler2D uCrackedRockAlbedo;
        uniform sampler2D uCrackedRockNormal;
        uniform sampler2D uCrackedRockRoughAo;

        uniform sampler2D uGlowingMossAlbedo;
        uniform sampler2D uGlowingMossNormal;
        uniform sampler2D uGlowingMossRoughAo;

        uniform sampler2D uVeinTexture;
        uniform vec3 uVeinColor1;
        uniform vec3 uVeinColor2;

        vec4 sampleTriplanar(sampler2D tex, vec3 pos, vec3 norm, float scale) {
          if (uQuality == 0) {
            // Low quality: Top-down single planar projection
            return texture2D(tex, pos.xz * scale);
          }
          vec3 weights = pow(abs(norm), vec3(4.0));
          weights /= (weights.x + weights.y + weights.z);

          vec4 colX = texture2D(tex, pos.zy * scale);
          vec4 colY = texture2D(tex, pos.xz * scale);
          vec4 colZ = texture2D(tex, pos.xy * scale);

          return colX * weights.x + colY * weights.y + colZ * weights.z;
        }

        ${shader.fragmentShader}
      `;

      // Inject triplanar layer blending into standard color mapping
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        vec3 norm = normalize(vWorldNorm);
        float slope = clamp(dot(norm, vec3(0.0, 1.0, 0.0)), 0.0, 1.0);

        // Triplanar samples
        vec4 soilCol = sampleTriplanar(uDeadSoilAlbedo, vWorldPos, norm, 0.12);
        vec4 mudCol = sampleTriplanar(uWetMudAlbedo, vWorldPos, norm, 0.14);
        vec4 rockCol = sampleTriplanar(uCrackedRockAlbedo, vWorldPos, norm, 0.10);
        vec4 mossCol = sampleTriplanar(uGlowingMossAlbedo, vWorldPos, norm, 0.16);

        vec4 soilRoughAo = sampleTriplanar(uDeadSoilRoughAo, vWorldPos, norm, 0.12);
        vec4 mudRoughAo = sampleTriplanar(uWetMudRoughAo, vWorldPos, norm, 0.14);
        vec4 rockRoughAo = sampleTriplanar(uCrackedRockRoughAo, vWorldPos, norm, 0.10);
        vec4 mossRoughAo = sampleTriplanar(uGlowingMossRoughAo, vWorldPos, norm, 0.16);

        // Layer blending weights:
        // 1. Rock weight on steep slopes
        float rockWeight = smoothstep(0.72, 0.40, slope);

        // 2. Mud weight in low / wet areas
        float distToWater = vWorldPos.y - uWaterLevel;
        float mudWeight = (1.0 - rockWeight) * (1.0 - smoothstep(0.0, 1.8, distToWater));

        // 3. Moss weight in upper / humid zones modulated by low-frequency noise
        float macroNoise = sin(vWorldPos.x * 0.04) * cos(vWorldPos.z * 0.04) * 0.5 + 0.5;
        float mossWeight = (1.0 - rockWeight) * (1.0 - mudWeight) * smoothstep(0.35, 0.65, macroNoise);

        // 4. Dead soil everywhere else
        float soilWeight = max(0.0, 1.0 - rockWeight - mudWeight - mossWeight);

        // Normalizing weights
        float totalWeight = rockWeight + mudWeight + mossWeight + soilWeight + 0.0001;
        rockWeight /= totalWeight;
        mudWeight /= totalWeight;
        mossWeight /= totalWeight;
        soilWeight /= totalWeight;

        vec4 blendedAlbedo = soilCol * soilWeight + mudCol * mudWeight + rockCol * rockWeight + mossCol * mossWeight;
        vec4 blendedRoughAo = soilRoughAo * soilWeight + mudRoughAo * mudWeight + rockRoughAo * rockWeight + mossRoughAo * mossWeight;

        // Macro color variation to break tiling
        float macroVar = 0.88 + 0.24 * (sin(vWorldPos.x * 0.015 + 1.2) * cos(vWorldPos.z * 0.015 + 0.7) * 0.5 + 0.5);
        blendedAlbedo.rgb *= macroVar;

        // Low area wetness darkening
        if (vWorldPos.y < uWaterLevel + 0.5) {
          float wetFactor = 1.0 - clamp((vWorldPos.y - uWaterLevel) / 0.5, 0.0, 1.0);
          blendedAlbedo.rgb *= (1.0 - wetFactor * 0.35);
          blendedRoughAo.r = mix(blendedRoughAo.r, 0.15, wetFactor * 0.8);
        }

        diffuseColor = blendedAlbedo;
        `
      );

      // Inject roughness / AO into roughnessmap_fragment
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(blendedRoughAo.r, 0.1, 0.98);
        `
      );

      // Inject pulsing emissive mycelium veins into emissivemap_fragment
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `
        #include <emissivemap_fragment>

        // Sample glowing mycelium veins
        vec4 veinSample = sampleTriplanar(uVeinTexture, vWorldPos, norm, 0.08);
        float veinMask = veinSample.r;

        // Slow organic pulse
        float pulse = 0.65 + 0.35 * sin(uTime * 1.4 + vWorldPos.x * 0.08 + vWorldPos.z * 0.08);

        // Vein color transition between cyan and toxic green
        float colorShift = sin(uTime * 0.7 + vWorldPos.x * 0.05) * 0.5 + 0.5;
        vec3 veinColor = mix(uVeinColor1, uVeinColor2, colorShift);

        // Emissive boost: veins glow brightly to activate post-processing bloom
        float veinBoost = veinMask * pulse * (mossWeight * 1.8 + soilWeight * 0.6);
        totalEmissiveRadiance += veinColor * veinBoost * 2.8;
        `
      );
    };
  }

  public update(time: number, playerPos: THREE.Vector3): void {
    this.uniforms.uTime.value = time;
    this.uniforms.uPlayerPos.value.copy(playerPos);
  }

  public setQuality(quality: 'low' | 'medium' | 'high'): void {
    const val = quality === 'low' ? 0 : quality === 'medium' ? 1 : 2;
    this.uniforms.uQuality.value = val;
    this.needsUpdate = true;
  }
}
