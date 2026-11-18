// El teléfono como mando (`?mando=ABCD`): no carga three.js ni dibuja la carrera. Muestra las flechas para los
// menús, los botones de manejar (los mismos de TouchControls, con giroscopio) y un HUD mínimo: puesto, vuelta,
// objeto y poder. La carrera se ve en la pantalla del computador.
import { Gyro } from '../input/gyro';
import { TouchControls } from '../input/touch';
import type { Controls } from '../input/input';
import { defaultSettings, loadSettings, type Settings, type SteerMode } from '../core/settings';
import { NetGuest, normalizeCode } from '../net/net';
import { RelayGuest, relayAvailable } from '../net/relay';
import { PAD_PROTOCOL, type Msg, type PadHud, type PadKey, type PadState } from '../net/protocol';
import { ITEM_ICONS } from '../ui/icons';
import type { ItemId } from '../core/events';
import { installErrorHooks } from '../core/events';

const CSS = `
#pad { position: fixed; inset: 0; display: grid; place-items: center; padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
  max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); box-sizing: border-box; text-align: center; overflow: auto; }
#pad .stroke { paint-order: stroke fill; -webkit-text-stroke: 6px #2a2050; }
#pad h1 { margin: 0; font-size: 30px; font-weight: 900; line-height: 1.1; }
#pad .sub { font-weight: 800; opacity: .9; margin: 6px 0 14px; font-size: 16px; }
#pad .box { display: grid; gap: 12px; justify-items: center; width: min(420px, 100%); }
#pad .note { font-weight: 800; font-size: 16px; line-height: 1.35; background: rgba(42,32,80,.35); border-radius: 16px; padding: 10px 14px; }
#pad .go { font: inherit; font-weight: 900; font-size: 26px; color: #fff; background: #3fb24a; border: 0; border-radius: 22px; padding: 16px 34px;
  box-shadow: 0 7px 0 #2a7a32; cursor: pointer; touch-action: manipulation; }
#pad .go.alt { background: #2f7de0; box-shadow: 0 7px 0 #1d5aa8; font-size: 20px; padding: 12px 26px; }
#pad .go:active { transform: translateY(4px); box-shadow: 0 3px 0 #2a7a32; }
#pad .opts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; font-weight: 800; align-items: center; }
#pad .opt { font: inherit; font-weight: 900; font-size: 16px; border: 3px solid #fff; background: transparent; color: #fff; border-radius: 14px; padding: 8px 14px; }
#pad .opt.sel { background: #fff; color: #2a2050; }
#pad .tag { font-weight: 900; font-size: 24px; }
#pad .dpad { display: grid; grid-template-columns: repeat(3, 84px); grid-template-rows: repeat(3, 84px); gap: 8px; }
#pad .k { font: inherit; font-weight: 900; font-size: 30px; color: #fff; background: rgba(255,255,255,.22); border: 4px solid rgba(255,255,255,.85);
  border-radius: 24px; display: grid; place-items: center; touch-action: manipulation; -webkit-tap-highlight-color: transparent; line-height: 1.05; }
#pad .k small { display: block; font-size: 12px; }
#pad .k.ok { background: #3fb24a; border-color: #fff; font-size: 24px; }
#pad .k:active, #pad .k.on { background: rgba(255,210,58,.75); transform: scale(.95); }
#pad .row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
#pad .menuwrap { display: flex; gap: 18px; align-items: center; justify-content: center; flex-wrap: wrap; }
@media (orientation: landscape) and (max-height: 500px) {
  #pad .dpad { grid-template-columns: repeat(3, 70px); grid-template-rows: repeat(3, 70px); }
  #pad h1 { font-size: 24px; }
}
#padhud { position: fixed; top: max(10px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: none; align-items: center; gap: 14px;
  z-index: 5; pointer-events: none; font-weight: 900; }
#padhud .pos { font-size: 54px; line-height: 1; }
#padhud .pos small { font-size: .45em; }
#padhud .lap { font-size: 20px; line-height: 1.15; text-align: left; }
#padhud .slot { width: 60px; height: 60px; border-radius: 16px; background: rgba(255,255,255,.3); border: 4px solid #fff; display: grid; place-items: center; }
#padhud .slot svg { width: 46px; height: 46px; }
#padhud .slot.spin svg { animation: pgp-padspin .2s linear infinite; }
@keyframes pgp-padspin { 50% { transform: scale(.8) rotate(12deg) } }
#padhud .pow { width: 90px; height: 14px; border-radius: 7px; background: rgba(42,32,80,.5); border: 3px solid #fff; overflow: hidden; margin-top: 6px; }
#padhud .pow div { height: 100%; width: 0; background: #ffd23a; }
#padhud .pow.ready { box-shadow: 0 0 0 4px #ffd23a; }
`;

