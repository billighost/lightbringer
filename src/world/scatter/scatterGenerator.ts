import { RegionData } from '../../data/regions/schema';
import { HeightFunction, SimplexNoise2D } from '../terrain/heightFunction';
import { ExclusionManager } from './exclusion';
import { FLORA_ARCHETYPES } from '../../data/flora/archetypes';
import { PoissonDiscSampler2D } from './poisson';
import { ChunkScatterResult, ScatterInstance } from './scatterTypes';
import { createMulberry32 } from '../flora/generators/geometryUtils';

export class ScatterGenerator {
  private region: RegionData;
  private heightFunction: HeightFunction;
  private exclusionManager: ExclusionManager;
  private biomeNoise: SimplexNoise2D;

  constructor(region: RegionData, heightFunction: HeightFunction, exclusionManager: ExclusionManager) {
    this.region = region;
    this.heightFunction = heightFunction;
    this.exclusionManager = exclusionManager;
    this.biomeNoise = new SimplexNoise2D(region.seed + 999);
  }

  /**
   * Deterministically generates scatter instances for a specific chunk (chunkX, chunkZ)
   */
  public generateChunk(chunkX: number, chunkZ: number): ChunkScatterResult {
    const startTime = performance.now();
    const chunkSize = this.region.terrain.chunkSize;
    const minX = chunkX * chunkSize;
    const minZ = chunkZ * chunkSize;

    // Deterministic seed per chunk
    const chunkSeed = (this.region.seed ^ (chunkX * 73856093) ^ (chunkZ * 19349663)) | 0;
    const rng = createMulberry32(chunkSeed);

    const instances: ScatterInstance[] = [];
    const archetypeCounts: Record<string, number> = {};

    // Sort rules by priority (1 = Titan landmarks first, 5 = small underfoot cover)
    const sortedRules = [...(this.region.scatterRules || [])].sort((a, b) => a.priority - b.priority);

    // Master Poisson sampler across chunk to prevent big colliding flora
    const masterSampler = new PoissonDiscSampler2D(minX, minZ, chunkSize, chunkSize, 1.8);

    for (const rule of sortedRules) {
      if (!rule.archetypeWeights || rule.archetypeWeights.length === 0) continue;

      // Filter function to evaluate biological constraints
      const filterFn = (x: number, z: number): boolean => {
        // 1. Exclusion zones (paths, flattened clearings, etc.)
        if (this.exclusionManager.isExcluded(x, z)) return false;

        // 2. Height check
        const h = this.heightFunction.getHeight(x, z);
        if (h < rule.heightRange[0] || h > rule.heightRange[1]) return false;

        // 3. Slope check
        const normal = this.heightFunction.getNormal(x, z);
        // Slope = sqrt(nx^2 + nz^2) / ny
        const slope = Math.sqrt(normal[0] * normal[0] + normal[2] * normal[2]) / Math.max(0.001, normal[1]);
        if (slope < rule.slopeRange[0] || slope > rule.slopeRange[1]) return false;

        // 4. Distance to water check
        const waterLevel = this.region.water.level;
        const distToWaterPlane = Math.abs(h - waterLevel);
        if (rule.waterDistanceRange) {
          if (distToWaterPlane < rule.waterDistanceRange[0] || distToWaterPlane > rule.waterDistanceRange[1]) {
            return false;
          }
        }

        // 5. Ecological pattern mask check
        if (rule.ecologicalPattern && rule.ecologicalPattern !== 'all') {
          // If close to water, prioritize marsh_edge
          if (distToWaterPlane < 1.2 && rule.ecologicalPattern === 'marsh_edge') {
            return true;
          }
          if (distToWaterPlane < 1.2 && rule.ecologicalPattern !== 'marsh_edge') {
            return false;
          }

          // Sample 2D biome noise to partition into ecological provinces
          const bVal = this.biomeNoise.noise(x * 0.004, z * 0.004); // [-1, 1]
          if (rule.ecologicalPattern === 'fungal_grove' && bVal < 0.05) return false;
          if (rule.ecologicalPattern === 'dead_timber' && (bVal < -0.45 || bVal > 0.35)) return false;
          if (rule.ecologicalPattern === 'barren_rock' && bVal > -0.1) return false;
        }

        // 6. Noise mask check (clustering / clearings)
        if (rule.noiseMask) {
          const nmVal = this.biomeNoise.noise(x * rule.noiseMask.scale, z * rule.noiseMask.scale) * 0.5 + 0.5;
          if (rule.noiseMask.invert) {
            if (nmVal > rule.noiseMask.threshold) return false;
          } else {
            if (nmVal < rule.noiseMask.threshold) return false;
          }
        }

        return true;
      };

      // Rule-specific Poisson sampler
      const ruleSampler = new PoissonDiscSampler2D(minX, minZ, chunkSize, chunkSize, rule.minDistance);
      const points = ruleSampler.generateSamples(rule.density, rng, 16, filterFn);

      for (const pt of points) {
        const px = pt[0];
        const pz = pt[1];

        // Ensure point doesn't overlap master occupied cells
        if (!masterSampler.isPointValid(px, pz)) {
          continue;
        }
        masterSampler.registerExistingPoint(px, pz);

        const py = this.heightFunction.getHeight(px, pz);
        const normal = this.heightFunction.getNormal(px, pz);

        // Weighted selection of archetype
        const archetypeId = this.selectWeightedArchetype(rule.archetypeWeights, rng);
        const def = FLORA_ARCHETYPES[archetypeId];
        if (!def) continue;

        // Instance properties
        const scaleVal = rule.scaleRange[0] + rng() * (rule.scaleRange[1] - rule.scaleRange[0]);
        const rotY = rng() * Math.PI * 2;
        const maxTilt = rule.tiltRange[1];
        // Align tilt slightly with terrain normal
        const rotX = (rng() - 0.5) * maxTilt - normal[2] * 0.3;
        const rotZ = (rng() - 0.5) * maxTilt + normal[0] * 0.3;

        const variantIndex = Math.floor(rng() * 8);
        const instanceId = `${chunkX}_${chunkZ}_${archetypeId}_${instances.length}`;

        const instance: ScatterInstance = {
          id: instanceId,
          archetypeId,
          variantIndex,
          position: [px, py, pz],
          rotation: [rotX, rotY, rotZ],
          scale: [scaleVal, scaleVal, scaleVal],
          isSolid: def.colliderType !== 'none',
          colliderType: def.colliderType,
          colliderDimensions: def.colliderDimensions,
          glow: def.glowSettings.enabled
            ? {
                color: def.glowSettings.color,
                intensity: def.glowSettings.intensity,
                radius: def.glowSettings.radius * scaleVal
              }
            : undefined,
          gatherableConfig: def.gatherableConfig
        };

        instances.push(instance);
        archetypeCounts[archetypeId] = (archetypeCounts[archetypeId] || 0) + 1;
      }
    }

    const generationTimeMs = performance.now() - startTime;

    return {
      chunkKey: `${chunkX},${chunkZ}`,
      chunkX,
      chunkZ,
      instances,
      archetypeCounts,
      generationTimeMs
    };
  }

  private selectWeightedArchetype(weights: { archetypeId: string; weight: number }[], rng: () => number): string {
    let totalWeight = 0;
    for (const w of weights) totalWeight += w.weight;
    let roll = rng() * totalWeight;
    for (const w of weights) {
      if (roll <= w.weight) return w.archetypeId;
      roll -= w.weight;
    }
    return weights[0].archetypeId;
  }
}
