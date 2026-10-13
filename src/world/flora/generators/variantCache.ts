import * as THREE from 'three';
import { FLORA_ARCHETYPES } from '../../../data/flora/archetypes';
import { AssetManager } from '../../../assets/assetManager';
import {
  generateUmbrellaTitan,
  generateShelfFungus,
  generateLumenCapCluster,
  generateSporeStalk,
  generateMyceliumVeins
} from './fungiGenerators';
import {
  generateTwistedSnag,
  generateBrokenStump,
  generateFallenLog,
  generateRootMass
} from './treeGenerators';
import {
  generateBoulder,
  generateSlab,
  generateSpire,
  generateScreeCluster
} from './rockGenerators';
import {
  generateDeadGrass,
  generateGlowFern,
  generateThornBramble,
  generateBoneReeds
} from './groundCoverGenerators';
import {
  generateLumenShard,
  generateGlowSporePlant
} from './gatherableGenerators';

export type GeneratorFn = (seed: number, params: Record<string, number>, lod: number) => THREE.BufferGeometry;

export class VariantCache {
  private static instance: VariantCache | null = null;

  public static readonly VARIANTS_PER_ARCHETYPE = 8;
  public static readonly LOD_LEVELS = [0, 1, 2];

  private generators = new Map<string, GeneratorFn>();
  // key: `${archetypeId}_lod${lod}_v${variantIndex}`
  private geometryCache = new Map<string, THREE.BufferGeometry>();
  private triangleCounts = new Map<string, number>();

  private manifestOverrides = new Map<string, THREE.BufferGeometry>();
  private initialized = false;

  public static getInstance(): VariantCache {
    if (!this.instance) {
      this.instance = new VariantCache();
    }
    return this.instance;
  }

  constructor() {
    this.registerGenerators();
  }

  private registerGenerators(): void {
    this.generators.set('umbrella_titan', generateUmbrellaTitan);
    this.generators.set('shelf_fungus', generateShelfFungus);
    this.generators.set('lumen_cap_cluster', generateLumenCapCluster);
    this.generators.set('spore_stalk', generateSporeStalk);
    this.generators.set('mycelium_veins', generateMyceliumVeins);

    this.generators.set('twisted_snag', generateTwistedSnag);
    this.generators.set('broken_stump', generateBrokenStump);
    this.generators.set('fallen_log', generateFallenLog);
    this.generators.set('root_mass', generateRootMass);

    this.generators.set('boulder', generateBoulder);
    this.generators.set('slab', generateSlab);
    this.generators.set('spire', generateSpire);
    this.generators.set('scree_cluster', generateScreeCluster);

    this.generators.set('dead_grass', generateDeadGrass);
    this.generators.set('glow_fern', generateGlowFern);
    this.generators.set('thorn_bramble', generateThornBramble);
    this.generators.set('bone_reeds', generateBoneReeds);

    this.generators.set('lumen_shard', generateLumenShard);
    this.generators.set('glow_spore_plant', generateGlowSporePlant);
  }

  /**
   * Pre-generates all archetype variants deterministically
   */
  public async init(worldSeed = 421337): Promise<void> {
    if (this.initialized) return;

    // 1. Check asset manifest for GLB overrides
    await this.checkManifestOverrides();

    // 2. Generate procedural geometries for each archetype & LOD
    for (const [id, def] of Object.entries(FLORA_ARCHETYPES)) {
      const generator = this.generators.get(def.generatorId);
      if (!generator) {
        console.warn(`[VariantCache] Generator missing for archetype: ${id}`);
        continue;
      }

      for (const lod of VariantCache.LOD_LEVELS) {
        for (let v = 0; v < VariantCache.VARIANTS_PER_ARCHETYPE; v++) {
          const key = this.getKey(id, lod, v);

          // Check if GLB override exists
          if (this.manifestOverrides.has(id)) {
            const overrideGeo = this.manifestOverrides.get(id)!.clone();
            this.geometryCache.set(key, overrideGeo);
            this.triangleCounts.set(key, this.countTriangles(overrideGeo));
            continue;
          }

          // Deterministic seed per archetype, LOD, and variant
          const variantSeed = (worldSeed + id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 101 + v * 37 + lod * 7919) | 0;

          // Sample parameter values within ranges
          const params: Record<string, number> = {};
          for (const [paramName, range] of Object.entries(def.paramRanges)) {
            const frac = ((variantSeed ^ (paramName.charCodeAt(0) * 31)) & 0xffff) / 0xffff;
            params[paramName] = range[0] + frac * (range[1] - range[0]);
          }

          const geo = generator(variantSeed, params, lod);
          geo.name = `${id}_lod${lod}_v${v}`;
          this.geometryCache.set(key, geo);
          this.triangleCounts.set(key, this.countTriangles(geo));
        }
      }
    }

    this.initialized = true;
    console.info(`[VariantCache] Generated ${this.geometryCache.size} flora variants across ${Object.keys(FLORA_ARCHETYPES).length} archetypes.`);
  }

