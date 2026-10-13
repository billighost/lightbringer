import * as THREE from 'three';
import {
  createMulberry32,
  createEmptyGeometryData,
  addVertex,
  addQuad,
  addTriangle,
  mergeGeometryData,
  buildBufferGeometry,
  createTubeAlongPath
} from './geometryUtils';

/**
 * Generates the Umbrella Titan giant mushroom (8-25m tall)
 */
export function generateUmbrellaTitan(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);

  const height = params.height ?? (12.0 + rng() * 10.0);
  const capRadius = params.capRadius ?? (5.0 + rng() * 4.5);
  const stalkBaseRadius = params.stalkRadius ?? (0.9 + rng() * 0.7);
  const ruffleRatio = params.ruffleHeightRatio ?? (0.68 + (rng() - 0.5) * 0.08);

  // Radial segments according to LOD
  let stalkRadial = 16;
  let capRadial = 28;
  let capRings = 12;
  let gillCount = 28;
  if (lod === 1) {
    stalkRadial = 10;
    capRadial = 16;
    capRings = 7;
    gillCount = 16;
  } else if (lod >= 2) {
    stalkRadial = 6;
    capRadial = 10;
    capRings = 4;
    gillCount = 8;
  }

  const combined = createEmptyGeometryData();

  // 1. Tapered Stalk with slight organic lean
  const stalkPoints: THREE.Vector3[] = [];
  const stalkRadii: number[] = [];
  const stalkSteps = lod === 0 ? 12 : lod === 1 ? 7 : 4;
  const leanX = (rng() - 0.5) * 1.8;
  const leanZ = (rng() - 0.5) * 1.8;

  for (let i = 0; i <= stalkSteps; i++) {
    const t = i / stalkSteps;
    const y = t * (height - 1.2);
    const x = Math.sin(t * Math.PI * 0.5) * leanX;
    const z = Math.sin(t * Math.PI * 0.5) * leanZ;
    stalkPoints.push(new THREE.Vector3(x, y, z));

    // Stalk base flared, top tapered
    let r = stalkBaseRadius * (1.35 - t * 0.55);
    if (t < 0.15) {
      r += (0.15 - t) * stalkBaseRadius * 1.8; // Root flare
    }
    stalkRadii.push(r);
  }

  const stalkGeoData = createTubeAlongPath(stalkPoints, stalkRadii, stalkRadial, 0.0, 0.25, 0.0);
  mergeGeometryData(combined, stalkGeoData);

  // 2. Collar Ruffle around 70% height
  if (lod <= 1) {
    const ruffleIdx = Math.floor(stalkSteps * ruffleRatio);
    const ruffleCenter = stalkPoints[ruffleIdx];
    const ruffleRadius = stalkRadii[ruffleIdx] * 1.7;
    const ruffleData = createEmptyGeometryData();

    for (let j = 0; j <= stalkRadial; j++) {
      const angle = (j / stalkRadial) * Math.PI * 2;
      const wave = Math.sin(angle * 6) * 0.15;
      const rx = ruffleCenter.x + Math.cos(angle) * (ruffleRadius + wave);
      const rz = ruffleCenter.z + Math.sin(angle) * (ruffleRadius + wave);
      const ry = ruffleCenter.y - 0.35 + wave * 0.5;

      // Inner ring on stalk
      const inX = ruffleCenter.x + Math.cos(angle) * stalkRadii[ruffleIdx];
      const inZ = ruffleCenter.z + Math.sin(angle) * stalkRadii[ruffleIdx];

      addVertex(ruffleData, inX, ruffleCenter.y, inZ, 0, 1, 0, j / stalkRadial, 0, 0.15, 0.3, 0.7);
      addVertex(ruffleData, rx, ry, rz, 0, -1, 0, j / stalkRadial, 1, 0.18, 0.5, 0.9);
    }
    for (let j = 0; j < stalkRadial; j++) {
      const a = j * 2;
      const b = a + 1;
      const c = (j + 1) * 2 + 1;
      const d = (j + 1) * 2;
      addQuad(ruffleData, a, b, c, d);
    }
    mergeGeometryData(combined, ruffleData);
  }

  // 3. Huge Domed Cap (top hemisphere + underside gills)
  const capApex = stalkPoints[stalkPoints.length - 1].clone().add(new THREE.Vector3(0, 2.5, 0));
  const capData = createEmptyGeometryData();

  // Cap Dome surface
  for (let ring = 0; ring <= capRings; ring++) {
    const phi = (ring / capRings) * (Math.PI * 0.52); // Cap dome curve
    const yOffset = Math.cos(phi) * 2.8;
    const r = Math.sin(phi) * capRadius;
    const tRing = ring / capRings;

    for (let seg = 0; seg <= capRadial; seg++) {
      const theta = (seg / capRadial) * Math.PI * 2;
      const x = capApex.x + Math.cos(theta) * r;
      const y = capApex.y + yOffset - 1.2;
      const z = capApex.z + Math.sin(theta) * r;

      const norm = new THREE.Vector3(Math.cos(theta) * Math.sin(phi), Math.cos(phi), Math.sin(theta) * Math.sin(phi)).normalize();
      // Cap edges carry cyan/magenta glow rim
      const glowMask = tRing > 0.85 ? 0.85 : 0.05;
      const windWeight = 0.35;
      const ao = 0.95;

      addVertex(capData, x, y, z, norm.x, norm.y, norm.z, seg / capRadial, tRing, windWeight, glowMask, ao);
    }
  }

  const capRowLen = capRadial + 1;
  for (let ring = 0; ring < capRings; ring++) {
    for (let seg = 0; seg < capRadial; seg++) {
      const a = ring * capRowLen + seg;
      const b = (ring + 1) * capRowLen + seg;
      const c = (ring + 1) * capRowLen + (seg + 1);
      const d = ring * capRowLen + (seg + 1);
      addQuad(capData, a, b, c, d);
    }
  }

  // 4. Underside Gills (carries high emissive glowMask = 1.0)
  const capRimCenter = capApex.clone().add(new THREE.Vector3(0, -1.2, 0));
  const stalkTop = stalkPoints[stalkPoints.length - 1];

  for (let g = 0; g < gillCount; g++) {
    const angle = (g / gillCount) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const outerX = capRimCenter.x + cosA * (capRadius * 0.96);
    const outerY = capRimCenter.y;
    const outerZ = capRimCenter.z + sinA * (capRadius * 0.96);

    const innerX = stalkTop.x + cosA * (stalkRadii[stalkRadii.length - 1] * 1.1);
    const innerY = stalkTop.y;
    const innerZ = stalkTop.z + sinA * (stalkRadii[stalkRadii.length - 1] * 1.1);

    const gillDrop = 0.8;
    // Four vertices for the gill blade
    const v0 = addVertex(capData, innerX, innerY, innerZ, 0, -1, 0, 0, 0, 0.25, 1.0, 0.4);
    const v1 = addVertex(capData, innerX, innerY - gillDrop * 0.4, innerZ, 0, -1, 0, 0, 1, 0.25, 1.0, 0.6);
    const v2 = addVertex(capData, outerX, outerY - gillDrop, outerZ, 0, -1, 0, 1, 1, 0.35, 1.0, 0.8);
    const v3 = addVertex(capData, outerX, outerY, outerZ, 0, -1, 0, 1, 0, 0.35, 1.0, 0.5);

    addQuad(capData, v0, v1, v2, v3);
  }

  // 5. Dripping spore nodules along cap perimeter (LOD0 only)
  if (lod === 0) {
    const noduleCount = 8;
    for (let n = 0; n < noduleCount; n++) {
      const angle = (n / noduleCount) * Math.PI * 2 + (rng() - 0.5) * 0.2;
      const dripLen = 0.6 + rng() * 0.8;
      const nx = capRimCenter.x + Math.cos(angle) * capRadius * 0.98;
      const ny = capRimCenter.y - 0.2;
      const nz = capRimCenter.z + Math.sin(angle) * capRadius * 0.98;

      const vA = addVertex(capData, nx - 0.08, ny, nz, 0, -1, 0, 0, 0, 0.35, 1.0, 0.7);
      const vB = addVertex(capData, nx + 0.08, ny, nz, 0, -1, 0, 1, 0, 0.35, 1.0, 0.7);
      const vC = addVertex(capData, nx, ny - dripLen, nz, 0, -1, 0, 0.5, 1, 0.45, 1.0, 0.9);
      addTriangle(capData, vA, vB, vC);
    }
  }

  mergeGeometryData(combined, capData);

  return buildBufferGeometry(combined);
}

