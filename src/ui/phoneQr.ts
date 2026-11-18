// Recuadro con el QR para usar un teléfono como mando (lo usan «2 jugadores» y el panel 📱 Mando del título).
import qrcode from 'qrcode-generator';

const CSS = `
.pgp-phoneqr { display: flex; gap: 12px; align-items: center; justify-content: center; margin-top: 12px; background: #f1effa; border-radius: 18px; padding: 8px 12px; }
.pgp-phoneqr .qr { width: 104px; height: 104px; background: #fff; border-radius: 10px; padding: 3px; box-sizing: border-box; flex: none; }
.pgp-phoneqr .qr svg { width: 100%; height: 100%; display: block; }
.pgp-phoneqr .txt { font-size: 14px; font-weight: 800; color: #6a64a0; text-align: left; max-width: 340px; }
.pgp-phoneqr .txt b { color: #2a2050; font-size: 17px; display: block; }
.pgp-phoneqr .code { font-size: 22px; letter-spacing: 3px; color: #2a2050; font-weight: 900; }
@media (max-height: 520px) {
  .pgp-phoneqr { margin-top: 6px; padding: 4px 10px; }
  .pgp-phoneqr .qr { width: 72px; height: 72px; }
}
`;
let styled = false;

export interface PhoneLink {
  url: string;
  code: string;
}

/** Estado de la sala de mandos: la dirección cuando está lista, o el error. `changed` se llama al resolverse. */
export function watchPhoneUrl(p: Promise<PhoneLink>, changed: () => void): { link: PhoneLink | null; error: string } {
  const st: { link: PhoneLink | null; error: string } = { link: null, error: '' };
  p.then(
    (l) => {
      st.link = l;
      changed();
    },
    () => {
      st.error = 'No se pudo abrir la conexión para los teléfonos (revisa que haya Internet).';
      changed();
    },
  );
  return st;
}

export function phoneQrBox(st: { link: PhoneLink | null; error: string }, title: string, hint: string): HTMLElement {
  if (!styled) {
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.append(s);
    styled = true;
  }
  const el = (tag: string, cls = '', text = ''): HTMLElement => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  const box = el('div', 'pgp-phoneqr');
  const txt = el('div', 'txt');
  if (st.link) {
    const qr = qrcode(0, 'M');
    qr.addData(st.link.url);
    qr.make();
    const q = el('div', 'qr');
    q.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 1, scalable: true });
    box.append(q);
    const code = el('div', '', 'Código: ');
    code.append(el('span', 'code', st.link.code));
    txt.append(el('b', '', title), document.createTextNode(hint), code);
    if (/^(localhost|127\.|\[::1\])/.test(location.hostname))
      txt.append(el('div', '', '⚠️ Esta dirección solo funciona en este computador: abre el juego con npm run dev:lan o desde la dirección publicada.'));
  } else txt.append(el('b', '', '📱 Teléfono como mando'), document.createTextNode(st.error || 'Preparando el código…'));
  box.append(txt);
  return box;
}
