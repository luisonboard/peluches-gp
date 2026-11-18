// Presets de calidad con detección automática conservadora y resolución dinámica.
import type { WebGLRenderer } from 'three';

export type QualityName = 'low' | 'medium' | 'high';

export interface Quality {
  name: QualityName;
  /** Tope de devicePixelRatio. */
  maxPixelRatio: number;
  /** Tamaño del mapa de sombras (0 = sin sombras: se usan manchas bajo los karts). */
  shadowMap: number;
  antialias: boolean;
  /** Partículas máximas por sistema. */
  particles: number;
  anisotropy: number;
  /** 0..1: cuánta decoración extra se coloca. */
  scenery: number;
  /** Barreras con cantos redondeados. */
  roundedBarriers: boolean;
}

export const PRESETS: Record<QualityName, Quality> = {
  low: { name: 'low', maxPixelRatio: 1.5, shadowMap: 0, antialias: false, particles: 500, anisotropy: 2, scenery: 0.5, roundedBarriers: false },
  medium: { name: 'medium', maxPixelRatio: 1.5, shadowMap: 1024, antialias: true, particles: 1200, anisotropy: 4, scenery: 1, roundedBarriers: true },
  high: { name: 'high', maxPixelRatio: 2, shadowMap: 2048, antialias: true, particles: 2000, anisotropy: 8, scenery: 1, roundedBarriers: true },
};

export function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
}

export function detectQuality(forced: string | null): Quality {
  if (forced && forced in PRESETS) return { ...PRESETS[forced as QualityName] };
  return { ...(isMobile() ? PRESETS.low : PRESETS.medium) };
}

const MIN_SCALE = 0.6;

/** Baja la resolución si los cuadros llegan tarde y la sube con cautela cuando sobra tiempo. */
export class DynamicResolution {
  scale = 1;
  private acc = 0;
  private n = 0;
  private timer = 0;
  private cooldown = 2;

  constructor(private renderer: WebGLRenderer, private base: number, public targetMs: number) {
    this.apply();
  }

  get pixelRatio(): number {
    return Math.max(0.5, this.base * this.scale);
  }

  /** La resolución ya está en su mínimo (no puede bajar más para ganar tiempo). */
  get atFloor(): boolean {
    return this.scale <= MIN_SCALE + 1e-6;
  }

  /** Cambia el tope de resolución (al cambiar de calidad). */
  setBase(base: number): void {
    this.base = base;
    this.apply();
  }

  apply(): void {
    this.renderer.setPixelRatio(this.pixelRatio);
  }

  sample(intervalMs: number, dt: number): void {
    if (intervalMs > 100) return; // pestaña en segundo plano o pausa del navegador
    this.acc += intervalMs;
    this.n++;
    this.timer += dt;
    this.cooldown -= dt;
    if (this.timer < 1) return;
    const avg = this.acc / this.n;
    this.acc = this.n = this.timer = 0;
    if (avg > this.targetMs * 1.2 && this.scale > MIN_SCALE) {
      this.scale = Math.max(MIN_SCALE, this.scale - 0.1);
      this.apply();
      this.cooldown = 4;
    } else if (avg < this.targetMs * 1.06 && this.scale < 1 && this.cooldown <= 0) {
      this.scale = Math.min(1, this.scale + 0.05);
      this.apply();
      this.cooldown = 3;
    }
  }
}

/**
 * Protector de temperatura para la pantalla dividida de 3 y 4 jugadores: si con la resolución al mínimo los cuadros
 * siguen llegando tarde durante unos segundos, el equipo está al límite (y se calienta). Entonces conviene pasar a
 * 30 fps estables, que se ven mejor que 40–50 fps irregulares y gastan la mitad.
 */
export class HeatGuard {
  enabled = false;
  /** Ya pasó a 30 fps (no vuelve a subir hasta salir de la pantalla dividida). */
  tripped = false;
  private slowT = 0;

  reset(enabled: boolean): void {
    this.enabled = enabled;
    this.tripped = false;
    this.slowT = 0;
  }

  /** Devuelve true en el cuadro en que decide bajar a 30 fps. */
  sample(dt: number, frameMs: number, targetMs: number, atFloor: boolean): boolean {
    if (!this.enabled || this.tripped) return false;
    if (atFloor && frameMs > targetMs * 1.18) this.slowT += dt;
    else this.slowT = Math.max(0, this.slowT - dt * 2);
    if (this.slowT < 4) return false;
    this.tripped = true;
    return true;
  }
}

/** Tiempo de GPU real con EXT_disjoint_timer_query_webgl2 (si existe). */
export class GpuTimer {
  lastMs = -1;
  private gl: WebGL2RenderingContext;
  private ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  private pending: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;

  constructor(renderer: WebGLRenderer) {
    this.gl = renderer.getContext() as WebGL2RenderingContext;
    this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
  }

  get supported(): boolean {
    return !!this.ext;
  }

  begin(): void {
    if (!this.ext || this.active || this.pending.length > 4) return;
    const q = this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  end(): void {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
    this.poll();
  }

  private poll(): void {
    const gl = this.gl;
    while (this.pending.length) {
      const q = this.pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      if (!gl.getParameter(this.ext!.GPU_DISJOINT_EXT)) this.lastMs = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(q);
      this.pending.shift();
    }
  }
}
