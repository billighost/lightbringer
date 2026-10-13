# Lightbringer Asset & Animation Pipeline Specification

This document details the asset specifications, conventions, budgets, workflows, and troubleshooting procedures for dropping 3D models and animation libraries into the **LIGHTBRINGER** engine.

---

## 1. Coordinate and Scale Conventions

- **Units**: 1 unit = **1.0 meter**.
- **Coordinate System**:
  - **+Y is UP**.
  - **+Z is FORWARD** (characters face towards positive Z in world space).
  - **+X is RIGHT** / **-X is LEFT**.
- **Pivot Point**:
  - The model's origin `(0, 0, 0)` must be placed directly at the bottom soles of the character's feet.
  - The model should be horizontally centered at `x = 0`, `z = 0`.
- **Target Height**:
  - Default humanoid hero height is **1.8 meters**.
  - The asset pipeline automatically normalizes height to the configured `targetHeight` in the character JSON, but authoring models at real-world scale (1.7m–1.9m) prevents precision loss.

---

## 2. Polycount & Asset Budgets

| Asset Type | Maximum Triangles | Recommended Materials | Max Texture Dim | Target File Size |
| :--- | :--- | :--- | :--- | :--- |
| **Hero / Player** | **40,000 tris** | ≤ 4 | 2048 × 2048 | < 20 MB |
| **Bosses** | **60,000 tris** | ≤ 6 | 2048 × 2048 | < 30 MB |
| **Standard Enemies** | **25,000 tris** | ≤ 3 | 2048 × 2048 | < 15 MB |
| **Weapons / Props** | **5,000 tris** | ≤ 2 | 2048 × 2048 | < 5 MB |

---

## 3. Texture & Material Rules

- **PBR Standard Workflow**:
  - Metalness / Roughness workflow (`MeshStandardMaterial`).
  - Textures:
    - **BaseColor / Albedo**: sRGB color space.
    - **Normal Map**: Linear color space, OpenGL tangent space (+Y up).
    - **Metallic / Roughness / AO**: Packed (e.g. ORM: Occlusion = R, Roughness = G, Metalness = B).
    - **Emissive Map**: Kept intact for bloom effects.
- **Maximum Resolution**: **2048 × 2048** (2K). Secondary props should use 1024 or 512.
- **Filtering**: Pipeline automatically applies anisotropic filtering (`8x` or hardware max) and sets `colorSpace = SRGBColorSpace`.

---

## 4. Rigging & Skeleton Rules

- **Rest Pose**:
  - **A-Pose** or **T-Pose**.
  - Open, relaxed hands with palms facing downward or slightly inward.
  - Fingers extended with slight natural curvature.
- **Hierarchy**:
  - Single root bone (`Root` or `Hips`) located at or above origin.
  - Standard humanoid biped hierarchy:
    ```
    Root
      └─ Hips
          ├─ Spine ─ Spine1 (Chest) ─ Neck ─ Head
          │   ├─ LeftShoulder ─ LeftArm ─ LeftForeArm ─ LeftHand
          │   └─ RightShoulder ─ RightArm ─ RightForeArm ─ RightHand
          ├─ LeftUpLeg ─ LeftLeg ─ LeftFoot ─ LeftToeBase
          └─ RightUpLeg ─ RightLeg ─ RightFoot ─ RightToeBase
    ```
- **Supported Presets**:
  - **Mixamo**: `mixamorig:Hips` or `mixamorig_` prefixes.
  - **SMPL**: `m_avg_Pelvis`, `m_avg_Spine1`, `m_avg_L_Shoulder`, etc.
  - **Quaternius / Rigify**: `DEF-hips`, `shoulder.L`, `thigh.L`, etc.
  - **Custom**: Custom user mapping defined in `character.json`.

---

## 5. Animation Conventions & Root Motion

