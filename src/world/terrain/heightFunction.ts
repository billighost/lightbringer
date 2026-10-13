import { RegionData, TerrainFeature, FlattenRectFeature, SplinePathFeature } from '../../data/regions/schema';

/**
 * Deterministic PRNG using Mulberry32
 */
function createMulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 2D Simplex Noise with deterministic permutation table
 */
export class SimplexNoise2D {
  private perm: Uint8Array = new Uint8Array(512);

  constructor(seed: number) {
    const rng = createMulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    // Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  public noise(xin: number, yin: number): number {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);

    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1 = 0;
    let j1 = 0;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let n0 = 0;
    let n1 = 0;
    let n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.grad(this.perm[ii + this.perm[jj]], x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.grad(this.perm[ii + i1 + this.perm[jj + j1]], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.grad(this.perm[ii + 1 + this.perm[jj + 1]], x2, y2);
    }

    // Result scaled to approximately [-1, 1]
    return 70.0 * (n0 + n1 + n2);
  }
}

/**
 * Smoothstep interpolation helper
 */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Point to line segment minimum distance squared
 */
function distSqToSegment(px: number, pz: number, x1: number, z1: number, x2: number, z2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (z2 - z1) * (z2 - z1);
  if (l2 === 0) return (px - x1) * (px - x1) + (pz - z1) * (pz - z1);
  let t = ((px - x1) * (x2 - x1) + (pz - z1) * (z2 - z1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projZ = z1 + t * (z2 - z1);
  return (px - projX) * (px - projX) + (pz - projZ) * (pz - projZ);
}

/**
 * Deterministic Height Function Generator
 */
export class HeightFunction {
  private baseNoise: SimplexNoise2D;
  private warpNoiseX: SimplexNoise2D;
  private warpNoiseZ: SimplexNoise2D;
  private detailNoise: SimplexNoise2D;
  private region: RegionData;

  constructor(region: RegionData) {
    this.region = region;
    const seed = region.seed;
    this.baseNoise = new SimplexNoise2D(seed);
    this.warpNoiseX = new SimplexNoise2D(seed + 101);
    this.warpNoiseZ = new SimplexNoise2D(seed + 202);
    this.detailNoise = new SimplexNoise2D(seed + 303);
  }

  /**
   * Multi-octave Fractal Brownian Motion (FBM)
   */
  public fbm(x: number, z: number, freq: number, octaves: number, persistence: number, lacunarity: number): number {
    let total = 0;
    let amplitude = 1.0;
    let frequency = freq;
    let maxAmp = 0;

    for (let o = 0; o < octaves; o++) {
      total += this.baseNoise.noise(x * frequency, z * frequency) * amplitude;
      maxAmp += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxAmp;
  }

  /**
   * Ridged multifractal noise (sharp crests)
   */
  public ridged(x: number, z: number, freq: number): number {
    const raw = this.detailNoise.noise(x * freq, z * freq);
    const n = 1.0 - Math.abs(raw);
    return n * n;
  }

  /**
   * Get deterministic raw terrain height before features
   */
  public getRawHeight(x: number, z: number): number {
    const p = this.region.terrain;

    // 1. Domain warping
    const wx = this.warpNoiseX.noise(x * p.warpScale, z * p.warpScale) * p.warpStrength;
    const wz = this.warpNoiseZ.noise((x + 31.7) * p.warpScale, (z - 47.2) * p.warpScale) * p.warpStrength;
    const warpedX = x + wx;
    const warpedZ = z + wz;

    // 2. Base FBM
    const base = this.fbm(warpedX, warpedZ, p.baseFrequency, p.octaves, p.persistence, p.lacunarity);

    // 3. Ridged noise layer
    const ridge = this.ridged(warpedX, warpedZ, p.baseFrequency * 2.5);

    // 4. Combined height
    let h = (base + ridge * p.ridgedWeight) * p.heightScale;

    // 5. Cheap hydraulic erosion approximation
    // Steep areas accumulate slight sediment loss and carve gullies
    const delta = 1.2;
    const hE = this.fbm(warpedX + delta, warpedZ, p.baseFrequency, 2, 0.5, 2.0) * p.heightScale;
    const hN = this.fbm(warpedX, warpedZ + delta, p.baseFrequency, 2, 0.5, 2.0) * p.heightScale;
    const slope = Math.sqrt((hE - h) * (hE - h) + (hN - h) * (hN - h)) / delta;
    const erosion = Math.min(1.0, slope * 0.4) * p.erosionStrength * 2.0;
    h -= erosion;

    return h;
  }

  /**
   * Apply region features and stamps
   */
  public applyFeatures(x: number, z: number, currentHeight: number): number {
    let h = currentHeight;
    const features = this.region.features;
    if (!features || features.length === 0) return h;

    for (let i = 0; i < features.length; i++) {
      const feat = features[i];
      const dx = x - feat.x;
      const dz = z - feat.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      switch (feat.type) {
        case 'radial_hill': {
          const totalRadius = feat.radius + feat.blendRadius;
          if (dist < totalRadius) {
            const factor = 1.0 - smoothstep(feat.radius, totalRadius, dist);
            h += feat.height * factor;
          }
          break;
        }

        case 'radial_basin': {
          const totalRadius = feat.radius + feat.blendRadius;
          if (dist < totalRadius) {
            const factor = 1.0 - smoothstep(feat.radius, totalRadius, dist);
            h -= feat.depth * factor;
          }
          break;
        }

        case 'flatten_circle': {
          const totalRadius = feat.radius + feat.blendRadius;
          if (dist < totalRadius) {
            const factor = (1.0 - smoothstep(feat.radius, totalRadius, dist)) * feat.strength;
            h = h * (1.0 - factor) + feat.targetHeight * factor;
          }
          break;
        }

        case 'flatten_rect': {
          const rf = feat as FlattenRectFeature;
          // Transform point into rect local space
          const cosR = Math.cos(-rf.rotation);
          const sinR = Math.sin(-rf.rotation);
          const lx = Math.abs(dx * cosR - dz * sinR);
          const lz = Math.abs(dx * sinR + dz * cosR);

          const halfW = rf.width * 0.5;
          const halfD = rf.depth * 0.5;
          const blend = rf.blendRadius;

          const factorX = 1.0 - smoothstep(halfW, halfW + blend, lx);
          const factorZ = 1.0 - smoothstep(halfD, halfD + blend, lz);
          const factor = factorX * factorZ * rf.strength;

          if (factor > 0) {
            h = h * (1.0 - factor) + rf.targetHeight * factor;
          }
          break;
        }

        case 'spline_path': {
          const pf = feat as SplinePathFeature;
          if (pf.points && pf.points.length >= 2) {
            let minDistSq = Infinity;
            for (let pIdx = 0; pIdx < pf.points.length - 1; pIdx++) {
              const p1 = pf.points[pIdx];
              const p2 = pf.points[pIdx + 1];
              const d2 = distSqToSegment(x, z, p1[0], p1[1], p2[0], p2[1]);
              if (d2 < minDistSq) {
                minDistSq = d2;
              }
            }
            const pathDist = Math.sqrt(minDistSq);
            const totalR = pf.width * 0.5 + pf.blendRadius;
            if (pathDist < totalR) {
              const factor = 1.0 - smoothstep(pf.width * 0.5, totalR, pathDist);
              h -= pf.targetDepth * factor;
            }
          }
          break;
        }
      }
    }

    return h;
  }

  /**
   * Synchronous height lookup at any world coordinate (x, z)
   */
  public getHeight(x: number, z: number): number {
    const raw = this.getRawHeight(x, z);
    return this.applyFeatures(x, z, raw);
  }

  /**
   * Synchronous surface normal at (x, z)
   */
  public getNormal(x: number, z: number, eps = 0.4): [number, number, number] {
    const hL = this.getHeight(x - eps, z);
    const hR = this.getHeight(x + eps, z);
    const hD = this.getHeight(x, z - eps);
    const hU = this.getHeight(x, z + eps);

    const dx = (hR - hL) / (2 * eps);
    const dz = (hU - hD) / (2 * eps);

    // Normal = normalize(-dx, 1.0, -dz)
    const len = Math.sqrt(dx * dx + 1.0 + dz * dz);
    return [-dx / len, 1.0 / len, -dz / len];
  }
}
