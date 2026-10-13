import * as THREE from 'three';
import {
  createMulberry32,
  createEmptyGeometryData,
  addVertex,
  addQuad,
  mergeGeometryData,
  buildBufferGeometry
} from './geometryUtils';

/**
 * Generates Boulder (noise-displaced faceted rock)
 */
export function generateBoulder(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const scaleX = params.scaleX ?? (2.0 + rng() * 1.5);
  const scaleY = params.scaleY ?? (1.6 + rng() * 1.2);
  const scaleZ = params.scaleZ ?? (2.0 + rng() * 1.5);

  let detail = lod === 0 ? 2 : lod === 1 ? 1 : 0;
  const baseGeo = new THREE.IcosahedronGeometry(1.0, detail);
  const posAttr = baseGeo.getAttribute('position');

  const data = createEmptyGeometryData();
  const vCount = posAttr.count;

  for (let i = 0; i < vCount; i++) {
    let vx = posAttr.getX(i);
    let vy = posAttr.getY(i);
    let vz = posAttr.getZ(i);

    // Multi-frequency ridged noise displacement
    const n1 = Math.sin(vx * 2.5 + vy * 3.1) * Math.cos(vz * 2.8) * 0.22;
    const n2 = Math.cos(vx * 6.0 + vz * 5.2) * 0.08;
    // Flat-faceted quantization
    const displacement = Math.round((n1 + n2) * 8) / 8;

    vx = (vx + vx * displacement) * scaleX * 0.5;
    vy = (vy + vy * displacement) * scaleY * 0.5;
    vz = (vz + vz * displacement) * scaleZ * 0.5;

    // Flatten bottom and ground planting
    if (vy < -0.3) {
      vy = -0.3 + (vy + 0.3) * 0.35;
    }
    // Shift base to ground level (y >= 0)
    vy += scaleY * 0.35;

    const ao = Math.min(1.0, 0.4 + (vy / scaleY) * 1.2);
    // Rare faint crystal glint in crevice
    const hasGlint = lod === 0 && displacement < -0.15 && rng() > 0.85 ? 0.9 : 0.0;

    addVertex(data, vx, vy, vz, 0, 1, 0, (vx / scaleX) + 0.5, (vz / scaleZ) + 0.5, 0.0, hasGlint, ao);
  }

  const idxAttr = baseGeo.getIndex();
  if (idxAttr) {
    for (let i = 0; i < idxAttr.count; i++) {
      data.indices.push(idxAttr.getX(i));
    }
  } else {
    for (let i = 0; i < vCount; i++) data.indices.push(i);
  }

  baseGeo.dispose();
  return buildBufferGeometry(data);
}

/**
 * Generates Stone Slab (chiseled tilted monolithic slab)
 */
export function generateSlab(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const w = params.width ?? (3.5 + rng() * 1.8);
  const h = params.height ?? (0.8 + rng() * 0.5);
  const d = params.depth ?? (3.0 + rng() * 1.5);
  const tilt = params.tilt ?? (0.2 + rng() * 0.25);

  const segsW = lod === 0 ? 6 : lod === 1 ? 4 : 2;
  const segsD = lod === 0 ? 6 : lod === 1 ? 4 : 2;

  const boxGeo = new THREE.BoxGeometry(w, h, d, segsW, 2, segsD);
  const posAttr = boxGeo.getAttribute('position');
  const data = createEmptyGeometryData();

  const rotEuler = new THREE.Euler(tilt * (rng() - 0.5), (rng() - 0.5) * 0.4, tilt);
  const rotMat = new THREE.Matrix4().makeRotationFromEuler(rotEuler);

  for (let i = 0; i < posAttr.count; i++) {
    const v = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    // Chisel noise on top edge
    v.y += Math.sin(v.x * 2.0) * Math.cos(v.z * 2.0) * 0.08;
    v.applyMatrix4(rotMat);
    v.y += h * 0.7; // Lift above ground

    const ao = Math.min(1.0, 0.4 + Math.max(0, v.y) * 0.9);
    addVertex(data, v.x, Math.max(0.02, v.y), v.z, 0, 1, 0, (v.x / w) + 0.5, (v.z / d) + 0.5, 0.0, 0.0, ao);
  }

  const idxAttr = boxGeo.getIndex();
  if (idxAttr) {
    for (let i = 0; i < idxAttr.count; i++) data.indices.push(idxAttr.getX(i));
  }
  boxGeo.dispose();

  return buildBufferGeometry(data);
}