/**
 * Generates Shelf Fungus clusters (stacked bracket shelves with glowing rim)
 */
export function generateShelfFungus(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const shelfCount = Math.floor(params.shelfCount ?? (3 + rng() * 3));
  const baseRadius = params.radius ?? (0.7 + rng() * 0.6);

  let segments = lod === 0 ? 12 : lod === 1 ? 7 : 4;
  const combined = createEmptyGeometryData();

  for (let s = 0; s < shelfCount; s++) {
    const heightY = s * (0.35 + rng() * 0.2);
    const radius = baseRadius * (1.1 - s * 0.15) * (0.8 + rng() * 0.4);
    const shelfAngle = (s * 0.4) + (rng() - 0.5) * 0.3;
    const shelfData = createEmptyGeometryData();

    // Fan-shaped semicircular bracket
    const arcSpan = Math.PI * 0.85;
    const startAngle = shelfAngle - arcSpan * 0.5;

    for (let i = 0; i <= segments; i++) {
      const frac = i / segments;
      const a = startAngle + frac * arcSpan;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);

      // Root attachment vertex (x=0, z=0)
      const inX = cosA * 0.05;
      const inZ = sinA * 0.05;
      const inY = heightY;

      // Outer rim vertex with wavy ripple
      const ripple = Math.sin(frac * Math.PI * 4) * 0.05;
      const outX = cosA * (radius + ripple);
      const outZ = sinA * (radius + ripple);
      const outY = heightY + 0.04 - frac * 0.08;

      // Top surface
      const vIn = addVertex(shelfData, inX, inY, inZ, 0, 1, 0, 0, frac, 0.05, 0.1, 0.6);
      // Outer rim carries intense emissive glow mask
      const vOut = addVertex(shelfData, outX, outY, outZ, cosA * 0.5, 0.8, sinA * 0.5, 1, frac, 0.08, 1.0, 0.9);

      if (i > 0) {
        const prevIn = (i - 1) * 2;
        const prevOut = (i - 1) * 2 + 1;
        addQuad(shelfData, prevIn, vIn, vOut, prevOut);
      }
    }

    mergeGeometryData(combined, shelfData);
  }

  return buildBufferGeometry(combined);
}

