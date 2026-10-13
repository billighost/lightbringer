/**
 * Deterministic 2D Poisson Disc Sampler with spatial hashing
 */
export class PoissonDiscSampler2D {
  private cellSize: number;
  private gridWidth: number;
  private gridHeight: number;
  private grid: (number[] | null)[];
  private minX: number;
  private minZ: number;
  private width: number;
  private depth: number;
  private minDistanceSq: number;

  constructor(minX: number, minZ: number, width: number, depth: number, minDistance: number) {
    this.minX = minX;
    this.minZ = minZ;
    this.width = width;
    this.depth = depth;
    this.minDistanceSq = minDistance * minDistance;

    // Grid cell size ensures at most one sample per cell
    this.cellSize = minDistance / Math.SQRT2;
    this.gridWidth = Math.ceil(width / this.cellSize);
    this.gridHeight = Math.ceil(depth / this.cellSize);
    this.grid = new Array(this.gridWidth * this.gridHeight).fill(null);
  }

  private getGridIndex(x: number, z: number): number {
    const gx = Math.floor((x - this.minX) / this.cellSize);
    const gz = Math.floor((z - this.minZ) / this.cellSize);
    if (gx < 0 || gx >= this.gridWidth || gz < 0 || gz >= this.gridHeight) return -1;
    return gx + gz * this.gridWidth;
  }

  public isPointValid(x: number, z: number): boolean {
    const gx = Math.floor((x - this.minX) / this.cellSize);
    const gz = Math.floor((z - this.minZ) / this.cellSize);
    if (gx < 0 || gx >= this.gridWidth || gz < 0 || gz >= this.gridHeight) return false;

    // Check 5x5 neighborhood of grid cells
    const startX = Math.max(0, gx - 2);
    const endX = Math.min(this.gridWidth - 1, gx + 2);
    const startZ = Math.max(0, gz - 2);
    const endZ = Math.min(this.gridHeight - 1, gz + 2);

    for (let iz = startZ; iz <= endZ; iz++) {
      for (let ix = startX; ix <= endX; ix++) {
        const pt = this.grid[ix + iz * this.gridWidth];
        if (pt) {
          const dx = x - pt[0];
          const dz = z - pt[1];
          if (dx * dx + dz * dz < this.minDistanceSq) {
            return false;
          }
        }
      }
    }

    return true;
  }

  public registerExistingPoint(x: number, z: number): void {
    const idx = this.getGridIndex(x, z);
    if (idx >= 0) {
      this.grid[idx] = [x, z];
    }
  }

  public generateSamples(
    targetCount: number,
    rng: () => number,
    kAttempts = 15,
    filterFn?: (x: number, z: number) => boolean
  ): [number, number][] {
    const samples: [number, number][] = [];
    const activeList: [number, number][] = [];

    // Seed initial points
    let initialTries = 0;
    while (activeList.length < Math.min(3, targetCount) && initialTries < 40) {
      initialTries++;
      const initX = this.minX + rng() * this.width;
      const initZ = this.minZ + rng() * this.depth;
      if (this.isPointValid(initX, initZ) && (!filterFn || filterFn(initX, initZ))) {
        this.registerExistingPoint(initX, initZ);
        samples.push([initX, initZ]);
        activeList.push([initX, initZ]);
      }
    }

    // Expand samples around active list
    const minD = Math.sqrt(this.minDistanceSq);

    while (activeList.length > 0 && samples.length < targetCount) {
      const activeIdx = Math.floor(rng() * activeList.length);
      const center = activeList[activeIdx];
      let found = false;

      for (let attempt = 0; attempt < kAttempts; attempt++) {
        const angle = rng() * Math.PI * 2;
        const radius = minD + rng() * minD;
        const candX = center[0] + Math.cos(angle) * radius;
        const candZ = center[1] + Math.sin(angle) * radius;

        if (
          candX >= this.minX &&
          candX <= this.minX + this.width &&
          candZ >= this.minZ &&
          candZ <= this.minZ + this.depth &&
          this.isPointValid(candX, candZ) &&
          (!filterFn || filterFn(candX, candZ))
        ) {
          this.registerExistingPoint(candX, candZ);
          samples.push([candX, candZ]);
          activeList.push([candX, candZ]);
          found = true;
          if (samples.length >= targetCount) break;
        }
      }

      if (!found) {
        // Remove inactive point
        activeList.splice(activeIdx, 1);
      }
    }

    return samples;
  }
}
