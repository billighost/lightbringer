export type BufferedActionType = 'light_attack' | 'heavy_attack' | 'dodge' | 'jump';

export interface BufferedAction {
  type: BufferedActionType;
  timestamp: number; // in seconds
  payload?: any;
}

export class InputBuffer {
  private buffer: BufferedAction[] = [];
  public maxLifetime = 0.25; // 250ms window

  public queue(type: BufferedActionType, currentTime: number, payload?: any): void {
    // Avoid spamming duplicate identical action within 0.05s
    const existing = this.buffer.find((a) => a.type === type && (currentTime - a.timestamp) < 0.05);
    if (!existing) {
      this.buffer.push({ type, timestamp: currentTime, payload });
    }
  }

  public update(currentTime: number): void {
    // Drop expired inputs
    this.buffer = this.buffer.filter((a) => (currentTime - a.timestamp) <= this.maxLifetime);
  }

  public has(type: BufferedActionType): boolean {
    return this.buffer.some((a) => a.type === type);
  }

  public peek(): BufferedAction | null {
    return this.buffer.length > 0 ? this.buffer[0] : null;
  }

  public consume(types?: BufferedActionType[]): BufferedAction | null {
    if (this.buffer.length === 0) return null;

    if (!types || types.length === 0) {
      return this.buffer.shift() || null;
    }

    const index = this.buffer.findIndex((a) => types.includes(a.type));
    if (index !== -1) {
      const item = this.buffer.splice(index, 1)[0];
      return item;
    }

    return null;
  }

  public clear(): void {
    this.buffer = [];
  }

  public getQueueSummary(): string {
    if (this.buffer.length === 0) return '(empty)';
    return this.buffer.map((a) => a.type).join(', ');
  }
}
