// Sesión multijugador: sala de espera, inicio sincronizado, estados de los karts y reenvío del anfitrión.
// Cada dispositivo simula su propio kart (sin retraso al manejar); el anfitrión simula además a la IA
// y decide los puestos de llegada. Los golpes los decide el dispositivo dueño del kart golpeado.
import type { Species } from '../core/events';
import { CHARACTERS } from '../game/characters';
import type { Kart } from '../game/kart';
import type { Race } from '../game/race';
import type { Arena } from '../game/arena';
import { NetHost, NetGuest, normalizeCode } from './net';
import { MAX_PLAYERS, PROTOCOL, type LobbyPlayer, type Msg, type RosterEntry } from './protocol';

export interface SessionHooks {
  /** Cambió la sala de espera: volver a dibujarla. */
  onLobby(): void;
  /** Empieza una carrera. */
  onStart(roster: RosterEntry[], laps: number, cpu: string): void;
  /** El anfitrión volvió a la sala tras la carrera. */
  onMenu(): void;
  /** Error que termina la sesión (se vuelve al menú). */
  onError(text: string): void;
  /** Aviso breve (alguien entró o salió). */
  onNotice(text: string): void;
}

const SEND_HZ = 20;

export class Session {
  role: 'host' | 'guest' = 'host';
  code = '';
  players: LobbyPlayer[] = [];
  /** Slot de este dispositivo en la sala de espera. */
  me = 0;
  laps = 3;
  cpu = 'facil';
  racing = false;
  roster: RosterEntry[] = [];
  private host: NetHost | null = null;
  private guest: NetGuest | null = null;
  private race: Race | null = null;
  private karts: Kart[] = [];
  private sendT = 0;

  constructor(private hooks: SessionHooks, private arena: Arena) {}

  /** Hay una sala abierta (como anfitrión o como invitado). */
  get active(): boolean {
    return !!(this.host || this.guest);
  }

  get isHost(): boolean {
    return this.role === 'host';
  }

  get myPlayer(): LobbyPlayer | undefined {
    return this.players.find((p) => p.slot === this.me);
  }

  /** Id con el que este dispositivo aparece en el orden de carrera ("host" o su id de PeerJS). */
  get ownerId(): string {
    return this.isHost ? 'host' : this.guest?.id ?? '';
  }

  // ---------------- Crear / unirse ----------------

  async create(char: Species, name: string, laps: number, cpu: string): Promise<void> {
    this.role = 'host';
    this.laps = laps;
    this.cpu = cpu;
    const h = (this.host = new NetHost());
    this.code = await h.open();
    this.players = [{ slot: 0, peer: '', name, char, host: true, waiting: false }];
    this.me = 0;
    h.onMsg = (from, m) => this.hostMsg(from, m);
    h.onLeave = (id) => this.hostLeave(id);
    h.onError = (t) => this.hooks.onNotice(t);
    this.hooks.onLobby();
  }

  async join(rawCode: string, char: Species, name: string): Promise<void> {
    this.role = 'guest';
    this.code = normalizeCode(rawCode);
    const g = (this.guest = new NetGuest());
    g.onMsg = (m) => this.guestMsg(m);
    g.onClose = (t) => this.fail(t);
    await g.connect(this.code);
    g.send({ t: 'hello', v: PROTOCOL, name, char });
  }

  leave(): void {
    this.host?.close();
    this.guest?.close();
    this.host = this.guest = null;
    this.race = null;
    this.arena.net = null;
    this.players = [];
    this.racing = false;
  }

  private fail(text: string): void {
    this.leave();
    this.hooks.onError(text);
  }

  // ---------------- Sala de espera ----------------

  pick(char: Species, name: string): void {
    if (this.isHost) {
      if (this.players.some((p) => p.char === char && p.slot !== this.me)) return;
      const p = this.myPlayer;
      if (p) Object.assign(p, { char, name });
      this.pushLobby();
    } else this.guest?.send({ t: 'pick', char, name });
  }

  setOptions(laps: number, cpu: string): void {
    if (!this.isHost) return;
    this.laps = laps;
    this.cpu = cpu;
    this.pushLobby();
  }

  private pushLobby(): void {
    if (!this.host) return;
    for (const p of this.players) {
      if (p.peer) this.host.send(p.peer, { t: 'lobby', players: this.players, laps: this.laps, cpu: this.cpu, you: p.slot, racing: this.racing });
    }
    this.hooks.onLobby();
  }

  private freeChar(): Species {
    return (CHARACTERS.find((c) => !this.players.some((p) => p.char === c.id)) ?? CHARACTERS[0]).id;
  }

