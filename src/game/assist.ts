// Ayuda de manejo: aceleración automática y dirección asistida.
// La dirección asistida mira la pista por delante y, si el kart va a salirse o el niño no gira, corrige con suavidad.
// Si el niño gira, manda él salvo cuando va a chocar.
import type { Kart, KartCtl } from './kart';
import { wrapAngle } from './kart';

export interface AssistOpts {
  autoAccel: boolean;
  smartSteer: boolean;
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function applyAssist(k: Kart, c: KartCtl, o: AssistOpts, out: KartCtl): KartCtl {
  Object.assign(out, c);
  if (o.autoAccel && c.brake < 0.1) out.throttle = Math.max(c.throttle, 1);
  if (!o.smartSteer) return out;
  const tr = k.track;
  const S = tr.samples;
  const N = tr.N;
  const here = S[k.idx];
  const look = Math.round(8 + Math.abs(k.speed) * 0.45);
  const s = S[(k.idx + look) % N];
  // Mantiene el carril del niño, pero dentro de una zona segura.
  const safe = s.hw - 1.8;
  const lat = Math.max(-safe, Math.min(safe, k.lat));
  const tx = s.x + s.nx * lat;
  const tz = s.z + s.nz * lat;
  const diff = wrapAngle(Math.atan2(tx - k.pos.x, tz - k.pos.z) - k.heading);
  const guide = Math.max(-1, Math.min(1, -diff * 2.4));
  // Peligro: posición lateral prevista en 0,7 s, mezclando hacia dónde va el kart y hacia dónde apunta el morro.
  const latV = k.vel.x * here.nx + k.vel.z * here.nz;
  const latH = (Math.sin(k.heading) * here.nx + Math.cos(k.heading) * here.nz) * Math.abs(k.speed);
  const pred = Math.abs(k.lat + (latV * 0.5 + latH * 0.5) * 0.7);
  const edge = here.hw + 0.6;
  const danger = smoothstep(edge - 4.5, edge + 0.5, pred);
  const idle = Math.abs(c.steer) < 0.12;
  const w = idle ? 1 : Math.min(0.95, danger);
  out.steer = c.steer + (guide - c.steer) * w;
  return out;
}