/** Arranca el mando (lo llama entry.ts). */
export function startPhone(): void {
  installErrorHooks();
  const code = normalizeCode(new URLSearchParams(location.search).get('mando') ?? '');
  const STEER_KEY = 'pgp.pad.steer';
  const ID_KEY = 'pgp.pad.id';
  const SEND_MS = 33;

  const store = {
    get(k: string): string | null {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set(k: string, v: string): void {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* sin almacenamiento */
      }
    },
  };
  /** Id fijo por pestaña: si se corta y se vuelve a conectar, la pantalla lo reconoce como el mismo mando. */
  function stableId(): string {
    try {
      let id = sessionStorage.getItem(ID_KEY);
      if (!id) sessionStorage.setItem(ID_KEY, (id = `m${Math.random().toString(36).slice(2, 10)}`));
      return id;
    } catch {
      return `m${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.append(st);
  document.title = 'Mando · Peluches GP';
  const root = document.createElement('div');
  root.id = 'pad';
  const hudEl = document.createElement('div');
  hudEl.id = 'padhud';
  document.body.append(root, hudEl);
  document.getElementById('app')?.remove();

  const saved = loadSettings();
  const gyro = new Gyro();
  gyro.sens = saved.gyroSens;
  gyro.invert = saved.gyroInvert;
  let steerMode: SteerMode = store.get(STEER_KEY) === 'botones' ? 'botones' : 'giro';
  const touch = new TouchControls(gyro, () => sendKey('pause'), true);

  let conn: RelayGuest | NetGuest | null = null;
  let state: PadState | null = null;
  let hud: PadHud | null = null;
  let error = '';
  let connecting = false;

  const el = (tag: string, cls = '', html = ''): HTMLElement => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  };
  const btn = (cls: string, html: string, on: () => void): HTMLElement => {
    const b = el('button', cls, html);
    b.addEventListener('click', on);
    return b;
  };

  function send(m: Msg): void {
    conn?.send(m);
  }
  function sendKey(k: PadKey): void {
    send({ t: 'pkey', k });
    navigator.vibrate?.(12);
  }

  // ---------------- Conexión ----------------

  async function connect(): Promise<void> {
    if (connecting) return;
    connecting = true;
    error = '';
    render();
    // Lo que exige un toque: giroscopio (iPhone), pantalla encendida, pantalla completa.
    if (steerMode === 'giro' && !gyro.active) await gyro.enable();
    void keepAwake();
    const de = document.documentElement;
    if (!document.fullscreenElement && de.requestFullscreen) de.requestFullscreen().catch(() => {});
    try {
      const g = (await relayAvailable()) ? new RelayGuest(stableId()) : new NetGuest();
      g.onMsg = onMsg;
      g.onClose = (t) => {
        conn = null;
        state = null;
        error = t;
        touch.show(false);
        render();
      };
      await g.connect(code);
      conn = g;
      g.send({ t: 'padhi', v: PAD_PROTOCOL });
      setTimeout(() => {
        if (conn === g && !state) {
          error = 'Se encontró la sala, pero no responde como una pantalla de Peluches GP. Revisa el código.';
          g.close();
          conn = null;
          render();
        }
      }, 4000);
    } catch (e) {
      const msg = (e as Error).message;
      error = /No existe/.test(msg) ? 'No hay ninguna pantalla con ese código. En el computador, abre «2 jugadores» y vuelve a escanear el QR.' : msg;
    }
    connecting = false;
    render();
  }

  let wake: { release(): Promise<void> } | null = null;
  async function keepAwake(): Promise<void> {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
      if (wl && !wake) {
        wake = await wl.request('screen');
        (wake as unknown as EventTarget).addEventListener?.('release', () => (wake = null));
      }
    } catch {
      /* sin permiso: la pantalla puede apagarse */
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && conn) void keepAwake();
  });

  function onMsg(m: Msg): void {
    if (m.t === 'padst') {
      const before = state;
      state = m.st;
      if (state.mode === 'reject') {
        error = state.note ?? 'No se pudo usar este teléfono como mando.';
        conn?.close();
        conn = null;
        state = null;
      }
      const was = before?.mode === 'race';
      const now = state?.mode === 'race';
      if (now && (!was || before?.auto !== state!.auto || before?.peque !== state!.peque)) configureTouch();
      if (now && !was) setTimeout(() => gyro.calibrate(), 600);
      if (!now) hud = null;
      render();
    } else if (m.t === 'padhud') {
      hud = m.h;
      renderHud();
    } else if (m.t === 'buzz') navigator.vibrate?.(m.ms);
  }

  function configureTouch(): void {
    const s: Settings = { ...defaultSettings(), steerMode: gyro.active ? steerMode : 'botones', autoAccel: !!state?.auto, profile: state?.peque ? 'peque' : 'normal' };
    touch.configure(s);
  }

  // ---------------- Envío de controles ----------------

  let last = performance.now();
  let sentAt = 0;
  function frame(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (state?.mode === 'race') {
      const c: Controls = { steer: 0, throttle: 0, brake: 0, drift: false, item: false, power: false, look: false };
      touch.merge(c, dt, (hud?.pow ?? 0) >= 1);
      if (now - sentAt >= SEND_MS) {
        sentAt = now;
        const bits = (c.drift ? 1 : 0) | (c.item ? 2 : 0) | (c.power ? 4 : 0) | (c.look ? 8 : 0);
        send({ t: 'pad', c: [Math.round(c.steer * 100) / 100, c.throttle, c.brake, bits] });
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------------- Pantallas ----------------

  function steerOpts(): HTMLElement {
    const o = el('div', 'opts', 'Volante:');
    for (const [m, label] of [['giro', 'Girar el teléfono'], ['botones', 'Botones ◀ ▶']] as [SteerMode, string][]) {
      o.append(
        btn(`opt${steerMode === m ? ' sel' : ''}`, label, () => {
          steerMode = m;
          store.set(STEER_KEY, m);
          if (m === 'giro' && !gyro.active) void gyro.enable().then(() => (configureTouch(), render()));
          else if (state?.mode === 'race') configureTouch();
          render();
        }),
      );
    }
    return o;
  }

  function tag(): HTMLElement {
    const t = el('div', 'tag stroke');
    if (state && state.who >= 0) {
      t.textContent = `Jugador ${state.who + 1}${state.name ? ` · ${state.name}` : ''}`;
      t.style.color = state.color ?? '#fff';
    } else t.textContent = state?.label ?? '';
    return t;
  }

  /** Flechas y OK. `labels`: textos pequeños debajo de cada flecha. */
  function dpad(labels: Partial<Record<PadKey, string>> = {}, okText = 'OK'): HTMLElement {
    const g = el('div', 'dpad');
    const cell = (k: PadKey | '', html: string, cls = 'k'): void => {
      if (!k) {
        g.append(el('div'));
        return;
      }
      const b = el('button', cls, `${html}${labels[k] ? `<small>${labels[k]}</small>` : ''}`);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        sendKey(k);
      });
      g.append(b);
    };
    cell('', '');
    cell('up', '▲');
    cell('', '');
    cell('left', '◀');
    cell('ok', okText, 'k ok');
    cell('right', '▶');
    cell('', '');
    cell('down', '▼');
    cell('', '');
    return g;
  }

  function render(): void {
    root.replaceChildren();
    const box = el('div', 'box');
    root.append(box);
    const racing = state?.mode === 'race';
    touch.show(!!racing);
    root.style.display = racing ? 'none' : '';
    hudEl.style.display = racing ? 'flex' : 'none';
    if (racing) return renderHud();

    if (!code) {
      box.append(el('h1', 'stroke', '📱 Mando'), el('div', 'note', 'Falta el código de la pantalla. Escanea el QR que aparece en el computador, en «2 jugadores».'));
      return;
    }
    if (!state) {
      box.append(el('h1', 'stroke', '📱 Mando de Peluches GP'), el('div', 'sub', `Pantalla ${code}`));
      if (error) box.append(el('div', 'note', `⚠️ ${error}`));
      box.append(btn('go', connecting ? 'Conectando…' : error ? 'Reintentar' : '¡Conectar!', () => void connect()));
      if (!window.isSecureContext) box.append(el('div', 'note', 'Esta dirección no es segura (https): el giroscopio no funciona y se usarán botones.'));
      else box.append(steerOpts());
      box.append(el('div', 'sub', 'La carrera se ve en la pantalla grande. Aquí solo manejas.'));
      return;
    }
    box.append(tag());
    if (state.mode === 'join') {
      if (state.who < 0) {
        box.append(el('div', 'sub', 'Pantalla de 2 jugadores'), btn('go', '¡Unirme!', () => sendKey('ok')));
      } else {
        box.append(
          el('div', 'sub', state.ready ? '¡Listo! Esperando al otro jugador…' : 'Elige tu peluche y tu perfil'),
          el('div', 'menuwrap'),
        );
        const w = box.lastElementChild!;
        w.append(dpad({ left: 'peluche', right: 'peluche', up: 'perfil', down: 'perfil' }, '¡Listo!'));
        box.append(btn('go alt', state.ready ? 'Cambiar' : 'Salir', () => sendKey('back')));
      }
    } else if (state.canSolo) {
      // Fuera de «2 jugadores»: conectado, pero solo maneja si se elige.
      box.append(
        el('div', 'note', state.mode === 'wait' ? 'Hay una carrera en marcha. Puedes tomar el control del jugador 1 ahora.' : 'Conectado. Este teléfono todavía no maneja a nadie.'),
        btn('go', '🎮 Usar como mando', () => sendKey('solo')),
        el('div', 'sub', 'Maneja al jugador 1 en las partidas de 1 jugador.'),
      );
    } else if (state.mode === 'wait') {
      box.append(el('div', 'note', state.note ?? 'Esta carrera ya empezó sin este teléfono. Entras en la siguiente.'));
    } else {
      const row = el('div', 'row');
      row.append(btn('go alt', 'Atrás', () => sendKey('back')));
      if (state.solo) row.append(btn('go alt', 'Dejar de usarlo', () => sendKey('unsolo')));
      box.append(el('div', 'sub', state.note ?? 'Muévete por el menú de la pantalla'), dpad(), row);
    }
    box.append(steerOpts());
    if (steerMode === 'giro' && !gyro.active && gyro.permission !== 'desconocido')
      box.append(el('div', 'note', 'El giroscopio no está disponible: se usarán los botones ◀ ▶.'));
  }

  const ordinal = (n: number): string => `${n}<small>º</small>`;
  function renderHud(): void {
    if (state?.mode !== 'race') return;
    const h = hud;
    hudEl.replaceChildren();
    const pos = el('div', 'pos stroke', h ? ordinal(h.pos) : '');
    pos.style.color = state.color ?? '#fff';
    const lap = el('div', 'lap stroke', h ? (h.fin ? '¡Meta!' : `Vuelta ${Math.max(1, h.lap)}/${h.laps}`) : 'Mira la pantalla');
    const pw = el('div', `pow${h && h.pow >= 1 ? ' ready' : ''}`);
    const fill = el('div');
    fill.style.width = `${Math.round((h?.pow ?? 0) * 100)}%`;
    pw.append(fill);
    lap.append(pw);
    const slot = el('div', `slot${h?.roul ? ' spin' : ''}`, h?.roul ? ITEM_ICONS.pelota : h?.item ? ITEM_ICONS[h.item as ItemId] ?? '' : '');
    hudEl.append(pos, lap, slot);
  }

  render();
}
