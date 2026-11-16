// Pantalla de Ajustes: perfil, ayuda de manejo, voz, volante (botones o giroscopio), nombres y prueba del mando.
import { CHARACTERS, displayName, cssColor } from '../game/characters';
import { applyProfile, type Settings, type Profile, type SteerMode, type GyroSens } from '../core/settings';
import type { Gyro } from '../input/gyro';
import { installState, promptInstall } from '../pwa';

const CSS = `
.pgp-set { width: min(640px, 100%); max-height: calc(100dvh - 32px); overflow-y: auto; box-sizing: border-box; }
.pgp-set h2 { margin: 0 0 6px; font-size: 28px; text-align: center; }
.pgp-set h3 { margin: 16px 0 6px; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: #6a64a0; }
.pgp-set .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.pgp-set .tog { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 8px 4px; border: 0;
  background: none; font: inherit; font-weight: 800; font-size: 17px; color: #2a2050; cursor: pointer; text-align: left; }
.pgp-set .tog small { display: block; font-weight: 600; font-size: 13px; color: #6a64a0; }
.pgp-set .sw { flex: none; width: 54px; height: 32px; border-radius: 999px; background: #d8d4ee; position: relative; transition: background .15s; }
.pgp-set .sw::after { content: ""; position: absolute; top: 4px; left: 4px; width: 24px; height: 24px; border-radius: 50%; background: #fff;
  box-shadow: 0 2px 0 rgba(0,0,0,.2); transition: transform .15s; }
.pgp-set .tog.on .sw { background: #3fb24a; }
.pgp-set .tog.on .sw::after { transform: translateX(22px); }
.pgp-set .note { font-size: 13px; color: #6a64a0; font-weight: 600; margin: 4px 2px; }
.pgp-set .names { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
.pgp-set .names label { display: flex; align-items: center; gap: 8px; background: #f1effa; border-radius: 14px; padding: 6px 8px; min-width: 0; }
.pgp-set .names .dot { flex: none; width: 22px; height: 22px; border-radius: 8px; }
.pgp-set .names input { min-width: 0; width: 100%; border: 2px solid #d8d4ee; border-radius: 10px; padding: 6px 8px; font: inherit; font-weight: 800;
  font-size: 16px; color: #2a2050; background: #fff; -webkit-user-select: text; user-select: text; }
.pgp-set .pad { font: 600 13px/1.4 ui-monospace, Menlo, monospace; background: #f1effa; border-radius: 10px; padding: 8px 10px; color: #2a2050; }
.pgp-set .tilt { font-weight: 800; color: #2a2050; font-variant-numeric: tabular-nums; }
`;

let styled = false;

export interface SettingsDeps {
  settings: Settings;
  gyro: Gyro;
  padInfo: () => string;
  onChange: (s: Settings) => void;
  onClose: () => void;
}

