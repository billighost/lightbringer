import * as THREE from 'three';
import { RegionData, WaterBodyConfig } from '../../data/regions/schema';
import { HeightFunction } from '../terrain/heightFunction';
import { WaterMaterial } from './waterMaterial';

export class WaterBodiesManager {
  public scene: THREE.Scene;
  public region: RegionData;
  public heightFunction: HeightFunction;
  public material: WaterMaterial;
  public meshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, region: RegionData, heightFunction: HeightFunction) {
    this.scene = scene;
    this.region = region;
    this.heightFunction = heightFunction;
    this.material = new WaterMaterial(region.water, region.fog.color);

    this.validateAndCreateBodies();
  }

  private validateAndCreateBodies(): void {
    const bodies = this.region.water.bodies;
    const maxAllowedDepth = this.region.water.maxDepth;

    for (const body of bodies) {
      this.validateBasinDepth(body, maxAllowedDepth);
      this.createWaterMesh(body);
    }
  }

  /**
   * Shallow basin validator: ensures terrain basin depth stays within 1.0m wading budget
   */
  public validateBasinDepth(body: WaterBodyConfig, maxAllowedDepth: number): boolean {
    const sampleStep = 4.0;
    let maxMeasuredDepth = 0;
    let hasViolations = false;

    for (let r = 0; r <= body.radius; r += sampleStep) {
      const stepCount = Math.max(1, Math.floor((2 * Math.PI * r) / sampleStep));
      for (let s = 0; s < stepCount; s++) {
        const theta = (s / stepCount) * Math.PI * 2;
        const x = body.centerX + Math.cos(theta) * r;
        const z = body.centerZ + Math.sin(theta) * r;
        const terrainH = this.heightFunction.getHeight(x, z);
        const depth = body.level - terrainH;

        if (depth > maxMeasuredDepth) {
          maxMeasuredDepth = depth;
        }

        if (depth > maxAllowedDepth + 0.1) {
          hasViolations = true;
        }
      }
    }

    if (hasViolations) {
      console.warn(
        `[WaterBodies] Basin "${body.name}" exceeds maximum wading depth of ${maxAllowedDepth}m (measured ${maxMeasuredDepth.toFixed(2)}m). Shallow wading only!`
      );
      return false;
    } else {
      console.info(
        `[WaterBodies] Basin "${body.name}" verified shallow (max depth ${maxMeasuredDepth.toFixed(2)}m <= ${maxAllowedDepth}m).`
      );
      return true;
    }
  }

  private createWaterMesh(body: WaterBodyConfig): THREE.Mesh {
    const geo = new THREE.CircleGeometry(body.radius, 48);
    geo.rotateX(-Math.PI / 2);

    const mesh = new THREE.Mesh(geo, this.material);
    mesh.position.set(body.centerX, body.level, body.centerZ);
    mesh.renderOrder = 100;
    mesh.receiveShadow = true;

    this.scene.add(mesh);
    this.meshes.push(mesh);
    return mesh;
  }

  public update(time: number): void {
    this.material.update(time);
  }

  public dispose(): void {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.material.dispose();
    this.meshes = [];
  }
}
