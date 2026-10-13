import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import Stats from 'stats.js';

import { FLORA_ARCHETYPES } from '../data/flora/archetypes';
import { GLIMMERWOOD_REGION } from '../data/regions/glimmerwood';
import { VariantCache } from '../world/flora/generators/variantCache';
import { FloraMaterialManager } from '../world/flora/materials/floraMaterials';
import { WindSystem } from '../world/wind/windSystem';
import { LightingModule } from '../engine/lighting';
import { HeightFunction } from '../world/terrain/heightFunction';
import { ChunkScatterManager } from '../world/scatter/chunkScatterManager';

export class FloraShowcaseApp {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private stats: Stats;
  private gui: GUI;

  private wind: WindSystem;
  private lighting: LightingModule;
  private heightFunction: HeightFunction;
  private variantCache: VariantCache;
  private materialManager: FloraMaterialManager;
  private scatterManager: ChunkScatterManager;

  private displayGroup = new THREE.Group();
  private patchTerrainMesh: THREE.Mesh | null = null;

  // State
  public currentMode: 'variants_grid' | 'scatter_patch' | 'all_lineup' = 'variants_grid';
  public selectedArchetype = 'umbrella_titan';
  public currentLod = 0;
  public seed = 421337;
  public wireframe = false;
  public windEnabled = true;
  public glowEnabled = true;
  public lightPoolVisible = true;

