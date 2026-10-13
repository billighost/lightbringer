import { EventBus } from '../combat/eventBus';
import { AnimationEventItem } from '../data/schemas';

export class AnimationEventManager {
  private entityId: string;
  // clipName -> sorted list of events
  private clipEvents: Map<string, AnimationEventItem[]> = new Map();
  // action clipName -> last processed playback time
  private lastTimes: Map<string, number> = new Map();

  constructor(entityId: string) {
    this.entityId = entityId;
  }

  public registerEvents(clipName: string, events: AnimationEventItem[]): void {
    // Keep events sorted by timestamp
    const sorted = [...events].sort((a, b) => a.time - b.time);
    this.clipEvents.set(clipName, sorted);
  }

  public clearClip(clipName: string): void {
    this.clipEvents.delete(clipName);
    this.lastTimes.delete(clipName);
  }

  public resetPlayback(clipName: string): void {
    this.lastTimes.delete(clipName);
  }

  /**
   * Update playback for a clip and dispatch any events whose timestamp falls in (prevTime, currTime].
   * Handles looping clips gracefully.
   */
  public update(clipName: string, currentTime: number, duration: number, isLooping = false): void {
    const events = this.clipEvents.get(clipName);
    if (!events || events.length === 0) return;

    const prevTime = this.lastTimes.get(clipName) ?? 0;
    this.lastTimes.set(clipName, currentTime);

    if (currentTime < prevTime && isLooping) {
      // Loop wrapped around: process from prevTime to duration, then 0 to currentTime
      this.dispatchRange(clipName, events, prevTime, duration);
      this.dispatchRange(clipName, events, 0, currentTime);
    } else {
      this.dispatchRange(clipName, events, prevTime, currentTime);
    }
  }

  private dispatchRange(clipName: string, events: AnimationEventItem[], from: number, to: number): void {
    for (const ev of events) {
      if (ev.time >= from && ev.time <= to) {
        EventBus.getInstance().emit('animationEvent', {
          eventName: ev.event,
          clipName,
          entityId: this.entityId,
          time: ev.time,
          payload: ev.payload
        });
      }
    }
  }
}
