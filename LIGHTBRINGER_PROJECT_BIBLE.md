# LIGHTBRINGER: Project Bible

> **Working title:** Lightbringer
> **Genre:** 3D open-world action RPG, runs in the web browser
> **Document purpose:** The single source of truth for the story, vision, design, architecture, decisions, current status, and roadmap. Paste or attach this file whenever starting a new AI session so the assistant has full context.
> **Last updated:** October 13, 2026

---

## How to use this document

- **Section 1-3** explain *what* the game is and *why* (vision, story, world).
- **Section 4-7** explain *how it plays* (characters, powers, combat, survival).
- **Section 8-9** explain *how it looks and sounds*.
- **Section 10-13** explain *how it is built* (tech, architecture, pipelines).
- **Section 14** is the **decision log**: every choice we locked, with reasons.
- **Section 15** is **where we are right now**.
- **Section 16** is the **roadmap**.
- **Section 17-19** cover open questions, risks, and licensing.
- **Appendices** hold the prompt library index, glossary, and checklists.

**Legend for certainty:**
- **[LOCKED]**: decided by the creator.
- **[WORKING]**: a name or detail invented during planning, safe to change.
- **[ASSUMED]**: an interpretation made to fill a gap, needs creator confirmation.
- **[FUTURE]**: designed for, but not built yet.

---

## 1. Vision

### 1.1 One-line pitch
You are the reincarnated last witch of a lost city of light. The sun died 2,000 years ago, and a monster-god called the Sovereign rules the darkness. Rekindle your light, survive the night, and in the end become the new sun.

### 1.2 The feeling we are chasing
- **Darkness with islands of warm light.** The world is nearly black, teal, and violet. Gold-white light (the player's, and nothing else's) is the only warm color. Players should feel the player's light as hope, shelter, and power.
- **Elden Ring / Zelda-style action.** Weighty, readable, fair combat built on timing, stamina, and dodging.
- **A world that glows.** Bioluminescent fungi, glowing marshes, and mycelium veins create landmarks and mood. Glow is both beauty and the survival economy.
- **Music and sound that reacts.** Every region has its own theme. Combat triggers a different song. A boss gets its own. All procedurally generated in code.
- **A story with a payoff.** The ending twist (the player becomes the sun) recontextualizes everything: the gold light, the warm color rules, the whole palette.

### 1.3 Design pillars
1. **Light is everything.** Light is the health bar, the resource, the weapon, the navigation aid, the story, and the ending.
2. **Feel over feature count.** Combat feel (timing, hit-stop, camera shake, sound) matters more than the number of abilities.
3. **Data-driven always.** Regions, enemies, attacks, items, and music are data files. Adding content should rarely need new engine code.
4. **Build small, review often.** One step at a time, each step playable and reviewed before the next.
5. **Code-generate the world, AI-generate the cast.** Terrain, plants, rocks, water, and wind come from code. Only characters and a few hero pieces are generated models.
6. **Always runnable.** Every system degrades gracefully. A missing model becomes a stand-in. A missing texture becomes procedural. The game never crashes for lack of an asset.

### 1.4 Target platform
- **Desktop browsers** (Chrome and Edge as primary targets). [LOCKED]
- **Keyboard and mouse only.** No gamepad, no mobile, at least for now. [LOCKED]
- **Performance target:** 60 fps on a mid-range laptop at Medium quality, with a Low preset for weaker machines.
- Creator's machine: **no good GPU** [LOCKED], so all 3D model generation uses hosted tools and free tiers, and the game itself must be performance-conscious.

---

## 2. The Story

### 2.1 Backstory [LOCKED]
About **2,000 years ago, the entire world lost its sun.** The loss plunged the world into an apocalypse of endless night, and the same event **brought the Sovereign into the realm**, a ruler of the darkness.

Survival depends on **gathering bioluminescent resources**, the only reliable light left in the world.

### 2.2 The protagonist [LOCKED]
The player is the **reincarnation of the last witch of Aelindra**, known as the **Lightbringer**. Aelindra was [WORKING] a city of light-witches who held back the dark. She was the last of her order. Reborn after 2,000 years, she wakes with only a fragment of her former power.

### 2.3 The mystery [LOCKED]
The player must **uncover the Sovereign's true origin.** (The answer is not yet written. See Open Questions.)

### 2.4 The arc [LOCKED]
1. **Awakening:** She wakes weak, finds her first power, and learns to survive.
2. **Reclaiming power:** She gathers light, grows stronger, rescues the mythical dragon-bird (unlocking flight), and unlocks her full set of light abilities.
3. **Uncovering the truth:** She learns the Sovereign's true origin.
4. **Confrontation:** After regaining her full power, she attacks and defeats the Sovereign.
5. **The twist:** In the ending, **she becomes the new sun.**

### 2.5 The twist as a design anchor
The twist must be seeded from the first minute:
- Her light is **warm gold-white**, the only warm color in an otherwise cold world.
- Light is her resource, her health-like meter, and her weapon.
- Shrines, statues, and ruins of Aelindra reference the sun and light-witches.
- Note: **this twist is not part of the first playable slice.** It lives in `docs/DESIGN.md` as the north star.

### 2.6 Vertical slice story scope [LOCKED]
The first playable version covers only:
- Awakening in a ruined Aelindra shrine.
- Receiving the first light power (Light Beam).
- Exploring the first region (the Glimmerwood).
- Fighting a regular enemy (the Duskhusk).
- Defeating the first boss (Ser Caldrith).
- A short dialogue hinting at the Sovereign's origin.
- An end-of-slice screen.

It does **not** include: the dragon-bird rescue, flight, the Sovereign, the sun twist, or other regions. [LOCKED]

---

## 3. The World

### 3.1 The setting
A sunless world, **2,000 years into endless night.** There is no sky light, no day cycle (in the slice), and no sun. The only light comes from:
- The player (warm gold-white).
- Bioluminescent life (cyan, toxic green, magenta).
- Lumen Shrines (warm, safe).

