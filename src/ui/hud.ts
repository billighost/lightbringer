import * as THREE from 'three';
import { EventBus } from '../combat/eventBus';

export class HUD {
  private container: HTMLDivElement;
  private healthFill: HTMLDivElement;
  private healthTrail: HTMLDivElement;
  private staminaFill: HTMLDivElement;
  private targetHudContainer: HTMLDivElement;
  private targetFill: HTMLDivElement;
  private targetName: HTMLDivElement;
  private floatingTextContainer: HTMLDivElement;
  private deathOverlay: HTMLDivElement;

  private targetBarTimer = 0;
  private camera!: THREE.Camera;
  private lastDummyPos = new THREE.Vector3();
  private hasTarget = false;

  private trailingHpRatio = 1.0;
  private currentHpRatio = 1.0;

  constructor() {
    this.injectStyles();

    this.container = document.createElement('div');
    this.container.id = 'combat-hud';
    this.container.innerHTML = `
      <!-- Player Status Bars (Bottom-Left) -->
      <div class="player-bars">
        <div class="bar-container hp-container">
          <div class="bar-label">HP</div>
          <div class="bar-track">
            <div class="bar-trail hp-trail"></div>
            <div class="bar-fill hp-fill"></div>
          </div>
        </div>
        <div class="bar-container stamina-container">
          <div class="bar-label">STM</div>
          <div class="bar-track">
            <div class="bar-fill stamina-fill"></div>
          </div>
        </div>
      </div>

      <!-- Target Dummy Health Bar (Top Center) -->
      <div class="target-bar-wrap hidden">
        <div class="target-name">Training Dummy</div>
        <div class="target-track">
          <div class="target-fill"></div>
        </div>
      </div>

      <!-- Floating Combat Text Container -->
      <div id="floating-combat-text"></div>

      <!-- Death Screen Overlay -->
      <div id="death-overlay" class="hidden">
        <div class="death-title">YOU DIED</div>
        <div class="death-subtitle">Respawning...</div>
      </div>
    `;

    document.body.appendChild(this.container);

    this.healthFill = this.container.querySelector('.hp-fill') as HTMLDivElement;
    this.healthTrail = this.container.querySelector('.hp-trail') as HTMLDivElement;
    this.staminaFill = this.container.querySelector('.stamina-fill') as HTMLDivElement;
    this.targetHudContainer = this.container.querySelector('.target-bar-wrap') as HTMLDivElement;
    this.targetFill = this.container.querySelector('.target-fill') as HTMLDivElement;
    this.targetName = this.container.querySelector('.target-name') as HTMLDivElement;
    this.floatingTextContainer = this.container.querySelector('#floating-combat-text') as HTMLDivElement;
    this.deathOverlay = this.container.querySelector('#death-overlay') as HTMLDivElement;

    this.setupEventListeners();
  }