/** Abre Ajustes encima de lo que haya. Devuelve una función para cerrarlo. */
export function openSettings(d: SettingsDeps): () => void {
  if (!styled) {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.append(st);
    styled = true;
  }
  const s = d.settings;
  const screen = document.createElement('div');
  screen.className = 'pgp-screen dim';
  screen.style.zIndex = '12';
  const card = document.createElement('div');
  card.className = 'pgp-card pgp-set';
  screen.append(card);
  document.body.append(screen);
  let timer = 0;

  const changed = (): void => {
    d.onChange(s);
    render();
  };
  const opt = <T extends string>(cur: T, values: [T, string][], set: (v: T) => void): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'row';
    for (const [v, label] of values) {
      const b = document.createElement('button');
      b.className = `pgp-opt${v === cur ? ' sel' : ''}`;
      b.textContent = label;
      b.onclick = () => {
        set(v);
        changed();
      };
      row.append(b);
    }
    return row;
  };
  const tog = (on: boolean, title: string, sub: string, set: (v: boolean) => void): HTMLElement => {
    const b = document.createElement('button');
    b.className = `tog${on ? ' on' : ''}`;
    b.innerHTML = `<span>${title}<small>${sub}</small></span><span class="sw"></span>`;
    b.onclick = () => {
      set(!on);
      changed();
    };
    return b;
  };
  const h = (t: string): HTMLElement => {
    const e = document.createElement('h3');
    e.textContent = t;
    return e;
  };
  const note = (t: string): HTMLElement => {
    const e = document.createElement('div');
    e.className = 'note';
    e.innerHTML = t;
    return e;
  };

  function render(): void {
    card.innerHTML = '<h2>Ajustes</h2>';
    card.append(h('Perfil'));
    card.append(opt<Profile>(s.profile, [['peque', 'Peque (5 años)'], ['normal', 'Normal']], (v) => applyProfile(s, v)));
    card.append(note('Peque: ayuda de manejo, rivales en Fácil, golpes más cortos, un solo botón para objeto y poder, y voz.'));

    card.append(h('Ayuda de manejo'));
    card.append(tog(s.autoAccel, 'Aceleración automática', 'El kart acelera solo; solo hay que girar.', (v) => (s.autoAccel = v)));
    card.append(tog(s.smartSteer, 'Dirección asistida', 'Evita chocar y salirse. Una estrella brilla detrás del kart.', (v) => (s.smartSteer = v)));
    card.append(tog(s.autoPower, 'Poder automático', 'Usa el poder del peluche cuando conviene.', (v) => (s.autoPower = v)));
    card.append(tog(s.voice, 'Voz', 'Dice "¡Tres, dos, uno, ya!" y avisa la última vuelta.', (v) => (s.voice = v)));
    card.append(h('Sonido'));
    card.append(tog(s.music, 'Música', 'Música alegre en los menús y en la carrera.', (v) => (s.music = v)));
    card.append(tog(s.sfx, 'Efectos', 'Motor, turbos, poderes y golpes.', (v) => (s.sfx = v)));

    card.append(h('Volante en el teléfono'));
    card.append(opt<SteerMode>(s.steerMode, [['botones', 'Botones ◀ ▶'], ['giro', 'Giroscopio']], (v) => {
      s.steerMode = v;
      if (v === 'giro') void d.gyro.enable().then(() => render());
    }));
    if (s.steerMode === 'giro') {
      card.append(opt<GyroSens>(s.gyroSens, [['sensible', 'Sensible'], ['normal', 'Normal'], ['suave', 'Suave']], (v) => (s.gyroSens = v)));
      const row = document.createElement('div');
      row.className = 'row';
      row.style.marginTop = '8px';
      const act = document.createElement('button');
      act.className = 'pgp-opt';
      act.textContent = d.gyro.active ? 'Centrar volante' : 'Activar volante';
      act.onclick = () => {
        if (d.gyro.active) d.gyro.calibrate();
        else void d.gyro.enable().then(() => render());
      };
      const inv = document.createElement('button');
      inv.className = `pgp-opt${s.gyroInvert ? ' sel' : ''}`;
      inv.textContent = 'Invertir';
      inv.onclick = () => {
        s.gyroInvert = !s.gyroInvert;
        changed();
      };
      const tilt = document.createElement('span');
      tilt.className = 'tilt';
      row.append(act, inv, tilt);
      card.append(row);
      const msg: Record<string, string> = {
        'no disponible': 'Este dispositivo o navegador no da el giroscopio (en el iPhone hace falta abrir el juego con https).',
        denegado: 'Permiso denegado. En el iPhone: cierra la pestaña, vuelve a abrir el juego y pulsa "Permitir".',
        desconocido: 'Pulsa "Activar volante" y acepta el permiso.',
        concedido: 'Gira el teléfono como un volante. Al empezar cada carrera, la posición en que lo tengas cuenta como "recto".',
      };
      card.append(note(msg[d.gyro.permission]));
      clearInterval(timer);
      timer = window.setInterval(() => {
        tilt.textContent = d.gyro.active ? `Inclinación: ${d.gyro.tiltDeg.toFixed(0)}°` : '';
      }, 100);
    }

    card.append(h('Nombres de los peluches'));
    const names = document.createElement('div');
    names.className = 'names';
    for (const c of CHARACTERS) {
      const l = document.createElement('label');
      l.innerHTML = `<span class="dot" style="background:${cssColor(c.color)}"></span>`;
      const inp = document.createElement('input');
      inp.maxLength = 12;
      inp.placeholder = c.defaultName;
      inp.value = displayName(c) === c.defaultName ? '' : displayName(c);
      inp.setAttribute('aria-label', `Nombre de ${c.defaultName}`);
      inp.oninput = () => {
        try {
          if (inp.value.trim()) localStorage.setItem(`pgp.name.${c.id}`, inp.value.trim().slice(0, 12));
          else localStorage.removeItem(`pgp.name.${c.id}`);
        } catch {
          /* sin almacenamiento */
        }
        d.onChange(s);
      };
      l.append(inp);
      names.append(l);
    }
    card.append(names);
    const reset = document.createElement('button');
    reset.className = 'pgp-opt';
    reset.style.marginTop = '8px';
    reset.textContent = 'Restaurar nombres';
    reset.onclick = () => {
      for (const c of CHARACTERS) {
        try {
          localStorage.removeItem(`pgp.name.${c.id}`);
        } catch {
          /* sin almacenamiento */
        }
      }
      changed();
    };
    card.append(reset);

    const inst = installState();
    if (inst !== 'instalada') {
      card.append(h('Instalar como app'));
      if (inst === 'disponible') {
        const b = document.createElement('button');
        b.className = 'pgp-opt';
        b.textContent = 'Instalar Peluches GP';
        b.onclick = () => void promptInstall().then(() => render());
        card.append(b);
        card.append(note('Queda en la pantalla de inicio y se abre sin conexión.'));
      } else if (inst === 'ios') {
        card.append(note('En Safari: botón <b>Compartir</b> → <b>Añadir a pantalla de inicio</b>. Luego se abre a pantalla completa y sin conexión.'));
      } else {
        card.append(note('Desde el menú del navegador: <b>Instalar app</b> o <b>Añadir a pantalla de inicio</b>.'));
      }
    }

    card.append(h('Mando'));
    const pad = document.createElement('div');
    pad.className = 'pad';
    card.append(pad);
    const padTimer = window.setInterval(() => {
      if (!pad.isConnected) return clearInterval(padTimer);
      pad.textContent = d.padInfo();
    }, 100);
    pad.textContent = d.padInfo();

    const done = document.createElement('button');
    done.className = 'pgp-go';
    done.textContent = 'Listo';
    done.onclick = close;
    card.append(done);
  }

  function close(): void {
    clearInterval(timer);
    screen.remove();
    d.onClose();
  }

  render();
  return close;
}
