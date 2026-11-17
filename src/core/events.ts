// Bus de eventos tipado. La jugabilidad emite; audio, HUD y efectos escuchan.

export interface EventMap {
  'race:countdown': { n: number };
  'race:go': undefined;
  'race:done': undefined;
  'kart:lap': { kart: number; lap: number };
  'kart:finish': { kart: number; place: number; time: number };
  'kart:boost': { kart: number; kind: 'mini' | 'pad' | 'start'; seconds: number };
  'kart:bump': { kart: number; strength: number; wall: boolean };
  'kart:drift': { kart: number; level: number };
  'kart:hop': { kart: number };
  'kart:land': { kart: number; strength: number };
  /** Pisó un charco de jabón. */
  'kart:slip': { kart: number };
  /** Golpe recibido. `by` = kart que lo causó (−1 si nadie). */
  'kart:hit': { kart: number; kind: HitKind; by: number };
  'box:open': { kart: number; x: number; y: number; z: number };
  'item:get': { kart: number; item: ItemId };
  'item:use': { kart: number; item: ItemId };
  'power:ready': { kart: number };
  'power:use': { kart: number; power: Species };
  'fx:explode': { x: number; y: number; z: number; big: boolean };
  'fx:quake': { kart: number; x: number; y: number; z: number };
  'fx:lightning': { kart: number };
  /** La mano telescópica de Robotín se agarra (a un rival si `caught`, si no a la pista) y lo jala. */
  'fx:grab': { kart: number; caught: boolean };
}

export type HitKind = 'spin' | 'stuck' | 'bubble' | 'shrink' | 'tumble';
export type ItemId = 'turbo' | 'pelota' | 'chicle';
export type Species = 'perro' | 'esponja' | 'raton' | 'zorro' | 'dino' | 'robot';

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<keyof EventMap, Set<Handler<unknown>>>();

  on<K extends keyof EventMap>(type: K, fn: Handler<EventMap[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn as Handler<unknown>);
    return () => set!.delete(fn as Handler<unknown>);
  }

  emit<K extends keyof EventMap>(type: K, ...payload: EventMap[K] extends undefined ? [] : [EventMap[K]]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload[0]);
      } catch (error) {
        reportError(`event:${String(type)}`, error);
      }
    }
  }
}

export const bus = new EventBus();

// --- Registro de errores: window.__errors, cada origen se registra una vez ---
declare global {
  interface Window {
    __errors: { source: string; message: string; time: number }[];
    __game: unknown;
    __bench: unknown;
  }
}
window.__errors = window.__errors ?? [];
const reported = new Set<string>();

export function reportError(source: string, error: unknown): void {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  const key = `${source}|${message.split('\n')[0]}`;
  if (reported.has(key)) return;
  reported.add(key);
  window.__errors.push({ source, message, time: performance.now() });
  console.error(`[Peluches GP] ${source}:`, error);
}

export function installErrorHooks(): void {
  addEventListener('error', (e) => reportError('window', e.error ?? e.message));
  addEventListener('unhandledrejection', (e) => reportError('promise', e.reason));
}
