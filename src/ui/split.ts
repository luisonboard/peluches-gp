// Pantalla dividida: "Pulsa un botón para unirte". Cada jugador se une con su dispositivo (teclado o mando) y con
// ese mismo dispositivo elige peluche (◀ ▶), perfil (▲ ▼) y dice "listo" (B / Enter). Con los dos listos, empieza.
// Un teléfono también sirve de mando: se escanea el QR y se pulsa «¡Unirme!» en él (ver net/pad.ts y pad/phone.ts).
import { phoneQrBox, watchPhoneUrl } from './phoneQr';
import { CHARACTERS, displayName, cssColor } from '../game/characters';
import type { DeviceId, MenuEvent } from '../input/input';
import type { Profile } from '../core/settings';
import { LOCAL_COLORS } from './hud';

export interface SplitPlayer {
  dev: DeviceId;
  charIndex: number;
  profile: Profile;
}

export interface SplitDeps {
  /** Peluche y perfil guardados de cada jugador (al unirse empiezan así). */
  saved: [{ charIndex: number; profile: Profile }, { charIndex: number; profile: Profile }];
  /** Qué se va a correr ("Cuarto de Juegos · 3 vueltas · rivales Fácil"). */
  summary: string;
  deviceName: (dev: DeviceId) => string;
  /** Dirección para abrir el mando en un teléfono (se resuelve cuando la sala de mandos está abierta). */
  phoneUrl: Promise<{ url: string; code: string }>;
  onStart: (players: [SplitPlayer, SplitPlayer]) => void;
  onBack: () => void;
}

const CSS = `
.pgp-split { width: min(760px, 100%); }
.pgp-split h2 { margin: 0 0 2px; text-align: center; font-size: 30px; }
.pgp-split .sum { text-align: center; color: #6a64a0; font-weight: 800; margin-bottom: 12px; }
.pgp-split .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 560px) { .pgp-split .cols { grid-template-columns: 1fr; } }
.pgp-split .col { border-radius: 22px; background: #f1effa; padding: 12px; display: grid; gap: 8px; justify-items: center; align-content: start;
  min-height: 210px; border: 4px solid transparent; min-width: 0; }
.pgp-split .col.ready { border-color: #3fb24a; background: #ecfbe9; }
.pgp-split .who { font-weight: 900; font-size: 22px; paint-order: stroke fill; -webkit-text-stroke: 5px #2a2050; letter-spacing: .5px; }
.pgp-split .dev { font-size: 13px; font-weight: 800; color: #6a64a0; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.pgp-split .wait { font-size: 20px; font-weight: 900; text-align: center; margin-top: 18px; animation: pgp-blink 1.2s steps(2) infinite; }
.pgp-split .keys { font-size: 13px; font-weight: 700; color: #6a64a0; text-align: center; }
.pgp-split .pick { display: flex; align-items: center; gap: 10px; }
.pgp-split .pick button, .pgp-split .prof button { font: inherit; font-weight: 900; cursor: pointer; }
.pgp-split .arrow { border: 0; background: #2a2050; color: #fff; width: 40px; height: 40px; border-radius: 50%; font-size: 18px; }
.pgp-split .face { width: 64px; height: 64px; border-radius: 22px; position: relative; box-shadow: inset 0 -8px 0 rgba(0,0,0,0.18); }
.pgp-split .face::before, .pgp-split .face::after { content: ""; position: absolute; top: 22px; width: 12px; height: 14px; border-radius: 50%; background: #fff; box-shadow: inset 3px 2px 0 2px #1e2236; }
.pgp-split .face::before { left: 14px } .pgp-split .face::after { right: 14px }
.pgp-split .nm { font-weight: 900; font-size: 18px; }
.pgp-split .prof { display: flex; gap: 6px; }
.pgp-split .state { font-weight: 900; font-size: 15px; color: #6a64a0; }
.pgp-split .col.ready .state { color: #2f9a4a; }
.pgp-split .btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 14px; }
.pgp-split .btns .pgp-go { margin: 0; font-size: 22px; padding: 12px 30px; }
.pgp-split .btns .alt { background: #2f7de0; box-shadow: 0 7px 0 #1d5aa8; }
.pgp-split .pgp-go:disabled { opacity: .45; cursor: default; }
@media (max-height: 520px) {
  .pgp-split h2 { font-size: 22px; }
  .pgp-split .sum { margin-bottom: 6px; font-size: 13px; }
  .pgp-split .col { min-height: 0; padding: 8px; gap: 4px; }
  .pgp-split .face { width: 40px; height: 40px; border-radius: 14px; }
  .pgp-split .face::before, .pgp-split .face::after { top: 13px; width: 8px; height: 9px; }
  .pgp-split .face::before { left: 8px } .pgp-split .face::after { right: 8px }
  .pgp-split .btns { margin-top: 8px; }
  .pgp-split .btns .pgp-go { font-size: 17px; padding: 8px 18px; }
}
`;

let styled = false;

interface Slot {
  dev: DeviceId;
  charIndex: number;
  profile: Profile;
  ready: boolean;
}

export interface SplitJoin {
  input: (ev: MenuEvent[]) => void;
  close: () => void;
  /** Vuelve a dibujar (por ejemplo, si un teléfono se conectó o se fue). */
  refresh: () => void;
  /** Qué jugador es ese dispositivo y con qué peluche, o `null` si aún no se unió. */
  info: (dev: DeviceId) => { who: number; name: string; ready: boolean } | null;
}