- **Locomotion In-Place**:
  - All locomotion clips (`walk`, `run`, `sprint`) must play **in-place**.
  - The pipeline automatically strips/neutralizes horizontal X and Z translation when `rootMotion: "none"`.
  - Movement is driven by the Rapier kinematic physics controller.
- **Attacks & Displacements**:
  - Attacks use the data-driven `lungeDistance` from `src/data/attacks.ts` as the single source of truth for horizontal displacement.
- **Time-Warping to Combat Data**:
  - Attack clips define `activeStart` and `activeEnd` timestamps in `character.json`.
  - The controller segments the clip into startup, active, and recovery phases, matching the combat state machine frame-by-frame.
- **Animation Events**:
  - Clips can define events: `hitboxOn`, `hitboxOff`, `footstepLeft`, `footstepRight`, `vfxSpawn`, `soundCue`, `comboWindowOpen`.
  - Declared in `public/assets/animation-events/<library>.json`.
  - Combat state machine listens to these events to activate and deactivate hitboxes.

---

## 6. Sockets (Attachment Points)

Named sockets attach equipment, weapons, and particle emitters to specific skeleton bones:
- `rightHandSocket`: Weapon / Staff grip point.
- `backSocket`: Sheathed weapon mount point.
- `headSocket`: Helmets / Head VFX.
- `chestSocket`: Chest hit targets / Torso lights.

Configured with local position `[x, y, z]` and rotation `[rx, ry, rz]`, editable live in `/viewer`.

---

## 7. How to Register a New Character

1. Place character `.glb` in `public/assets/characters/<id>.glb`.
2. Create definition in `public/assets/characters/<id>.json`:
   ```json
   {
     "id": "my_hero",
     "name": "My Hero",
     "modelAssetId": "my_hero",
     "targetHeight": 1.8,
     "forwardFix": 0.0,
     "skeletonType": "mixamo",
     "boneMap": { ... },
     "sockets": { ... },
     "animationMap": { ... }
   }
   ```
3. Register in `public/assets/manifest.json`:
   ```json
   "my_hero": {
     "id": "my_hero",
     "name": "My Hero",
     "glbPath": "/assets/characters/my_hero.glb",
     "definitionPath": "/assets/characters/my_hero.json"
   }
   ```
4. Open `http://localhost:5173/viewer` to validate and tweak sockets.

---

## 8. New Model Checklist

- [ ] Export as binary `.glb` with Draco compression or meshopt.
- [ ] Geometry scale applied (`Ctrl+A -> Apply All Transforms` in Blender).
- [ ] Model faces **+Z forward** and feet rest at **Y = 0**.
- [ ] Rest pose is clean T-pose or A-pose.
- [ ] Triangles under budget (Hero ≤ 40k, Enemy ≤ 25k, Boss ≤ 60k).
- [ ] Max texture dimension is 2048px or lower.
- [ ] Bones mapped to standard humanoid convention (Mixamo, SMPL, or Quaternius).
- [ ] Validated clean in the `/viewer` validation panel.

---

## 9. Troubleshooting Guide

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **Model disappears at certain camera angles** | Skinned mesh bounding box culling | Handled automatically (`frustumCulled = false` applied by pipeline). Ensure root bone is not scaled to 0. |
| **Character facing wrong direction (backwards or sideways)** | Export forward axis was -Z or +Y | Set `forwardFix: 3.14159` (180°) in `character.json` or fix export settings. |
| **Weapon floats away from hand** | Hand socket bone name mismatch or wrong offset | Adjust socket offset and bone name using the Socket Editor in `/viewer`. |
| **Feet sink into floor or float on stairs** | Foot IK disabled or ray length too short | Ensure Foot IK is toggled ON in F1 Debug panel; check ankle offset. |
| **Locomotion slides / ice-skates** | Clip playback speed mismatched with controller speed | Tune `strideLength` in `character.json` under `animationMap.walk` or `run`. |
| **Procedural Fallback active** | Missing GLB or logical clip name not in animation map | Check debug panel monitor for reason. Drop file in path specified. |
