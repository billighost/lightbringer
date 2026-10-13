import * as THREE from 'three';
import { PhysicsWorld } from '../engine/physics';

export class RapierDebugRenderer {
  public enabled = false;
  private lines: THREE.LineSegments;
  private geometry: THREE.BufferGeometry;
  private material: THREE.LineBasicMaterial;
  private scene: THREE.Scene;
  private physics: PhysicsWorld;

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.scene = scene;
    this.physics = physics;

    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.LineBasicMaterial({
      vertexColors: true,
      depthTest: true,
      transparent: true,
      opacity: 0.85
    });

    this.lines = new THREE.LineSegments(this.geometry, this.material);
    this.lines.visible = false;
    this.lines.renderOrder = 999;
    this.scene.add(this.lines);
  }

  public setVisible(visible: boolean): void {
    this.enabled = visible;
    this.lines.visible = visible;
  }

  public update(): void {
    if (!this.enabled || !this.physics.world) {
      this.lines.visible = false;
      return;
    }

    this.lines.visible = true;
    const buffers = this.physics.world.debugRender();

    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(buffers.vertices, 3)
    );
    this.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(buffers.colors, 4)
    );
  }
}
