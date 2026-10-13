export interface MovementInput {
  forward: number; // -1 to 1
  right: number;   // -1 to 1
  sprint: boolean;
  jump: boolean;
  dodge: boolean;
  lightAttack: boolean;
  heavyAttack: boolean;
}

export class InputManager {
  private keys: Map<string, boolean> = new Map();
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private mouseWheelDelta = 0;
  private pointerLocked = false;
  private overlayElement: HTMLElement | null = null;
  private canvasElement: HTMLCanvasElement;
  private debugToggleCallbacks: (() => void)[] = [];

  // Single-frame action flags
  private jumpPressedThisFrame = false;
  private dodgePressedThisFrame = false;
  private lightAttackPressedThisFrame = false;
  private heavyAttackPressedThisFrame = false;

  // External action listener (for InputBuffer)
  private onActionListener?: (action: 'light_attack' | 'heavy_attack' | 'dodge' | 'jump') => void;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement | null) {
    this.canvasElement = canvas;
    this.overlayElement = overlay;

    this.setupKeyboardListeners();
    this.setupMouseListeners();
    this.setupPointerLock();
  }

  public setOnActionListener(listener: (action: 'light_attack' | 'heavy_attack' | 'dodge' | 'jump') => void): void {
    this.onActionListener = listener;
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Toggle debug with F1
      if (e.code === 'F1') {
        e.preventDefault();
        this.debugToggleCallbacks.forEach((cb) => cb());
        return;
      }

      this.keys.set(e.code, true);

      // Space is Dodge
      if (e.code === 'Space') {
        this.dodgePressedThisFrame = true;
        this.onActionListener?.('dodge');
      }

      // Alt or KeyF is Jump
      if (e.code === 'AltLeft' || e.code === 'AltRight' || e.code === 'KeyF' || e.code === 'KeyC') {
        e.preventDefault();
        this.jumpPressedThisFrame = true;
        this.onActionListener?.('jump');
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keys.set(e.code, false);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.jumpPressedThisFrame = false;
      this.dodgePressedThisFrame = false;
      this.lightAttackPressedThisFrame = false;
      this.heavyAttackPressedThisFrame = false;
    });
  }

  private setupMouseListeners(): void {
    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.pointerLocked) {
        this.mouseDeltaX += e.movementX;
        this.mouseDeltaY += e.movementY;
      }
    });

    window.addEventListener('wheel', (e: WheelEvent) => {
      if (this.pointerLocked) {
        this.mouseWheelDelta += e.deltaY;
      }
    }, { passive: true });

    window.addEventListener('mousedown', (e: MouseEvent) => {
      if (!this.pointerLocked) return;

      if (e.button === 0) {
        // LMB: Light Attack
        this.lightAttackPressedThisFrame = true;
        this.onActionListener?.('light_attack');
      } else if (e.button === 2) {
        // RMB: Heavy Attack
        e.preventDefault();
        this.heavyAttackPressedThisFrame = true;
        this.onActionListener?.('heavy_attack');
      }
    });

    window.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
    });
  }

  private setupPointerLock(): void {
    const requestLock = () => {
      if (!this.pointerLocked) {
        this.canvasElement.requestPointerLock();
      }
    };

    if (this.overlayElement) {
      this.overlayElement.addEventListener('click', () => {
        requestLock();
      });
    }

    this.canvasElement.addEventListener('click', () => {
      requestLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvasElement;
      if (this.overlayElement) {
        if (this.pointerLocked) {
          this.overlayElement.classList.add('hidden');
        } else {
          this.overlayElement.classList.remove('hidden');
        }
      }
    });
  }

  public onToggleDebug(callback: () => void): void {
    this.debugToggleCallbacks.push(callback);
  }

  public isLocked(): boolean {
    return this.pointerLocked;
  }

  public getMovementInput(): MovementInput {
    let forward = 0;
    let right = 0;

    if (this.keys.get('KeyW') || this.keys.get('ArrowUp')) forward += 1;
    if (this.keys.get('KeyS') || this.keys.get('ArrowDown')) forward -= 1;
    if (this.keys.get('KeyD') || this.keys.get('ArrowRight')) right += 1;
    if (this.keys.get('KeyA') || this.keys.get('ArrowLeft')) right -= 1;

    const sprint = !!(this.keys.get('ShiftLeft') || this.keys.get('ShiftRight'));
    const jump = this.jumpPressedThisFrame;
    const dodge = this.dodgePressedThisFrame;
    const lightAttack = this.lightAttackPressedThisFrame;
    const heavyAttack = this.heavyAttackPressedThisFrame;

    // Reset single-frame flags
    this.jumpPressedThisFrame = false;
    this.dodgePressedThisFrame = false;
    this.lightAttackPressedThisFrame = false;
    this.heavyAttackPressedThisFrame = false;

    return { forward, right, sprint, jump, dodge, lightAttack, heavyAttack };
  }

  public consumeMouseDelta(): { dx: number; dy: number } {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return { dx, dy };
  }

  public consumeWheelDelta(): number {
    const delta = this.mouseWheelDelta;
    this.mouseWheelDelta = 0;
    return delta;
  }
}
