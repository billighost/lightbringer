import * as THREE from 'three';

export interface PbrTextureSet {
  albedo: THREE.Texture;
  normal: THREE.Texture;
  roughnessAo: THREE.Texture;
  isFallback: boolean;
}

export interface TerrainTextureSets {
  deadSoil: PbrTextureSet;
  wetMud: PbrTextureSet;
  crackedRock: PbrTextureSet;
  glowingMoss: PbrTextureSet;
  myceliumVeins: THREE.Texture;
  fallbackReport: Record<string, boolean>;
}

/**
 * Procedural PBR Texture Generator
 * Provides high-quality procedural fallback textures when CC0 texture files are absent.
 */
export class ProceduralTextureGenerator {
  private static instance: ProceduralTextureGenerator | null = null;
  private cachedSets: TerrainTextureSets | null = null;

  public static getInstance(): ProceduralTextureGenerator {
    if (!this.instance) {
      this.instance = new ProceduralTextureGenerator();
    }
    return this.instance;
  }

  public getTerrainTextures(): TerrainTextureSets {
    if (this.cachedSets) {
      return this.cachedSets;
    }

    const fallbackReport: Record<string, boolean> = {
      deadSoil: true,
      wetMud: true,
      crackedRock: true,
      glowingMoss: true
    };

    console.info(
      '[Terrain] Using procedural PBR fallback textures for ground layers: deadSoil, wetMud, crackedRock, glowingMoss (Drop CC0 textures in public/assets/textures/ground/<layer>/ to override).'
    );

    const deadSoil = this.createDeadSoilTextures();
    const wetMud = this.createWetMudTextures();
    const crackedRock = this.createCrackedRockTextures();
    const glowingMoss = this.createGlowingMossTextures();
    const myceliumVeins = this.createMyceliumVeinTexture();

    this.cachedSets = {
      deadSoil,
      wetMud,
      crackedRock,
      glowingMoss,
      myceliumVeins,
      fallbackReport
    };

    return this.cachedSets;
  }

  private createTextureFromCanvas(canvas: HTMLCanvasElement): THREE.CanvasTexture {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  /**
   * Helper to compute normal map from a height/bump canvas
   */
  private generateNormalMapFromHeight(heightData: Uint8ClampedArray, width: number, height: number, strength = 2.0): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const yPrev = ((y - 1 + height) % height) * width;
      const yNext = ((y + 1) % height) * width;
      const yCurr = y * width;

      for (let x = 0; x < width; x++) {
        const xPrev = (x - 1 + width) % width;
        const xNext = (x + 1) % width;

        const left = heightData[(yCurr + xPrev) * 4] / 255.0;
        const right = heightData[(yCurr + xNext) * 4] / 255.0;
        const up = heightData[(yPrev + x) * 4] / 255.0;
        const down = heightData[(yNext + x) * 4] / 255.0;

        const dx = (right - left) * strength;
        const dy = (down - up) * strength;

        // Normal: normalize(-dx, -dy, 1.0) mapped to [0, 255]
        const len = Math.sqrt(dx * dx + dy * dy + 1.0);
        const nx = -dx / len;
        const ny = -dy / len;
        const nz = 1.0 / len;

        const idx = (yCurr + x) * 4;
        data[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
        data[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return this.createTextureFromCanvas(canvas);
  }

  private createDeadSoilTextures(): PbrTextureSet {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Albedo
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    const heightData = new Uint8ClampedArray(size * size * 4);

    for (let i = 0; i < size * size; i++) {
      const noise1 = Math.sin((i % size) * 0.12) * Math.cos(Math.floor(i / size) * 0.12);
      const noise2 = Math.random() * 0.25;
      const lum = Math.min(1.0, Math.max(0.0, 0.45 + noise1 * 0.15 + noise2));

      // Dark peaty soil tone (#181512 with subtle cool silt specks)
      const r = Math.floor(24 * lum);
      const g = Math.floor(21 * lum);
      const b = Math.floor(18 * lum);

      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;

      const bump = Math.floor(lum * 255);
      heightData[i * 4] = bump;
    }
    ctx.putImageData(imgData, 0, 0);
    const albedo = this.createTextureFromCanvas(canvas);
    const normal = this.generateNormalMapFromHeight(heightData, size, size, 2.5);

    // Roughness (high, ~0.95) & AO (R: roughness, G: ao)
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;
    const rData = rCtx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      rData.data[i * 4] = 240; // Roughness 0.94
      rData.data[i * 4 + 1] = heightData[i * 4]; // AO
      rData.data[i * 4 + 2] = 0;
      rData.data[i * 4 + 3] = 255;
    }
    rCtx.putImageData(rData, 0, 0);

    return {
      albedo,
      normal,
      roughnessAo: this.createTextureFromCanvas(roughCanvas),
      isFallback: true
    };
  }

  private createWetMudTextures(): PbrTextureSet {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(size, size);
    const heightData = new Uint8ClampedArray(size * size * 4);

    for (let i = 0; i < size * size; i++) {
      const x = i % size;
      const y = Math.floor(i / size);
      const swirl = Math.sin(x * 0.05 + Math.cos(y * 0.05)) * 0.5 + 0.5;
      const grain = (Math.random() - 0.5) * 0.1;
      const v = Math.min(1.0, Math.max(0.0, swirl * 0.4 + 0.3 + grain));

      // Dark slick mud tone (#101416)
      imgData.data[i * 4] = Math.floor(16 * v);
      imgData.data[i * 4 + 1] = Math.floor(20 * v);
      imgData.data[i * 4 + 2] = Math.floor(22 * v);
      imgData.data[i * 4 + 3] = 255;

      heightData[i * 4] = Math.floor(v * 255);
    }
    ctx.putImageData(imgData, 0, 0);
    const albedo = this.createTextureFromCanvas(canvas);
    const normal = this.generateNormalMapFromHeight(heightData, size, size, 1.2);

    // Roughness is low (0.2 - 0.35) for wet sheen
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;
    const rData = rCtx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      rData.data[i * 4] = 65; // Wet roughness ~0.25
      rData.data[i * 4 + 1] = 220; // High AO
      rData.data[i * 4 + 2] = 0;
      rData.data[i * 4 + 3] = 255;
    }
    rCtx.putImageData(rData, 0, 0);

    return {
      albedo,
      normal,
      roughnessAo: this.createTextureFromCanvas(roughCanvas),
      isFallback: true
    };
  }

  private createCrackedRockTextures(): PbrTextureSet {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(size, size);
    const heightData = new Uint8ClampedArray(size * size * 4);

    for (let i = 0; i < size * size; i++) {
      const x = i % size;
      const y = Math.floor(i / size);

      // Voronoi-like cell cracking pattern approximation
      const cx = (x % 64) - 32;
      const cy = (y % 64) - 32;
      const cellDist = Math.sqrt(cx * cx + cy * cy) / 32;
      const isCrack = cellDist > 0.88 ? 0.3 : 1.0;

      const baseRock = 0.5 + Math.sin(x * 0.1) * 0.1 + Math.random() * 0.08;
      const v = Math.min(1.0, Math.max(0.0, baseRock * isCrack));

      // Slate basalt tone (#252c36)
      imgData.data[i * 4] = Math.floor(37 * v);
      imgData.data[i * 4 + 1] = Math.floor(44 * v);
      imgData.data[i * 4 + 2] = Math.floor(54 * v);
      imgData.data[i * 4 + 3] = 255;

      heightData[i * 4] = Math.floor(v * 255);
    }
    ctx.putImageData(imgData, 0, 0);
    const albedo = this.createTextureFromCanvas(canvas);
    const normal = this.generateNormalMapFromHeight(heightData, size, size, 3.8);

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;
    const rData = rCtx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      rData.data[i * 4] = 210; // Roughness ~0.82
      rData.data[i * 4 + 1] = heightData[i * 4]; // AO in crevices
      rData.data[i * 4 + 2] = 0;
      rData.data[i * 4 + 3] = 255;
    }
    rCtx.putImageData(rData, 0, 0);

    return {
      albedo,
      normal,
      roughnessAo: this.createTextureFromCanvas(roughCanvas),
      isFallback: true
    };
  }

