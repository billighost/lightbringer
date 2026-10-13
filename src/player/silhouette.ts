import * as THREE from 'three';

export class CharacterVisual {
  public root: THREE.Group;
  public modelContainer: THREE.Group;
  public bodyGroup: THREE.Group;
  public bodyMesh!: THREE.Mesh;
  public headMesh!: THREE.Mesh;
  public visorMesh!: THREE.Mesh;
  public staffPivot: THREE.Group;
  public staffMesh!: THREE.Mesh;
  public staffTip: THREE.Object3D;
  private currentModel: THREE.Object3D | null = null;

  constructor() {
    this.root = new THREE.Group();
    this.modelContainer = new THREE.Group();
    this.root.add(this.modelContainer);

    this.bodyGroup = new THREE.Group();
    this.staffPivot = new THREE.Group();
    this.staffTip = new THREE.Object3D();

    // Build default dark silhouette
    const silhouette = this.buildSilhouetteMesh();
    this.setModel(silhouette);
  }

  /**
   * Replace visual model cleanly without touching physics or controller code
   */
  public setModel(model: THREE.Object3D): void {
    if (this.currentModel) {
      this.modelContainer.remove(this.currentModel);
    }
    this.currentModel = model;
    this.modelContainer.add(model);
  }

  public getModel(): THREE.Object3D | null {
    return this.currentModel;
  }

  private buildSilhouetteMesh(): THREE.Group {
    const group = new THREE.Group();

    // Dark silhouette materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x181e26,
      roughness: 0.75,
      metalness: 0.15
    });

    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x7aa2f7,
      roughness: 0.3,
      metalness: 0.8
    });

    const staffMat = new THREE.MeshStandardMaterial({
      color: 0x222a36,
      roughness: 0.85,
      metalness: 0.2
    });

    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x64b5f6,
      emissive: 0x1e88e5,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.8
    });

    this.bodyGroup = new THREE.Group();
    group.add(this.bodyGroup);

    // 1. Capsule Body (total height ~1.3m)
    const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.7, 8, 16);
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.y = 0.85;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.bodyGroup.add(this.bodyMesh);

    // 2. Head Sphere
    const headGeo = new THREE.SphereGeometry(0.22, 16, 16);
    this.headMesh = new THREE.Mesh(headGeo, bodyMat);
    this.headMesh.position.set(0, 1.48, 0);
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.bodyGroup.add(this.headMesh);

    // 3. Facing Direction Indicator (small visor/cone pointing in +Z forward direction)
    const coneGeo = new THREE.ConeGeometry(0.08, 0.22, 12);
    this.visorMesh = new THREE.Mesh(coneGeo, visorMat);
    this.visorMesh.rotation.x = Math.PI / 2; // Point forward along +Z
    this.visorMesh.position.set(0, 1.48, 0.22);
    this.visorMesh.castShadow = true;
    this.bodyGroup.add(this.visorMesh);

    // 4. Staff Pivot on right side of torso
    this.staffPivot = new THREE.Group();
    this.staffPivot.position.set(0.38, 0.95, 0.1);
    this.bodyGroup.add(this.staffPivot);

    // Staff mesh
    const staffGeo = new THREE.CylinderGeometry(0.02, 0.025, 1.9, 12);
    this.staffMesh = new THREE.Mesh(staffGeo, staffMat);
    this.staffMesh.position.y = 0; // centered in staffPivot
    this.staffMesh.rotation.z = -0.06;
    this.staffMesh.rotation.x = 0.04;
    this.staffMesh.castShadow = true;
    this.staffPivot.add(this.staffMesh);

    // Staff tip crystal
    const crystalGeo = new THREE.OctahedronGeometry(0.065, 0);
    const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
    crystalMesh.position.y = 0.95; // Top tip of staff
    this.staffPivot.add(crystalMesh);

    // Staff tip marker for trail
    this.staffTip = new THREE.Object3D();
    this.staffTip.position.set(0, 0.95, 0);
    this.staffPivot.add(this.staffTip);

    return group;
  }
}
