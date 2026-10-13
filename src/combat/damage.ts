import { EventBus } from './eventBus';

export interface HealthConfig {
  maxHp: number;
}

export class HealthComponent {
  public maxHp: number;
  public currentHp: number;
  public isDead = false;
  private entityId: string;
  private eventBus = EventBus.getInstance();

  constructor(entityId: string, maxHp = 100) {
    this.entityId = entityId;
    this.maxHp = maxHp;
    this.currentHp = maxHp;
  }

  public takeDamage(amount: number): number {
    if (this.isDead || amount <= 0) return 0;

    const actualDamage = Math.min(this.currentHp, amount);
    this.currentHp = Math.max(0, this.currentHp - actualDamage);

    this.eventBus.emit('damaged', {
      targetId: this.entityId,
      amount: actualDamage,
      currentHp: this.currentHp,
      maxHp: this.maxHp
    });

    if (this.entityId === 'player') {
      this.eventBus.emit('healthChanged', {
        current: this.currentHp,
        max: this.maxHp,
        ratio: this.currentHp / this.maxHp
      });
    }

    if (this.currentHp <= 0 && !this.isDead) {
      this.isDead = true;
      this.eventBus.emit('death', { entityId: this.entityId });
    }

    return actualDamage;
  }

  public heal(amount: number): void {
    if (this.isDead) return;
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
    if (this.entityId === 'player') {
      this.eventBus.emit('healthChanged', {
        current: this.currentHp,
        max: this.maxHp,
        ratio: this.currentHp / this.maxHp
      });
    }
  }

  public reset(): void {
    this.currentHp = this.maxHp;
    this.isDead = false;
    if (this.entityId === 'player') {
      this.eventBus.emit('healthChanged', {
        current: this.currentHp,
        max: this.maxHp,
        ratio: 1.0
      });
    }
  }
}

export interface PoiseConfig {
  maxPoise: number;
  decayRate: number;      // poise recovered per second after delay
  decayDelay: number;     // seconds before poise begins recovering
}

export class PoiseComponent {
  public maxPoise: number;
  public currentPoise: number;
  public isBroken = false;
  private config: PoiseConfig;
  private decayTimer = 0;

  constructor(config?: Partial<PoiseConfig>) {
    this.config = {
      maxPoise: 60,
      decayRate: 20,
      decayDelay: 2.5,
      ...config
    };
    this.maxPoise = this.config.maxPoise;
    this.currentPoise = this.maxPoise;
  }

  public takePoiseDamage(amount: number, forceStagger = false): boolean {
    if (this.isBroken) return false;

    this.currentPoise = Math.max(0, this.currentPoise - amount);
    this.decayTimer = this.config.decayDelay;

    if (this.currentPoise <= 0 || forceStagger) {
      this.isBroken = true;
      this.currentPoise = 0;
      return true; // Poise broken!
    }

    return false;
  }

  public update(dt: number): void {
    if (this.isBroken) return; // Reset manually or after stagger state

    if (this.decayTimer > 0) {
      this.decayTimer -= dt;
      return;
    }

    if (this.currentPoise < this.maxPoise) {
      this.currentPoise = Math.min(this.maxPoise, this.currentPoise + this.config.decayRate * dt);
    }
  }

  public reset(): void {
    this.currentPoise = this.maxPoise;
    this.isBroken = false;
    this.decayTimer = 0;
  }
}
