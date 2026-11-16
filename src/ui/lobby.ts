// Pantallas del multijugador: crear o unirse a una sala, y la sala de espera (código, QR, jugadores y peluches).
import qrcode from 'qrcode-generator';
import { CHARACTERS, cssColor, displayName } from '../game/characters';
import { CPU_LEVELS } from '../game/race';
import type { Species } from '../core/events';
import type { Session } from '../net/session';

const CSS = `
.pgp-lobby { width: min(720px, 100%); box-sizing: border-box; max-height: calc(100dvh - 32px); overflow-y: auto; }
.pgp-lobby h2 { margin: 0 0 8px; text-align: center; font-size: 30px; }
.pgp-lobby .code-row { display: flex; gap: 18px; align-items: center; justify-content: center; flex-wrap: wrap; }
.pgp-lobby .code { font: 900 54px/1 ui-monospace, Menlo, monospace; letter-spacing: .16em; color: #2a2050; background: #fff4c8;
  border-radius: 18px; padding: 10px 18px 10px 26px; border: 4px dashed #ffb52a; }
.pgp-lobby .qr { width: 132px; height: 132px; background: #fff; border-radius: 12px; padding: 4px; box-sizing: border-box; }
.pgp-lobby .qr svg { width: 100%; height: 100%; display: block; }
.pgp-lobby .hint { text-align: center; color: #6a64a0; font-weight: 700; font-size: 14px; margin: 8px 0 0; }
.pgp-lobby .players { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-top: 6px; }
.pgp-lobby .pl { display: flex; align-items: center; gap: 8px; background: #f1effa; border-radius: 14px; padding: 8px 10px; min-width: 0; font-weight: 800; }
.pgp-lobby .pl.me { background: #fff4c8; }
.pgp-lobby .pl .dot { flex: none; width: 26px; height: 26px; border-radius: 9px; }
.pgp-lobby .pl .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pgp-lobby .pl small { display: block; color: #6a64a0; font-size: 11px; }
.pgp-lobby .pgp-char[disabled] { opacity: .35; cursor: not-allowed; }
.pgp-lobby .join { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; margin-top: 10px; }
.pgp-lobby .join input { font: 900 34px/1 ui-monospace, Menlo, monospace; letter-spacing: .2em; text-transform: uppercase; width: 6.2em;
  text-align: center; border: 4px solid #d8d4ee; border-radius: 16px; padding: 8px; color: #2a2050; -webkit-user-select: text; user-select: text; }
.pgp-lobby .err { color: #c0302a; font-weight: 800; text-align: center; margin-top: 10px; }
.pgp-lobby .btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 16px; }
.pgp-lobby .btns .pgp-go { margin: 0; font-size: 22px; padding: 12px 28px; }
.pgp-lobby .alt { background: #2f7de0 !important; box-shadow: 0 7px 0 #1d5aa8 !important; }
.pgp-lobby .gray { background: #8a86a8 !important; box-shadow: 0 7px 0 #5f5b80 !important; }
@media (max-height: 520px) {
  .pgp-lobby .code { font-size: 36px; }
  .pgp-lobby .qr { width: 96px; height: 96px; }
  .pgp-lobby h2 { font-size: 22px; margin: 0; }
  .pgp-lobby .hint { display: none; }
  .pgp-lobby .players { margin-top: 2px; gap: 6px; }
  .pgp-lobby .pl { padding: 4px 8px; }
  .pgp-lobby .pgp-label { margin: 4px 2px 2px; }
  .pgp-lobby .btns { margin-top: 8px; }
  .pgp-lobby .btns .pgp-go { font-size: 17px; padding: 8px 20px; }
  .pgp-lobby .pgp-opt { padding: 4px 12px; font-size: 14px; }
}
`;

let styled = false;
let current: HTMLElement | null = null;

function screen(): HTMLElement {
  if (!styled) {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.append(st);
    styled = true;
  }
  closeLobbyScreen();
  const s = document.createElement('div');
  s.className = 'pgp-screen dim';
  s.style.zIndex = '11';
  const card = document.createElement('div');
  card.className = 'pgp-card pgp-lobby';
  s.append(card);
  document.body.append(s);
  current = s;
  return card;
}

export function closeLobbyScreen(): void {
  current?.remove();
  current = null;
}

export function lobbyOpen(): boolean {
  return !!current;
}

function btn(text: string, cls: string, fn: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = `pgp-go ${cls}`;
  b.textContent = text;
  b.onclick = fn;
  return b;
}