  private createGlowingMossTextures(): PbrTextureSet {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(size, size);
    const heightData = new Uint8ClampedArray(size * size * 4);

    for (let i = 0; i < size * size; i++) {
      const x = i % size;
      const y = Math.floor(i / size);
      const mossCluster = Math.sin(x * 0.08) * Math.cos(y * 0.08) * 0.5 + 0.5;
      const fleck = Math.random() * 0.15;
      const v = Math.min(1.0, Math.max(0.0, mossCluster * 0.7 + 0.3 + fleck));

      // Deep teal/emerald moss (#0e3230)
      imgData.data[i * 4] = Math.floor(14 * v);
      imgData.data[i * 4 + 1] = Math.floor(50 * v);
      imgData.data[i * 4 + 2] = Math.floor(48 * v);
      imgData.data[i * 4 + 3] = 255;

      heightData[i * 4] = Math.floor(v * 255);
    }
    ctx.putImageData(imgData, 0, 0);
    const albedo = this.createTextureFromCanvas(canvas);
    const normal = this.generateNormalMapFromHeight(heightData, size, size, 1.8);

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;
    const rData = rCtx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      rData.data[i * 4] = 165; // Roughness ~0.65
      rData.data[i * 4 + 1] = 210;
      rData.data[i * 4 + 2] = 0;
      rData.data[i * 4 + 3] = 255;
    }
    rCtx.putImageData(rData, 0, 0);

    return {
      albedo,
      normal,
      roughnessAo: this.createTextureFromCanvas(roughCanvas),
      isFallback: true
    };
  }

  private createMyceliumVeinTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);

    // Procedural branching glowing filaments
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';

    const branch = (x: number, y: number, length: number, angle: number, depth: number) => {
      if (depth <= 0 || length < 2) return;
      const x2 = x + Math.cos(angle) * length;
      const y2 = y + Math.sin(angle) * length;

      ctx.lineWidth = Math.max(1, depth * 0.8);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const spread = 0.45;
      branch(x2, y2, length * 0.72, angle - spread + (Math.random() - 0.5) * 0.2, depth - 1);
      branch(x2, y2, length * 0.72, angle + spread + (Math.random() - 0.5) * 0.2, depth - 1);
    };

    // Seed multiple root nodes
    for (let i = 0; i < 14; i++) {
      const rx = Math.random() * size;
      const ry = Math.random() * size;
      for (let a = 0; a < 3; a++) {
        branch(rx, ry, 36, (a * Math.PI * 2) / 3, 5);
      }
    }

    return this.createTextureFromCanvas(canvas);
  }
}