  public setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      #combat-hud {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 15;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      .player-bars {
        position: absolute;
        bottom: 24px;
        left: 24px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 260px;
      }
      .bar-container {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(10, 14, 20, 0.75);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        padding: 5px 8px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
      }
      .bar-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1px;
        color: #94a3b8;
        width: 28px;
      }
      .bar-track {
        position: relative;
        flex: 1;
        height: 12px;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 3px;
        overflow: hidden;
      }
      .bar-fill {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        border-radius: 3px;
        transition: width 0.08s ease-out;
      }
      .hp-fill {
        background: linear-gradient(90deg, #e53935, #ef5350);
        z-index: 2;
      }
      .hp-trail {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        background: rgba(255, 255, 255, 0.65);
        z-index: 1;
        border-radius: 3px;
        transition: width 0.35s ease-out;
      }
      .stamina-fill {
        background: linear-gradient(90deg, #2e7d32, #43a047);
        transition: width 0.05s linear;
      }
      .stamina-container.denied-flash {
        animation: stamina-flash 0.3s ease-out;
      }
      @keyframes stamina-flash {
        0%, 100% { border-color: rgba(255, 255, 255, 0.12); }
        50% { border-color: #ff3344; box-shadow: 0 0 16px rgba(255, 51, 68, 0.8); }
      }
      /* Target Dummy Bar */
      .target-bar-wrap {
        position: absolute;
        top: 24px;
        left: 50%;
        transform: translateX(-50%);
        width: 320px;
        background: rgba(10, 14, 20, 0.85);
        backdrop-filter: blur(8px);
        padding: 6px 12px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
        transition: opacity 0.3s ease, visibility 0.3s ease;
      }
      .target-bar-wrap.hidden {
        opacity: 0;
        visibility: hidden;
      }
      .target-name {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: #e2e8f0;
        margin-bottom: 4px;
        text-align: center;
      }
      .target-track {
        height: 8px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
      }
      .target-fill {
        height: 100%;
        width: 100%;
        background: linear-gradient(90deg, #d32f2f, #f44336);
        transition: width 0.12s ease-out;
      }
      /* Floating Combat Text */
      .fct-number {
        position: absolute;
        font-size: 22px;
        font-weight: 800;
        color: #ffeb3b;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9), 0 0 4px rgba(255, 235, 59, 0.6);
        pointer-events: none;
        animation: float-up 0.85s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
      }
      .fct-heavy {
        font-size: 32px;
        color: #ff5722;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9), 0 0 8px rgba(255, 87, 34, 0.8);
      }
      .fct-dodged {
        font-size: 26px;
        font-weight: 900;
        color: #00e676;
        letter-spacing: 2px;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9), 0 0 10px rgba(0, 230, 118, 0.8);
        animation: float-up 1.0s cubic-bezier(0.15, 0.9, 0.3, 1) forwards;
      }
      @keyframes float-up {
        0% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.6);
        }
        15% {
          opacity: 1;
          transform: translate(-50%, -65%) scale(1.15);
        }
        30% {
          transform: translate(-50%, -75%) scale(1.0);
        }
        80% {
          opacity: 1;
        }
        100% {
          opacity: 0;
          transform: translate(-50%, -120%) scale(0.9);
        }
      }
      /* Death Overlay */
      #death-overlay {
        position: fixed;
        inset: 0;
        background: rgba(10, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 50;
        transition: opacity 0.8s ease, visibility 0.8s ease;
      }
      #death-overlay.hidden {
        opacity: 0;
        visibility: hidden;
      }
      .death-title {
        font-size: 54px;
        font-weight: 900;
        letter-spacing: 8px;
        color: #b71c1c;
        text-shadow: 0 4px 20px rgba(0, 0, 0, 0.9);
        margin-bottom: 12px;
      }
      .death-subtitle {
        font-size: 15px;
        letter-spacing: 2px;
        color: #94a3b8;
      }
    `;
    document.head.appendChild(style);
  }

  private setupEventListeners(): void {
    const bus = EventBus.getInstance();

    bus.on('healthChanged', (e) => {
      this.currentHpRatio = Math.max(0, Math.min(1, e.ratio));
      this.healthFill.style.width = `${(this.currentHpRatio * 100).toFixed(1)}%`;
    });

    bus.on('staminaChanged', (e) => {
      const ratio = Math.max(0, Math.min(1, e.ratio));
      this.staminaFill.style.width = `${(ratio * 100).toFixed(1)}%`;
    });

    bus.on('staminaDenied', () => {
      const parent = this.staminaFill.closest('.stamina-container') as HTMLElement;
      if (parent) {
        parent.classList.remove('denied-flash');
        // Trigger reflow to restart animation
        void parent.offsetWidth;
        parent.classList.add('denied-flash');
      }
    });

    bus.on('dummyDamaged', (e) => {
      this.hasTarget = true;
      this.targetBarTimer = 4.0;
      this.lastDummyPos.set(e.position.x, e.position.y, e.position.z);
      this.targetHudContainer.classList.remove('hidden');
      const ratio = Math.max(0, Math.min(1, e.currentHp / e.maxHp));
      this.targetFill.style.width = `${(ratio * 100).toFixed(1)}%`;
      this.targetName.textContent = e.dummyId.replace('_', ' ').toUpperCase();

      // Spawn floating damage number
      this.spawnDamageNumber(e.damage, e.position);
    });

    bus.on('dummyReset', () => {
      this.targetHudContainer.classList.add('hidden');
      this.hasTarget = false;
    });

    bus.on('dodged', (e) => {
      this.spawnDodgedText(e.position);
    });

    bus.on('death', () => {
      this.deathOverlay.classList.remove('hidden');
    });

    bus.on('respawn', () => {
      this.deathOverlay.classList.add('hidden');
    });
  }

  public spawnDamageNumber(amount: number, worldPos: { x: number; y: number; z: number }): void {
    const screenPos = this.projectToScreen(worldPos);
    if (!screenPos) return;

    const el = document.createElement('div');
    el.className = `fct-number ${amount >= 50 ? 'fct-heavy' : ''}`;
    el.textContent = `${Math.round(amount)}`;

    // Add random slight jitter to screen position
    const jitterX = (Math.random() - 0.5) * 30;
    const jitterY = (Math.random() - 0.5) * 20;

    el.style.left = `${screenPos.x + jitterX}px`;
    el.style.top = `${screenPos.y + jitterY}px`;

    this.floatingTextContainer.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 850);
  }

  public spawnDodgedText(worldPos: { x: number; y: number; z: number }): void {
    const screenPos = this.projectToScreen(worldPos);
    if (!screenPos) return;

    const el = document.createElement('div');
    el.className = 'fct-dodged';
    el.textContent = 'DODGED!';

    el.style.left = `${screenPos.x}px`;
    el.style.top = `${screenPos.y - 25}px`;

    this.floatingTextContainer.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 1000);
  }

  private projectToScreen(pos: { x: number; y: number; z: number }): { x: number; y: number } | null {
    if (!this.camera) return null;

    const v = new THREE.Vector3(pos.x, pos.y, pos.z);
    v.project(this.camera);

    // If behind camera, skip
    if (v.z > 1.0) return null;

    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;

    return { x, y };
  }

  public update(dt: number): void {
    // Smooth trailing health damage bar
    if (this.trailingHpRatio > this.currentHpRatio) {
      this.trailingHpRatio = Math.max(this.currentHpRatio, this.trailingHpRatio - dt * 0.6);
      this.healthTrail.style.width = `${(this.trailingHpRatio * 100).toFixed(1)}%`;
    } else if (this.trailingHpRatio < this.currentHpRatio) {
      this.trailingHpRatio = this.currentHpRatio;
      this.healthTrail.style.width = `${(this.trailingHpRatio * 100).toFixed(1)}%`;
    }

    // Target bar auto-hide
    if (this.hasTarget) {
      this.targetBarTimer -= dt;
      if (this.targetBarTimer <= 0) {
        this.targetBarTimer = 0;
        this.hasTarget = false;
        this.targetHudContainer.classList.add('hidden');
      }
    }
  }
}