/** Menú: crear sala o escribir un código. */
export function showOnlineMenu(o: { code?: string; error?: string; busy?: string; onCreate: () => void; onJoin: (code: string) => void; onBack: () => void }): void {
  const card = screen();
  card.innerHTML = `<h2>Jugar con otros</h2><p class="hint">Cada uno en su teléfono, tablet o computador. Uno crea la sala y los demás escriben el código.</p>`;
  const btns = document.createElement('div');
  btns.className = 'btns';
  btns.append(btn('Crear sala', '', o.onCreate));
  card.append(btns);
  const join = document.createElement('div');
  join.className = 'join';
  const inp = document.createElement('input');
  inp.maxLength = 4;
  inp.placeholder = 'CÓDIGO';
  inp.autocapitalize = 'characters';
  inp.autocomplete = 'off';
  inp.spellcheck = false;
  inp.setAttribute('aria-label', 'Código de la sala');
  inp.value = o.code ?? '';
  const go = btn('Unirme', 'alt', () => o.onJoin(inp.value));
  inp.onkeydown = (e) => {
    if (e.key === 'Enter') o.onJoin(inp.value);
  };
  join.append(inp, go);
  card.append(join);
  if (o.busy) card.insertAdjacentHTML('beforeend', `<p class="hint">${o.busy}</p>`);
  if (o.error) card.insertAdjacentHTML('beforeend', `<p class="err">${o.error}</p>`);
  const back = document.createElement('div');
  back.className = 'btns';
  back.append(btn('Volver', 'gray', o.onBack));
  card.append(back);
}

/** Sala de espera. Se vuelve a dibujar cada vez que cambia. */
export function showLobby(s: Session, h: { pick: (c: Species) => void; options: (laps: number, cpu: string) => void; start: () => void; leave: () => void }): void {
  const card = screen();
  card.innerHTML = `<h2>${s.isHost ? 'Tu sala' : 'Sala'}</h2>`;
  const row = document.createElement('div');
  row.className = 'code-row';
  row.innerHTML = `<div class="code">${s.code}</div>`;
  if (s.isHost) {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(s.joinUrl());
      qr.make();
      const q = document.createElement('div');
      q.className = 'qr';
      q.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 1, scalable: true });
      row.append(q);
    } catch {
      /* sin QR */
    }
  }
  card.append(row);
  card.insertAdjacentHTML(
    'beforeend',
    `<p class="hint">${s.isHost ? 'Los demás: "Jugar con otros" → escribir el código, o escanear el QR.' : 'Esperando a que el anfitrión empiece la carrera…'}</p>`,
  );

  const pl = document.createElement('div');
  pl.className = 'players';
  for (const p of s.players) {
    const c = CHARACTERS.find((x) => x.id === p.char)!;
    const e = document.createElement('div');
    e.className = `pl${p.slot === s.me ? ' me' : ''}`;
    e.innerHTML = `<span class="dot" style="background:${cssColor(c.color)}"></span><span class="nm">${escapeHtml(p.name)}<small>${p.host ? 'anfitrión' : p.waiting ? 'entra en la próxima' : 'invitado'}${p.slot === s.me ? ' · tú' : ''}</small></span>`;
    pl.append(e);
  }
  const free = 6 - s.players.length;
  if (free > 0) {
    const e = document.createElement('div');
    e.className = 'pl';
    e.innerHTML = `<span class="nm">+ ${free} con la IA<small>se llenan solos</small></span>`;
    pl.append(e);
  }
  card.append(pl);

  const lab = document.createElement('div');
  lab.className = 'pgp-label';
  lab.textContent = 'Tu peluche';
  card.append(lab);
  const chars = document.createElement('div');
  chars.className = 'pgp-chars';
  const mine = s.myPlayer?.char;
  for (const c of CHARACTERS) {
    const b = document.createElement('button');
    const taken = s.players.some((p) => p.char === c.id && p.slot !== s.me);
    b.className = `pgp-char${c.id === mine ? ' sel' : ''}`;
    b.disabled = taken;
    b.innerHTML = `<div class="face" style="background:${cssColor(c.color)}"></div><div class="nm">${escapeHtml(displayName(c))}</div><div class="sp">${taken ? 'ocupado' : c.label}</div>`;
    b.onclick = () => h.pick(c.id);
    chars.append(b);
  }
  card.append(chars);

  if (s.isHost) {
    const opts = document.createElement('div');
    opts.className = 'pgp-opts';
    const mk = (label: string, values: [string, string][], cur: string, set: (v: string) => void): HTMLElement => {
      const col = document.createElement('div');
      col.innerHTML = `<div class="pgp-label">${label}</div>`;
      const r = document.createElement('div');
      r.className = 'pgp-row';
      for (const [v, t] of values) {
        const b = document.createElement('button');
        b.className = `pgp-opt${v === cur ? ' sel' : ''}`;
        b.textContent = t;
        b.onclick = () => set(v);
        r.append(b);
      }
      col.append(r);
      return col;
    };
    opts.append(
      mk('Rivales de la IA', CPU_LEVELS.map((l) => [l.id, l.label]), s.cpu, (v) => h.options(s.laps, v)),
      mk('Vueltas', [['2', '2'], ['3', '3']], String(s.laps), (v) => h.options(Number(v), s.cpu)),
    );
    card.append(opts);
  } else {
    card.insertAdjacentHTML('beforeend', `<p class="hint">${s.laps} vueltas · rivales ${CPU_LEVELS.find((l) => l.id === s.cpu)?.label ?? ''}</p>`);
  }

  const btns = document.createElement('div');
  btns.className = 'btns';
  if (s.isHost) btns.append(btn('¡A correr!', '', h.start));
  btns.append(btn(s.isHost ? 'Cerrar sala' : 'Salir', 'gray', h.leave));
  card.append(btns);
}

function escapeHtml(t: string): string {
  return t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