/**
 * Generates Lumen Cap Clusters (small ground mushrooms in tight groups)
 */
export function generateLumenCapCluster(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const capCount = Math.floor(params.capCount ?? (5 + rng() * 4));

  let radialSegs = lod === 0 ? 10 : lod === 1 ? 5 : 4;
  let capRings = lod === 0 ? 5 : lod === 1 ? 2 : 2;

  const combined = createEmptyGeometryData();

  for (let c = 0; c < capCount; c++) {
    const angle = rng() * Math.PI * 2;
    const dist = 0.15 + rng() * 0.65;
    const posX = Math.cos(angle) * dist;
    const posZ = Math.sin(angle) * dist;

    const stemHeight = (params.height ?? 0.55) * (0.6 + rng() * 0.8);
    const capRad = (params.capRadius ?? 0.18) * (0.7 + rng() * 0.6);

    // Stalk
    const stalkPts: THREE.Vector3[] = [];
    const stalkRadii: number[] = [];
    const lean = (rng() - 0.5) * 0.18;
    const stalkSteps = lod === 0 ? 4 : lod === 1 ? 2 : 1;

    for (let step = 0; step <= stalkSteps; step++) {
      const t = step / stalkSteps;
      stalkPts.push(new THREE.Vector3(posX + t * lean, t * stemHeight, posZ + t * lean * 0.5));
      stalkRadii.push(capRad * 0.22 * (1.1 - t * 0.3));
    }

    const stalkData = createTubeAlongPath(stalkPts, stalkRadii, radialSegs, 0.0, 0.2, 0.2);
    mergeGeometryData(combined, stalkData);

    // Domed cap
    const capApex = stalkPts[stalkPts.length - 1];
    const capData = createEmptyGeometryData();

    for (let ring = 0; ring <= capRings; ring++) {
      const phi = (ring / capRings) * (Math.PI * 0.55);
      const r = Math.sin(phi) * capRad;
      const yOff = Math.cos(phi) * capRad * 1.1;

      for (let s = 0; s <= radialSegs; s++) {
        const theta = (s / radialSegs) * Math.PI * 2;
        const vx = capApex.x + Math.cos(theta) * r;
        const vy = capApex.y + yOff;
        const vz = capApex.z + Math.sin(theta) * r;

        // Caps have strong glowing tips and underside
        const glowMask = ring === 0 || ring === capRings ? 1.0 : 0.75;
        addVertex(capData, vx, vy, vz, Math.cos(theta), 0.7, Math.sin(theta), s / radialSegs, ring / capRings, 0.25, glowMask, 0.85);
      }
    }

    const row = radialSegs + 1;
    for (let ring = 0; ring < capRings; ring++) {
      for (let s = 0; s < radialSegs; s++) {
        const a = ring * row + s;
        const b = (ring + 1) * row + s;
        const c = (ring + 1) * row + (s + 1);
        const d = ring * row + (s + 1);
        addQuad(capData, a, b, c, d);
      }
    }

    mergeGeometryData(combined, capData);
  }

  return buildBufferGeometry(combined);
}