/**
 * Generates Rock Spire (monolithic towering needle pillar)
 */
export function generateSpire(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const height = params.height ?? (8.5 + rng() * 5.0);
  const baseRad = params.baseRadius ?? (1.6 + rng() * 1.0);
  const ridgeCount = Math.floor(params.ridgeCount ?? (lod === 0 ? 7 : lod === 1 ? 5 : 4));

  let radial = lod === 0 ? 14 : lod === 1 ? 8 : 5;
  let steps = lod === 0 ? 10 : lod === 1 ? 6 : 3;

  const data = createEmptyGeometryData();

  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const y = t * height;
    // Tapering to a sharp needle tip at t = 1.0
    const r = baseRad * Math.pow(1.0 - t * 0.9, 0.85);

    for (let i = 0; i <= radial; i++) {
      const angle = (i / radial) * Math.PI * 2;
      const ridge = Math.abs(Math.sin(angle * (ridgeCount * 0.5))) * 0.25;
      const x = Math.cos(angle) * (r + ridge);
      const z = Math.sin(angle) * (r + ridge);

      const norm = new THREE.Vector3(Math.cos(angle), 0.25, Math.sin(angle)).normalize();
      const ao = Math.min(1.0, 0.35 + t * 1.5);
      // Crystal glint veins run vertically along ridges
      const hasCrystal = lod === 0 && ridge > 0.18 && t > 0.25 && t < 0.75 ? 0.95 : 0.0;

      addVertex(data, x, y, z, norm.x, norm.y, norm.z, i / radial, t, 0.0, hasCrystal, ao);
    }
  }

  const row = radial + 1;
  for (let step = 0; step < steps; step++) {
    for (let i = 0; i < radial; i++) {
      const a = step * row + i;
      const b = (step + 1) * row + i;
      const c = (step + 1) * row + (i + 1);
      const d = step * row + (i + 1);
      addQuad(data, a, b, c, d);
    }
  }

  return buildBufferGeometry(data);
}

/**
 * Generates Scree Cluster (scatter of jagged stones on a rocky patch)
 */
export function generateScreeCluster(
  seed: number,
  params: Record<string, number>,
  lod = 0
): THREE.BufferGeometry {
  const rng = createMulberry32(seed);
  const rockCount = Math.max(2, Math.floor((params.rockCount ?? 10) * (lod === 0 ? 1.0 : lod === 1 ? 0.55 : 0.3)));
  const clusterRad = params.radius ?? (2.4 + rng() * 1.0);

  const combined = createEmptyGeometryData();

  for (let r = 0; r < rockCount; r++) {
    const angle = rng() * Math.PI * 2;
    const dist = (0.2 + rng() * 0.8) * clusterRad;
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;

    const rockSz = (0.25 + rng() * 0.45);
    const detail = 0; // Simple low-poly rocks
    const rGeo = new THREE.IcosahedronGeometry(rockSz, detail);
    const rPos = rGeo.getAttribute('position');
    const rIdx = rGeo.getIndex();

    const rData = createEmptyGeometryData();
    for (let i = 0; i < rPos.count; i++) {
      let vx = rPos.getX(i);
      let vy = rPos.getY(i) * 0.65; // Slightly flat
      let vz = rPos.getZ(i);

      vx += px;
      vy += rockSz * 0.35; // Planted
      vz += pz;

      addVertex(rData, vx, vy, vz, 0, 1, 0, 0, 0, 0.0, 0.0, 0.85);
    }

    if (rIdx) {
      for (let i = 0; i < rIdx.count; i++) rData.indices.push(rIdx.getX(i));
    } else {
      for (let i = 0; i < rPos.count; i++) rData.indices.push(i);
    }
    rGeo.dispose();

    mergeGeometryData(combined, rData);
  }

  return buildBufferGeometry(combined);
}
