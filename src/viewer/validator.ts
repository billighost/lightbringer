import * as THREE from 'three';
import { detectBonePreset } from '../animation/bonePresets';
import { CANONICAL_BONES } from '../animation/canonicalBones';
import { CanonicalBone } from '../data/schemas';

export type ValidationStatus = 'PASS' | 'WARN' | 'FAIL';

export interface ValidationItem {
  id: string;
  category: string;
  status: ValidationStatus;
  title: string;
  actual: string | number;
  budget: string | number;
  details?: string;
  hint?: string;
}

export interface MeshBreakdown {
  name: string;
  triangles: number;
  vertices: number;
  isSkinned: boolean;
}

export interface ModelValidationReport {
  overallStatus: ValidationStatus;
  characterType: 'hero' | 'boss' | 'enemy' | 'prop';
  totalTriangles: number;
  totalVertices: number;
  materialCount: number;
  textureCount: number;
  maxTextureDim: number;
  boneCount: number;
  unmappedBones: CanonicalBone[];
  detectedPreset: string;
  meshes: MeshBreakdown[];
  items: ValidationItem[];
}

export const ASSET_BUDGETS = {
  hero: { triangles: 40000, materials: 4, textures: 8, maxDim: 2048, maxFileSizeMB: 20 },
  boss: { triangles: 60000, materials: 6, textures: 12, maxDim: 2048, maxFileSizeMB: 30 },
  enemy: { triangles: 25000, materials: 3, textures: 6, maxDim: 2048, maxFileSizeMB: 15 },
  prop: { triangles: 5000, materials: 2, textures: 4, maxDim: 2048, maxFileSizeMB: 5 }
};

