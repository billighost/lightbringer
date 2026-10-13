export type FixedUpdateCallback = (fixedDt: number) => void;
export type RenderCallback = (alpha: number, dt: number) => void;

export class GameLoop {
  private fixedDt: number;
  private maxFrameTime: number;
  private accumulator = 0;
  private lastTime = 0;
  private isRunning = false;
  private animFrameId: number | null = null;

  private onFixedUpdate: FixedUpdateCallback;
  private onRender: RenderCallback;

  constructor(
    onFixedUpdate: FixedUpdateCallback,
    onRender: RenderCallback,
    physicsHz = 60,
    maxFrameTime = 0.1
  ) {
    this.fixedDt = 1 / physicsHz;
    this.maxFrameTime = maxFrameTime;
    this.onFixedUpdate = onFixedUpdate;
    this.onRender = onRender;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;

    const loop = (currentTime: number) => {
      if (!this.isRunning) return;

      const frameTime = Math.min((currentTime - this.lastTime) / 1000, this.maxFrameTime);
      this.lastTime = currentTime;

      this.accumulator += frameTime;

      // Fixed timestep updates
      while (this.accumulator >= this.fixedDt) {
        this.onFixedUpdate(this.fixedDt);
        this.accumulator -= this.fixedDt;
      }

      // Render interpolation factor
      const alpha = this.accumulator / this.fixedDt;
      this.onRender(alpha, frameTime);

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}