  private hostMsg(from: string, m: Msg): void {
    const h = this.host!;
    switch (m.t) {
      case 'hello': {
        if (m.v !== PROTOCOL) return h.send(from, { t: 'reject', why: 'Las versiones del juego no coinciden. Recarguen la página en los dos dispositivos.' });
        if (this.players.length >= MAX_PLAYERS) return h.send(from, { t: 'reject', why: 'La sala está llena (6 jugadores).' });
        let slot = 1;
        while (this.players.some((p) => p.slot === slot)) slot++;
        const char = this.players.some((p) => p.char === m.char) ? this.freeChar() : m.char;
        this.players.push({ slot, peer: from, name: m.name, char, host: false, waiting: this.racing });
        this.players.sort((a, b) => a.slot - b.slot);
        this.hooks.onNotice(`${m.name} entró a la sala`);
        return this.pushLobby();
      }
      case 'pick': {
        const p = this.players.find((x) => x.peer === from);
        if (!p || this.players.some((x) => x.char === m.char && x !== p)) return this.pushLobby();
        Object.assign(p, { char: m.char, name: m.name });
        return this.pushLobby();
      }
      case 'fin': {
        const k = this.karts.find((x) => x.slot === m.s);
        if (k && this.race) this.race.assignPlace(k, m.time);
        return;
      }
      default:
        this.applyRaceMsg(m);
        h.broadcast(m, from);
    }
  }

  private hostLeave(id: string): void {
    const p = this.players.find((x) => x.peer === id);
    if (!p) return;
    this.players = this.players.filter((x) => x !== p);
    this.hooks.onNotice(`${p.name} salió de la sala`);
    // Si estaba corriendo, la IA del anfitrión maneja su kart desde donde quedó.
    const e = this.roster.find((r) => r.owner === id);
    if (e) {
      e.owner = 'ai';
      const k = this.karts.find((x) => x.slot === e.slot);
      if (k) k.remote = false;
    }
    this.pushLobby();
  }

  private guestMsg(m: Msg): void {
    switch (m.t) {
      case 'reject':
        return this.fail(m.why);
      case 'lobby':
        this.players = m.players;
        this.me = m.you;
        this.laps = m.laps;
        this.cpu = m.cpu;
        if (!this.racing) this.hooks.onLobby();
        return;
      case 'start':
        this.roster = m.roster;
        this.laps = m.laps;
        this.cpu = m.cpu;
        if (m.roster.some((r) => r.owner === this.ownerId)) {
          this.racing = true;
          this.hooks.onStart(m.roster, m.laps, m.cpu);
        }
        return;
      case 'menu':
        this.racing = false;
        this.race = null;
        this.arena.net = null;
        return this.hooks.onMenu();
      case 'place': {
        const k = this.karts.find((x) => x.slot === m.s);
        if (k && this.race) this.race.setPlace(k, m.place, m.time);
        return;
      }
      default:
        this.applyRaceMsg(m);
    }
  }

  /** Mensajes de carrera que ambos roles aplican igual. */
  private applyRaceMsg(m: Msg): void {
    if (!this.race) return;
    switch (m.t) {
      case 'st':
        for (const st of m.k) {
          const k = this.karts.find((x) => x.slot === st[0]);
          if (k?.remote) k.applyState(st);
        }
        return;
      case 'use':
        return this.arena.applyNetUse(m);
      case 'kill':
        return this.arena.applyNetKill(m.id);
      case 'box':
        return this.arena.applyNetBox(m.i);
      case 'quake':
        return this.arena.applyNetQuake(m.s, m.x, m.y, m.z);
    }
  }

  // ---------------- Carrera ----------------

  /** Anfitrión: arma el orden (jugadores y luego la IA con los peluches libres) y arranca en todos. */
  start(): void {
    if (!this.isHost || !this.host) return;
    for (const p of this.players) p.waiting = false;
    const roster: RosterEntry[] = this.players.map((p, i) => ({ slot: i, char: p.char, name: p.name, owner: p.host ? 'host' : p.peer }));
    for (const c of CHARACTERS) {
      if (roster.length >= MAX_PLAYERS) break;
      if (!roster.some((r) => r.char === c.id)) roster.push({ slot: roster.length, char: c.id, name: '', owner: 'ai' });
    }
    this.roster = roster;
    this.racing = true;
    this.host.broadcast({ t: 'start', roster, laps: this.laps, cpu: this.cpu });
    this.hooks.onStart(roster, this.laps, this.cpu);
  }

  /** Conecta la carrera recién creada con la red. */
  attach(race: Race, karts: Kart[]): void {
    this.race = race;
    this.karts = karts;
    race.authority = this.isHost;
    race.onLocalFinish = (k) => this.guest?.send({ t: 'fin', s: k.slot, time: k.finishTime });
    race.onPlace = (k) => this.host?.broadcast({ t: 'place', s: k.slot, place: k.place, time: k.finishTime });
    this.arena.net = (m) => this.send(m);
  }

  private send(m: Msg): void {
    if (this.host) this.host.broadcast(m);
    else this.guest?.send(m);
  }

  /** Envía 20 veces por segundo el estado de los karts que simula este dispositivo. */
  tick(dt: number): void {
    if (!this.race) return;
    this.sendT += dt;
    if (this.sendT < 1 / SEND_HZ) return;
    this.sendT = 0;
    const k = this.karts.filter((x) => !x.remote).map((x) => x.toState());
    if (k.length) this.send({ t: 'st', k });
  }

  /** Anfitrión: fin de la carrera, todos de vuelta a la sala de espera. */
  backToLobby(): void {
    if (!this.isHost) return;
    this.racing = false;
    this.race = null;
    this.arena.net = null;
    this.host?.broadcast({ t: 'menu' });
    this.pushLobby();
  }

  joinUrl(): string {
    return `${location.origin}${location.pathname}?sala=${this.code}`;
  }
}
