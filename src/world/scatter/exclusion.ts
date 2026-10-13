import { TerrainFeature } from '../../data/regions/schema';

export type ExclusionShape =
  | { id: string; type: 'circle'; x: number; z: number; radius: number }
  | { id: string; type: 'rect'; x: number; z: number; width: number; depth: number; rotation?: number }
  | { id: string; type: 'path'; points: [number, number][]; width: number };

function distSqToSegment(px: number, pz: number, x1: number, z1: number, x2: number, z2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (z2 - z1) * (z2 - z1);
  if (l2 === 0) return (px - x1) * (px - x1) + (pz - z1) * (pz - z1);
  let t = ((px - x1) * (x2 - x1) + (pz - z1) * (z2 - z1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projZ = z1 + t * (z2 - z1);
  return (px - projX) * (px - projX) + (pz - projZ) * (pz - projZ);
}

export class ExclusionManager {
  private exclusions = new Map<string, ExclusionShape>();

  constructor(features?: TerrainFeature[]) {
    if (features) {
      this.importRegionFeatures(features);
    }
  }

  public importRegionFeatures(features: TerrainFeature[]): void {
    for (const f of features) {
      if (f.type === 'flatten_circle' || f.type === 'radial_basin') {
        this.addExclusion({
          id: f.id,
          type: 'circle',
          x: f.x,
          z: f.z,
          radius: f.radius * 0.85
        });
      } else if (f.type === 'flatten_rect') {
        this.addExclusion({
          id: f.id,
          type: 'rect',
          x: f.x,
          z: f.z,
          width: f.width,
          depth: f.depth,
          rotation: f.rotation
        });
      } else if (f.type === 'spline_path') {
        this.addExclusion({
          id: f.id,
          type: 'path',
          points: f.points,
          width: f.width * 0.85
        });
      }
    }
  }

  public addExclusion(shape: ExclusionShape): void {
    this.exclusions.set(shape.id, shape);
  }

  public removeExclusion(id: string): void {
    this.exclusions.delete(id);
  }

  public clear(): void {
    this.exclusions.clear();
  }

  public isExcluded(x: number, z: number): boolean {
    for (const shape of this.exclusions.values()) {
      switch (shape.type) {
        case 'circle': {
          const dx = x - shape.x;
          const dz = z - shape.z;
          if (dx * dx + dz * dz <= shape.radius * shape.radius) {
            return true;
          }
          break;
        }

        case 'rect': {
          const dx = x - shape.x;
          const dz = z - shape.z;
          const rot = shape.rotation || 0;
          const cosR = Math.cos(-rot);
          const sinR = Math.sin(-rot);
          const lx = Math.abs(dx * cosR - dz * sinR);
          const lz = Math.abs(dx * sinR + dz * cosR);
          if (lx <= shape.width * 0.5 && lz <= shape.depth * 0.5) {
            return true;
          }
          break;
        }

        case 'path': {
          const pts = shape.points;
          const halfW = shape.width * 0.5;
          const halfWSq = halfW * halfW;
          for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i];
            const p2 = pts[i + 1];
            if (distSqToSegment(x, z, p1[0], p1[1], p2[0], p2[1]) <= halfWSq) {
              return true;
            }
          }
          break;
        }
      }
    }
    return false;
  }
}
