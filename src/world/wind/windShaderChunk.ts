import * as THREE from 'three';
import { WindSystem } from './windSystem';

export const WIND_GLSL_CHUNK = `
  uniform vec2 uWindDir;
  uniform float uWindStrength;
  uniform float uWindTime;

  vec3 applyWindDisplacement(vec3 pos, float heightWeight, float phaseOffset) {
    float spatialPhase = pos.x * 0.12 + pos.z * 0.12 + phaseOffset;
    float sway = sin(uWindTime * 2.2 + spatialPhase) * 0.65
               + sin(uWindTime * 4.3 + spatialPhase * 1.8) * 0.35;
    vec3 disp = vec3(uWindDir.x, 0.0, uWindDir.y) * sway * uWindStrength * heightWeight;
    return pos + disp;
  }
`;

/**
 * Patches a Three.js material to add wind vertex displacement
 */
export function patchMaterialWithWind(
  material: THREE.Material,
  heightWeightFactor = 0.25
): void {
  const wind = WindSystem.getInstance();

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindDir = wind.uniforms.uWindDir;
    shader.uniforms.uWindStrength = wind.uniforms.uWindStrength;
    shader.uniforms.uWindTime = wind.uniforms.uWindTime;

    shader.vertexShader = `
      ${WIND_GLSL_CHUNK}
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      // Displace upper vertices weighted by UV.y or position.y
      float hWeight = clamp(position.y * ${heightWeightFactor.toFixed(3)}, 0.0, 1.0);
      transformed = applyWindDisplacement(transformed, hWeight, 0.0);
      `
    );
  };
}

/**
 * Creates demonstration wind sway banner/card meshes to visually prove wind displacement
 */
export function createWindTestCards(scene: THREE.Scene, count = 4, origin = new THREE.Vector3(3, 0, 3)): THREE.Group {
  const group = new THREE.Group();

  const cardGeo = new THREE.PlaneGeometry(0.8, 2.5, 4, 16);
  // Shift pivot to bottom
  cardGeo.translate(0, 1.25, 0);

  const cardMat = new THREE.MeshStandardMaterial({
    color: 0x07443e,
    emissive: 0x00f2ff,
    emissiveIntensity: 0.3,
    roughness: 0.7,
    side: THREE.DoubleSide
  });

  patchMaterialWithWind(cardMat, 0.45);

  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(cardGeo, cardMat);
    const angle = (i / count) * Math.PI * 2;
    mesh.position.set(origin.x + Math.cos(angle) * 3.5, origin.y, origin.z + Math.sin(angle) * 3.5);
    mesh.rotation.y = angle;
    mesh.castShadow = true;
    group.add(mesh);
  }

  scene.add(group);
  return group;
}
