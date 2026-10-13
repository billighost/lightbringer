import * as THREE from 'three';

/**
 * Deterministic pseudo-random number generator using Mulberry32
 */
export function createMulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GeometryData {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  windWeights: number[];
  glowMasks: number[];
  vertexAos: number[];
}

export function createEmptyGeometryData(): GeometryData {
  return {
    positions: [],
    normals: [],
    uvs: [],
    indices: [],
    windWeights: [],
    glowMasks: [],
    vertexAos: []
  };
}

/**
 * Appends a vertex to GeometryData
 */
export function addVertex(
  data: GeometryData,
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  u: number,
  v: number,
  windWeight = 0,
  glowMask = 0,
  vertexAo = 1.0
): number {
  const index = data.positions.length / 3;
  data.positions.push(x, y, z);
  data.normals.push(nx, ny, nz);
  data.uvs.push(u, v);
  data.windWeights.push(windWeight);
  data.glowMasks.push(glowMask);
  data.vertexAos.push(vertexAo);
  return index;
}

/**
 * Appends a triangle face indices
 */
export function addTriangle(data: GeometryData, a: number, b: number, c: number): void {
  data.indices.push(a, b, c);
}

/**
 * Appends a quad face indices (two triangles)
 */
export function addQuad(data: GeometryData, a: number, b: number, c: number, d: number): void {
  data.indices.push(a, b, d);
  data.indices.push(b, c, d);
}

/**
 * Merges source GeometryData into target GeometryData with an optional matrix/offset
 */
export function mergeGeometryData(
  target: GeometryData,
  source: GeometryData,
  transform?: { offset?: THREE.Vector3; rotation?: THREE.Euler; scale?: THREE.Vector3 }
): void {
  const baseIndex = target.positions.length / 3;
  const pos = new THREE.Vector3();
  const norm = new THREE.Vector3();

  const rot = transform?.rotation;
  const offset = transform?.offset || new THREE.Vector3(0, 0, 0);
  const scale = transform?.scale || new THREE.Vector3(1, 1, 1);
  const rotMatrix = new THREE.Matrix4();
  if (rot) rotMatrix.makeRotationFromEuler(rot);

  for (let i = 0; i < source.positions.length; i += 3) {
    pos.set(
      source.positions[i] * scale.x,
      source.positions[i + 1] * scale.y,
      source.positions[i + 2] * scale.z
    );
    if (rot) pos.applyMatrix4(rotMatrix);
    pos.add(offset);

    norm.set(source.normals[i], source.normals[i + 1], source.normals[i + 2]);
    if (rot) norm.applyMatrix4(rotMatrix);
    norm.normalize();

    target.positions.push(pos.x, pos.y, pos.z);
    target.normals.push(norm.x, norm.y, norm.z);
    target.uvs.push(source.uvs[(i / 3) * 2], source.uvs[(i / 3) * 2 + 1]);
    target.windWeights.push(source.windWeights[i / 3]);
    target.glowMasks.push(source.glowMasks[i / 3]);
    target.vertexAos.push(source.vertexAos[i / 3]);
  }

  for (let i = 0; i < source.indices.length; i++) {
    target.indices.push(source.indices[i] + baseIndex);
  }
}

/**
 * Converts GeometryData to a finished Three.js BufferGeometry with baked attributes
 */
export function buildBufferGeometry(data: GeometryData): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();

  const vertCount = data.positions.length / 3;
  const posArray = new Float32Array(data.positions);
  const normArray = new Float32Array(data.normals);
  const uvArray = new Float32Array(data.uvs);
  const windArray = new Float32Array(data.windWeights);
  const glowArray = new Float32Array(data.glowMasks);
  const aoArray = new Float32Array(data.vertexAos);

  // Packed color attribute for shaders:
  // r = windWeight, g = glowMask, b = vertexAo
  const colorArray = new Float32Array(vertCount * 3);
  for (let i = 0; i < vertCount; i++) {
    colorArray[i * 3] = windArray[i];
    colorArray[i * 3 + 1] = glowArray[i];
    colorArray[i * 3 + 2] = aoArray[i];
  }

  geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normArray, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

  // Explicit custom attributes for specialized shaders
  geo.setAttribute('aWindWeight', new THREE.BufferAttribute(windArray, 1));
  geo.setAttribute('aGlowMask', new THREE.BufferAttribute(glowArray, 1));
  geo.setAttribute('aVertexAo', new THREE.BufferAttribute(aoArray, 1));

  // Index buffer: uint16 if under 65535 vertices, uint32 otherwise
  if (vertCount > 65535) {
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(data.indices), 1));
  } else {
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array(data.indices), 1));
  }

  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  return geo;
}

/**
 * Generates a curved/tapered cylinder/tube along a spline/spine
 */
export function createTubeAlongPath(
  points: THREE.Vector3[],
  radii: number[],
  radialSegments: number,
  windWeightBase = 0.0,
  windWeightTip = 1.0,
  glowMask = 0.0
): GeometryData {
  const data = createEmptyGeometryData();
  const segs = points.length - 1;

  for (let i = 0; i <= segs; i++) {
    const pt = points[i];
    const r = radii[i];
    const t = i / segs;
    const wind = THREE.MathUtils.lerp(windWeightBase, windWeightTip, t * t);
    // Darken ambient occlusion near the ground (t < 0.25)
    const ao = Math.min(1.0, 0.45 + t * 1.8);

    // Compute tangent
    const tangent = new THREE.Vector3();
    if (i < segs) {
      tangent.subVectors(points[i + 1], pt).normalize();
    } else {
      tangent.subVectors(pt, points[i - 1]).normalize();
    }

    // Normal & binormal
    const up = Math.abs(tangent.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

    for (let j = 0; j <= radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const ringNorm = new THREE.Vector3()
        .addScaledVector(normal, cosA)
        .addScaledVector(binormal, sinA)
        .normalize();

      const posX = pt.x + ringNorm.x * r;
      const posY = pt.y + ringNorm.y * r;
      const posZ = pt.z + ringNorm.z * r;

      addVertex(
        data,
        posX,
        posY,
        posZ,
        ringNorm.x,
        ringNorm.y,
        ringNorm.z,
        j / radialSegments,
        t,
        wind,
        glowMask,
        ao
      );
    }
  }

  // Indices
  const vertsPerRow = radialSegments + 1;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * vertsPerRow + j;
      const b = (i + 1) * vertsPerRow + j;
      const c = (i + 1) * vertsPerRow + (j + 1);
      const d = i * vertsPerRow + (j + 1);
      addQuad(data, a, b, c, d);
    }
  }

  return data;
}
