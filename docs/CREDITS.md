# Lightbringer Asset Credits & Licenses

This document tracks all 3D character models, props, animation libraries, textures, sound effects, and shaders utilized in **LIGHTBRINGER**.

---

## Characters

| Asset ID | Asset Name | Source / Author | License | Original URL | Modifications |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `player_test` | Hero Test (Mixamo Rig) | Code-Generated / In-Engine | MIT | N/A | Procedural humanoid skinned rig |
| `player_smpl` | Hero Test (SMPL Rig) | Code-Generated / In-Engine | MIT | N/A | Procedural humanoid SMPL academic rig |
| *(Example)* `hero_paladin` | Paladin Knight GLB | *Author Name* | CC0 / CC-BY 4.0 | *https://...* | Rescaled to 1.8m, optimized textures |

---

## Animation Libraries

| Library ID | Library Name | Source / Author | License | Original URL | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `humanoid_basic` | Basic Humanoid Combat Pack | Code-Generated / In-Engine | CC0 | N/A | Idle, Walk, Run, 3 Light Attacks, Heavy Smash, Dodge, Hit, Stagger, Death |
| *(Example)* `mixamo_combat` | Mixamo Unarmed Pack | Adobe Mixamo | Mixamo End User License | *https://mixamo.com* | Retargeted, root motion neutralized |

---

## Props & Environment

| Asset ID | Description | Source / Author | License | Original URL |
| :--- | :--- | :--- | :--- | :--- |
| `training_staff` | Wooden Combat Staff | Lightbringer Core | MIT | N/A |
| `graybox_arena` | Graybox Obstacles & Stairs | Lightbringer Core | MIT | N/A |

---

## Asset Submission Template

When adding a new asset to `public/assets/`, append an entry above following this format:

```markdown
| `asset_id` | Name | Author | License (CC0, CC-BY, etc.) | Source Link | Notes & Modifications |
```
