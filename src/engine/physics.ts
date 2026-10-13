import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export interface RayHit {
  hit: boolean;
  distance: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

export class PhysicsWorld {
  public world!: RAPIER.World;
  public rapier!: typeof RAPIER;
  private isInitialized = false;

  public async init(gravity = { x: 0, y: -25, z: 0 }): Promise<void> {
    if (this.isInitialized) return;
    await RAPIER.init();
    this.rapier = RAPIER;
    this.world = new RAPIER.World(gravity);
    this.isInitialized = true;
  }

  public step(): void {
    if (!this.isInitialized) return;
    this.world.step();
  }

  public setGravity(y: number): void {
    if (!this.world) return;
    this.world.gravity = { x: 0, y, z: 0 };
  }

  public getGravityY(): number {
    return this.world ? this.world.gravity.y : -25;
  }

  public createStaticBox(
    halfX: number,
    halfY: number,
    halfZ: number,
    posX: number,
    posY: number,
    posZ: number,
    rotationEuler?: { x: number; y: number; z: number }
  ): RAPIER.Collider {
    const bodyDesc = this.rapier.RigidBodyDesc.fixed().setTranslation(posX, posY, posZ);
    if (rotationEuler) {
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rotationEuler.x, rotationEuler.y, rotationEuler.z)
      );
      bodyDesc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.rapier.ColliderDesc.cuboid(halfX, halfY, halfZ);
    return this.world.createCollider(colliderDesc, body);
  }

  public createStaticCylinder(
    halfHeight: number,
    radius: number,
    posX: number,
    posY: number,
    posZ: number
  ): RAPIER.Collider {
    const bodyDesc = this.rapier.RigidBodyDesc.fixed().setTranslation(posX, posY, posZ);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.rapier.ColliderDesc.cylinder(halfHeight, radius);
    return this.world.createCollider(colliderDesc, body);
  }

  public createStaticSphere(
    radius: number,
    posX: number,
    posY: number,
    posZ: number
  ): RAPIER.Collider {
    const bodyDesc = this.rapier.RigidBodyDesc.fixed().setTranslation(posX, posY, posZ);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.rapier.ColliderDesc.ball(radius);
    return this.world.createCollider(colliderDesc, body);
  }

  public createStaticTrimesh(
    vertices: Float32Array,
    indices: Uint32Array
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    const bodyDesc = this.rapier.RigidBodyDesc.fixed();
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.rapier.ColliderDesc.trimesh(vertices, indices);
    const collider = this.world.createCollider(colliderDesc, body);
    return { body, collider };
  }

  public removeRigidBody(body: RAPIER.RigidBody): void {
    if (this.world && body) {
      this.world.removeRigidBody(body);
    }
  }

  /**
   * Cast a ray against the physics world, ignoring specific collider if needed (e.g., player's collider)
   */
  public castRay(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    ignoreCollider?: RAPIER.Collider
  ): RayHit | null {
    if (!this.world) return null;

    const dirNorm = direction.clone().normalize();
    const ray = new this.rapier.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dirNorm.x, y: dirNorm.y, z: dirNorm.z }
    );

    const hit = this.world.castRayAndGetNormal(
      ray,
      maxDistance,
      true, // solid
      undefined, // flags
      undefined, // groups
      ignoreCollider // filterExcludeCollider
    );

    if (hit) {
      const hitPoint = origin.clone().addScaledVector(dirNorm, hit.timeOfImpact);
      return {
        hit: true,
        distance: hit.timeOfImpact,
        point: hitPoint,
        normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z)
      };
    }

    return null;
  }
}
