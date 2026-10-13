import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

import {
  AssetManifest,
  CharacterDefinition,
  validateManifest,
  validateCharacterDefinition
} from '../data/schemas';
import { createTestSkinnedMesh } from '../testing/testRigs';

export interface PostLoadOptions {
  targetHeight?: number;
  forwardFix?: number;
  scale?: number;
}

export interface LoadedCharacterAsset {
  model: THREE.Group;
  definition: CharacterDefinition;
  clips: THREE.AnimationClip[];
  skeleton?: THREE.Skeleton;
  isFallback: boolean;
  fallbackReason?: string;
}

export class AssetManager {
  private static instance: AssetManager;

  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader;
  private gltfCache: Map<string, any> = new Map();
  private manifestCache: AssetManifest | null = null;
  private charDefCache: Map<string, CharacterDefinition> = new Map();

  private hotReloadListeners: Set<() => void> = new Set();
  private maxAnisotropy = 8;

  public static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  constructor() {
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  }

  public setMaxAnisotropy(val: number): void {
    this.maxAnisotropy = Math.max(1, val);
  }

  public onHotReload(cb: () => void): () => void {
    this.hotReloadListeners.add(cb);
    return () => {
      this.hotReloadListeners.delete(cb);
    };
  }

  public async hotReloadAll(): Promise<void> {
    console.log('[AssetManager] Hot reloading assets...');
    this.gltfCache.clear();
    this.manifestCache = null;
    this.charDefCache.clear();
    await this.loadManifest();
    for (const cb of this.hotReloadListeners) {
      cb();
    }
    console.log('[AssetManager] Hot reload complete.');
  }

