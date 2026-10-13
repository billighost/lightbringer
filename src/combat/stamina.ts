import { EventBus } from './eventBus';

export interface StaminaConfig {
  maxStamina: number;
  regenRate: number;        // per second (default 25)
  regenDelay: number;       // seconds after spend before regen starts (default 1.0)
  exhaustedDelay: number;   // seconds extra delay if stamina hit 0 (default 1.2)
  sprintCostPerSecond: number; // default 12
  lightAttackCost: number;     // default 15
  heavyAttackCost: number;     // default 30
  dodgeCost: number;           // default 20
  jumpCost: number;            // default 0
}

export class StaminaSystem {
  public config: StaminaConfig;
  public current: number;
  public isExhausted = false;
  private delayTimer = 0;
  private isRegenPaused = false;
  private eventBus = EventBus.getInstance();

  constructor(customConfig?: Partial<StaminaConfig>) {
    this.config = {
      maxStamina: 100,
      regenRate: 25,
      regenDelay: 1.0,
      exhaustedDelay: 1.2,
      sprintCostPerSecond: 12,
      lightAttackCost: 15,
      heavyAttackCost: 30,
      dodgeCost: 20,
      jumpCost: 0,
      ...customConfig
    };
    this.current = this.config.maxStamina;
  }

  public setRegenPaused(paused: boolean): void {
    this.isRegenPaused = paused;
  }

  /**
   * Try consuming stamina for an action.
   * Souls rule: action allowed if current stamina >= 1.
   * If action succeeds, stamina can dip to 0.
   * If stamina was < 1 or insufficient, action denied.
   */
  public tryConsume(action: string, amount: number): boolean {
    if (amount <= 0) return true;

    // Souls rule: Cannot initiate action if stamina < 1
    if (this.current < 1) {
      this.eventBus.emit('staminaDenied', {
        action,
        required: amount,
        current: this.current
      });
      return false;
    }

    // Consume stamina (can dip to 0)
    const prev = this.current;
    this.current = Math.max(0, this.current - amount);

    // If dipped to 0, trigger exhausted delay
    if (this.current === 0) {
      this.isExhausted = true;
      this.delayTimer = this.config.regenDelay + this.config.exhaustedDelay;
    } else {
      this.delayTimer = this.config.regenDelay;
    }

    if (prev !== this.current) {
      this.emitChange();
    }

    return true;
  }

  /**
   * Continuous drain (for sprinting). Returns true if sprint can continue.
   */
  public drainContinuous(amount: number, dt: number): boolean {
    const drain = amount * dt;
    if (this.current <= 0) {
      this.isExhausted = true;
      this.delayTimer = this.config.regenDelay + this.config.exhaustedDelay;
      return false;
    }

    this.current = Math.max(0, this.current - drain);
    if (this.current === 0) {
      this.isExhausted = true;
      this.delayTimer = this.config.regenDelay + this.config.exhaustedDelay;
    } else {
      this.delayTimer = this.config.regenDelay;
    }

    this.emitChange();
    return this.current > 0;
  }

  public update(dt: number): void {
    if (this.delayTimer > 0) {
      this.delayTimer -= dt;
      if (this.delayTimer <= 0.0001) {
        this.delayTimer = 0;
        this.isExhausted = false;
      }
      return;
    }

    // Regen if not paused
    if (!this.isRegenPaused && this.current < this.config.maxStamina) {
      this.current = Math.min(this.config.maxStamina, this.current + this.config.regenRate * dt);
      this.emitChange();
    }
  }

  public refill(): void {
    this.current = this.config.maxStamina;
    this.delayTimer = 0;
    this.isExhausted = false;
    this.emitChange();
  }

  public getRatio(): number {
    return this.current / this.config.maxStamina;
  }

  private emitChange(): void {
    this.eventBus.emit('staminaChanged', {
      current: this.current,
      max: this.config.maxStamina,
      ratio: this.getRatio()
    });
  }
}
