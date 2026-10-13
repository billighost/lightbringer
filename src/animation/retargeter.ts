import * as THREE from 'three';
import { CanonicalBoneMap, CanonicalBone, RootMotionType } from '../data/schemas';
import { CANONICAL_BONES } from './canonicalBones';

export interface RetargetOptions {
  sourceBoneMap: CanonicalBoneMap;
  targetBoneMap: CanonicalBoneMap;
  sourceHipsHeight?: number;
  targetHipsHeight?: number;
  rootMotion?: RootMotionType;
  restPoseOffsets?: Partial<Record<CanonicalBone, THREE.Quaternion>>;
}

export interface RetargetStats {
  cacheHits: number;
  cacheMisses: number;
  cachedClipCount: number;
}

export class AnimationRetargeter {
  private static instance: AnimationRetargeter;
  private clipCache: Map<string, THREE.AnimationClip> = new Map();
  private stats: RetargetStats = {
    cacheHits: 0,
    cacheMisses: 0,
    cachedClipCount: 0
  };

  public static getInstance(): AnimationRetargeter {
    if (!AnimationRetargeter.instance) {
      AnimationRetargeter.instance = new AnimationRetargeter();
    }
    return AnimationRetargeter.instance;
  }

  public getStats(): RetargetStats {
    return {
      ...this.stats,
      cachedClipCount: this.clipCache.size
    };
  }

  public clearCache(): void {
    this.clipCache.clear();
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      cachedClipCount: 0
    };
  }

  /**
   * Retargets an AnimationClip from source skeleton to target skeleton using canonical bone maps.
   */
  public retargetClip(
    sourceClip: THREE.AnimationClip,
    options: RetargetOptions,
    cacheKey?: string
  ): THREE.AnimationClip {
    if (cacheKey && this.clipCache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.clipCache.get(cacheKey)!;
    }

    this.stats.cacheMisses++;

    const {
      sourceBoneMap,
      targetBoneMap,
      sourceHipsHeight = 1.0,
      targetHipsHeight = 1.0,
      rootMotion = 'none',
      restPoseOffsets = {}
    } = options;

    // Build reverse map: source bone name -> CanonicalBone -> target bone name
    const srcNameToCanonical = new Map<string, CanonicalBone>();
    for (const canonical of CANONICAL_BONES) {
      const srcName = sourceBoneMap[canonical];
      if (srcName) {
        srcNameToCanonical.set(srcName.toLowerCase(), canonical);
      }
    }

    const heightRatio = sourceHipsHeight > 0.001 ? targetHipsHeight / sourceHipsHeight : 1.0;
    const newTracks: THREE.KeyframeTrack[] = [];

    for (const track of sourceClip.tracks) {
      // Track name is formatted as "boneName.property" (e.g. "mixamorig:Hips.quaternion")
      const dotIndex = track.name.lastIndexOf('.');
      if (dotIndex === -1) continue;

      const boneName = track.name.substring(0, dotIndex);
      const property = track.name.substring(dotIndex + 1);

      const canonical = srcNameToCanonical.get(boneName.toLowerCase());
      if (!canonical) {
        // Bone not in canonical map, skip
        continue;
      }

      const targetBoneName = targetBoneMap[canonical];
      if (!targetBoneName) {
        // Target doesn't have this canonical bone, skip
        continue;
      }

      const targetTrackName = `${targetBoneName}.${property}`;

      if (property === 'quaternion' && track instanceof THREE.QuaternionKeyframeTrack) {
        const offsetQ = restPoseOffsets[canonical];
        const times = track.times.slice();
        const values = new Float32Array(track.values.length);

        if (offsetQ) {
          const q = new THREE.Quaternion();
          for (let i = 0; i < track.values.length; i += 4) {
            q.set(track.values[i], track.values[i + 1], track.values[i + 2], track.values[i + 3]);
            // Apply rest pose offset
            q.multiply(offsetQ);
            values[i] = q.x;
            values[i + 1] = q.y;
            values[i + 2] = q.z;
            values[i + 3] = q.w;
          }
        } else {
          values.set(track.values);
        }

        newTracks.push(new THREE.QuaternionKeyframeTrack(targetTrackName, times as unknown as number[], values as unknown as number[]));
      } else if (property === 'position' && track instanceof THREE.VectorKeyframeTrack) {
        // Translation handling, mainly for Hips / Root
        const times = track.times.slice();
        const values = new Float32Array(track.values.length);

        if (canonical === 'hips') {
          const initialX = track.values[0] || 0;
          const initialZ = track.values[2] || 0;

          for (let i = 0; i < track.values.length; i += 3) {
            let x = track.values[i];
            let y = track.values[i + 1] * heightRatio;
            let z = track.values[i + 2];

            if (rootMotion === 'none') {
              // Strip horizontal displacement in-place
              x = initialX;
              z = initialZ;
            } else if (rootMotion === 'xz') {
              x *= heightRatio;
              z *= heightRatio;
            } else {
              x *= heightRatio;
              z *= heightRatio;
            }

            values[i] = x;
            values[i + 1] = y;
            values[i + 2] = z;
          }
        } else {
          // Standard scale position
          for (let i = 0; i < track.values.length; i += 3) {
            values[i] = track.values[i] * heightRatio;
            values[i + 1] = track.values[i + 1] * heightRatio;
            values[i + 2] = track.values[i + 2] * heightRatio;
          }
        }

        newTracks.push(new THREE.VectorKeyframeTrack(targetTrackName, times as unknown as number[], values as unknown as number[]));
      } else if (property === 'scale') {
        const times = track.times.slice();
        const values = new Float32Array(track.values);
        newTracks.push(new THREE.VectorKeyframeTrack(targetTrackName, times as unknown as number[], values as unknown as number[]));
      }
    }

    const retargetedClip = new THREE.AnimationClip(
      `${sourceClip.name}_retargeted`,
      sourceClip.duration,
      newTracks
    );

    if (cacheKey) {
      this.clipCache.set(cacheKey, retargetedClip);
      this.stats.cachedClipCount = this.clipCache.size;
    }

    return retargetedClip;
  }
}
