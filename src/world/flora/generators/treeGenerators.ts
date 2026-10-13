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
 * Generates Twisted Snag (gnarled dead tree with leaning limbs and hanging vine ribbons)
 */
export function generateTwistedSnag(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const height = params.height ?? (7.5 + rng() * 4.0);
  const trunkBaseRad = params.trunkRadius ?? (0.7 + rng() * 0.35);
  const branchCount = Math.max(1, Math.floor((params.branchCount ?? 5) * (lod === 0 ? 1.0 : lod === 1 ? 0.6 : 0.4)));
  const vineCount = Math.floor(params.vineCount ?? (lod === 0 ? 4 : lod === 1 ? 2 : 0));

  let radial = lod === 0 ? 12 : lod === 1 ? 8 : 4;
  let trunkSteps = lod === 0 ? 10 : lod === 1 ? 6 : 4;

  const combined = createEmptyGeometryData();

  // 1. Gnarled Main Trunk
  const trunkPoints: THREE.Vector3[] = [];
  const trunkRadii: number[] = [];
  const leanX = (rng() - 0.5) * 2.2;
  const leanZ = (rng() - 0.5) * 2.2;

  for (let i = 0; i <= trunkSteps; i++) {
    const t = i / trunkSteps;
    const y = t * height;
    const x = Math.sin(t * Math.PI * 0.6) * leanX + Math.sin(t * Math.PI * 2.0) * 0.25;
    const z = Math.sin(t * Math.PI * 0.6) * leanZ + Math.cos(t * Math.PI * 2.0) * 0.25;
    trunkPoints.push(new THREE.Vector3(x, y, z));

    let r = trunkBaseRad * (1.1 - t * 0.65);
    if (t < 0.2) r += (0.2 - t) * trunkBaseRad * 1.5; // Root flare
    trunkRadii.push(r);
  }

  const trunkData = createTubeAlongPath(trunkPoints, trunkRadii, radial, 0.0, 0.05, 0.0);
  mergeGeometryData(combined, trunkData);

  // 2. Dead Branch Limbs branching outward
  for (let b = 0; b < branchCount; b++) {
    const attachT = 0.5 + (b / branchCount) * 0.45;
    const attachIdx = Math.floor(attachT * trunkSteps);
    const origin = trunkPoints[attachIdx];
    const baseR = trunkRadii[attachIdx] * 0.45;

    const branchAngle = (b * 1.8) + (rng() - 0.5) * 0.5;
    const branchLen = (2.2 + rng() * 2.5) * (1.0 - (attachT - 0.5));
    const branchSteps = lod === 0 ? 6 : lod === 1 ? 4 : 2;

    const bPoints: THREE.Vector3[] = [];
    const bRadii: number[] = [];

    for (let s = 0; s <= branchSteps; s++) {
      const bt = s / branchSteps;
      const bRad = baseR * (1.0 - bt * 0.8);
      const bDist = bt * branchLen;
      const bx = origin.x + Math.cos(branchAngle) * bDist + Math.sin(bt * 3.0) * 0.2;
      const by = origin.y + bt * (0.8 + rng() * 0.6) - bt * bt * 0.4;
      const bz = origin.z + Math.sin(branchAngle) * bDist + Math.cos(bt * 3.0) * 0.2;
      bPoints.push(new THREE.Vector3(bx, by, bz));
      bRadii.push(Math.max(0.04, bRad));
    }

    const branchRadial = Math.max(3, Math.floor(radial * 0.65));
    const branchData = createTubeAlongPath(bPoints, bRadii, branchRadial, 0.02, 0.1, 0.0);
    mergeGeometryData(combined, branchData);

    // 3. Hanging Dead Vine Ribbons (LOD0 & LOD1)
    if (lod <= 1 && b < vineCount) {
      const tipPt = bPoints[bPoints.length - 1];
      const vineLen = 1.8 + rng() * 2.2;
      const vineSegs = lod === 0 ? 6 : 4;
      const vineData = createEmptyGeometryData();

      for (let v = 0; v <= vineSegs; v++) {
        const vt = v / vineSegs;
        const vx = tipPt.x + Math.sin(vt * 4.0) * 0.08;
        const vy = tipPt.y - vt * vineLen;
        const vz = tipPt.z + Math.cos(vt * 4.0) * 0.08;

        const w = 0.035 * (1.0 - vt * 0.4);
        // Vines flutter with high wind weight
        const windWeight = 0.2 + vt * 0.8;
        const ao = 0.85;

        addVertex(vineData, vx - w, vy, vz, 0, 0, 1, 0, vt, windWeight, 0.0, ao);
        addVertex(vineData, vx + w, vy, vz, 0, 0, 1, 1, vt, windWeight, 0.0, ao);

        if (v > 0) {
          const idxA = (vineData.positions.length / 3) - 4;
          const idxB = idxA + 1;
          const idxC = idxA + 2;
          const idxD = idxA + 3;
          addQuad(vineData, idxA, idxB, idxD, idxC);
        }
      }
      mergeGeometryData(combined, vineData);
    }
  }

  return buildBufferGeometry(combined);
}