/**
 * Generates Spore Stalk (thin tall pod with bulbous slit head)
 */
export function generateSporeStalk(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const height = params.height ?? (3.6 + rng() * 2.0);
  const bulbRadius = params.bulbRadius ?? (0.55 + rng() * 0.25);

  let radial = lod === 0 ? 12 : lod === 1 ? 8 : 4;
  let steps = lod === 0 ? 10 : lod === 1 ? 6 : 3;

  const points: THREE.Vector3[] = [];
  const radii: number[] = [];
  const leanX = (rng() - 0.5) * 1.2;
  const leanZ = (rng() - 0.5) * 1.2;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * height;
    const x = Math.sin(t * Math.PI * 0.4) * leanX;
    const z = Math.sin(t * Math.PI * 0.4) * leanZ;
    points.push(new THREE.Vector3(x, y, z));

    // Thin stalk, bulges dramatically at the apex bulb (t > 0.82)
    let r = 0.08 + (1.0 - t) * 0.06;
    if (t > 0.78) {
      const bulbT = (t - 0.78) / 0.22;
      r += Math.sin(bulbT * Math.PI) * bulbRadius;
    }
    radii.push(r);
  }

  const stalkData = createTubeAlongPath(points, radii, radial, 0.0, 0.45, 0.1);

  // Add emissive slit pores around bulb
  if (lod <= 1) {
    const topPt = points[points.length - 2];
    const slitCount = lod === 0 ? 6 : 3;
    for (let s = 0; s < slitCount; s++) {
      const angle = (s / slitCount) * Math.PI * 2;
      const slitDist = bulbRadius * 0.9;
      const sx = topPt.x + Math.cos(angle) * slitDist;
      const sz = topPt.z + Math.sin(angle) * slitDist;
      const sy = topPt.y;

      const v0 = addVertex(stalkData, sx - 0.04, sy + 0.15, sz, Math.cos(angle), 0, Math.sin(angle), 0, 0, 0.4, 1.0, 0.9);
      const v1 = addVertex(stalkData, sx + 0.04, sy + 0.15, sz, Math.cos(angle), 0, Math.sin(angle), 1, 0, 0.4, 1.0, 0.9);
      const v2 = addVertex(stalkData, sx, sy - 0.2, sz, Math.cos(angle), 0, Math.sin(angle), 0.5, 1, 0.4, 1.0, 0.9);
      addTriangle(stalkData, v0, v1, v2);
    }
  }

  return buildBufferGeometry(stalkData);
}

/**
 * Generates Mycelium Veins (ground decal ribbon mesh branching over terrain)
 */
export function generateMyceliumVeins(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const radius = params.radius ?? (3.0 + rng() * 2.2);
  const branchCount = Math.max(2, Math.floor((params.branchDensity ?? 8) * (lod === 0 ? 1.0 : lod === 1 ? 0.6 : 0.35)));

  const data = createEmptyGeometryData();

  for (let b = 0; b < branchCount; b++) {
    const mainAngle = (b / branchCount) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const segs = lod === 0 ? 8 : lod === 1 ? 5 : 3;
    let currX = 0;
    let currZ = 0;
    let currAngle = mainAngle;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const len = (radius / segs) * (0.8 + rng() * 0.4);
      currX += Math.cos(currAngle) * len;
      currZ += Math.sin(currAngle) * len;
      currAngle += (rng() - 0.5) * 0.6; // Wriggle

      const width = (0.22 * (1.0 - t * 0.75));
      const perpX = -Math.sin(currAngle) * width;
      const perpZ = Math.cos(currAngle) * width;

      // Ribbons sit slightly above terrain (y = 0.02)
      const glow = Math.max(0.1, 1.0 - t * 0.85);

      addVertex(data, currX - perpX, 0.025, currZ - perpZ, 0, 1, 0, 0, t, 0.0, glow, 0.9);
      addVertex(data, currX + perpX, 0.025, currZ + perpZ, 0, 1, 0, 1, t, 0.0, glow, 0.9);

      if (s > 0) {
        const prevA = (data.positions.length / 3) - 4;
        const prevB = prevA + 1;
        const currA = prevA + 2;
        const currB = prevA + 3;
        addQuad(data, prevA, currA, currB, prevB);
      }
    }
  }

  return buildBufferGeometry(data);
}