  private activeMeshes: THREE.Mesh[] = [];
  private elapsedTime = 0;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Three.js Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050c14);
    this.scene.fog = new THREE.FogExp2(0x06111a, 0.015);
    this.scene.add(this.displayGroup);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    // 2. Camera & OrbitControls
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);
    this.camera.position.set(0, 10, 24);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 4, 0);

    // 3. Stats & GUI
    this.stats = new Stats();
    this.stats.showPanel(0);
    document.body.appendChild(this.stats.dom);
    this.gui = new GUI({ title: 'Flora Kit Controls' });

    // 4. Core Systems
    this.wind = new WindSystem(GLIMMERWOOD_REGION.wind);
    this.lighting = new LightingModule(this.scene);
    this.lighting.lightPool.setDebugVisible(true);
    this.heightFunction = new HeightFunction(GLIMMERWOOD_REGION);
    this.variantCache = VariantCache.getInstance();
    this.materialManager = FloraMaterialManager.getInstance();
    this.scatterManager = new ChunkScatterManager(
      this.scene,
      GLIMMERWOOD_REGION,
      this.heightFunction,
      undefined,
      this.lighting
    );

    // Base subtle ambient & directional fill
    const fillLight = new THREE.DirectionalLight(0x0a202c, 0.6);
    fillLight.position.set(20, 40, 20);
    this.scene.add(fillLight);

    const hemi = new THREE.HemisphereLight(0x08222a, 0x03070b, 0.5);
    this.scene.add(hemi);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(80, 40, 0x00f2ff, 0x0d2836);
    gridHelper.position.y = -0.01;
    this.scene.add(gridHelper);

    // 5. Build GUI and initialize
    this.initGui();
    this.initAsync().then(() => {
      this.validateBudgets();
      this.rebuildView();
    });

    window.addEventListener('resize', this.onResize.bind(this));
    this.animate();
  }

  private async initAsync(): Promise<void> {
    await this.variantCache.init(this.seed);
  }

  private initGui(): void {
    const archetypeOptions = Object.keys(FLORA_ARCHETYPES);

    const fView = this.gui.addFolder('View Settings');
    fView
      .add(this, 'currentMode', {
        'Variants Grid (8 Variants)': 'variants_grid',
        'Scatter Test Patch (4 Biomes)': 'scatter_patch',
        'All Archetypes Lineup': 'all_lineup'
      })
      .name('View Mode')
      .onChange(() => this.rebuildView());

    fView
      .add(this, 'selectedArchetype', archetypeOptions)
      .name('Archetype')
      .onChange(() => this.rebuildView());

    fView
      .add(this, 'currentLod', { 'LOD0 (High Detail)': 0, 'LOD1 (Medium)': 1, 'LOD2 (Low / Far)': 2 })
      .name('LOD Level')
      .onChange(() => this.rebuildView());

    fView
      .add(this, 'seed', 1, 999999, 1)
      .name('Random Seed')
      .onChange(async () => {
        await this.variantCache.init(this.seed);
        this.rebuildView();
      });

    const fDisplay = this.gui.addFolder('Shading & Toggles');
    fDisplay
      .add(this, 'wireframe')
      .name('Wireframe')
      .onChange((v: boolean) => {
        for (const m of this.activeMeshes) {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat) mat.wireframe = v;
        }
      });

    fDisplay.add(this, 'windEnabled').name('Wind Sway');
    fDisplay.add(this, 'glowEnabled').name('Emissive Glow');
    fDisplay
      .add(this, 'lightPoolVisible')
      .name('Light Pool Markers')
      .onChange((v: boolean) => {
        this.lighting.lightPool.setDebugVisible(v);
      });

    const fActions = this.gui.addFolder('Diagnostics');
    fActions.add(this, 'validateBudgets').name('Re-run Budget Check');
  }

  public rebuildView(): void {
    // Clear previous view
    while (this.displayGroup.children.length > 0) {
      const child = this.displayGroup.children[0];
      this.displayGroup.remove(child);
    }
    this.activeMeshes = [];

    if (this.currentMode === 'variants_grid') {
      this.buildVariantsGrid();
    } else if (this.currentMode === 'scatter_patch') {
      this.buildScatterPatch();
    } else if (this.currentMode === 'all_lineup') {
      this.buildAllLineup();
    }

    this.updateBudgetUi();
  }

  /**
   * Mode 1: Displays all 8 variants of the chosen archetype laid out in a clean 2x4 grid
   */
  private buildVariantsGrid(): void {
    const def = FLORA_ARCHETYPES[this.selectedArchetype];
    if (!def) return;

    const spacing = Math.max(4.0, (def.colliderDimensions ? def.colliderDimensions[1] * 0.45 : 3.5));
    const mat = this.materialManager.getMaterial(def.materialId, def.glowSettings, def.windSettings, GLIMMERWOOD_REGION);
    mat.wireframe = this.wireframe;

    for (let v = 0; v < 8; v++) {
      const geo = this.variantCache.getVariantGeometry(this.selectedArchetype, v, this.currentLod);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const row = Math.floor(v / 4);
      const col = v % 4;
      mesh.position.set((col - 1.5) * spacing, 0, (row - 0.5) * spacing);

      this.displayGroup.add(mesh);
      this.activeMeshes.push(mesh);
    }

    this.controls.target.set(0, spacing * 0.35, 0);
    this.camera.position.set(0, spacing * 1.2, spacing * 3.0);
  }

  /**
   * Mode 2: Displays mini 64x64m terrain patch showing the 4 ecological patterns
   */
  private buildScatterPatch(): void {
    // 1. Mini terrain mesh
    const patchSize = 64;
    const segs = 48;
    const patchGeo = new THREE.PlaneGeometry(patchSize, patchSize, segs, segs);
    patchGeo.rotateX(-Math.PI * 0.5);

    const pos = patchGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.heightFunction.getHeight(x, z);
      pos.setY(i, y);
    }
    patchGeo.computeVertexNormals();

    const patchMat = new THREE.MeshStandardMaterial({
      color: 0x091e24,
      roughness: 0.85,
      metalness: 0.05
    });
    this.patchTerrainMesh = new THREE.Mesh(patchGeo, patchMat);
    this.patchTerrainMesh.receiveShadow = true;
    this.displayGroup.add(this.patchTerrainMesh);

    // 2. Stream scatter chunk (0, 0)
    this.scatterManager.update(new THREE.Vector3(0, 0, 0));

    this.controls.target.set(0, 2, 0);
    this.camera.position.set(0, 25, 45);
  }

  /**
   * Mode 3: Displays one exemplar of every archetype in a side-by-side gallery
   */
  private buildAllLineup(): void {
    const ids = Object.keys(FLORA_ARCHETYPES);
    const spacing = 4.2;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const def = FLORA_ARCHETYPES[id];
      const geo = this.variantCache.getVariantGeometry(id, 0, this.currentLod);
      const mat = this.materialManager.getMaterial(def.materialId, def.glowSettings, def.windSettings, GLIMMERWOOD_REGION);
      mat.wireframe = this.wireframe;

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set((i - ids.length * 0.5) * spacing, 0, 0);

      this.displayGroup.add(mesh);
      this.activeMeshes.push(mesh);
    }

    this.controls.target.set(0, 4, 0);
    this.camera.position.set(0, 12, 40);
  }

  /**
   * Validator printing per-archetype triangle counts against budgets and warning when exceeded
   */
  public validateBudgets(): { passed: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const reportData: { archetype: string; lod0Tris: number; lod0Budget: number; lod1Tris: number; status: string }[] = [];

    for (const [id, def] of Object.entries(FLORA_ARCHETYPES)) {
      const avgLod0 = this.variantCache.getAverageTriangleCount(id, 0);
      const avgLod1 = this.variantCache.getAverageTriangleCount(id, 1);
      const budget0 = def.triBudgets.lod0;

      let status = 'PASS';
      if (avgLod0 > budget0) {
        status = 'WARN (EXCEEDED)';
        warnings.push(`[Budget] ${def.name} (${id}) LOD0: ${avgLod0} tris exceeds budget of ${budget0}!`);
      }

      reportData.push({
        archetype: def.name,
        lod0Tris: avgLod0,
        lod0Budget: budget0,
        lod1Tris: avgLod1,
        status
      });
    }

    console.group('[Flora Kit] Triangle Budget Validation Report');
    console.table(reportData);
    if (warnings.length === 0) {
      console.info('%c✓ All archetypes meet polygon budget constraints!', 'color: #2afc64; font-weight: bold;');
    } else {
      console.warn(`%c⚠ ${warnings.length} budget warnings detected:`, 'color: #ff9800; font-weight: bold;', warnings);
    }
    console.groupEnd();

    this.updateBudgetUi(warnings);
    return { passed: warnings.length === 0, warnings };
  }

  private updateBudgetUi(warnings?: string[]): void {
    const statusEl = document.getElementById('budget-status');
    const detailsEl = document.getElementById('budget-details');
    if (!statusEl || !detailsEl) return;

    const warnList = warnings ?? [];
    if (warnList.length === 0) {
      statusEl.className = 'pass';
      statusEl.textContent = 'PASSED (0 Warnings)';
      const avgTitan = this.variantCache.getAverageTriangleCount('umbrella_titan', 0);
      const avgSnag = this.variantCache.getAverageTriangleCount('twisted_snag', 0);
      const avgBoulder = this.variantCache.getAverageTriangleCount('boulder', 0);
      const avgGrass = this.variantCache.getAverageTriangleCount('dead_grass', 0);
      detailsEl.textContent = `Titan: ~${avgTitan} tris (<=7800) | Tree: ~${avgSnag} (<=4400) | Rock: ~${avgBoulder} (<=1200) | Grass: ~${avgGrass} (<=380)`;
    } else {
      statusEl.className = 'warn';
      statusEl.textContent = `${warnList.length} WARNINGS`;
      detailsEl.textContent = warnList[0];
    }
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));
    this.stats.begin();

    const dt = 0.016;
    this.elapsedTime += dt;

    if (this.windEnabled) {
      this.wind.update(dt);
    }
    if (this.glowEnabled) {
      this.materialManager.update(this.elapsedTime);
    }

    this.controls.update();

    if (this.currentMode === 'scatter_patch') {
      this.scatterManager.update(this.camera.position);
    }

    this.renderer.render(this.scene, this.camera);
    this.stats.end();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');
  if (container) {
    new FloraShowcaseApp(container);
  }
});