/**
 * Generates Broken Stump (hollow jagged top, root buttresses, faint inner glow)
 */
export function generateBrokenStump(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const height = params.height ?? (2.4 + rng() * 1.2);
  const baseRad = params.radius ?? (1.1 + rng() * 0.4);
  const splinterCount = Math.max(2, Math.floor((params.splinters ?? 10) * (lod === 0 ? 1.0 : lod === 1 ? 0.6 : 0.4)));

  let radial = lod === 0 ? 16 : lod === 1 ? 10 : 6;
  const combined = createEmptyGeometryData();

  // Outer and Inner hollow cylinder
  const outerWall = createEmptyGeometryData();
  const innerWall = createEmptyGeometryData();
  const rimSteps = lod === 0 ? 5 : 3;

  for (let step = 0; step <= rimSteps; step++) {
    const t = step / rimSteps;
    const y = t * height;
    const rOuter = baseRad * (1.3 - t * 0.4);
    const rInner = Math.max(0.15, rOuter * 0.65);

    // Root buttress wave at ground level
    const buttressWave = t < 0.3 ? (0.3 - t) * 0.5 : 0;

    for (let i = 0; i <= radial; i++) {
      const angle = (i / radial) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const wave = Math.sin(angle * 4) * buttressWave;

      // Outer wall
      const ox = cosA * (rOuter + wave);
      const oz = sinA * (rOuter + wave);
      const aoOuter = Math.min(1.0, 0.35 + t * 1.2);
      addVertex(outerWall, ox, y, oz, cosA, 0, sinA, i / radial, t, 0.0, 0.0, aoOuter);

      // Inner wall (inner cavity with faint glow)
      const ix = cosA * rInner;
      const iz = sinA * rInner;
      const innerGlow = t > 0.3 ? 0.75 : 0.2;
      const aoInner = 0.5;
      addVertex(innerWall, ix, y, iz, -cosA, 0, -sinA, i / radial, t, 0.0, innerGlow, aoInner);
    }
  }

  const row = radial + 1;
  for (let step = 0; step < rimSteps; step++) {
    for (let i = 0; i < radial; i++) {
      // Outer
      const oA = step * row + i;
      const oB = (step + 1) * row + i;
      const oC = (step + 1) * row + (i + 1);
      const oD = step * row + (i + 1);
      addQuad(outerWall, oA, oB, oC, oD);

      // Inner (reversed normal)
      const iA = step * row + i;
      const iB = (step + 1) * row + i;
      const iC = (step + 1) * row + (i + 1);
      const iD = step * row + (i + 1);
      addQuad(innerWall, iA, iD, iC, iB);
    }
  }

  mergeGeometryData(combined, outerWall);
  mergeGeometryData(combined, innerWall);

  // Jagged splinter teeth along top rim
  const rimData = createEmptyGeometryData();

  for (let s = 0; s < splinterCount; s++) {
    const angle = (s / splinterCount) * Math.PI * 2;
    const splinterH = 0.3 + rng() * 0.7;
    const midR = baseRad * 0.75;
    const sx = Math.cos(angle) * midR;
    const sz = Math.sin(angle) * midR;
    const sy = height + splinterH;

    const vTip = addVertex(rimData, sx, sy, sz, 0, 1, 0, 0.5, 1, 0.0, 0.4, 0.9);
    const vOut = addVertex(rimData, Math.cos(angle) * baseRad * 0.9, height, Math.sin(angle) * baseRad * 0.9, 0, 1, 0, 0, 0, 0.0, 0.2, 0.8);
    const vIn = addVertex(rimData, Math.cos(angle) * baseRad * 0.6, height, Math.sin(angle) * baseRad * 0.6, 0, 1, 0, 1, 0, 0.0, 0.6, 0.6);
    addTriangle(rimData, vTip, vOut, vIn);
  }

  mergeGeometryData(combined, rimData);

  return buildBufferGeometry(combined);
}

/**
 * Generates Fallen Log (horizontal curved trunk with shelf fungus brackets)
 */