/** Abre la pantalla. Devuelve el manejador de teclas de menú por dispositivo y la función para cerrarla. */
export function openSplitJoin(d: SplitDeps): SplitJoin {
  if (!styled) {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.append(st);
    styled = true;
  }
  const slots: (Slot | null)[] = [null, null];
  const screen = document.createElement('div');
  screen.className = 'pgp-screen dim';
  const card = document.createElement('div');
  card.className = 'pgp-card pgp-split';
  screen.append(card);
  document.body.append(screen);

  const taken = (i: number): number => slots[1 - i]?.charIndex ?? -1;
  const stepChar = (i: number, dir: number): void => {
    const s = slots[i];
    if (!s) return;
    let c = s.charIndex;
    do c = (c + dir + CHARACTERS.length) % CHARACTERS.length;
    while (c === taken(i));
    s.charIndex = c;
    s.ready = false;
  };
  const join = (dev: DeviceId): void => {
    if (slots.some((s) => s?.dev === dev)) return;
    const i = slots.indexOf(null);
    if (i < 0) return;
    const saved = d.saved[i];
    const s: Slot = { dev, charIndex: saved.charIndex, profile: saved.profile, ready: false };
    slots[i] = s;
    if (s.charIndex === taken(i)) stepChar(i, 1);
  };
  const both = (): boolean => !!slots[0] && !!slots[1];
  const start = (): void => {
    if (!both()) return;
    close();
    d.onStart(slots.map((s) => ({ dev: s!.dev, charIndex: s!.charIndex, profile: s!.profile })) as [SplitPlayer, SplitPlayer]);
  };
  let closed = false;
  const close = (): void => {
    closed = true;
    screen.remove();
  };
  const back = (): void => {
    close();
    d.onBack();
  };

  const el = (tag: string, cls = '', text = ''): HTMLElement => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  const phone = watchPhoneUrl(d.phoneUrl, () => !closed && render());
  const render = (): void => {
    card.replaceChildren();
    card.append(el('h2', '', '👥 2 jugadores'), el('div', 'sum', d.summary));
    const cols = el('div', 'cols');
    slots.forEach((s, i) => {
      const col = el('div', `col${s?.ready ? ' ready' : ''}`);
      const who = el('div', 'who', `Jugador ${i + 1}`);
      who.style.color = LOCAL_COLORS[i];
      col.append(who);
      if (!s) {
        col.append(el('div', 'wait', 'Pulsa un botón para unirte'), el('div', 'keys', i === 0 ? 'Mando: B · Teclado: Enter' : 'Con otro mando (B) o con el teclado (Enter)'));
      } else {
        col.append(el('div', 'dev', d.deviceName(s.dev)));
        const ch = CHARACTERS[s.charIndex];
        const pick = el('div', 'pick');
        const l = el('button', 'arrow', '◀');
        l.onclick = () => (stepChar(i, -1), render());
        const r = el('button', 'arrow', '▶');
        r.onclick = () => (stepChar(i, 1), render());
        const face = el('div', 'face');
        face.style.background = cssColor(ch.color);
        pick.append(l, face, r);
        col.append(pick, el('div', 'nm', displayName(ch)));
        const prof = el('div', 'prof');
        for (const [p, label] of [['peque', 'Peque'], ['normal', 'Normal']] as [Profile, string][]) {
          const b = el('button', `pgp-opt${s.profile === p ? ' sel' : ''}`, label);
          b.onclick = () => {
            s.profile = p;
            s.ready = false;
            render();
          };
          prof.append(b);
        }
        col.append(prof);
        col.append(el('div', 'state', s.ready ? '¡Listo!' : `◀ ▶ peluche · ▲ ▼ perfil · ${s.dev === 'kbd' ? 'Enter' : s.dev.startsWith('tel') ? 'OK' : 'B'}: listo`));
      }
      cols.append(col);
    });
    card.append(cols);
    if (!both()) card.append(phoneQrBox(phone, '📱 ¿Sin mando? Usa un teléfono', 'Escanea el QR y toca «¡Unirme!» en el teléfono.'));
    const btns = el('div', 'btns');
    const go = el('button', 'pgp-go', '¡A correr!') as HTMLButtonElement;
    go.disabled = !both();
    go.onclick = start;
    const bk = el('button', 'pgp-go alt', 'Volver');
    bk.onclick = back;
    btns.append(go, bk);
    card.append(btns);
  };
  render();

  const input = (events: MenuEvent[]): void => {
    if (closed || !events.length) return;
    for (const { dev, key } of events) {
      const i = slots.findIndex((s) => s?.dev === dev);
      const s = slots[i];
      if (!s) {
        if (key === 'ok') join(dev);
        else if (key === 'back' && !slots[0] && !slots[1]) return back();
        continue;
      }
      if (key === 'left' || key === 'right') stepChar(i, key === 'left' ? -1 : 1);
      else if (key === 'up' || key === 'down') {
        s.profile = s.profile === 'peque' ? 'normal' : 'peque';
        s.ready = false;
      } else if (key === 'ok') {
        s.ready = true;
        if (slots.every((x) => x?.ready)) return start();
      } else if (key === 'back') {
        if (s.ready) s.ready = false;
        else slots[i] = null;
      }
    }
    if (!closed) render();
  };
  const info = (dev: DeviceId): { who: number; name: string; ready: boolean } | null => {
    const i = slots.findIndex((s) => s?.dev === dev);
    if (i < 0) return null;
    return { who: i, name: displayName(CHARACTERS[slots[i]!.charIndex]), ready: slots[i]!.ready };
  };
  return { input, close, refresh: () => !closed && render(), info };
}
