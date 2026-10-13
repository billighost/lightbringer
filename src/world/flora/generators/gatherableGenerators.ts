import * as THREE from 'three';
import {
  createMulberry32,
  createEmptyGeometryData,
  addVertex,
  addQuad,
  addTriangle,
  mergeGeometryData,
  buildBufferGeometry
} from './geometryUtils';

/**
 * Generates Lumen Shard (pale crystal cluster with hexagonal prisms)
 */
export function generateLumenShard(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const crystalCount = Math.max(2, Math.floor((params.crystalCount ?? 6) * (lod === 0 ? 1.0 : lod === 1 ? 0.6 : 0.35)));
  const baseHeight = params.height ?? (1.2 + rng() * 0.6);

  const combined = createEmptyGeometryData();

  for (let c = 0; c < crystalCount; c++) {
    const isCentral = c === 0;
    const h = isCentral ? baseHeight : baseHeight * (0.45 + rng() * 0.45);
    const r = isCentral ? 0.22 : 0.12 + rng() * 0.08;

    const angle = isCentral ? 0 : (c / (crystalCount - 1)) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const tilt = isCentral ? 0.05 : 0.25 + rng() * 0.25;
    const dist = isCentral ? 0 : 0.25 + rng() * 0.2;

    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;

    const sides = 6;
    const cData = createEmptyGeometryData();
    const rotEuler = new THREE.Euler(Math.sin(angle) * tilt, angle, Math.cos(angle) * tilt);
    const rotMat = new THREE.Matrix4().makeRotationFromEuler(rotEuler);

    // Bottom and top hexagonal rings, plus apex point
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const cosA = Math.cos(a) * r;
      const sinA = Math.sin(a) * r;

      const pBase = new THREE.Vector3(cosA, 0.02, sinA).applyMatrix4(rotMat).add(new THREE.Vector3(px, 0, pz));
      const pTop = new THREE.Vector3(cosA * 0.85, h * 0.75, sinA * 0.85).applyMatrix4(rotMat).add(new THREE.Vector3(px, 0, pz));

      addVertex(cData, pBase.x, pBase.y, pBase.z, Math.cos(a), 0, Math.sin(a), i / sides, 0, 0.0, 0.85, 0.6);
      addVertex(cData, pTop.x, pTop.y, pTop.z, Math.cos(a), 0.5, Math.sin(a), i / sides, 0.75, 0.0, 1.0, 0.95);
    }

    // Apex pyramid point
    const pApex = new THREE.Vector3(0, h, 0).applyMatrix4(rotMat).add(new THREE.Vector3(px, 0, pz));
    const vApex = addVertex(cData, pApex.x, pApex.y, pApex.z, 0, 1, 0, 0.5, 1.0, 0.0, 1.0, 1.0);

    // Body quads and apex triangles
    for (let i = 0; i < sides; i++) {
      const iNext = (i + 1) % sides;
      const b0 = i * 2;
      const t0 = i * 2 + 1;
      const b1 = iNext * 2;
      const t1 = iNext * 2 + 1;

      addQuad(cData, b0, b1, t1, t0);
      addTriangle(cData, t0, t1, vApex);
    }

    mergeGeometryData(combined, cData);
  }

  return buildBufferGeometry(combined);
}

/**
 * Generates Glow-Spore Plant (bulbous fleshy pods on slender stems)
 */
export function generateGlowSporePlant(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const podCount = Math.max(1, Math.floor((params.podCount ?? 4) * (lod === 0 ? 1.0 : lod === 1 ? 0.6 : 0.3)));
  const baseH = params.height ?? (1.2 + rng() * 0.4);

  const combined = createEmptyGeometryData();

  for (let p = 0; p < podCount; p++) {
    const angle = (p / podCount) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const lean = 0.25 + rng() * 0.25;
    const h = baseH * (0.8 + rng() * 0.4);
    const podRad = (params.podRadius ?? 0.3) * (0.8 + rng() * 0.4);

    const stemSegs = lod === 0 ? 5 : 3;
    const stemPts: THREE.Vector3[] = [];
    for (let s = 0; s <= stemSegs; s++) {
      const t = s / stemSegs;
      const x = Math.cos(angle) * (t * lean * h);
      const z = Math.sin(angle) * (t * lean * h);
      const y = t * h;
      stemPts.push(new THREE.Vector3(x, y, z));
    }

    // Slender stem
    const stemData = createEmptyGeometryData();
    const stemRad = 0.035;
    for (let s = 0; s < stemSegs; s++) {
      const p1 = stemPts[s];
      const p2 = stemPts[s + 1];
      const t = s / stemSegs;
      const v0 = addVertex(stemData, p1.x - stemRad, p1.y, p1.z, 0, 1, 0, 0, t, t * 0.3, 0.2, 0.7);
      const v1 = addVertex(stemData, p1.x + stemRad, p1.y, p1.z, 0, 1, 0, 1, t, t * 0.3, 0.2, 0.7);
      const v2 = addVertex(stemData, p2.x + stemRad, p2.y, p2.z, 0, 1, 0, 1, (s + 1) / stemSegs, (t + 0.2) * 0.3, 0.2, 0.7);
      const v3 = addVertex(stemData, p2.x - stemRad, p2.y, p2.z, 0, 1, 0, 0, (s + 1) / stemSegs, (t + 0.2) * 0.3, 0.2, 0.7);
      addQuad(stemData, v0, v1, v2, v3);
    }
    mergeGeometryData(combined, stemData);

    // Bulbous sac pod at stem tip
    const apex = stemPts[stemPts.length - 1];
    const podDetail = lod === 0 ? 2 : lod === 1 ? 1 : 0;
    const sphere = new THREE.IcosahedronGeometry(podRad, podDetail);
    const sPos = sphere.getAttribute('position');
    const sIdx = sphere.getIndex();

    const podData = createEmptyGeometryData();
    for (let i = 0; i < sPos.count; i++) {
      let vx = sPos.getX(i);
      let vy = sPos.getY(i) * 1.35; // Elongated bulb
      let vz = sPos.getZ(i);

      vx += apex.x;
      vy += apex.y + podRad;
      vz += apex.z;

      // Glow mask = 1.0 across pod surface
      addVertex(podData, vx, vy, vz, 0, 1, 0, 0.5, 0.5, 0.35, 1.0, 0.9);
    }

    if (sIdx) {
      for (let i = 0; i < sIdx.count; i++) podData.indices.push(sIdx.getX(i));
    } else {
      for (let i = 0; i < sPos.count; i++) podData.indices.push(i);
    }
    sphere.dispose();

    mergeGeometryData(combined, podData);
  }

  return buildBufferGeometry(combined);
}
