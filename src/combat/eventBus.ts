export type CombatEventType =
  | 'hit'
  | 'damaged'
  | 'dodged'
  | 'staminaDenied'
  | 'staminaChanged'
  | 'healthChanged'
  | 'death'
  | 'respawn'
  | 'stateChange'
  | 'dummyDamaged'
  | 'dummyPoiseBreak'
  | 'dummyReset'
  | 'animationEvent';

export interface AnimationEventPayload {
  eventName: string;
  clipName: string;
  entityId: string;
  time: number;
  payload?: Record<string, unknown>;
}

export interface CombatHitEvent {
  attackerId: string;
  targetId: string;
  damage: number;
  poiseDamage: number;
  hitPoint: { x: number; y: number; z: number };
  isHeavy: boolean;
  stagger: boolean;
}

export interface DamageEvent {
  targetId: string;
  amount: number;
  currentHp: number;
  maxHp: number;
}

export interface StateChangeEvent {
  previousState: string;
  currentState: string;
  timeInPreviousState: number;
}

export interface EventPayloadMap {
  hit: CombatHitEvent;
  damaged: DamageEvent;
  dodged: { position: { x: number; y: number; z: number } };
  staminaDenied: { action: string; required: number; current: number };
  staminaChanged: { current: number; max: number; ratio: number };
  healthChanged: { current: number; max: number; ratio: number };
  death: { entityId: string };
  respawn: { entityId: string };
  stateChange: StateChangeEvent;
  dummyDamaged: { dummyId: string; damage: number; currentHp: number; maxHp: number; position: { x: number; y: number; z: number } };
  dummyPoiseBreak: { dummyId: string };
  dummyReset: { dummyId: string };
  animationEvent: AnimationEventPayload;
}

type EventListener<K extends CombatEventType> = (payload: EventPayloadMap[K]) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<CombatEventType, Set<EventListener<any>>> = new Map();

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on<K extends CombatEventType>(event: K, listener: EventListener<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(listener);

    return () => {
      set.delete(listener);
    };
  }

  public emit<K extends CombatEventType>(event: K, payload: EventPayloadMap[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const listener of set) {
        listener(payload);
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}
