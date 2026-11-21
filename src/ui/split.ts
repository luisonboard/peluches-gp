// Pantalla dividida, en dos pestañas como el menú de un jugador: «Jugadores» y «Pista» (pista o copa, rivales y vueltas).
// Pestaña «Jugadores»: "Pulsa un botón para unirte". De 2 a 4 jugadores: cada uno se une con su dispositivo (teclado o
// mando) y con ese mismo dispositivo elige peluche (◀ ▶), perfil (▲ ▼) y dice "listo" (B / Enter). Con cuatro listos
// empieza sola; con dos o tres, cuando todos están listos, cualquiera vuelve a pulsar B / Enter (o «¡A correr!»).
// Un teléfono también sirve de mando: se escanea el QR y se pulsa «¡Unirme!» en él (ver net/pad.ts y pad/phone.ts).
import { phoneQrBox, watchPhoneUrl } from './phoneQr';
import { CHARACTERS, displayName, cssColor } from '../game/characters';
import type { DeviceId, MenuEvent } from '../input/input';
import { MAX_LOCAL, type Profile } from '../core/settings';
import { LOCAL_COLORS, type TitleSetup } from './hud';
import { CPU_LEVELS } from '../game/race';
import { TRACKS } from '../world/tracks';
import { CUPS, cupDef } from '../game/cup';

export interface SplitPlayer {
  dev: DeviceId;
  charIndex: number;
  profile: Profile;
}

export interface SplitDeps {
  /** Peluche y perfil guardados de cada jugador (al unirse empiezan así). */
  saved: { charIndex: number; profile: Profile }[];
  /** Pista o copa, rivales y vueltas elegidos (los mismos del menú de un jugador). */
  setup: () => TitleSetup;
  /** Se cambió la pista, la copa, los rivales o las vueltas en la pestaña «Pista». */
  onSetup: (s: TitleSetup) => void;
  deviceName: (dev: DeviceId) => string;
  /** Dirección para abrir el mando en un teléfono (se resuelve cuando la sala de mandos está abierta). */
  phoneUrl: Promise<{ url: string; code: string }>;
  onStart: (players: SplitPlayer[]) => void;
  onBack: () => void;
}

