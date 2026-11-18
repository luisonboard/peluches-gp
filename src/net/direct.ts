// Conexión directa WebRTC entre dos dispositivos, negociada a través del relevo (no usa el servidor de PeerJS).
// Dos canales: `r` fiable y ordenado (sala, objetos, puestos…) y `f` sin reenvíos para lo que se manda 20–30 veces
// por segundo (estado de los karts, controles del mando): si se pierde uno, el siguiente ya lo reemplaza.

/** Mensaje de negociación (oferta, respuesta o candidato). `k`: intento, para descartar restos de uno anterior. */
export interface Signal {
  k: number;
  sdp?: RTCSessionDescriptionInit;
  ice?: RTCIceCandidateInit;
}

const CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }],
};
/** Si no abre en este tiempo, se desiste (y se sigue por el relevo). */
const OPEN_TIMEOUT_MS = 15000;
/** Con tanto pendiente en el canal rápido, se descartan sus mensajes en vez de acumular retraso. */
const FAST_BACKLOG = 64 * 1024;

export const directSupported = typeof RTCPeerConnection !== 'undefined';

export class DirectLink {
  private pc: RTCPeerConnection;
  private rel: RTCDataChannel | null = null;
  private fast: RTCDataChannel | null = null;
  private pending: RTCIceCandidateInit[] = [];
  private closed = false;
  open = false;
  /** `lan`: ambos en la misma red local. `internet`: directo, pero a través de los routers. */
  kind: 'lan' | 'internet' = 'internet';
  onOpen: () => void = () => {};
  onClose: () => void = () => {};
  /** Se supo si la conexión es por la red local. */
  onKind: () => void = () => {};
  onData: (w: unknown) => void = () => {};

  constructor(readonly k: number, initiator: boolean, private signal: (s: Signal) => void) {
    const pc = (this.pc = new RTCPeerConnection(CONFIG));
    pc.onicecandidate = (e) => {
      if (e.candidate) signal({ k, ice: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.close();
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') this.close();
    };
    if (initiator) {
      this.wire(pc.createDataChannel('r', { ordered: true }));
      this.wire(pc.createDataChannel('f', { ordered: true, maxRetransmits: 0 }));
      void (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          signal({ k, sdp: { type: offer.type, sdp: offer.sdp } });
        } catch {
          this.close();
        }
      })();
    } else pc.ondatachannel = (e) => this.wire(e.channel);
    setTimeout(() => {
      if (!this.open) this.close();
    }, OPEN_TIMEOUT_MS);
  }

  async handle(s: Signal): Promise<void> {
    if (this.closed) return;
    const pc = this.pc;
    try {
      if (s.sdp) {
        await pc.setRemoteDescription(s.sdp);
        if (s.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.signal({ k: this.k, sdp: { type: answer.type, sdp: answer.sdp } });
        }
        for (const c of this.pending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      } else if (s.ice) {
        if (pc.remoteDescription) await pc.addIceCandidate(s.ice).catch(() => {});
        else this.pending.push(s.ice);
      }
    } catch {
      this.close();
    }
  }

  private wire(dc: RTCDataChannel): void {
    if (dc.label === 'f') this.fast = dc;
    else this.rel = dc;
    dc.onopen = () => this.ready();
    dc.onclose = () => this.close();
    dc.onmessage = (e) => {
      let d: unknown;
      try {
        d = JSON.parse(String(e.data));
      } catch {
        return;
      }
      this.onData(d);
    };
  }

  private ready(): void {
    if (this.open || this.closed || this.rel?.readyState !== 'open' || this.fast?.readyState !== 'open') return;
    this.open = true;
    this.onOpen();
    void this.detectKind();
  }

  /** Envía por el canal fiable o por el rápido. Devuelve false si el canal no está abierto. */
  send(w: unknown, lossy: boolean): boolean {
    const dc = lossy ? this.fast : this.rel;
    if (!this.open || dc?.readyState !== 'open') return false;
    if (lossy && dc.bufferedAmount > FAST_BACKLOG) return true; // congestión: mejor perder este que atrasar los siguientes
    try {
      dc.send(JSON.stringify(w));
      return true;
    } catch {
      return false;
    }
  }

  /** ¿La pareja de candidatos elegida está dentro de la red local? (solo para mostrarlo) */
  private async detectKind(): Promise<void> {
    try {
      const stats = await this.pc.getStats();
      const byId = new Map<string, Record<string, unknown>>();
      stats.forEach((r: Record<string, unknown>) => byId.set(r.id as string, r));
      let pair: Record<string, unknown> | undefined;
      for (const r of byId.values()) {
        if (r.type === 'transport' && r.selectedCandidatePairId) pair = byId.get(r.selectedCandidatePairId as string);
      }
      pair ??= [...byId.values()].find((r) => r.type === 'candidate-pair' && r.state === 'succeeded' && (r.nominated || r.selected));
      if (!pair) return;
      const local = byId.get(pair.localCandidateId as string);
      const remote = byId.get(pair.remoteCandidateId as string);
      const lan = (c?: Record<string, unknown>): boolean =>
        !!c && (c.candidateType === 'host' || isPrivate(String(c.address ?? c.ip ?? '')));
      if (lan(local) && lan(remote) && local?.candidateType !== 'relay' && remote?.candidateType !== 'relay') this.kind = 'lan';
      this.onKind();
    } catch {
      /* sin estadísticas: queda como «internet» */
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.open = false;
    for (const dc of [this.rel, this.fast]) {
      try {
        dc?.close();
      } catch {
        /* nada */
      }
    }
    try {
      this.pc.close();
    } catch {
      /* nada */
    }
    this.onClose();
  }
}

function isPrivate(a: string): boolean {
  return (
    a.endsWith('.local') ||
    /^10\./.test(a) ||
    /^192\.168\./.test(a) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(a) ||
    /^169\.254\./.test(a) ||
    /^f[cd]/i.test(a) ||
    /^fe80/i.test(a)
  );
}
