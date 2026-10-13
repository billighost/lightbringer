import { EventBus } from '../../combat/eventBus';

export type GatherableState = 'available' | 'depleted' | 'respawning';

export interface GatherableInitOptions {
  id: string;
  resourceId: string;
  name: string;
  position: [number, number, number];
  respawnSeconds?: number;
  interactionRadius?: number;
}

export class GatherableComponent {
  public id: string;
  public resourceId: string;
  public name: string;
  public position: [number, number, number];
  public respawnSeconds: number;
  public interactionRadius: number;

  public state: GatherableState = 'available';
  public respawnTimer = 0;

  // Visual lerp factors
  public currentScaleFactor = 1.0;
  public targetScaleFactor = 1.0;
  public currentGlowFactor = 1.0;
  public targetGlowFactor = 1.0;

  constructor(options: GatherableInitOptions) {
    this.id = options.id;
    this.resourceId = options.resourceId;
    this.name = options.name;
    this.position = options.position;
    this.respawnSeconds = options.respawnSeconds ?? 20;
    this.interactionRadius = options.interactionRadius ?? 2.8;
  }

  /**
   * Attempt to harvest the gatherable resource
   */
  public gather(): boolean {
    const bus = EventBus.getInstance();
    const pos = { x: this.position[0], y: this.position[1], z: this.position[2] };

    bus.emit('gatherAttempted', {
      resourceId: this.resourceId,
      gatherableId: this.id,
      position: pos
    });

    if (this.state !== 'available') {
      return false;
    }

    this.state = 'depleted';
    this.respawnTimer = this.respawnSeconds;
    this.targetScaleFactor = 0.28; // Visually collapsed pods / shards
    this.targetGlowFactor = 0.05; // Glow dims

    bus.emit('gathered', {
      resourceId: this.resourceId,
      gatherableId: this.id,
      position: pos
    });

    return true;
  }

  public update(dt: number): void {
    if (this.state === 'depleted' || this.state === 'respawning') {
      this.respawnTimer -= dt;

      if (this.respawnTimer <= 3.0 && this.state === 'depleted') {
        // Transition into respawning phase
        this.state = 'respawning';
        this.targetScaleFactor = 1.0;
        this.targetGlowFactor = 1.0;
      }

      if (this.respawnTimer <= 0) {
        this.state = 'available';
        this.respawnTimer = 0;
        this.targetScaleFactor = 1.0;
        this.targetGlowFactor = 1.0;
      }
    }

    // Smooth visual interpolation
    const lerpSpeed = dt * 4.0;
    this.currentScaleFactor += (this.targetScaleFactor - this.currentScaleFactor) * Math.min(1.0, lerpSpeed);
    this.currentGlowFactor += (this.targetGlowFactor - this.currentGlowFactor) * Math.min(1.0, lerpSpeed);
  }
}
