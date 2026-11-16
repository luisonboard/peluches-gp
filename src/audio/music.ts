// Música sintetizada en tiempo real (Web Audio): una pista tranquila para los menús y una alegre para la carrera.
// Planificador con 0,12 s de anticipación; cada pista son 4 compases que se repiten con variaciones.

type Track = 'menu' | 'race' | 'none';

const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

// Progresión: Do – La menor – Fa – Sol (un compás de 16 semicorcheas cada uno).
const CHORDS = [
  [60, 64, 67],
  [57, 60, 64],
  [53, 57, 60],
  [55, 59, 62],
];
const BASS = [36, 33, 29, 31];

// Melodía de la carrera: [paso, nota, duración en pasos].
const RACE_MELODY: [number, number, number][] = [
  [0, 72, 2], [2, 76, 2], [4, 79, 2], [6, 76, 2], [8, 77, 2], [10, 76, 2], [12, 74, 4],
  [16, 72, 2], [18, 76, 2], [20, 81, 2], [22, 79, 2], [24, 76, 4], [28, 74, 4],
  [32, 77, 2], [34, 81, 2], [36, 84, 2], [38, 81, 2], [40, 79, 2], [42, 77, 2], [44, 76, 4],
  [48, 74, 2], [50, 77, 2], [52, 79, 2], [54, 83, 2], [56, 84, 6], [62, 79, 2],
];

export class Music {
  private track: Track = 'none';
  private step = 0;
  private loop = 0;
  private next = 0;
  private timer = 0;
  private out: GainNode;
  private noiseBuf: AudioBuffer;
  tempoMul = 1;
  enabled = true;

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.2;
    this.out.connect(dest);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  play(t: Track): void {
    if (t === this.track) return;
    this.track = t;
    this.step = 0;
    this.loop = 0;
    this.tempoMul = 1;
    this.next = this.ctx.currentTime + 0.08;
    clearInterval(this.timer);
    if (t !== 'none') this.timer = window.setInterval(() => this.schedule(), 25);
  }

  /** Baja el volumen (pausa) o lo restablece. */
  duck(on: boolean): void {
    this.out.gain.setTargetAtTime(on ? 0.07 : 0.2, this.ctx.currentTime, 0.15);
  }

  private get stepDur(): number {
    const bpm = (this.track === 'race' ? 136 : 98) * this.tempoMul;
    return 60 / bpm / 4;
  }

  private schedule(): void {
    if (this.ctx.state !== 'running') return;
    while (this.next < this.ctx.currentTime + 0.12) {
      if (this.enabled) {
        if (this.track === 'race') this.raceStep(this.step, this.next);
        else this.menuStep(this.step, this.next);
      }
      this.next += this.stepDur;
      this.step = (this.step + 1) % 64;
      if (this.step === 0) this.loop++;
    }
  }

  private raceStep(s: number, t: number): void {
    const bar = Math.floor(s / 16);
    const b = s % 16;
    const sd = this.stepDur;
    // Batería.
    if (b === 0 || b === 8 || (b === 10 && bar === 3)) this.kick(t);
    if (b === 4 || b === 12) this.snare(t);
    if (b % 2 === 0) this.hat(t, b % 4 === 2 ? 0.05 : 0.025);
    // Bajo.
    if ([0, 3, 6, 8, 11, 14].includes(b)) this.note(t, midi(BASS[bar] + (b === 6 || b === 14 ? 7 : 0)), sd * 1.6, 'square', 0.16, 900);
    // Acordes a contratiempo.
    if (b === 4 || b === 12) for (const n of CHORDS[bar]) this.note(t, midi(n + 12), sd * 1.5, 'triangle', 0.06);
    // Melodía (cada dos vueltas, una sin melodía y con arpegio, para no cansar).
    if (this.loop % 2 === 0) {
      for (const [st, n, len] of RACE_MELODY) if (st === s) this.note(t, midi(n), sd * len * 0.9, 'square', 0.07, 2600);
    } else if (b % 2 === 0) {
      const ch = CHORDS[bar];
      this.note(t, midi(ch[(b / 2) % 3] + 24), sd * 1.2, 'triangle', 0.05);
    }
  }

  private menuStep(s: number, t: number): void {
    const bar = Math.floor(s / 16);
    const b = s % 16;
    const sd = this.stepDur;
    if (b === 0) this.note(t, midi(BASS[bar] + 12), sd * 12, 'triangle', 0.14);
    if (b === 8) this.note(t, midi(BASS[bar] + 19), sd * 6, 'triangle', 0.08);
    // Campanitas: arpegio del acorde en corcheas.
    if (b % 2 === 0) {
      const ch = CHORDS[bar];
      const seq = [0, 1, 2, 1, 2, 0, 1, 2];
      this.bell(t, midi(ch[seq[b / 2]] + 12 + (b === 14 && this.loop % 2 ? 12 : 0)), 0.07);
    }
    if (b === 4 || b === 12) this.hat(t, 0.015);
  }

  private note(t: number, f: number, dur: number, type: OscillatorType, vol: number, lp = 0): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (lp) {
      const f2 = ctx.createBiquadFilter();
      f2.type = 'lowpass';
      f2.frequency.value = lp;
      o.connect(f2);
      node = f2;
    }
    node.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private bell(t: number, f: number, vol: number): void {
    const ctx = this.ctx;
    for (const [mul, v] of [[1, 1], [2.01, 0.35], [3.98, 0.12]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mul;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * v, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 / mul);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + 1);
    }
  }

  private kick(t: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.18);
  }

  private snare(t: number): void {
    this.noise(t, 0.12, 'bandpass', 1800, 0.25);
    this.note(t, 190, 0.08, 'triangle', 0.12);
  }

  private hat(t: number, vol: number): void {
    this.noise(t, 0.04, 'highpass', 7000, vol * 4);
  }

  private noise(t: number, dur: number, type: BiquadFilterType, f: number, vol: number): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
}
