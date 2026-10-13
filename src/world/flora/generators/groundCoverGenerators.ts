import * as THREE from 'three';
import {
  createMulberry32,
  createEmptyGeometryData,
  addVertex,
  addQuad,
  buildBufferGeometry
} from './geometryUtils';

/**
 * Generates Dead Grass (wind-swaying blades in clumps)
 */
export function generateDeadGrass(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const bladeCount = Math.max(3, Math.floor((params.bladeCount ?? 16) * (lod === 0 ? 1.0 : lod === 1 ? 0.55 : 0.25)));
  const clumpRad = params.clumpRadius ?? (0.45 + rng() * 0.25);
  const baseHeight = params.height ?? (0.85 + rng() * 0.4);

  const data = createEmptyGeometryData();

  for (let b = 0; b < bladeCount; b++) {
    const angle = (b / bladeCount) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const dist = rng() * clumpRad;
    const originX = Math.cos(angle) * dist;
    const originZ = Math.sin(angle) * dist;

    const bladeH = baseHeight * (0.7 + rng() * 0.5);
    const bladeCurveAngle = angle + (rng() - 0.5) * 0.5;
    const curveAmount = 0.25 + rng() * 0.35;

    const bladeWidth = 0.055 * (0.8 + rng() * 0.4);
    const segs = lod === 0 ? 4 : lod === 1 ? 3 : 2;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const y = t * bladeH;
      const x = originX + Math.cos(bladeCurveAngle) * (t * t * curveAmount);
      const z = originZ + Math.sin(bladeCurveAngle) * (t * t * curveAmount);

      const w = bladeWidth * (1.0 - t * 0.9);
      const perpX = -Math.sin(bladeCurveAngle) * w;
      const perpZ = Math.cos(bladeCurveAngle) * w;

      // High wind sway towards the tips
      const windWeight = Math.pow(t, 1.4);
      const ao = Math.min(1.0, 0.4 + t * 0.9);

      addVertex(data, x - perpX, y, z - perpZ, 0, 1, 0, 0, t, windWeight, 0.0, ao);
      addVertex(data, x + perpX, y, z + perpZ, 0, 1, 0, 1, t, windWeight, 0.0, ao);

      if (s > 0) {
        const vA = (data.positions.length / 3) - 4;
        const vB = vA + 1;
        const vC = vA + 2;
        const vD = vA + 3;
        addQuad(data, vA, vC, vD, vB);
      }
    }
  }

  return buildBufferGeometry(data);
}

/**
 * Generates Glow Fern (fronds with emissive glowing tips)
 */
export function generateGlowFern(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const frondCount = Math.max(2, Math.floor((params.frondCount ?? 5) * (lod === 0 ? 1.0 : lod === 1 ? 0.6 : 0.4)));
  const frondLength = params.frondLength ?? (1.1 + rng() * 0.45);

  const data = createEmptyGeometryData();

  for (let f = 0; f < frondCount; f++) {
    const angle = (f / frondCount) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const segs = lod === 0 ? 6 : lod === 1 ? 4 : 2;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      // Arching fern frond
      const dist = t * frondLength;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = Math.sin(t * Math.PI * 0.7) * (frondLength * 0.45) * (1.0 - t * 0.3);

      const w = 0.14 * Math.sin(t * Math.PI * 0.85);
      const perpX = -Math.sin(angle) * w;
      const perpZ = Math.cos(angle) * w;

      const windWeight = t * 0.85;
      // Emissive glow mask at frond tips (t > 0.65)
      const glowMask = t > 0.65 ? (t - 0.65) / 0.35 : 0.0;
      const ao = Math.min(1.0, 0.45 + t * 0.8);

      addVertex(data, x - perpX, y, z - perpZ, 0, 1, 0, 0, t, windWeight, glowMask, ao);
      addVertex(data, x + perpX, y, z + perpZ, 0, 1, 0, 1, t, windWeight, glowMask, ao);

      if (s > 0) {
        const vA = (data.positions.length / 3) - 4;
        const vB = vA + 1;
        const vC = vA + 2;
        const vD = vA + 3;
        addQuad(data, vA, vC, vD, vB);
      }
    }
  }

  return buildBufferGeometry(data);
}

