type Handler<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private handlers: { [K in keyof Events]?: Handler<Events[K]>[] } = {};

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    (this.handlers[event] ??= []).push(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>) {
    const list = this.handlers[event];
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx >= 0) list.splice(idx, 1);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    const list = this.handlers[event];
    if (!list) return;
    for (const h of [...list]) h(payload);
  }
}

export interface GameEvents {
  log: { text: string; kind: 'info' | 'xp' | 'combat' | 'loot' | 'warning' };
  levelUp: { skill: string; level: number };
  hit: { targetKind: 'player' | 'monster'; targetId: string; amount: number; x: number; y: number };
  inventoryChanged: undefined;
  equipmentChanged: undefined;
  itemSelectionChanged: undefined;
  skillsChanged: undefined;
  playerDied: undefined;
  save: undefined;
}

export const bus = new EventBus<GameEvents>();

export function log(text: string, kind: GameEvents['log']['kind'] = 'info') {
  bus.emit('log', { text, kind });
}
