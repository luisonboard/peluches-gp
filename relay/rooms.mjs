// Relevo de salas por WebSocket: el anfitrión abre una sala con su código; los invitados se unen y todo mensaje
// pasa por aquí (invitado → anfitrión, anfitrión → uno o todos). Sirve en cualquier red, sin conexión directa.
// Lo usa el servidor de desarrollo (vite.config.ts); el mismo esquema sirve para un Worker de Cloudflare.

/** @typedef {{ send(data: string): void; close(): void }} Sock */

export function createRelay() {
  /** @type {Map<string, { host: Sock, guests: Map<string, Sock> }>} */
  const rooms = new Map();
  const out = (s, o) => {
    try {
      s.send(JSON.stringify(o));
    } catch {
      /* conexión cerrada */
    }
  };

  /** Se llama con cada socket nuevo; devuelve los manejadores de mensaje y cierre. */
  return function attach(sock) {
    let room = '';
    let role = '';
    let id = '';
    return {
      message(raw) {
        let d;
        try {
          d = JSON.parse(String(raw));
        } catch {
          return;
        }
        if (!role) {
          if (d.op === 'host' && /^[A-Z]{4}$/.test(d.room)) {
            if (rooms.has(d.room)) return out(sock, { op: 'taken' });
            room = d.room;
            role = 'host';
            rooms.set(room, { host: sock, guests: new Map() });
            return out(sock, { op: 'ok' });
          }
          if (d.op === 'join' && typeof d.id === 'string') {
            const r = rooms.get(d.room);
            if (!r) return out(sock, { op: 'noroom' });
            room = d.room;
            role = 'guest';
            id = d.id.slice(0, 40);
            r.guests.set(id, sock);
            out(sock, { op: 'ok' });
            return out(r.host, { op: 'join', id });
          }
          return;
        }
        const r = rooms.get(room);
        if (!r) return;
        if (role === 'guest') return out(r.host, { op: 'from', id, m: d.m });
        if (d.op === 'to') {
          const g = r.guests.get(d.id);
          if (g) out(g, { op: 'm', m: d.m });
        } else if (d.op === 'all') {
          for (const [gid, g] of r.guests) if (gid !== d.except) out(g, { op: 'm', m: d.m });
        } else if (d.op === 'kick') {
          r.guests.get(d.id)?.close();
        }
      },
      close() {
        const r = rooms.get(room);
        if (!r) return;
        if (role === 'host' && r.host === sock) {
          for (const g of r.guests.values()) {
            out(g, { op: 'gone' });
            g.close();
          }
          rooms.delete(room);
        } else if (role === 'guest' && r.guests.get(id) === sock) {
          r.guests.delete(id);
          out(r.host, { op: 'leave', id });
        }
      },
    };
  };
}