/**
 * Generates Thorn Bramble (tangled interlocking thorny arches)
 */
export function generateThornBramble(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const branchCount = Math.max(2, Math.floor((params.branchCount ?? 6) * (lod === 0 ? 1.0 : lod === 1 ? 0.6 : 0.35)));
  const radius = params.radius ?? (1.2 + rng() * 0.6);
  const height = params.height ?? (0.6 + rng() * 0.35);

  const data = createEmptyGeometryData();

  for (let b = 0; b < branchCount; b++) {
    const startA = (b / branchCount) * Math.PI * 2;
    const endA = startA + Math.PI * 0.8 + (rng() - 0.5) * 0.6;

    const startX = Math.cos(startA) * radius * (0.6 + rng() * 0.4);
    const startZ = Math.sin(startA) * radius * (0.6 + rng() * 0.4);
    const endX = Math.cos(endA) * radius * (0.6 + rng() * 0.4);
    const endZ = Math.sin(endA) * radius * (0.6 + rng() * 0.4);

    const segs = lod === 0 ? 6 : lod === 1 ? 4 : 2;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const x = THREE.MathUtils.lerp(startX, endX, t);
      const z = THREE.MathUtils.lerp(startZ, endZ, t);
      const y = Math.sin(t * Math.PI) * (height * (0.8 + rng() * 0.4));

      const w = 0.045 * (1.0 - t * 0.3);
      const windWeight = Math.sin(t * Math.PI) * 0.35;
      const ao = Math.min(1.0, 0.4 + y * 1.2);

      addVertex(data, x - w, y, z - w, 0, 1, 0, 0, t, windWeight, 0.0, ao);
      addVertex(data, x + w, y, z + w, 0, 1, 0, 1, t, windWeight, 0.0, ao);

      if (s > 0) {
        const vA = (data.positions.length / 3) - 4;
        const vB = vA + 1;
        const vC = vA + 2;
        const vD = vA + 3;
        addQuad(data, vA, vC, vD, vB);
      }
    }
  }

  return buildBufferGeometry(data);
}

/**
 * Generates Bone Reeds (tall straight pale segmented stalks near water)
 */
export function generateBoneReeds(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const reedCount = Math.max(3, Math.floor((params.reedCount ?? 14) * (lod === 0 ? 1.0 : lod === 1 ? 0.55 : 0.25)));
  const baseH = params.height ?? (2.8 + rng() * 1.0);

  const data = createEmptyGeometryData();

  for (let r = 0; r < reedCount; r++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * 0.65;
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;

    const h = baseH * (0.75 + rng() * 0.45);
    const segs = lod === 0 ? 6 : lod === 1 ? 4 : 2;
    const reedWidth = 0.035;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const y = t * h;
      const x = px + Math.sin(t * 1.5) * 0.08;
      const z = pz + Math.cos(t * 1.5) * 0.08;

      const w = reedWidth * (1.0 - t * 0.5);
      const windWeight = Math.pow(t, 1.8) * 1.4;
      // Pale glowing tip
      const glowMask = t > 0.85 ? 0.95 : 0.0;
      const ao = Math.min(1.0, 0.4 + t * 0.9);

      addVertex(data, x - w, y, z, 0, 0, 1, 0, t, windWeight, glowMask, ao);
      addVertex(data, x + w, y, z, 0, 0, 1, 1, t, windWeight, glowMask, ao);

      if (s > 0) {
        const vA = (data.positions.length / 3) - 4;
        const vB = vA + 1;
        const vC = vA + 2;
        const vD = vA + 3;
        addQuad(data, vA, vC, vD, vB);
      }
    }
  }

  return buildBufferGeometry(data);
}
