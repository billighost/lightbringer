import * as THREE from 'three';

export class FlyCam {
  public camera: THREE.PerspectiveCamera;
  public enabled = false;
  public speed = 16.0;

  private keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    sprint: false
  };

  private yaw = 0;
  private pitch = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.setupKeyListeners();
  }

  private setupKeyListeners(): void {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      switch (e.code) {
        case 'KeyW': this.keys.forward = true; break;
        case 'KeyS': this.keys.backward = true; break;
        case 'KeyA': this.keys.left = true; break;
        case 'KeyD': this.keys.right = true; break;
        case 'KeyE': this.keys.up = true; break;
        case 'KeyQ': this.keys.down = true; break;
        case 'ShiftLeft':
        case 'ShiftRight': this.keys.sprint = true; break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': this.keys.forward = false; break;
        case 'KeyS': this.keys.backward = false; break;
        case 'KeyA': this.keys.left = false; break;
        case 'KeyD': this.keys.right = false; break;
        case 'KeyE': this.keys.up = false; break;
        case 'KeyQ': this.keys.down = false; break;
        case 'ShiftLeft':
        case 'ShiftRight': this.keys.sprint = false; break;
      }
    });
  }

  public handleMouseMove(dx: number, dy: number): void {
    if (!this.enabled) return;
    const sensitivity = 0.0022;
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    this.pitch = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, this.pitch));

    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  public syncFromCamera(): void {
    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = euler.y;
    this.pitch = euler.x;
  }

  public update(dt: number): void {
    if (!this.enabled) return;

    const moveSpeed = this.speed * (this.keys.sprint ? 2.5 : 1.0) * dt;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0);

    if (this.keys.forward) this.camera.position.addScaledVector(forward, moveSpeed);
    if (this.keys.backward) this.camera.position.addScaledVector(forward, -moveSpeed);
    if (this.keys.right) this.camera.position.addScaledVector(right, moveSpeed);
    if (this.keys.left) this.camera.position.addScaledVector(right, -moveSpeed);
    if (this.keys.up) this.camera.position.addScaledVector(up, moveSpeed);
    if (this.keys.down) this.camera.position.addScaledVector(up, -moveSpeed);
  }
}
