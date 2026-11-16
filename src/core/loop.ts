// Bucle principal: límite de fps, dt acotado a 0,05 s y aislamiento de errores.
import { reportError } from './events';

export class Loop {
  /** Límite de fps (0 = sin límite). Menús a 30, carrera a 60. */
  fpsLimit = 60;
  /** Intervalo real entre cuadros presentados, en ms (suavizado). */
  frameMs = 16.7;
  /** Intervalo del último cuadro, sin suavizar. */
  lastIntervalMs = 16.7;
  private last = 0;
  private running = false;

  constructor(private frame: (dt: number, now: number) => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    requestAnimationFrame(this.tick);
    if (this.fpsLimit > 0 && now - this.last < 1000 / this.fpsLimit - 1.5) return;
    const interval = now - this.last;
    this.last = now;
    this.lastIntervalMs = interval;
    if (interval < 200) this.frameMs += (interval - this.frameMs) * 0.1;
    const dt = Math.min(0.05, interval / 1000);
    try {
      this.frame(dt, now);
    } catch (error) {
      reportError('frame', error);
    }
  };
}
