// Giroscopio como volante: se lee la gravedad (devicemotion) en el plano de la pantalla, teniendo en cuenta
// hacia qué lado está girada. Girar el teléfono en el sentido de las agujas del reloj = girar a la derecha.
// El ángulo se mide respecto a la posición de calibración ("recto"), así que da igual cómo lo sostenga.
import { GYRO_RANGE, type GyroSens } from '../core/settings';

const DEAD_DEG = 4;

type Permission = 'desconocido' | 'concedido' | 'denegado' | 'no disponible';

export class Gyro {
  permission: Permission = 'desconocido';
  sens: GyroSens = 'normal';
  invert = false;
  /** Ángulo del teléfono en el plano de la pantalla (rad). */
  private roll = 0;
  private calib = 0;
  private hasData = false;
  private smooth = 0;
  private listening = false;

  get active(): boolean {
    return this.permission === 'concedido' && this.hasData;
  }

  /** Debe llamarse dentro de un toque o clic (Safari en iPhone lo exige). */
  enable(): Promise<boolean> {
    const DM = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
    if (!DM || !window.isSecureContext) {
      this.permission = 'no disponible';
      return Promise.resolve(false);
    }
    const start = (): boolean => {
      if (!this.listening) addEventListener('devicemotion', this.onMotion);
      this.listening = true;
      this.permission = 'concedido';
      return true;
    };
    if (typeof DM.requestPermission === 'function') {
      return DM.requestPermission()
        .then((r) => (r === 'granted' ? start() : ((this.permission = 'denegado'), false)))
        .catch(() => ((this.permission = 'denegado'), false));
    }
    return Promise.resolve(start());
  }

  private onMotion = (e: DeviceMotionEvent): void => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null || g.y == null) return;
    const deg = screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;
    const a = (deg * Math.PI) / 180;
    const sx = g.x * Math.cos(a) + g.y * Math.sin(a);
    const sy = -g.x * Math.sin(a) + g.y * Math.cos(a);
    if (Math.hypot(sx, sy) < 2) return; // teléfono casi plano: se conserva el último valor
    this.roll = Math.atan2(sx, sy);
    if (!this.hasData) {
      this.hasData = true;
      this.calibrate();
    }
  };

  /** La posición actual pasa a ser "recto". */
  calibrate(): void {
    this.calib = this.roll;
    this.smooth = 0;
  }

  /** Inclinación actual en grados respecto a "recto" (+ = a la derecha). */
  get tiltDeg(): number {
    let d = this.roll - this.calib;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return ((-d * 180) / Math.PI) * (this.invert ? -1 : 1);
  }

  /** Volante −1..1, con zona muerta y suavizado. */
  steer(dt: number): number {
    if (!this.active) return 0;
    const deg = this.tiltDeg;
    const range = GYRO_RANGE[this.sens];
    const mag = Math.max(0, Math.abs(deg) - DEAD_DEG) / (range - DEAD_DEG);
    const v = Math.sign(deg) * Math.min(1, mag);
    this.smooth += (v - this.smooth) * Math.min(1, dt * 14);
    return this.smooth;
  }
}