  public async loadManifest(manifestUrl = '/assets/manifest.json'): Promise<AssetManifest> {
    if (this.manifestCache) {
      return this.manifestCache;
    }

    try {
      const res = await fetch(manifestUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch manifest: ${res.statusText}`);
      }
      const data = await res.json();
      const validation = validateManifest(data);
      if (!validation.valid) {
        console.warn('[AssetManager] Manifest validation warnings/errors:', validation.issues);
      }
      this.manifestCache = data as AssetManifest;
      return this.manifestCache;
    } catch (err) {
      console.warn(`[AssetManager] Could not load manifest from ${manifestUrl}:`, err);
      // Fallback default manifest
      this.manifestCache = {
        version: '1.0.0',
        characters: {},
        props: {},
        animationLibraries: {}
      };
      return this.manifestCache;
    }
  }

  public async loadCharacterDefinition(url: string): Promise<CharacterDefinition | null> {
    if (this.charDefCache.has(url)) {
      return this.charDefCache.get(url)!;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch character definition: ${res.statusText}`);
      }
      const data = await res.json();
      const validation = validateCharacterDefinition(data);
      if (!validation.valid) {
        console.warn(`[AssetManager] Character definition "${url}" validation issues:`, validation.issues);
      }
      const def = data as CharacterDefinition;
      this.charDefCache.set(url, def);
      return def;
    } catch (err) {
      console.warn(`[AssetManager] Error loading character definition from ${url}:`, err);
      return null;
    }
  }

  /**
   * Loads a character by ID.
   * If GLB fails to load or does not exist, gracefully uses code-generated test rigs or labeled stand-ins.
   */
  public async loadCharacter(characterId: string): Promise<LoadedCharacterAsset> {
    const manifest = await this.loadManifest();
    const entry = manifest.characters[characterId];

    let def: CharacterDefinition | null = null;
    if (entry?.definitionPath) {
      def = await this.loadCharacterDefinition(entry.definitionPath);
    }

    // Check if GLB is present
    if (entry?.glbPath) {
      try {
        const gltf = await this.loadGLTF(entry.glbPath);
        if (gltf && gltf.scene) {
          // Deep-clone skinned mesh
          const clonedScene = SkeletonUtils.clone(gltf.scene) as THREE.Group;
          this.applyPostLoadFixups(clonedScene, {
            targetHeight: def?.targetHeight || 1.8,
            forwardFix: def?.forwardFix || entry.forwardFix || 0,
            scale: entry.scale || 1.0
          });

          // Find skeleton
          let skeleton: THREE.Skeleton | undefined;
          clonedScene.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh && child.skeleton) {
              skeleton = child.skeleton;
            }
          });

          return {
            model: clonedScene,
            definition: def || this.createDefaultDefinition(characterId),
            clips: gltf.animations || [],
            skeleton,
            isFallback: false
          };
        }
      } catch (err) {
        console.warn(`[AssetManager] GLB load failed for "${characterId}" (${entry.glbPath}):`, err);
      }
    }

    // GLB absent or failed: use code-generated test rigs for test characters
    if (characterId === 'player_test' || characterId === 'player_smpl' || !entry) {
      const rigType = characterId === 'player_smpl' ? 'smpl' : 'mixamo';
      console.log(`[AssetManager] Using code-generated ${rigType.toUpperCase()} test rig for character "${characterId}".`);

      const gen = createTestSkinnedMesh(rigType);
      const targetHeight = def?.targetHeight || (rigType === 'smpl' ? 2.0 : 1.8);
      this.applyPostLoadFixups(gen.model, { targetHeight });

      return {
        model: gen.model,
        definition: def || {
          id: characterId,
          name: gen.model.name,
          modelAssetId: characterId,
          targetHeight,
          forwardFix: 0,
          skeletonType: rigType,
          boneMap: gen.boneMap,
          sockets: gen.sockets,
          animationMap: {}
        },
        clips: gen.clips,
        skeleton: gen.skeleton,
        isFallback: false
      };
    }

    // Missing asset fallback: Labeled capsule stand-in
    console.warn(`[AssetManager] Asset missing for character "${characterId}". Using labeled stand-in.`);
    const standIn = this.createStandInModel(characterId);
    return {
      model: standIn,
      definition: this.createDefaultDefinition(characterId),
      clips: [],
      isFallback: true,
      fallbackReason: `Asset not found for "${characterId}"`
    };
  }

  public async loadGLTF(path: string): Promise<any> {
    if (this.gltfCache.has(path)) {
      return this.gltfCache.get(path);
    }

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          this.gltfCache.set(path, gltf);
          resolve(gltf);
        },
        undefined,
        (err) => {
          reject(err);
        }
      );
    });
  }

  /**
   * Applies post-load fixups:
   * - sRGB color space & anisotropic filtering
   * - cast/receive shadows
   * - skinned mesh frustum culling bounds fix
   * - keep emissive maps intact
   * - scale normalization to target height
   * - pivot at feet (y=0)
   * - forward-axis correction (+Z)
   */
  public applyPostLoadFixups(model: THREE.Object3D, options: PostLoadOptions): void {
    // 1. Traverse materials & meshes
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child instanceof THREE.SkinnedMesh) {
          // Prevent skinned mesh popping out of view during animations
          child.frustumCulled = false;
        }

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of materials) {
          if (!mat) continue;

          // sRGB on color textures
          if ('map' in mat && mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.anisotropy = this.maxAnisotropy;
          }
          // Preserve emissive maps
          if ('emissiveMap' in mat && mat.emissiveMap) {
            mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
            mat.emissiveMap.anisotropy = this.maxAnisotropy;
          }
        }
      }
    });

    // 2. Measure bounds for scale normalization and pivot placement
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const currentHeight = box.max.y - box.min.y;

    if (options.targetHeight && currentHeight > 0.05) {
      const scaleFactor = (options.targetHeight / currentHeight) * (options.scale || 1.0);
      model.scale.set(scaleFactor, scaleFactor, scaleFactor);
    } else if (options.scale) {
      model.scale.set(options.scale, options.scale, options.scale);
    }

    // 3. Put pivot at feet (bottom of bounding box at y = 0)
    model.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(model);
    model.position.y -= scaledBox.min.y;

    // 4. Forward-axis correction
    if (options.forwardFix) {
      model.rotation.y += options.forwardFix;
    }
  }

  public createStandInModel(label: string): THREE.Group {
    const group = new THREE.Group();
    group.name = `StandIn_${label}`;

    const geo = new THREE.CapsuleGeometry(0.35, 1.1, 8, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x883333,
      roughness: 0.5,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.9;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Floating text label sprite
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(20, 20, 25, 0.85)';
      ctx.fillRect(0, 0, 256, 64);
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#ffcc00';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`MISSING: ${label}`, 128, 32);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(0, 2.0, 0);
      sprite.scale.set(1.6, 0.4, 1.0);
      group.add(sprite);
    }

    return group;
  }

  private createDefaultDefinition(id: string): CharacterDefinition {
    return {
      id,
      name: id,
      modelAssetId: id,
      targetHeight: 1.8,
      forwardFix: 0,
      skeletonType: 'mixamo',
      boneMap: {},
      sockets: {},
      animationMap: {}
    };
  }

  public getLoadedAssetMemoryEstimate(): { count: number; textures: number; geometries: number } {
    let geometries = 0;
    let textures = 0;
    for (const gltf of this.gltfCache.values()) {
      if (gltf.scene) {
        gltf.scene.traverse((node: any) => {
          if (node.isMesh && node.geometry) geometries++;
          if (node.isMesh && node.material) {
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            for (const m of mats) {
              if (m.map) textures++;
              if (m.normalMap) textures++;
              if (m.roughnessMap) textures++;
              if (m.metalnessMap) textures++;
              if (m.emissiveMap) textures++;
            }
          }
        });
      }
    }
    return {
      count: this.gltfCache.size,
      textures,
      geometries
    };
  }
}