export class ModelValidator {
  public static validate(
    model: THREE.Object3D,
    clips: THREE.AnimationClip[] = [],
    charType: 'hero' | 'boss' | 'enemy' | 'prop' = 'hero',
    fileSizeBytes?: number
  ): ModelValidationReport {
    const budget = ASSET_BUDGETS[charType];
    const items: ValidationItem[] = [];

    // 1. Gather Mesh and Triangle statistics
    const meshes: MeshBreakdown[] = [];
    let totalTriangles = 0;
    let totalVertices = 0;
    const materialSet = new Set<THREE.Material>();
    const textureSet = new Set<THREE.Texture>();
    let maxTextureDim = 0;
    let hasNormals = true;
    let nonUniformScale = false;

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const geo = child.geometry;
        let tris = 0;
        let verts = 0;

        if (geo) {
          verts = geo.attributes.position ? geo.attributes.position.count : 0;
          tris = geo.index ? geo.index.count / 3 : verts / 3;

          if (!geo.attributes.normal) hasNormals = false;
        }

        totalTriangles += Math.floor(tris);
        totalVertices += verts;

        meshes.push({
          name: child.name || `Mesh_${meshes.length + 1}`,
          triangles: Math.floor(tris),
          vertices: verts,
          isSkinned: child instanceof THREE.SkinnedMesh
        });

        // Non-uniform scale check
        const s = child.scale;
        if (Math.abs(s.x - s.y) > 0.001 || Math.abs(s.y - s.z) > 0.001) {
          nonUniformScale = true;
        }

        // Materials & Textures
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) {
          if (!m) continue;
          materialSet.add(m);

          const texMaps = [
            (m as any).map,
            (m as any).normalMap,
            (m as any).roughnessMap,
            (m as any).metalnessMap,
            (m as any).emissiveMap,
            (m as any).aoMap
          ];

          for (const tex of texMaps) {
            if (tex && tex.image) {
              textureSet.add(tex);
              const w = tex.image.width || 0;
              const h = tex.image.height || 0;
              maxTextureDim = Math.max(maxTextureDim, w, h);
            }
          }
        }
      }
    });

    // 2. Gather Bones
    const boneNames: string[] = [];
    model.traverse((child) => {
      if (child instanceof THREE.Bone) {
        boneNames.push(child.name);
      }
    });

    const detection = detectBonePreset(boneNames);

    // 3. Bounds and Origin Check
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const min = box.min;
    const max = box.max;
    const center = new THREE.Vector3();
    box.getCenter(center);

    const isFeetAtOrigin = Math.abs(min.y) < 0.08;
    const isCenteredXZ = Math.abs(center.x) < 0.1 && Math.abs(center.z) < 0.1;
    const measuredHeight = max.y - min.y;

    // 4. Animation Checks
    const clipsWithRootTranslation: string[] = [];
    for (const clip of clips) {
      for (const track of clip.tracks) {
        if (track.name.toLowerCase().includes('position') && (track.name.toLowerCase().includes('hips') || track.name.toLowerCase().includes('root'))) {
          // Check if values vary along X or Z
          const vals = track.values;
          let variesXZ = false;
          if (vals.length >= 6) {
            const firstX = vals[0];
            const firstZ = vals[2];
            for (let i = 3; i < vals.length; i += 3) {
              if (Math.abs(vals[i] - firstX) > 0.05 || Math.abs(vals[i + 2] - firstZ) > 0.05) {
                variesXZ = true;
                break;
              }
            }
          }
          if (variesXZ && !clipsWithRootTranslation.includes(clip.name)) {
            clipsWithRootTranslation.push(clip.name);
          }
        }
      }
    }

    // --- EVALUATE VALIDATION ITEMS ---

    // A. Triangles Budget
    const triStatus: ValidationStatus =
      totalTriangles <= budget.triangles
        ? 'PASS'
        : totalTriangles <= budget.triangles * 1.2
        ? 'WARN'
        : 'FAIL';

    items.push({
      id: 'triangles',
      category: 'Geometry',
      status: triStatus,
      title: 'Triangle Count',
      actual: `${totalTriangles.toLocaleString()} tris`,
      budget: `<= ${budget.triangles.toLocaleString()} tris`,
      details: `${meshes.length} meshes found.`,
      hint: triStatus !== 'PASS' ? 'Decimate secondary geometry or use LODs in Blender.' : undefined
    });

    // B. Textures Resolution
    const texResStatus: ValidationStatus =
      maxTextureDim <= budget.maxDim
        ? 'PASS'
        : maxTextureDim <= 4096
        ? 'WARN'
        : 'FAIL';

    items.push({
      id: 'texture_res',
      category: 'Materials',
      status: texResStatus,
      title: 'Max Texture Dimension',
      actual: maxTextureDim > 0 ? `${maxTextureDim}px` : 'No textures',
      budget: `<= ${budget.maxDim}px`,
      hint: texResStatus !== 'PASS' ? 'Downscale 4K/8K textures to 2048x2048 for optimal GPU memory.' : undefined
    });

    // C. Material Count
    const matStatus: ValidationStatus =
      materialSet.size <= budget.materials
        ? 'PASS'
        : materialSet.size <= budget.materials + 2
        ? 'WARN'
        : 'FAIL';

    items.push({
      id: 'materials',
      category: 'Materials',
      status: matStatus,
      title: 'Material Count',
      actual: `${materialSet.size} materials`,
      budget: `<= ${budget.materials}`,
      hint: matStatus !== 'PASS' ? 'Combine materials into an atlas or single PBR set to minimize draw calls.' : undefined
    });

    // D. Bones & Skeleton
    const boneStatus: ValidationStatus =
      charType === 'prop'
        ? 'PASS'
        : detection.matchedCount >= 16
        ? 'PASS'
        : detection.matchedCount >= 10
        ? 'WARN'
        : 'FAIL';

    items.push({
      id: 'bones',
      category: 'Rigging',
      status: boneStatus,
      title: 'Humanoid Bone Presets',
      actual: `${boneNames.length} bones (detected: ${detection.preset})`,
      budget: '>= 16 canonical humanoid bones',
      details: `Matched: ${detection.matchedCount}/${CANONICAL_BONES.length}. Unmapped: ${detection.unmappedBones.join(', ') || 'None'}`,
      hint: boneStatus !== 'PASS' ? 'Map missing bones in character JSON or use Mixamo / SMPL standard rig.' : undefined
    });

    // E. Origin & Pivot
    const originStatus: ValidationStatus = isFeetAtOrigin && isCenteredXZ ? 'PASS' : 'WARN';
    items.push({
      id: 'origin',
      category: 'Transforms',
      status: originStatus,
      title: 'Pivot at Feet & Centered',
      actual: `Bottom Y: ${min.y.toFixed(2)}m, Height: ${measuredHeight.toFixed(2)}m, Center XZ: (${center.x.toFixed(2)}, ${center.z.toFixed(2)})`,
      budget: 'Feet at Y=0.0m, Centered at (0, 0)',
      hint: originStatus !== 'PASS' ? 'Center model at (0,0) with feet resting on ground plane in DCC tool.' : undefined
    });

    // F. Scale Uniformity
    const scaleStatus: ValidationStatus = nonUniformScale ? 'WARN' : 'PASS';
    items.push({
      id: 'scale',
      category: 'Transforms',
      status: scaleStatus,
      title: 'Uniform Mesh Scale',
      actual: nonUniformScale ? 'Non-uniform scale detected' : 'Uniform 1.0',
      budget: 'Uniform scale (1, 1, 1)',
      hint: nonUniformScale ? 'Apply All Transforms (Ctrl+A in Blender) before exporting GLB.' : undefined
    });

    // G. Normals & Tangents
    const normalStatus: ValidationStatus = hasNormals ? 'PASS' : 'FAIL';
    items.push({
      id: 'normals',
      category: 'Geometry',
      status: normalStatus,
      title: 'Surface Normals',
      actual: hasNormals ? 'Present' : 'Missing normals',
      budget: 'Required for shading',
      hint: !hasNormals ? 'Recalculate normals or ensure export settings include vertex normals.' : undefined
    });

    // H. File Size (if known)
    if (fileSizeBytes !== undefined) {
      const sizeMB = fileSizeBytes / (1024 * 1024);
      const sizeStatus: ValidationStatus =
        sizeMB <= budget.maxFileSizeMB
          ? 'PASS'
          : sizeMB <= budget.maxFileSizeMB * 1.5
          ? 'WARN'
          : 'FAIL';

      items.push({
        id: 'file_size',
        category: 'File',
        status: sizeStatus,
        title: 'GLB File Size',
        actual: `${sizeMB.toFixed(1)} MB`,
        budget: `<= ${budget.maxFileSizeMB} MB`,
        hint: sizeStatus !== 'PASS' ? 'Compress textures with WebP/KTX2 and apply Draco mesh compression.' : undefined
      });
    }

    // I. Root Motion in Locomotion Clips
    const rootMotionStatus: ValidationStatus = clipsWithRootTranslation.length > 0 ? 'WARN' : 'PASS';
    items.push({
      id: 'root_motion',
      category: 'Animations',
      status: rootMotionStatus,
      title: 'Locomotion Root Motion (In-Place Check)',
      actual: clipsWithRootTranslation.length > 0
        ? `XZ motion found in: ${clipsWithRootTranslation.join(', ')}`
        : 'All clips clean in-place',
      budget: 'Locomotion clips must be in-place (no horizontal root translation)',
      hint: rootMotionStatus !== 'PASS'
        ? 'Enable rootMotion: "none" in animationMap to neutralize horizontal translation automatically, or export in-place from Mixamo.'
        : undefined
    });

    // Compute Overall Status
    const hasFail = items.some((i) => i.status === 'FAIL');
    const hasWarn = items.some((i) => i.status === 'WARN');
    const overallStatus: ValidationStatus = hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'PASS';

    return {
      overallStatus,
      characterType: charType,
      totalTriangles,
      totalVertices,
      materialCount: materialSet.size,
      textureCount: textureSet.size,
      maxTextureDim,
      boneCount: boneNames.length,
      unmappedBones: detection.unmappedBones,
      detectedPreset: detection.preset,
      meshes,
      items
    };
  }
}