### 3.2 Color language (art-direction rule)
| Color | Meaning |
|---|---|
| Near-black teal / deep violet | The default, hostile world |
| Cyan, toxic green, magenta | Natural bioluminescence (resources, flora, water) |
| **Warm gold-white** | **Player power, shrines, hope, the future sun. Used for nothing else.** |
| Pale sickly light | Corruption (e.g., the boss's glowing seams) |

### 3.3 The first region: the Glimmerwood [LOCKED setting, WORKING name]
A **dead glowing forest**: giant bioluminescent fungi, rotting trees, shallow glowing marshes, and ruins of Aelindra.

Planned size: about **1400 m x 1400 m**, with natural borders (cliffs, thorn walls, fog), so there are no invisible walls. A direct run from spawn to boss takes about 5-10 minutes. Full exploration takes 30+ minutes.

### 3.4 Glimmerwood zones [WORKING]
| # | Zone | Description |
|---|---|---|
| 1 | **Awakening Shrine** (southwest, spawn) | Ruined Aelindra shrine on a low hill. First Lumen Shrine. Calm and sparse. |
| 2 | **Spore Hollow** | Dense giant-fungus grove. Cyan/green. First Duskhusk camp (2-3). |
| 3 | **The Rotwood** | Dead timber, heavy fog, thorn clutter, darker and scarier. Duskhusk patrols. |
| 4 | **Mirelight Shallows** | Glowing shallow marsh, bone reeds, a stone causeway. Magenta accents. Duskhusk groups (3). |
| 5 | **Ashen Ridge** | Rocky cliffs and spires. A viewpoint that first reveals the boss court. A ruined watchtower. |
| 6 | **Aelindra Outskirts** | Ruined gatehouse and wall, collapsed road, second Lumen Shrine. Toughest regular encounter (3-4 Duskhusk). |
| 7 | **The Hollow Guard's Court** (northeast) | Circular boss arena (30 m+ open diameter), fog-gated entrance, a third Lumen Shrine just outside. |

### 3.5 Landmarks (visible from afar)
- A huge glowing Umbrella Titan "beacon" near the spawn.
- A toppled giant witch statue lying across a valley.
- A broken tower on the ridge.
- The pale glow of the boss court above the treeline.

### 3.6 Water
Water is **shallow only (max ~1 m), wade-able, no swimming.** [LOCKED]. This avoids building swimming, underwater rendering, and deep-water collision.

### 3.7 Future regions [FUTURE]
Additional regions are planned but are **not designed yet.** The architecture ensures each new region is a new data file plus its own ruin/flora kit.

---

## 4. Characters

### 4.1 The Witch / Lightbringer (player) [LOCKED concept]
- Young woman in her mid-twenties, lean and athletic, weary but determined.
- Pale skin with faint **gold sigil lines** on her collarbones and the backs of her hands.
- Dark hair in a short, tight braid.
- Worn gear: cropped tattered off-white ceremonial robe with gold trim, dark leather vest and belt with small pouches, fitted dark trousers, wrapped leather boots, fingerless gloves, a short close-fitting shoulder mantle.
- Weapon: a **light-infused staff** [ASSUMED]. The staff is a separate model attached to the hand socket, with a dark unlit crystal head that we make glow in code.
- **Design rules for rigging:** no long cape, no long flowing hair, no loose dangling parts (these generate and deform badly). A cloak and hair motion get added in code later.
- **Status:** concept images generated (front and back). Next: Meshy image-to-3D.

### 4.2 Duskhusk (regular enemy) [WORKING name]
- Gaunt, elongated humanoid born of the endless night, about 2 m tall, slightly stooped.
- Charcoal skin cracked like burnt bark, faint cold violet glowing veins.
- Overlong thin arms with clawed hands, no eyes (smooth hollow sockets).
- Tattered rags clinging tightly.
- **Weak to light** (takes extra damage from light attacks).
- Deliberately **humanoid on the same skeleton as the witch and boss**, so one shared animation library works for all three.

### 4.3 Ser Caldrith, the Hollow Guardian (boss) [LOCKED type, WORKING name]
- A corrupted former knight-guardian of Aelindra, about 2.4 m tall.
- Heavy plate armor, once white and gold, now blackened and cracked, with gold sigils dimly glowing a sickly pale color through the cracks.
- Closed helm with a narrow visor showing only emptiness, cold light leaking from visor and seams.
- Massive greatsword (separate prop model), not fused to the body.
- **2-3 phases** with distinct moves and clear telegraphs.
- Phase transitions shift music and lighting.

### 4.4 The Sovereign [FUTURE]
The ruler of the darkness and the final antagonist. Design, origin, and appearance are **not yet defined.**

### 4.5 The Dragon-Bird [FUTURE]
A mythical creature the player rescues, which unlocks flight. Planned to be animated **procedurally in code** (wing flaps, spring-driven tail and neck, flight banking), since auto-rigging for winged and quadruped creatures is weak. [WORKING plan]

---

## 5. Light Powers

All abilities run on the **Light** resource (see Survival).

| Power | Description | Status |
|---|---|---|
| **Light Beam** | Focused ranged beam. Damages and repels darkness creatures. Duskhusks take extra damage. | **In the slice** |
| **Light Shield** | A protective barrier of light. | [FUTURE] stub |
| **Light Burst** | A flash that **blinds enemies and briefly stuns them.** | [FUTURE] stub, [ASSUMED] interpretation |
| **Light Barrage** | **Violent rays of light erupting around the player.** | [FUTURE] stub |
| **Radiant Flight** | Flight, unlocked after rescuing the dragon-bird. | [FUTURE] stub |

> **[ASSUMED] note:** The original wording was "light beams, light shield, light barge that makes enemies blind and temporarily stunned" plus a separate "light barrage skill that makes violent light rays around you." We interpreted the first as **Light Burst** (blind and stun) and the second as **Light Barrage** (rays around the player). Confirm or rename.

The ability system must be built as a **framework** so all five slot in later with only data and a small amount of code.

---

## 6. Core Gameplay

### 6.1 Camera and controls [LOCKED]
- **Third-person over-the-shoulder** camera with collision, smoothing, and soft target assist. Optional lock-on is a stretch goal.
- **Keyboard and mouse only.**

| Key | Action |
|---|---|
| W A S D | Move (relative to camera) |
| Mouse | Look |
| Shift | Sprint |
| Space | Dodge roll [ASSUMED binding; jump moved to another key, final binding set by Step 2] |
| Left mouse | Light attack |
| Right mouse | Heavy attack |
| 1-4 | Abilities (Light Beam on 1) |
| E | Interact / gather / rest |
| Tab | Inventory |
| C | Crafting |
| Esc | Pause / release mouse |
| F1 | Debug panel (development) |

### 6.2 Combat (Elden Ring / Zelda style) [LOCKED]
**Core loop:** light attacks, heavy attacks, dodge roll, stamina bar.

**Player state machine:** Locomotion (idle/walk/sprint/airborne), Dodge, AttackLight(n), AttackHeavy, HitReact, Stagger, Dead. Illegal transitions are impossible. An input buffer (~0.2 s) queues inputs pressed late in recovery.

**Stamina:**
- Max 100, regen 25/s after a 1.0 s delay (paused while sprinting, attacking, dodging).
- Costs: sprint 12/s, light attack 15, heavy attack 30, dodge 20.
- Actions may dip stamina to zero but not start with less than 1.
- Exhausted window (~1.2 s) with delayed regen.

**Attack frame data (defaults, all live-tunable):**

| Attack | Startup | Active | Recovery | Damage | Notes |
|---|---|---|---|---|---|
| Light 1 | 0.18 s | 0.10 s | 0.28 s | 20 | small lunge 0.4 m |
| Light 2 | 0.16 s | 0.10 s | 0.30 s | 22 | opposite swing direction |
| Light 3 (finisher) | 0.22 s | 0.14 s | 0.50 s | 32 | bigger knockback and shake |
| Heavy | 0.55 s | 0.16 s | 0.60 s | 55 | high poise damage, forces stagger on dummy |

**Dodge roll:** 0.45 s duration, about 4.5 m with ease-out, **i-frames from 0.05 s to 0.25 s**, 0.15 s recovery. Cancels out of attack recovery (not startup/active). With no direction held, it hops backward.

**Hit detection:** swept/overlap queries only during active frames, from a hitbox on the staff pivot. Each swing hits each target at most once. Debug view draws hitboxes (red when active) and hurtboxes (green).

**Game feel (mandatory, not optional polish):**
- Hit-stop (~0.05 s light, ~0.09 s heavy).
- Camera shake from attack data.
- Staff swing trail.
- Spark/ring impact particles.
- Dummy wobble and flash.
- Soft aim assist (~3 m, ~45 degrees).

**Player health:** 100. Death respawns at the last Lumen Shrine and keeps boss progress.

### 6.3 Enemy AI [FUTURE, not yet built]
Finite state machine: idle, patrol, alert, chase, attack, stagger, blinded, dead. Telegraphed attacks, sight and sound perception.

### 6.4 Boss fight design [FUTURE, not yet built]
Dedicated arena, fog gate, 2-3 phases, large boss health bar, phase-transition beat (music and lighting shift), readable telegraphs.

---

## 7. Survival (medium depth) [LOCKED]

Three stats: **Health, Stamina, Light.**

- **Light** is an inner-light meter that doubles as the **darkness meter.**
- Standing in darkness slowly drains Light. Being near light sources, bioluminescent flora, or a shrine restores it.
- At zero Light, powers are disabled and the player takes slow damage.
- **Gathering:** bioluminescent resources (Lumen Shards, Glow-Spore Plants, Lumen Cap Clusters) gathered with **E**.
- **Crafting:** simple, at shrines and anywhere for basics. Examples: light-tonics (restore Light/Health), lumen charges (boost Light), a handheld lantern.
- All items, recipes, and resource tables are data files.
- **Lumen Shrines:** checkpoints, respawn points, rest and craft locations, and safe zones.

> Explicitly **not** in scope: hunger, base building, heavy survival systems.

---

## 8. Visual Direction [LOCKED]

**Semi-realistic dark fantasy**, heavy style. We accepted the performance cost knowing it is the hardest style for a browser.

### 8.1 Lighting model (replaces the temporary test sun)
- **No sun, no hard directional light** in the real game.
- Very dim cold hemisphere ambient, tinted teal/violet.
- Strong exponential-squared fog in dark teal-violet, which also drives the background.
- **Player light:** warm gold-white point light at chest height, the dominant light, with tunable flicker, optional soft shadows on Medium/High.
- **Light pool:** a fixed small number (default 6) of real point lights assigned to the nearest glowing sources. Everything else glows via emissive materials plus bloom.
- A debug "daylight" preset keeps the old test sun available.

### 8.2 Post-processing
ACES filmic tone mapping, luminance-threshold bloom (so only glowing things bloom), SMAA, subtle vignette, very subtle film grain, optional mild chromatic aberration, color grading. Depth of field off by default.

### 8.3 Atmosphere
GPU-instanced floating spores, ground mist, fake volumetric light shafts, and a dark gradient sky dome with faint slow aurora-like bands. No sun or stars.

### 8.4 Materials
PBR everywhere. **Free CC0 texture sets** (ambientCG, Poly Haven) supply ground, bark, rock, and stone. Triplanar texturing avoids stretching on displaced geometry. Shader-based wear (moss on up-facing surfaces, dampness near ground, cracks in crevices). Per-instance variation of scale, rotation, tint, wind phase, and glow phase.

### 8.5 Quality presets
Low / Medium / High, controlling shadows, bloom, particle counts, view distance, foliage density, and texture layers.

---

## 9. Audio Direction [LOCKED]

**Everything is generated procedurally in code. No audio files.** [LOCKED]

### 9.1 Tech
Web Audio API (Tone.js allowed for sequencing). Master, music, and SFX buses with volume sliders. Unlock on first user click to satisfy browser autoplay rules.

### 9.2 Sound effects (synthesized)
Footsteps (surface-aware), staff swings, hits, dodge, beam, UI sounds, ambient wind and drips, enemy vocalizations, boss roars, shrine resting cue.

### 9.3 Music system
- Generative, layered music **defined as data** (key/scale, tempo, instrument patches, layer rules).
- **Each region has its own explore theme.**
- A **combat theme** plays during normal fights.
- A **boss theme** plays for Ser Caldrith, with multi-phase intensity layers.
- Beat-quantized crossfades.
- State machine: **explore, combat, boss, victory, death.**
- Slice needs: Glimmerwood explore theme, combat theme, boss theme, a short victory sting.
- Adding a new region's theme must require only a new data file.

> **Honest limit:** Claude cannot generate audio files, but can write the code and the musical "DNA" (scale, tempo, instrumentation, mood). Procedural music can sound atmospheric and dynamic. Expect to iterate heavily to make it sound *good*.

---

## 10. Technology Stack [LOCKED]

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript (strict)** | Safety for a large codebase |
| Bundler | **Vite** | Fast dev loop |
| 3D engine | **Three.js** | Most examples and training data, so AI scaffolding is most reliable. Strong support for bloom, fog, dynamic lights |
| Physics | **Rapier** (`@dimforge/rapier3d-compat`) | WebAssembly, fast. Kinematic character controller, heightfield colliders |
| Post-processing | **pmndrs `postprocessing`** | Selective bloom, SMAA, tone mapping |
| Audio | **Web Audio API** (Tone.js optional) | Procedural audio |
| UI | **Plain DOM/CSS** | Simple HUD and menus, no framework |
| Debug | **lil-gui + stats.js** | Live tuning |
| Quality tools | ESLint, Prettier, Vitest | Linting, formatting, tests |
| Model loading | GLTFLoader + DRACOLoader + MeshoptDecoder | Compressed GLB support |

**Considered and rejected:** Babylon.js (strong runner-up, more built in, but less AI-scaffolding data), React Three Fiber (unneeded layer for a game this stateful).

### 10.1 Performance budgets
- Under 1,500 draw calls and under 3 M visible triangles in the densest area, on Medium, 60 fps on a mid-range laptop.
- Per-asset triangle budgets: hero 40k, boss 60k, enemy 25k, props 5k, Umbrella Titan LOD0 8k, other fungi 2k, trees 5k, rocks 1.5k.
- Textures: 2K max, PBR.
- No per-frame allocations in hot paths. Fixed-timestep logic with interpolated rendering. Frame-rate-independent timing (test at 60 and 144 Hz).

---

## 11. Architecture

### 11.1 Guiding principles
1. **Data-driven.** Gameplay values and content live in typed data files, not in logic. No magic numbers outside `data/` and config.
2. **Modular.** Adding a region, enemy, ability, item, or music theme is a data change plus minimal code.
3. **Decoupled systems via a typed event bus** (`hit`, `damaged`, `dodged`, `staminaDenied`, `death`, `gathered`, `bossEncounterStart`, and so on), so audio, VFX, and UI subscribe without touching combat code.
4. **Logic and visuals decoupled.** The state machine requests *logical* animation names. The animation controller decides what plays them.
5. **Graceful degradation.** Missing model: stand-in. Missing clip: procedural pose. Missing texture: procedural texture. The game always runs.
6. **Deterministic world.** Same seed, same world. Everything generated from `(seed, chunk coordinates)`.
7. **Isolated lighting module**, so the temporary test sun was replaceable without touching other code.

### 11.2 Target folder structure
```
src/
  main.ts
  core/        game loop, input, fixed timestep, events, state, save/load
  engine/      renderer, physics world, camera rig, lighting/, post/, debug
  assets/      manifest, loader, fixups, cache, hot reload
  animation/   controller, layers, retargeter, timewarp, events, footIK,
               canonicalBones, bonePresets
  player/      controller, states/, stateMachine, inputBuffer, animation glue
  combat/      hitbox queries, damage, hit-stop, health, poise, abilities/, AI/
  entities/    trainingDummy, enemies, boss
  survival/    stats, inventory, crafting, resources
  world/
    terrain/   heightFunction, features, stamps, chunkManager, chunkWorker,
               terrainMaterial, colliders
    water/     waterBodies, waterMaterial, wading
    atmosphere/ spores, mist, lightShafts, sky
    wind/      windSystem, shader chunk
    flora/     archetypes, generators/, materials/, lod, instancing
    scatter/   rules, poisson, scatterWorker, chunkScatter, exclusion, query
    gatherables/
    kits/      kitDefinition, proceduralPieces/, assembler, structureGrammar, damagePass
    entities/  lumenShrine, bossGateTrigger, enemySpawnMarkers
    validation/ mapValidator
  audio/       engine, sfx/, music/, themes/
  ui/          hud, menus, dialogue
  viewer/      model viewer, flora showcase, map view (dev routes)
  testing/     code-generated test rigs and clips
  data/        attacks, playerConfig, regions/, flora/, kits/, items, recipes,
               enemies, abilities, dialogue, schemas
public/assets/ manifest.json, characters/, models/, animation-events/, textures/
docs/          DESIGN.md, ARCHITECTURE.md, ASSET_PIPELINE.md, KIT_PIECES.md, CREDITS.md
```

### 11.3 Key systems

**Player state machine.** Hierarchical, explicit transitions, validated centrally. Each state defines enter/exit/update, allowed transitions, movement modifiers, and invulnerability.

**Region data.** One typed file per region defines size, seed, terrain parameters, fog, palette, water, wind, music theme ids, features, stamps, zones, scatter rules, landmarks, structures, resources, and spawn points.

**Streamed terrain.** 64 m chunks, generated in a Web Worker, pooled, 3 LOD levels with crack-free stitching, deterministic height function with features and stamps (radial hills, basins, flatten pads, spline-carved paths), synchronous `getHeight/getNormal` for gameplay, Rapier heightfield colliders near the player only.

**Light pool.** `registerGlowSource(...)` lets any system declare a glow. The manager assigns a small fixed number of real lights to the nearest sources, smoothly.

**Wind system.** Global direction and gusts exposed as shader uniforms, with a reusable GLSL chunk any material can use. Spores and mist read it too.

**Archetypes (flora/rocks/trees).** Each is data (generator id, parameter ranges, material, LOD, collider, glow, wind). Generator functions produce geometry variants from `(seed, params)`. A GLB in the manifest with the same id overrides the procedural version.

**Scatter engine.** Rule-driven (`scatterRules` in region data): Poisson-disc spacing, slope/height/water-distance filters, noise masks, exclusion zones, priority order. Chunk-aligned, worker-generated, deterministic, committed to pooled InstancedMeshes.

**Kit and assembler.** A modular piece set (16 pieces for the Glimmerwood) with snap sockets and damage variants. A structure grammar and seeded damage pass assemble ruins. Structures emit terrain stamps and scatter exclusions so ground and vegetation fit.

**Animation controller.** Built on `THREE.AnimationMixer` with cross-fading, layers (base, masked upper-body, additive hit reactions), time-warp to combat frame data, animation events through the bus, and a procedural fallback.

### 11.4 Dev tooling (treated as first-class)
- **F1 debug panel** with live-tunable everything.
- **`/viewer`**: model viewer and validator (clips, retargeting test, skeleton, sockets, validation report).
- **`/flora`**: archetype showcase with budgets.
- **`/map`**: top-down map with click-to-teleport.
- **Map validator**: checks path continuity, shrine spacing, water depth, resource and spawn placement.
- **Fly-cam**, chunk-streaming freeze, hitbox view, collider wireframes, light-pool view.

---

## 12. Asset Pipeline (Models)

### 12.1 The core decision [LOCKED]
The creator **cannot hand-model.** Characters are **AI-generated from concept art** and rigged with free tools. The world is **code-generated.**

### 12.2 Three content categories
| Category | Method | Examples |
|---|---|---|
| **AI-generated** | Concept art, then image-to-3D, rig, animate | Witch, Duskhusk, Ser Caldrith, dragon-bird (later), a few hero props |
| **Pure code** | Shaders, noise, math | Terrain, water, wind, sky, fog, spores, grass, rocks, fungi, trees, glow |
| **Hybrid kit** | ~16 modular pieces, assembled by code | Ruins, shrines, walls, arches, causeway, boss arena |

### 12.3 Character generation workflow
1. **Style anchor.** Generate one world-style concept board, and use it as a reference for all later images.
2. **Concept image** per character: full body, front view, A-pose, hands open and relaxed, flat shadowless lighting, plain gray background, no props in hands. Then a matching **back view**.
3. **Image-to-3D** in a hosted tool (Meshy is the first choice): multi-image input, A-pose, symmetry on, PBR textures, ~30k-40k tris for the hero, GLB export. Generate 3-4 variants and pick the best.
4. **Rig** with a free auto-rigger (Cinevva Auto Rigger, Mixamo, or Sorceress), placing joint markers carefully.
5. **Export rigged GLB with no baked animations.** Animations come from a shared library and are retargeted.
6. **Place files** (`public/assets/models/...`) and register in the manifest.
7. **Log credits** in `CREDITS.md`.

### 12.4 Rules that decide success
- Image-to-3D, not text-to-3D.
- Flat even lighting in concept art (shadows get baked into textures).
- Weapons generated separately.
- No long capes, flowing hair, dangling chains on characters.
- Always generate multiple variants.

### 12.5 The witch is the risk
She is on screen constantly. Her face and hands will be judged hardest. Expect many variants and possible Blender cleanup. A hood-up variant is the backup.

### 12.6 Design decision that saves work
**The witch, Ser Caldrith, and the Duskhusk all share one humanoid skeleton**, so a single animation library serves all three. Only the boss needs a few unique moves.

---

## 13. Animation Pipeline

### 13.1 Reality check
There is no free one-click "hand-animator quality." The approach is a hybrid: **shared humanoid library + runtime retargeting + procedural polish in code.**

### 13.2 Animation sources (researched October 2026)
| Source | Notes |
|---|---|
| **Quaternius Universal Animation Library** | CC0, 250+ animations. Our **safe, license-clean base** |
| **Mixamo** | Free with Adobe ID, royalty-free for games, but in **maintenance mode**, humanoid T-pose only, auth-related features have been unreliable since June 2025 |
| **Cinevva** (browser) | Free auto-rigger (biped and quadruped) and text-to-motion exporting GLB/BVH |
| **Sorceress 3D Studio** | Browser auto-rigger for humanoids and creatures, chains into text-to-animation |
| **Ludo.ai / Meshy** | 640+ motion presets / animation API. Credit-limited, reserve for the witch |
| **Blender Rigify** | Full manual control if ever needed |

**Weak spot:** creature animation. Auto-rigged quadrupeds typically get little beyond a walk cycle, so the dragon-bird is procedural.

### 13.3 Code-side techniques (built in Step 3A and 3C)
- **Runtime retargeting** through a canonical humanoid bone map, with presets for Mixamo, SMPL-style, and Quaternius/Rigify names, auto-detected.
- **In-place locomotion** with stride-based playback speed to reduce foot sliding. Attack displacement comes from `attacks.ts` lunge data.
- **Layered animation:** base locomotion, masked upper-body (attack/cast while running), additive hit reactions.
- **Time-warp to combat data:** attack clips are stretched so their `activeStart/activeEnd` markers match the data timings, keeping animation and hitboxes in sync.
- **Animation events** (hitboxOn/Off, footsteps, vfxSpawn, soundCue, comboWindowOpen) stored in JSON and emitted on the bus.
- **Two-bone foot IK** with ground raycasts, pelvis adjustment, and ground-normal alignment.
- **Procedural fallback poses** whenever a clip is missing.
- **Later polish (Step 3C):** spring-bone cloak and hair, staff glow pulsing with the Light meter, breathing and weight shifts, boss tells (glowing eyes, cracking armor, light leaking through).

---

## 14. Decision Log

| # | Decision | Status | Reason |
|---|---|---|---|
| D1 | Web game, 3D, open world | LOCKED | Creator's core vision |
| D2 | **Three.js + TypeScript + Vite + Rapier + pmndrs postprocessing** | LOCKED (recommended, accepted) | Best AI-scaffolding data, strong bloom/fog/lights |
| D3 | **Semi-realistic dark fantasy, heavy** | LOCKED | Creator's choice, accepted the perf cost |
| D4 | **Vertical slice first:** 1 region, 1 enemy type, 1 boss | LOCKED | Keeps scope achievable |
| D5 | **Over-the-shoulder action combat** (Elden Ring / Zelda) | LOCKED | Creator's choice |
| D6 | **Medium survival:** gathering, crafting, Light/darkness meter | LOCKED | Enough depth without heavy systems |
| D7 | **No hand-made models. Full AI-generated characters** (not placeholders) | LOCKED | Creator cannot model, wants final quality |
| D8 | **No good GPU, so hosted free tiers** for 3D generation | LOCKED | Creator's hardware |
| D9 | **Keyboard and mouse only** | LOCKED | Simplifies input and UI |
| D10 | First region: **dead glowing forest** | LOCKED | Creator's choice |
| D11 | Slice boss: **corrupted former guardian knight** | LOCKED | Creator's choice |
| D12 | Combat: **light/heavy, dodge roll, stamina bar** | LOCKED | Creator's choice |
| D13 | Slice story covers **awakening, first power, first region, boss** (no dragon-bird, no Sovereign tease) | LOCKED | Creator's choice |
| D14 | **All audio procedural, no audio files.** Per-region themes, separate combat and boss music | LOCKED | Creator's vision |
| D15 | **Build in small steps,** starting from an empty graybox scene | LOCKED | Creator requested smaller steps |
| D16 | **Temporary test sun** in Step 1, replaced with the sunless model in Step 4A | LOCKED | Easier to test movement in daylight |
| D17 | **Shallow water only** (max ~1 m, wade-able) | WORKING | Avoids swimming systems |
| D18 | **Humanoid-share-one-skeleton** rule for witch, Duskhusk, boss | WORKING | One animation library for all |
| D19 | **Code-generate the world, AI-generate the cast.** Procedural flora, rocks, trees, water, wind, terrain | LOCKED | Speed and scale |
| D20 | **Modular ruin kit** (16 pieces) for the first region, with procedural placeholders for every piece | LOCKED | Creator wanted only the pieces needed for region 1 |
| D21 | **Full first-region map built before enemies, boss, and audio** | LOCKED | Creator requested full map using all pieces |
| D22 | **Data-driven everything,** so new regions are new data files | LOCKED | Long-term scalability |
| D23 | **Prompts for Gemini are step-scoped** with explicit "do not build yet" lists and acceptance criteria | WORKING | Prevents scope creep and AI sprawl |
| D24 | Dodge on **Space**, jump rebound | ASSUMED | Souls-style convention |
| D25 | Names (Glimmerwood, Duskhusk, Ser Caldrith, Lumen Shrine, zone names) | WORKING | Invented during planning |
| D26 | Dragon-bird animated **procedurally** | WORKING | Auto-rigging creatures is weak |
| D27 | Light Burst / Light Barrage interpretation | ASSUMED | Original wording was ambiguous |

---

## 15. Where We Are Right Now

> **Honest status note:** This section records what we have *planned and written*. Whether each prompt has actually been run in Antigravity, and what state the code is in, **is not tracked by Claude.** The creator should update the "Execution status" column below.

### 15.1 Planning and prompts

| Step | Scope | Prompt written | Execution status (update me) |
|---|---|---|---|
| Master planning | Story, vision, stack, scope, decisions | Done | n/a |
| **Step 1** | Graybox scene + third-person controller (blocks, stairs, ramp, silhouette, camera, debug panel) | Done | ☐ Not started / ☐ In progress / ☐ Done |
| **Step 2** | Combat core (state machine, stamina, attacks, dodge, training dummy, hit-stop, HUD) | Done | ☐ |
| **Step 3A** | Asset and animation pipeline code (manifest, loader, retargeting, layers, events, foot IK, viewer) | Done | ☐ |
| **Step 3B** | Model generation guide (style anchor, concept prompts, Meshy settings, rigging, naming) | Done | ☐ (see below) |
| **Step 4A** | Dark world foundation (terrain, sunless lighting, post, water, atmosphere, wind) | Done | ☐ |
| **Step 4B** | Procedural flora, rocks, trees, gatherables | Done | ☐ |
| **Step 4C** | Ruin kit and the full Glimmerwood map | Done | ☐ |

### 15.2 Asset progress
- **Witch:** concept images (front and back) are **generated**. Next action: run Meshy image-to-3D with the recommended settings (A-pose, symmetry on, PBR, ~30-40k tris, GLB), generate 3-4 variants, and evaluate.
- **Duskhusk, Ser Caldrith:** concept prompts written, images not yet generated (as far as this document knows).
- **Props** (staff, greatsword, shrine, fungi, trees, shards, ruin set): prompts listed in the Step 3B guide, not generated.
- **Textures:** CC0 ground/bark/rock/stone sets need to be downloaded from ambientCG / Poly Haven and placed in the folders Gemini specifies. Procedural fallbacks cover the gap until then.
- **Animations:** need a CC0 library (Quaternius UAL recommended) downloaded and registered in the manifest.

### 15.3 Immediate next actions
1. Run Steps 1, 2, and 3A in Antigravity, one at a time, reviewing each.
2. In parallel, take the witch images to Meshy and generate variants.
3. Evaluate the best witch variant (check mesh, pose, hands, face), then rig it.
4. Generate Duskhusk and Ser Caldrith concepts, then models.
5. Download CC0 textures and the Quaternius animation library.
6. Continue to 4A, 4B, 4C once 3A is solid.

---

## 16. Roadmap

### 16.1 Completed planning
Steps 1 through 4C prompts (see section 15).

### 16.2 Upcoming (not yet written) [FUTURE]
| Step | Scope |
|---|---|
| **Step 3C** | Swap in real models, plus procedural polish (cloak/hair spring bones, staff glow, boss tells). Dragon-bird deferred. |
| **Step 5** | **Survival systems:** Light meter, gathering to inventory, crafting, items and recipes data |
| **Step 6** | **Abilities:** Light Beam, ability framework, stubs for Shield, Burst, Barrage, Flight |
| **Step 7** | **Enemy AI:** the Duskhusk (state machine, perception, telegraphed attacks, light weakness, blinded state), spawners from map data |
| **Step 8** | **Ser Caldrith boss fight:** phases, arena behavior, fog-gate encounter, health bar |
| **Step 9** | **Audio:** engine, procedural SFX, Glimmerwood explore theme, combat theme, boss theme, victory sting, transitions |
| **Step 10** | **UI, story, polish:** HUD finalization, menus, awakening intro, post-boss dialogue, end-of-slice screen, performance pass, save/load |

### 16.3 Beyond the slice [FUTURE]
- Dragon-bird rescue and Radiant Flight.
- Light Shield, Light Burst, Light Barrage fully implemented.
- Additional regions (each a new data file plus a kit).
- The Sovereign and the origin mystery.
- The final confrontation and the sun twist ending.
- Possible: lock-on targeting, day/dawn progression toward the sun, more enemy types, NPCs, side quests.

### 16.4 Suggested order of work
Pipeline code and model generation proceed in parallel (3A and 3B). The world is built before enemies (Step 4 before Step 7) because enemy placement and pacing depend on the map.

---

## 17. Open Questions

1. **What is the Sovereign's true origin?** The central mystery is undefined. This is the most important story question left.
2. **Why did the sun die?** Cause and connection to Aelindra's fall are not written.
3. **What was Aelindra?** City layout, culture, the nature of light-witches, and how it fell.
4. **Who was Ser Caldrith** and why did he become hollow? (Seeds the origin mystery.)
5. **What exactly are the Duskhusks?** Corrupted people, or creatures of the dark?
6. **How does the Light Burst vs. Light Barrage split work** (confirm the interpretation)?
7. **Final key bindings** (jump vs. dodge) are set in Step 2.
8. **Game title:** "Lightbringer" is a working title only.
9. **Day/dawn progression:** does the world slowly lighten as the player grows stronger?
10. **Save system** scope for the slice.
11. **Dialogue and narrative delivery:** subtitles only, or any cutscene system?
12. **Does the player have a name and voice** (text only for now)?
13. **Difficulty and checkpoint philosophy** beyond "Elden Ring-like but fair."

---

## 18. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| **Browser performance** for semi-realistic dark fantasy | Dark and fog hide pop-in and limit draw distance. Few real lights, emissive plus bloom for the rest. Instancing, LOD, chunk streaming, quality presets. Budgets enforced and reported |
| **AI model quality (the witch's face and hands)** | Many variants, head-and-shoulders portrait as a second reference, hood-up fallback, fingerless gloves, possible Blender cleanup |
| **Generated animations are inconsistent** (foot sliding, jitter) | Prefer CC0 Quaternius library, retargeting plus foot IK, curate and clean generated clips |
| **Free-tier limits and license terms** | Spend credits only on hero characters and a few props. Track every asset in `CREDITS.md` |
| **Mixamo instability** | Treat as optional. Do not depend on it |
| **Procedural code can look like "programmer art"** | Invest in materials, triplanar PBR, shader wear, variation, lighting, post-processing |
| **Procedural audio might not sound good** | Treat as a long iteration loop. Write musical DNA per theme. Accept that it may need many passes |
| **AI coding agent drift and over-scoping** | Step-scoped prompts with "do not build yet" lists and acceptance criteria, review after every step, keep this document updated |
| **Step 4C is large** | Split into 4C-1 (kit and assembler) and 4C-2 (map and validator) if needed |
| **Context loss across AI sessions** | Keep this file current, attach it at the start of every session |
| **Scope creep** | The slice is explicitly limited: one region, one enemy type, one boss |

---

## 19. Licensing and Credits

- **Meshy free tier:** outputs are **CC BY 4.0** (attribution required). Paid private tiers differ. Verify current terms before shipping.
- **TRELLIS:** MIT-licensed (open source).
- **Hunyuan3D-2:** Tencent community license **with territorial restrictions.** Check before use.
- **Mixamo:** free for commercial use including games, but you may not redistribute the raw animation or character files as a standalone pack.
- **Quaternius UAL, ambientCG, Poly Haven textures:** CC0 (no attribution required, but credit is good practice).
- **Rule:** record the **tool, date, source URL, and license** of every external asset in `docs/CREDITS.md`.
- Terms change, so re-verify each tool's license before any public release.

---

## Appendix A: Prompt Library Index

The full text of each Gemini/Antigravity prompt lives in the planning conversation. **Recommendation: save each prompt into `docs/prompts/` in the repo** (e.g. `step-1-graybox.md`) so the history and exact wording are preserved.

| File | Contents summary |
|---|---|
| `step-1-graybox.md` | Vite + Three.js + Rapier. Graybox scene with ground grid, block terrain, two staircases, ramp, platform. Silhouette character with `setModel()`. WASD/sprint/jump with coyote time and buffering, acceleration, autostep. Over-the-shoulder camera with collision. F1 debug panel. Temporary sun. |
| `step-2-combat.md` | Player state machine, input buffer, stamina rules, data-driven attacks (`attacks.ts`), dodge with i-frames, training dummy with sparring mode, hit-stop, camera shake, trails, aim assist, HUD, debug panel, event bus, Vitest tests. |
| `step-3a-pipeline.md` | Asset manifest and loader, character definition JSON, bone presets, runtime retargeting, animation controller (layers, time-warp, events, fallback), foot IK, `/viewer` with validator, code-generated test rigs, `ASSET_PIPELINE.md`. |
| `step-3b-model-guide.md` | Style anchor prompt, concept-image template, per-character descriptions, prop list, Meshy settings, rigging and export steps, witch-specific tips. |
| `step-4a-world-foundation.md` | Region data schema, streamed terrain with LOD and worker generation, terrain material with triplanar blending, sunless lighting and light pool, post-processing, atmosphere, shallow water, wind system. |
| `step-4b-flora.md` | Archetype system, giant fungi, dead trees, rocks, ground cover, glow shaders, scatter engine, gatherables, `/flora` showcase, budgets. |
| `step-4c-ruins-and-map.md` | Modular ruin kit with procedural placeholders, assembler and damage pass, Lumen Shrine entity, full Glimmerwood map (7 zones, landmarks, resources, spawn data), `/map` tool, map validator, `KIT_PIECES.md`. |

---

## Appendix B: Standing Rules for AI Coding Prompts

Use these on every Gemini/Antigravity prompt:
1. **Read the existing code first.** Extend, do not rewrite working systems.
2. **Plan before coding** (short), then build unless there is a real blocking question.
3. **Do not break earlier acceptance criteria.**
4. **Explicit "DO NOT BUILD YET" list** every time.
5. **Explicit "DONE WHEN" acceptance criteria** every time.
6. **Strict TypeScript, no `any`, no magic numbers outside data/config.**
7. **Zero console errors or warnings.**
8. **No per-frame allocations in hot paths.** Frame-rate-independent timing.
9. **Never guess download URLs** for external assets. Tell the creator which files to download and where to put them.
10. **End every step with a report:** what was built, deviations, known issues, and a suggested next step.
11. **Update `docs/ARCHITECTURE.md`** as systems are added.

---

## Appendix C: Kit Piece List (Glimmerwood, 16 pieces)

`wall_straight`, `wall_corner`, `wall_broken`, `pillar`, `pillar_broken`, `arch`, `arch_broken`, `doorway`, `floor_tiles`, `stairs`, `rubble_pile`, `statue_plinth`, `shrine_basin`, `arena_gate`, `arena_ring_wall`, `causeway_segment`.

Each ships with a **procedural placeholder**. Real GLB pieces replace them through the manifest with no code changes. Exact dimensions, pivot rules, and module sizes will be in `docs/KIT_PIECES.md` (produced by Step 4C).

---

## Appendix D: Flora and Resource Archetypes (Glimmerwood)

**Giant fungi:** Umbrella Titan, Shelf Fungus, Lumen Cap Cluster, Spore Stalk, Mycelium Veins.
**Dead trees:** Twisted Snag, Broken Stump, Fallen Log, Root Mass.
**Rocks:** Boulder, Slab, Spire, Scree Cluster.
**Ground cover:** Dead Grass, Glow Fern, Thorn Bramble, Bone Reeds.
**Gatherables:** Lumen Shard (3 sizes), Glow-Spore Plant, Lumen Cap Cluster.
**Ecological patterns:** Fungal Grove, Dead Timber, Marsh Edge, Barren Rock.

---

## Appendix E: Glossary

| Term | Meaning |
|---|---|
| **Aelindra** | The lost city of light-witches |
| **Lightbringer** | The player's identity, the last witch of Aelindra reborn |
| **Sovereign** | The ruler of the darkness, final antagonist |
| **Lumen Shrine** | Checkpoint, respawn, rest, and craft location, and a safe zone |
| **Light (meter)** | Inner-light resource and darkness meter |
| **Graybox** | Plain placeholder geometry used to test movement and layout |
| **Vertical slice** | A small, fully playable chunk of the game at final-ish quality |
| **GLB / glTF** | Standard 3D model format used in the browser |
| **Retargeting** | Playing animations made for one skeleton on another |
| **Foot IK** | Procedurally placing feet on uneven ground |
| **Triplanar** | Texture projection along three axes, avoiding stretching |
| **Archetype** | A data definition of a procedural object type (plant, rock, tree) |
| **Stamp / Feature** | Terrain-shaping instructions (hill, basin, flatten pad, path) |
| **Light pool** | Manager assigning a few real lights to the nearest glowing sources |
| **i-frames** | Invulnerability frames during a dodge |
| **Hit-stop** | Brief freeze on impact that makes hits feel heavy |
| **Poise** | Resistance to being staggered |
| **LOD** | Level of detail, simpler meshes at a distance |
| **Instancing** | Drawing many copies of one mesh in a single draw call |
| **CC0 / CC BY** | Free-use license / free-use-with-attribution license |

---

## Appendix F: New Model Checklist

Before adding any generated model to the game:
- [ ] Clean A-pose or T-pose, hands open and relaxed
- [ ] No merged limbs, holes, or floating pieces
- [ ] No baked shadows or lighting in textures
- [ ] Within the triangle budget for its category
- [ ] Textures 2K or smaller, PBR
- [ ] Rigged with a standard humanoid skeleton (characters)
- [ ] Exported as GLB with no baked animations (characters)
- [ ] Facing +Z, Y-up, 1 unit = 1 meter, pivot at the feet
- [ ] Registered in `manifest.json` and a character definition JSON
- [ ] Passes the `/viewer` validation report
- [ ] Source, date, and license recorded in `CREDITS.md`

---

*End of document. Keep this file updated as decisions change and steps complete. It is the shared memory of the project.*