export function generateFallenLog(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const length = params.length ?? (5.5 + rng() * 3.5);
  const radius = params.radius ?? (0.55 + rng() * 0.3);
  const shelfCount = Math.floor(params.shelfClusterCount ?? (lod === 0 ? 3 : 1));

  let radial = lod === 0 ? 12 : lod === 1 ? 8 : 4;
  let segs = lod === 0 ? 10 : lod === 1 ? 6 : 4;

  const points: THREE.Vector3[] = [];
  const radii: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = (t - 0.5) * length;
    const x = Math.sin(t * Math.PI) * (0.35 + (rng() - 0.5) * 0.2);
    // Log rests horizontally on ground
    const y = radius * 0.9;
    points.push(new THREE.Vector3(x, y, z));
    radii.push(radius * (1.05 - t * 0.25));
  }

  const combined = createEmptyGeometryData();
  const logData = createTubeAlongPath(points, radii, radial, 0.0, 0.0, 0.0);
  mergeGeometryData(combined, logData);

  // Shelf fungus clusters jutting from the top/side of the log
  if (lod <= 1) {
    for (let sc = 0; sc < shelfCount; sc++) {
      const t = 0.3 + (sc / (shelfCount + 1)) * 0.45;
      const idx = Math.floor(t * segs);
      const origin = points[idx];
      const r = radii[idx];

      const shelfAngle = Math.PI * 0.4 + (rng() - 0.5) * 0.6;
      const shelfRad = 0.35 + rng() * 0.3;
      const shelfData = createEmptyGeometryData();
      const sFan = lod === 0 ? 6 : 3;

      for (let j = 0; j <= sFan; j++) {
        const frac = j / sFan;
        const fanA = shelfAngle - 0.5 + frac * 1.0;
        const outX = origin.x + Math.cos(fanA) * (r + shelfRad);
        const outY = origin.y + Math.sin(fanA) * (r + shelfRad);
        const outZ = origin.z + (frac - 0.5) * 0.35;

        const inX = origin.x + Math.cos(fanA) * r;
        const inY = origin.y + Math.sin(fanA) * r;
        const inZ = origin.z + (frac - 0.5) * 0.3;

        addVertex(shelfData, inX, inY, inZ, 0, 1, 0, 0, frac, 0.0, 0.1, 0.7);
        addVertex(shelfData, outX, outY, outZ, 0, 1, 0, 1, frac, 0.0, 1.0, 0.9);

        if (j > 0) {
          const a = (j - 1) * 2;
          const b = a + 1;
          const c = j * 2 + 1;
          const d = j * 2;
          addQuad(shelfData, a, b, c, d);
        }
      }
      mergeGeometryData(combined, shelfData);
    }
  }

  return buildBufferGeometry(combined);
}

/**
 * Generates Root Mass (exposed arching root cage)
 */
export function generateRootMass(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const radius = params.radius ?? (3.0 + rng() * 1.5);
  const height = params.height ?? (2.0 + rng() * 1.0);
  const archCount = Math.max(2, Math.floor((params.archCount ?? 6) * (lod === 0 ? 1.0 : lod === 1 ? 0.6 : 0.4)));

  let radial = lod === 0 ? 8 : lod === 1 ? 6 : 4;
  let archSteps = lod === 0 ? 8 : lod === 1 ? 5 : 3;

  const combined = createEmptyGeometryData();

  for (let a = 0; a < archCount; a++) {
    const angle = (a / archCount) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const oppAngle = angle + Math.PI * 0.75 + (rng() - 0.5) * 0.5;

    const startX = Math.cos(angle) * radius;
    const startZ = Math.sin(angle) * radius;
    const endX = Math.cos(oppAngle) * (radius * 0.8);
    const endZ = Math.sin(oppAngle) * (radius * 0.8);

    const archPts: THREE.Vector3[] = [];
    const archRadii: number[] = [];
    const rootRad = 0.22 + rng() * 0.15;

    for (let s = 0; s <= archSteps; s++) {
      const t = s / archSteps;
      const x = THREE.MathUtils.lerp(startX, endX, t);
      const z = THREE.MathUtils.lerp(startZ, endZ, t);
      // Parabolic arch peaking at height
      const y = Math.sin(t * Math.PI) * (height * (0.8 + rng() * 0.4));
      archPts.push(new THREE.Vector3(x, y, z));
      archRadii.push(rootRad * (0.7 + Math.sin(t * Math.PI) * 0.3));
    }

    const archData = createTubeAlongPath(archPts, archRadii, radial, 0.0, 0.0, 0.0);
    mergeGeometryData(combined, archData);
  }

  return buildBufferGeometry(combined);
}
