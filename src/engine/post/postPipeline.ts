import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  ToneMappingEffect,
  ToneMappingMode,
  SMAAEffect,
  VignetteEffect,
  NoiseEffect,
  ChromaticAberrationEffect,
  HueSaturationEffect,
  BrightnessContrastEffect,
  DepthOfFieldEffect,
  BlendFunction
} from 'postprocessing';

export type QualityPreset = 'low' | 'medium' | 'high';

export interface PostProcessingConfig {
  bloomIntensity: number;
  bloomThreshold: number;
  bloomSmoothing: number;
  vignetteDarkness: number;
  vignetteOffset: number;
  grainOpacity: number;
  chromaticAberration: number;
  contrast: number;
  saturation: number;
  depthOfFieldEnabled: boolean;
  quality: QualityPreset;
}

export class PostPipeline {
  public composer: EffectComposer;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.Camera;

  private renderPass: RenderPass;
  private effectPass: EffectPass;

  // Effects
  public toneMappingEffect: ToneMappingEffect;
  public bloomEffect: BloomEffect;
  public smaaEffect: SMAAEffect;
  public vignetteEffect: VignetteEffect;
  public noiseEffect: NoiseEffect;
  public chromaticAberrationEffect: ChromaticAberrationEffect;
  public hueSatEffect: HueSaturationEffect;
  public brightContrastEffect: BrightnessContrastEffect;
  public dofEffect: DepthOfFieldEffect;

  public config: PostProcessingConfig = {
    bloomIntensity: 1.35,
    bloomThreshold: 0.82,
    bloomSmoothing: 0.22,
    vignetteDarkness: 0.52,
    vignetteOffset: 0.28,
    grainOpacity: 0.075,
    chromaticAberration: 0.0012,
    contrast: 0.06,
    saturation: -0.04,
    depthOfFieldEnabled: false,
    quality: 'high'
  };

  private isEnabled = false;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.UnsignedByteType
    });

    // 1. Scene Render Pass
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // 2. Effects Setup
    this.toneMappingEffect = new ToneMappingEffect({
      mode: ToneMappingMode.ACES_FILMIC
    });

    this.bloomEffect = new BloomEffect({
      luminanceThreshold: this.config.bloomThreshold,
      luminanceSmoothing: this.config.bloomSmoothing,
      intensity: this.config.bloomIntensity,
      mipmapBlur: true
    });

    this.smaaEffect = new SMAAEffect();

    this.vignetteEffect = new VignetteEffect({
      eskil: false,
      offset: this.config.vignetteOffset,
      darkness: this.config.vignetteDarkness
    });

    this.noiseEffect = new NoiseEffect({
      premultiply: true,
      blendFunction: BlendFunction.SOFT_LIGHT
    });
    this.noiseEffect.blendMode.opacity.value = this.config.grainOpacity;

    this.chromaticAberrationEffect = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(this.config.chromaticAberration, this.config.chromaticAberration),
      radialModulation: true,
      modulationOffset: 0.2
    });

    this.hueSatEffect = new HueSaturationEffect({
      saturation: this.config.saturation
    });

    this.brightContrastEffect = new BrightnessContrastEffect({
      contrast: this.config.contrast
    });

    this.dofEffect = new DepthOfFieldEffect(camera, {
      focusDistance: 0.03,
      focalLength: 0.05,
      bokehScale: 2.0
    });
    this.dofEffect.blendMode.opacity.value = 0.0; // Disabled by default

    // Main scene effects pass (Bloom + ToneMapping + Color Grading + Vignette + Grain)
    this.effectPass = new EffectPass(
      camera,
      this.bloomEffect,
      this.toneMappingEffect,
      this.brightContrastEffect,
      this.hueSatEffect,
      this.noiseEffect,
      this.vignetteEffect
    );
    this.composer.addPass(this.effectPass);

    // Chromatic Aberration in its own pass (cannot be merged with convolution BloomEffect)
    const chromaticPass = new EffectPass(camera, this.chromaticAberrationEffect);
    this.composer.addPass(chromaticPass);

    // SMAA Anti-aliasing pass
    const smaaPass = new EffectPass(camera, this.smaaEffect);
    this.composer.addPass(smaaPass);

    this.applyConfig();
  }

  public applyConfig(): void {
    this.bloomEffect.intensity = this.config.bloomIntensity;
    this.bloomEffect.luminanceMaterial.threshold = this.config.bloomThreshold;
    this.bloomEffect.luminanceMaterial.smoothing = this.config.bloomSmoothing;

    this.vignetteEffect.offset = this.config.vignetteOffset;
    this.vignetteEffect.darkness = this.config.vignetteDarkness;

    this.noiseEffect.blendMode.opacity.value = this.config.grainOpacity;

    this.chromaticAberrationEffect.offset.set(this.config.chromaticAberration, this.config.chromaticAberration);

    this.brightContrastEffect.contrast = this.config.contrast;
    this.hueSatEffect.setSaturation(this.config.saturation);

    this.dofEffect.blendMode.opacity.value = this.config.depthOfFieldEnabled ? 1.0 : 0.0;

    // Quality preset settings
    if (this.config.quality === 'low') {
      this.smaaEffect.blendMode.opacity.value = 0.0;
      this.chromaticAberrationEffect.blendMode.opacity.value = 0.0;
      this.noiseEffect.blendMode.opacity.value = 0.0;
      this.bloomEffect.intensity = 0.8;
      this.dofEffect.blendMode.opacity.value = 0.0;
    } else if (this.config.quality === 'medium') {
      this.smaaEffect.blendMode.opacity.value = 1.0;
      this.chromaticAberrationEffect.blendMode.opacity.value = 0.0;
      this.noiseEffect.blendMode.opacity.value = this.config.grainOpacity * 0.7;
      this.bloomEffect.intensity = this.config.bloomIntensity;
      this.dofEffect.blendMode.opacity.value = 0.0;
    } else {
      // High
      this.smaaEffect.blendMode.opacity.value = 1.0;
      this.chromaticAberrationEffect.blendMode.opacity.value = 1.0;
      this.noiseEffect.blendMode.opacity.value = this.config.grainOpacity;
      this.bloomEffect.intensity = this.config.bloomIntensity;
      this.dofEffect.blendMode.opacity.value = this.config.depthOfFieldEnabled ? 1.0 : 0.0;
    }
  }

  public setQuality(quality: QualityPreset): void {
    this.config.quality = quality;
    this.applyConfig();
  }

  public setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  public render(dt: number): void {
    if (this.isEnabled) {
      this.composer.render(dt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public dispose(): void {
    this.composer.dispose();
  }
}