const CSS = `
.pgp-split { width: min(980px, 100%); box-sizing: border-box; max-height: calc(100dvh - 32px); overflow-y: auto; }
.pgp-split .pgp-steps { margin-bottom: 8px; flex-wrap: wrap; }
/* Pestaña «Pista»: una sección debajo de otra y los botones bajan de línea (sin desbordar a los lados). */
.pgp-split .pgp-opts { display: block; }
.pgp-split .pgp-opts > div { display: block; }
.pgp-split .pgp-opts .pgp-row { flex-wrap: wrap; gap: 6px; }
.pgp-split .pgp-opts .pgp-opt { white-space: nowrap; }
.pgp-split .pgp-opts .pgp-label { margin: 8px 2px 2px; }
.pgp-split h2 { margin: 0 0 2px; text-align: center; font-size: 30px; }
.pgp-split .sum { text-align: center; color: #6a64a0; font-weight: 800; margin-bottom: 12px; }
.pgp-split .cols { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 900px) { .pgp-split .cols { grid-template-columns: 1fr 1fr; } }
@media (max-width: 420px) { .pgp-split .cols { grid-template-columns: 1fr; } }
.pgp-split .col.empty { opacity: .8; }
.pgp-split .allready { text-align: center; font-weight: 900; font-size: 18px; color: #2f9a4a; margin-top: 10px; animation: pgp-blink 1.2s steps(2) infinite; }
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
  .pgp-split h2 { display: none; }
  .pgp-split .pgp-steps { margin-bottom: 4px; }
  .pgp-split .col.empty .keys { display: none; }
  .pgp-split .cols { gap: 6px; }
  .pgp-split .pick { gap: 6px; }
  .pgp-split .arrow { width: 30px; height: 30px; font-size: 14px; }
  .pgp-split .nm { font-size: 15px; }
  .pgp-split .prof .pgp-opt { padding: 3px 10px; font-size: 13px; }
  .pgp-split .pgp-phoneqr .txt { font-size: 12px; }
  .pgp-split .pgp-phoneqr .txt b { font-size: 14px; }
  .pgp-split .sum { margin-bottom: 6px; font-size: 13px; }
  .pgp-split .col { min-height: 0; padding: 8px; gap: 4px; }
  .pgp-split .who { font-size: 17px; }
  .pgp-split .wait { margin-top: 4px; font-size: 15px; }
  .pgp-split .keys, .pgp-split .state { font-size: 11px; }
  .pgp-split .face { width: 40px; height: 40px; border-radius: 14px; }
  .pgp-split .face::before, .pgp-split .face::after { top: 13px; width: 8px; height: 9px; }
  .pgp-split .face::before { left: 8px } .pgp-split .face::after { right: 8px }
  .pgp-split .btns { margin-top: 2px; }
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
  const slots: (Slot | null)[] = Array.from({ length: MAX_LOCAL }, () => null);
  /** Pestaña abierta, y en «Pista» la fila elegida con el mando (0 pista, 1 rivales, 2 vueltas). */
  let tab: 'players' | 'track' = 'players';
  let optRow = 0;
  /** Opciones de la pestaña «Pista», en orden: pistas listas y luego las copas. */
  const places: [id: string, label: string, cup: boolean][] = [
    ...TRACKS.filter((t) => t.ready).map((t): [string, string, boolean] => [t.id, t.name, false]),
    ...CUPS.map((c): [string, string, boolean] => [c.id, `${c.icon} ${c.name}`, true]),
  ];
  const placeIdx = (st: TitleSetup): number => Math.max(0, places.findIndex(([id, , cup]) => (cup ? st.cup === id : !st.cup && st.trackId === id)));
  const setPlace = (i: number): void => {
    const st = d.setup();
    const [id, , cup] = places[Math.max(0, Math.min(places.length - 1, i))];
    if (cup) st.cup = id;
    else {
      st.trackId = id;
      st.cup = null;
    }
    d.onSetup(st);
  };
  const setCpu = (i: number): void => {
    const st = d.setup();
    st.cpu = CPU_LEVELS[Math.max(0, Math.min(CPU_LEVELS.length - 1, i))];
    d.onSetup(st);
  };
  const setLaps = (n: number): void => {
    const st = d.setup();
    st.laps = n;
    d.onSetup(st);
  };
  const summary = (): string => {
    const st = d.setup();
    const name = cupDef(st.cup)?.name ?? TRACKS.find((t) => t.id === st.trackId)?.name ?? '';
    return `${name} · ${st.laps} vueltas · rivales ${st.cpu.label}`;
  };
  const showTab = (t: 'players' | 'track'): void => {
    tab = t;
    optRow = 0;
    render();
  };
  const screen = document.createElement('div');
  screen.className = 'pgp-screen dim';
  const card = document.createElement('div');
  card.className = 'pgp-card pgp-split';
  screen.append(card);
  document.body.append(screen);

  /** ¿Otro jugador ya tiene ese peluche? */
  const taken = (i: number, c: number): boolean => slots.some((s, j) => j !== i && s?.charIndex === c);
  const stepChar = (i: number, dir: number): void => {
    const s = slots[i];
    if (!s) return;
    let c = s.charIndex;
    do c = (c + dir + CHARACTERS.length) % CHARACTERS.length;
    while (taken(i, c));
    s.charIndex = c;
    s.ready = false;
  };
  const join = (dev: DeviceId): void => {
    if (slots.some((s) => s?.dev === dev)) return;
    const i = slots.indexOf(null);
    if (i < 0) return;
    const saved = d.saved[i] ?? { charIndex: 0, profile: 'normal' };
    const s: Slot = { dev, charIndex: saved.charIndex, profile: saved.profile, ready: false };
    slots[i] = s;
    if (taken(i, s.charIndex)) stepChar(i, 1);
  };
  /** Jugadores unidos, en orden (sin huecos: si se va el 2, el 3 pasa a ser el 2). */
  const joined = (): Slot[] => slots.filter((s): s is Slot => !!s);
  const enough = (): boolean => joined().length >= 2;
  const allReady = (): boolean => enough() && joined().every((s) => s.ready);
  const start = (): void => {
    if (!enough()) return;
    close();
    d.onStart(joined().map((s) => ({ dev: s.dev, charIndex: s.charIndex, profile: s.profile })));
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
    const n = joined().length;
    const bar = el('div', 'pgp-steps');
    ([['players', `Jugadores${n ? ` (${n})` : ''}`], ['track', 'Pista']] as const).forEach(([t, label], i) => {
      const b = el('button', `pgp-step${t === tab ? ' on' : ''}`);
      b.innerHTML = `<span class="n">${i + 1}</span>${label}`;
      b.onclick = () => t !== tab && showTab(t);
      bar.append(b);
    });
    card.append(bar);
    if (tab === 'players') playersTab(n);
    else trackTab();
    const btns = el('div', 'btns');
    const go = el('button', 'pgp-go', '¡A correr!') as HTMLButtonElement;
    go.disabled = !enough();
    go.title = enough() ? '' : 'Faltan jugadores: se necesitan al menos 2';
    go.onclick = start;
    const bk = el('button', 'pgp-go alt', 'Volver');
    bk.onclick = back;
    btns.append(go, bk);
    card.append(btns);
  };

  /** Pestaña «Pista»: pista o copa, rivales y vueltas. Con el mando: ▲ ▼ fila, ◀ ▶ cambia, B / Enter vuelve. */
  const trackTab = (): void => {
    const st = d.setup();
    const opts = el('div', 'pgp-opts');
    const mk = (row: number, label: string, values: [string, boolean][], set: (i: number) => void): void => {
      const col = el('div');
      col.append(el('div', 'pgp-label', label));
      const r = el('div', `pgp-row${row === optRow ? ' focus' : ''}`);
      values.forEach(([t, sel], i) => {
        const b = el('button', `pgp-opt${sel ? ' sel' : ''}`, t);
        b.onclick = () => {
          optRow = row;
          set(i);
          render();
        };
        r.append(b);
      });
      col.append(r);
      opts.append(col);
    };
    const pi = placeIdx(st);
    mk(0, 'Pista o copa', places.map(([, t], i) => [t, i === pi]), setPlace);
    mk(1, 'Rivales de la IA', CPU_LEVELS.map((l) => [l.label, l.id === st.cpu.id]), setCpu);
    mk(2, 'Vueltas', [2, 3].map((v) => [String(v), v === st.laps]), (i) => setLaps([2, 3][i]));
    card.append(opts, el('div', 'sum', 'Mando o teclado: ▲ ▼ elige la fila · ◀ ▶ cambia · B / Enter vuelve a «Jugadores»'));
  };

  /** Pestaña «Jugadores»: las cuatro columnas y el QR para usar un teléfono como mando. */
  const playersTab = (n: number): void => {
    card.append(el('h2', '', `👥 ${Math.max(2, n)} jugadores`), el('div', 'sum', `${summary()} · de 2 a ${MAX_LOCAL} jugadores`));
    const cols = el('div', 'cols');
    slots.forEach((s, i) => {
      const col = el('div', `col${s?.ready ? ' ready' : ''}${s ? '' : ' empty'}`);
      const who = el('div', 'who', `Jugador ${i + 1}`);
      who.style.color = LOCAL_COLORS[i];
      col.append(who);
      if (!s) {
        col.append(el('div', 'wait', 'Pulsa un botón para unirte'), el('div', 'keys', i === 0 ? 'Mando: B · Teclado: Enter' : 'Con otro mando (B), un teléfono o el teclado (Enter)'));
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
        const ok = s.dev === 'kbd' ? 'Enter' : s.dev.startsWith('tel') ? 'OK' : 'B';
        col.append(el('div', 'state', s.ready ? '¡Listo!' : `◀ ▶ peluche · ${i === 0 ? '▼ perfil · ▲ pista' : '▲ ▼ perfil'} · ${ok}: listo`));
      }
      cols.append(col);
    });
    card.append(cols);
    if (allReady()) card.append(el('div', 'allready', '¡Todos listos! Pulsa B / Enter otra vez para correr'));
    if (n < MAX_LOCAL) card.append(phoneQrBox(phone, '📱 ¿Sin mando? Usa un teléfono', 'Escanea el QR y toca «¡Unirme!» en el teléfono.'));
  };
  render();

  const input = (events: MenuEvent[]): void => {
    if (closed || !events.length) return;
    for (const { dev, key } of events) {
      if (tab === 'track') {
        // Cualquier mando o el teclado maneja la pestaña «Pista».
        const st = d.setup();
        if (key === 'up') optRow = Math.max(0, optRow - 1);
        else if (key === 'down') optRow = Math.min(2, optRow + 1);
        else if (key === 'left' || key === 'right') {
          const dir = key === 'left' ? -1 : 1;
          if (optRow === 0) setPlace(placeIdx(st) + dir);
          else if (optRow === 1) setCpu(CPU_LEVELS.findIndex((l) => l.id === st.cpu.id) + dir);
          else setLaps(dir < 0 ? 2 : 3);
        } else if (key === 'ok' || key === 'back') tab = 'players';
        continue;
      }
      const i = slots.findIndex((s) => s?.dev === dev);
      const s = slots[i];
      if (!s) {
        if (key === 'ok') join(dev);
        else if (key === 'back' && !joined().length) return back();
        continue;
      }
      if (key === 'left' || key === 'right') stepChar(i, key === 'left' ? -1 : 1);
      else if (key === 'up' && i === 0) {
        // El jugador 1 abre la pestaña «Pista» (los demás cambian el perfil con ▲ o ▼).
        tab = 'track';
        optRow = 0;
      } else if (key === 'up' || key === 'down') {
        s.profile = s.profile === 'peque' ? 'normal' : 'peque';
        s.ready = false;
      } else if (key === 'ok') {
        // Ya listo y todos listos: vuelve a pulsar para salir (así un 3.º o 4.º jugador alcanza a unirse).
        if (s.ready && allReady()) return start();
        s.ready = true;
        if (joined().length === MAX_LOCAL && allReady()) return start();
      } else if (key === 'back') {
        if (s.ready) s.ready = false;
        else {
          // Se va: los de después suben un puesto (no quedan huecos entre jugadores).
          slots.splice(i, 1);
          slots.push(null);
        }
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