  private async checkManifestOverrides(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const assetManager = AssetManager.getInstance();
      const manifest = await assetManager.loadManifest();
      if (!manifest.props) return;

      for (const [propId, propEntry] of Object.entries(manifest.props)) {
        if (FLORA_ARCHETYPES[propId] && propEntry.glbPath) {
          try {
            console.info(`[VariantCache] Overriding procedural archetype "${propId}" with manifest GLB: ${propEntry.glbPath}`);
            const gltf = await assetManager.loadGLTF(propEntry.glbPath);
            if (gltf && gltf.scene) {
              let extractedGeo: THREE.BufferGeometry | null = null;
              gltf.scene.traverse((node: any) => {
                if (!extractedGeo && node.isMesh && node.geometry) {
                  extractedGeo = node.geometry.clone();
                }
              });
              if (extractedGeo) {
                this.manifestOverrides.set(propId, extractedGeo);
              }
            }
          } catch (err) {
            console.warn(`[VariantCache] Could not load GLB override for "${propId}":`, err);
          }
        }
      }
    } catch {
      // Manifest not present or fetch error, proceed with procedural
    }
  }

  private getKey(archetypeId: string, lod: number, variantIndex: number): string {
    return `${archetypeId}_lod${lod}_v${variantIndex % VariantCache.VARIANTS_PER_ARCHETYPE}`;
  }

  public getVariantGeometry(archetypeId: string, variantIndex: number, lod = 0): THREE.BufferGeometry {
    const key = this.getKey(archetypeId, lod, variantIndex);
    let geo = this.geometryCache.get(key);

    if (!geo) {
      // If not yet initialized or missing, generate synchronously on demand
      const def = FLORA_ARCHETYPES[archetypeId];
      const gen = def ? this.generators.get(def.generatorId) : null;
      if (gen) {
        const seed = 421337 + variantIndex * 37 + lod * 101;
        geo = gen(seed, {}, lod);
        this.geometryCache.set(key, geo);
        this.triangleCounts.set(key, this.countTriangles(geo));
      } else {
        // Fallback placeholder box
        geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      }
    }

    return geo;
  }

  public getTriangleCount(archetypeId: string, variantIndex: number, lod = 0): number {
    const key = this.getKey(archetypeId, lod, variantIndex);
    return this.triangleCounts.get(key) || 0;
  }

  public getAverageTriangleCount(archetypeId: string, lod = 0): number {
    let sum = 0;
    for (let v = 0; v < VariantCache.VARIANTS_PER_ARCHETYPE; v++) {
      sum += this.getTriangleCount(archetypeId, v, lod);
    }
    return Math.round(sum / VariantCache.VARIANTS_PER_ARCHETYPE);
  }

  private countTriangles(geo: THREE.BufferGeometry): number {
    const idx = geo.getIndex();
    if (idx) {
      return idx.count / 3;
    }
    const pos = geo.getAttribute('position');
    return pos ? pos.count / 3 : 0;
  }

  public getAllArchetypeIds(): string[] {
    return Object.keys(FLORA_ARCHETYPES);
  }

  public isOverridden(archetypeId: string): boolean {
    return this.manifestOverrides.has(archetypeId);
  }
}
