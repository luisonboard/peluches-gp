// Panel «📱 Mando» del título: QR para conectar un teléfono y elegirlo como mando del jugador 1 en partidas de
// 1 jugador. El teléfono se elige desde el propio teléfono («🎮 Usar como mando»); aquí se ve quién está conectado.
import { phoneQrBox, watchPhoneUrl, type PhoneLink } from './phoneQr';

export interface PhonePanelDeps {
  phoneUrl: Promise<PhoneLink>;
  /** Teléfonos conectados: nombre y si es el mando del jugador 1. */
  phones: () => { label: string; solo: boolean }[];
  /** Deja de usar el teléfono elegido. */
  onRelease: () => void;
  onClose: () => void;
}

const CSS = `
.pgp-phonepanel { width: min(560px, 100%); }
.pgp-phonepanel h2 { margin: 0 0 4px; text-align: center; font-size: 28px; }
.pgp-phonepanel .sub { text-align: center; color: #6a64a0; font-weight: 800; }
.pgp-phonepanel .list { display: grid; gap: 6px; margin-top: 12px; }
.pgp-phonepanel .ph { border-radius: 14px; background: #f1effa; padding: 8px 12px; font-weight: 800; color: #6a64a0; text-align: center; }
.pgp-phonepanel .ph.on { background: #ecfbe9; color: #2f9a4a; border: 3px solid #3fb24a; }
.pgp-phonepanel .btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 14px; }
.pgp-phonepanel .btns .pgp-go { margin: 0; font-size: 20px; padding: 12px 26px; }
.pgp-phonepanel .btns .alt { background: #ff9a2a; box-shadow: 0 7px 0 #c26a10; }
`;
let styled = false;

export function openPhonePanel(d: PhonePanelDeps): { refresh: () => void; close: () => void } {
  if (!styled) {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.append(st);
    styled = true;
  }
  let closed = false;
  const screen = document.createElement('div');
  screen.className = 'pgp-screen dim';
  const card = document.createElement('div');
  card.className = 'pgp-card pgp-phonepanel';
  screen.append(card);
  document.body.append(screen);
  const el = (tag: string, cls = '', text = ''): HTMLElement => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  const close = (): void => {
    if (closed) return;
    closed = true;
    screen.remove();
    d.onClose();
  };
  const link = watchPhoneUrl(d.phoneUrl, () => render());
  const render = (): void => {
    if (closed) return;
    card.replaceChildren();
    card.append(el('h2', '', '📱 Teléfono como mando'), el('div', 'sub', 'Para jugar solo con el teléfono en la mano y la carrera en esta pantalla.'));
    card.append(phoneQrBox(link, '1. Escanea el QR', '2. En el teléfono, toca «🎮 Usar como mando».'));
    const phones = d.phones();
    const list = el('div', 'list');
    if (!phones.length) list.append(el('div', 'ph', 'Ningún teléfono conectado'));
    for (const p of phones) list.append(el('div', `ph${p.solo ? ' on' : ''}`, p.solo ? `📱 ${p.label}: maneja al jugador 1 ✓` : `📱 ${p.label}: conectado (toca «Usar como mando» en él)`));
    card.append(list);
    const btns = el('div', 'btns');
    const ok = el('button', 'pgp-go', 'Listo');
    ok.onclick = close;
    btns.append(ok);
    if (phones.some((p) => p.solo)) {
      const rel = el('button', 'pgp-go alt', 'Dejar de usar el teléfono');
      rel.onclick = () => {
        d.onRelease();
        render();
      };
      btns.append(rel);
    }
    card.append(btns);
  };
  render();
  return { refresh: render, close };
}
