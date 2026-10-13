import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../engine/physics';
import { TrainingDummy } from '../entities/trainingDummy';

export class GrayboxWorld {
  public scene: THREE.Scene;
  public physics: PhysicsWorld;
  public dummies: TrainingDummy[] = [];
  public isVisible = false;
  private meshes: THREE.Mesh[] = [];
  private colliders: RAPIER.Collider[] = [];

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.scene = scene;
    this.physics = physics;
  }

  public build(): void {
    this.createGround();
    this.createPlatformsAndStairs();
    this.createRamp();
    this.createObstaclesAndWalls();
    this.createDummies();
    this.setVisible(false); // Hidden by default, toggleable via debug panel
  }

  public setVisible(enabled: boolean): void {
    this.isVisible = enabled;
    for (const mesh of this.meshes) {
      mesh.visible = enabled;
    }
    for (const col of this.colliders) {
      col.setEnabled(enabled);
    }
  }

  private createDummies(): void {
    // 1. Ground dummy in open arena area in front of player start
    const dummy1 = new TrainingDummy(
      'dummy_ground',
      new THREE.Vector3(0, 0, -7.5),
      this.scene,
      this.physics,
      Math.PI // facing player spawn
    );
    this.dummies.push(dummy1);

    // 2. Raised platform dummy on main platform (platform 1 at y = 3.0, z = -20)
    const dummy2 = new TrainingDummy(
      'dummy_platform',
      new THREE.Vector3(0, 3.0, -20),
      this.scene,
      this.physics,
      Math.PI
    );
    this.dummies.push(dummy2);
  }

  public update(dt: number, playerPos: THREE.Vector3): void {
    for (const dummy of this.dummies) {
      dummy.update(dt, playerPos);
    }
  }

  public resetAllDummies(): void {
    for (const dummy of this.dummies) {
      dummy.reset();
    }
  }

  private createMaterial(hexColor: number, roughness = 0.85): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: hexColor,
      roughness,
      metalness: 0.1
    });
  }

  private addBlock(
    width: number,
    height: number,
    depth: number,
    posX: number,
    posY: number,
    posZ: number,
    colorHex: number,
    rotationEuler?: { x: number; y: number; z: number }
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = this.createMaterial(colorHex);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(posX, posY, posZ);
    if (rotationEuler) {
      mesh.rotation.set(rotationEuler.x, rotationEuler.y, rotationEuler.z);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);

    // Physics static collider
    const col = this.physics.createStaticBox(
      width / 2,
      height / 2,
      depth / 2,
      posX,
      posY,
      posZ,
      rotationEuler
    );
    this.colliders.push(col);

    return mesh;
  }

  private createGround(): void {
    // Procedural grid canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base background tone
    ctx.fillStyle = '#222834';
    ctx.fillRect(0, 0, 512, 512);

    // 1-meter grid lines
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2d3748';
    const subStep = 512 / 8; // 8 sub-meters per texture tile
    for (let i = 0; i <= 512; i += subStep) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    // Major meter border lines
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#414e66';
    ctx.strokeRect(0, 0, 512, 512);

    const gridTexture = new THREE.CanvasTexture(canvas);
    gridTexture.wrapS = THREE.RepeatWrapping;
    gridTexture.wrapT = THREE.RepeatWrapping;
    const groundSize = 160;
    // Repeat every 8 units
    gridTexture.repeat.set(groundSize / 8, groundSize / 8);

    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMat = new THREE.MeshStandardMaterial({
      map: gridTexture,
      roughness: 0.9,
      metalness: 0.05
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);
    this.meshes.push(groundMesh);

    // Ground Rapier collider (top surface at y = 0)
    const groundCol = this.physics.createStaticBox(groundSize / 2, 0.5, groundSize / 2, 0, -0.5, 0);
    this.colliders.push(groundCol);
  }

  private createPlatformsAndStairs(): void {
    const platformHeight = 3.0;
    const platformThickness = 0.5;
    const platformCenterY = platformHeight - platformThickness / 2;

    // Platform 1 (Main Platform, 12m x 12m)
    this.addBlock(12, platformThickness, 12, 0, platformCenterY, -20, 0x3d495c);

    // Platform 2 across a jumpable gap (8m x 8m, 1.6m gap)
    // Platform 1 extends from z = -14 to z = -26.
    // Platform 2 starts at z = -26 - 1.6 - 4 = -31.6
    this.addBlock(8, platformThickness, 8, 0, platformCenterY, -31.6, 0x4a586e);

    // Low curb / ledge on back of platform 2 to test drop-off
    this.addBlock(8, 0.4, 0.4, 0, platformHeight + 0.2, -35.4, 0x5a6a82);

    // 1. Gentle Staircase (~0.20m riser, 0.38m tread, total rise = 3.0m)
    // 15 steps of 0.20m = 3.0m
    const gentleSteps = 15;
    const gentleRiser = platformHeight / gentleSteps; // 0.2m
    const gentleTread = 0.38;
    const stairWidth = 3.2;
    const gentleStartX = 4.2;
    const gentleBaseZ = -14; // edge of platform 1

    for (let i = 0; i < gentleSteps; i++) {
      const stepH = gentleRiser;
      const stepY = i * gentleRiser + stepH / 2;
      const stepZ = gentleBaseZ + (gentleSteps - i - 0.5) * gentleTread;
      // Alternate muted shades
      const color = i % 2 === 0 ? 0x455368 : 0x4d5c74;
      this.addBlock(stairWidth, stepH, gentleTread, gentleStartX, stepY, stepZ, color);
    }

    // 2. Steeper Staircase (~0.30m riser, 0.28m tread, total rise = 3.0m)
    // 10 steps of 0.30m = 3.0m
    const steepSteps = 10;
    const steepRiser = platformHeight / steepSteps; // 0.3m
    const steepTread = 0.30;
    const steepStartX = -4.2;
    const steepBaseZ = -14;

    for (let i = 0; i < steepSteps; i++) {
      const stepH = steepRiser;
      const stepY = i * steepRiser + stepH / 2;
      const stepZ = steepBaseZ + (steepSteps - i - 0.5) * steepTread;
      const color = i % 2 === 0 ? 0x3e4b5e : 0x47566d;
      this.addBlock(stairWidth, stepH, steepTread, steepStartX, stepY, stepZ, color);
    }
  }

  private createRamp(): void {
    // Smooth ramp leading up to platform 1 from the East side
    // Platform 1 is at x = 0, z = -20, width = 12 (x: -6 to +6)
    // Ramp starts at ground (y = 0) and reaches y = 3.0 at x = 6.0
    const rampRise = 3.0;
    const rampLength = 8.5; // along ground
    const rampWidth = 3.5;
    const angle = Math.atan2(rampRise, rampLength); // ~19.4 degrees
    const hypotenuse = Math.sqrt(rampRise * rampRise + rampLength * rampLength);

    const rampMesh = this.addBlock(
      hypotenuse,
      0.4,
      rampWidth,
      6.0 + rampLength / 2,
      rampRise / 2 - 0.05,
      -20,
      0x54657d,
      { x: 0, y: 0, z: -angle }
    );
    rampMesh.name = 'RampSlope';
  }

  private createObstaclesAndWalls(): void {
    // Low hurdle blocks (~0.4m high)
    this.addBlock(2.5, 0.4, 0.8, -4, 0.2, 5, 0x5a687d);
    this.addBlock(3.0, 0.4, 0.8, -4, 0.2, 8, 0x617086);

    // Waist-high obstacles (~1.0m high)
    this.addBlock(2.0, 1.0, 2.0, 4, 0.5, 5, 0x48556a);
    this.addBlock(3.0, 1.0, 1.0, 4, 0.5, 9, 0x4d5b70);

    // Tall walls (3.5m - 4.5m) to test camera collision & wall sliding
    // L-shaped wall corridor
    this.addBlock(0.6, 3.5, 12, -12, 1.75, 0, 0x364050);
    this.addBlock(10, 3.5, 0.6, -7, 1.75, -6, 0x3a4557);

    // Right side tall wall
    this.addBlock(0.6, 4.0, 10, 14, 2.0, -2, 0x384354);

    // Steeper barrier wall
    this.addBlock(4.0, 2.5, 0.8, 10, 1.25, 8, 0x425064);

    // Cylinders (Pillars)
    this.createCylinder(0.7, 3.5, -8, 1.75, 12, 0x4f5e73);
    this.createCylinder(0.9, 4.0, 0, 2.0, 12, 0x55667d);
    this.createCylinder(0.7, 3.5, 8, 1.75, 12, 0x4f5e73);

    // Spheres (Boulders)
    this.createSphere(1.1, -12, 1.1, -14, 0x5c6d84);
    this.createSphere(1.5, 13, 1.5, -12, 0x56657a);
  }

  private createCylinder(radius: number, height: number, x: number, y: number, z: number, colorHex: number): void {
    const geo = new THREE.CylinderGeometry(radius, radius, height, 24);
    const mat = this.createMaterial(colorHex);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);

    const col = this.physics.createStaticCylinder(height / 2, radius, x, y, z);
    this.colliders.push(col);
  }

  private createSphere(radius: number, x: number, y: number, z: number, colorHex: number): void {
    const geo = new THREE.SphereGeometry(radius, 24, 24);
    const mat = this.createMaterial(colorHex);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);

    const col = this.physics.createStaticSphere(radius, x, y, z);
    this.colliders.push(col);
  }
}
