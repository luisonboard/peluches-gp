// Audio sintetizado con Web Audio: motor del kart del jugador, chirrido de derrape y efectos.
// Se crea en la primera interacción (los navegadores no dejan sonar antes).

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private engO1!: OscillatorNode;
  private engO2!: OscillatorNode;
  private engF!: BiquadFilterNode;
  private engG!: GainNode;
  private skidG!: GainNode;
  private skidF!: BiquadFilterNode;
  private noiseBuf!: AudioBuffer;
  muted = false;

  constructor(private enabled: boolean) {}

  unlock(): void {
    if (!this.enabled) return;
    try {
      if (!this.ctx) this.build();
      void this.ctx!.resume();
    } catch {
      this.enabled = false;
    }
  }

  private build(): void {
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);
    // Ruido blanco reutilizable.
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Motor: diente de sierra + cuadrada una quinta arriba, por un paso bajo.
    this.engO1 = ctx.createOscillator();
    this.engO1.type = 'sawtooth';
    this.engO2 = ctx.createOscillator();
    this.engO2.type = 'square';
    this.engF = ctx.createBiquadFilter();
    this.engF.type = 'lowpass';
    this.engF.Q.value = 2;
    this.engG = ctx.createGain();
    this.engG.gain.value = 0;
    const o2g = ctx.createGain();
    o2g.gain.value = 0.35;
    this.engO1.connect(this.engF);
    this.engO2.connect(o2g).connect(this.engF);
    this.engF.connect(this.engG).connect(this.master);
    this.engO1.start();
    this.engO2.start();
    // Chirrido de derrape: ruido por un paso banda.
    const skid = ctx.createBufferSource();
    skid.buffer = this.noiseBuf;
    skid.loop = true;
    this.skidF = ctx.createBiquadFilter();
    this.skidF.type = 'bandpass';
    this.skidF.frequency.value = 1800;
    this.skidF.Q.value = 3;
    this.skidG = ctx.createGain();
    this.skidG.gain.value = 0;
    skid.connect(this.skidF).connect(this.skidG).connect(this.master);
    skid.start();
  }

  private get ok(): boolean {
    return !!this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  setEngine(speed01: number, throttle: number, boost: boolean, driftLevel: number, drifting: boolean, on: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 48 + speed01 * 120 + (boost ? 25 : 0);
    this.engO1.frequency.setTargetAtTime(f, t, 0.05);
    this.engO2.frequency.setTargetAtTime(f * 1.5, t, 0.05);
    this.engF.frequency.setTargetAtTime(500 + speed01 * 1600 + throttle * 300, t, 0.05);
    this.engG.gain.setTargetAtTime(on && !this.muted ? 0.05 + throttle * 0.04 : 0, t, 0.08);
    this.skidG.gain.setTargetAtTime(on && drifting && !this.muted ? 0.05 + driftLevel * 0.02 : 0, t, 0.05);
    this.skidF.frequency.setTargetAtTime(1500 + driftLevel * 400, t, 0.05);
  }

  tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.18, delay = 0, slideTo = 0): void {
    if (!this.ok) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur: number, from: number, to: number, vol = 0.25, type: BiquadFilterType = 'bandpass'): void {
    if (!this.ok) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  countdown(n: number): void {
    this.tone(n > 0 ? 523 : 1046, n > 0 ? 0.18 : 0.45, 'square', 0.16);
  }
  boost(): void {
    this.noise(0.6, 600, 3200, 0.28);
    this.tone(220, 0.4, 'sawtooth', 0.06, 0, 660);
  }
  driftLevel(level: number): void {
    this.tone([0, 660, 880, 1175][level] ?? 1175, 0.08, 'triangle', 0.12);
  }
  bump(strength: number): void {
    this.tone(110, 0.18, 'sine', Math.min(0.35, 0.08 + strength * 0.02), 0, 45);
    this.noise(0.12, 900, 300, 0.08, 'lowpass');
  }
  hop(): void {
    this.tone(300, 0.08, 'sine', 0.06, 0, 520);
  }
  land(): void {
    this.noise(0.15, 400, 120, 0.12, 'lowpass');
  }
  lap(final: boolean): void {
    const notes = final ? [523, 659, 784, 1046] : [659, 880];
    notes.forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.14, i * 0.1));
  }
  finish(place: number): void {
    const notes = place <= 3 ? [523, 659, 784, 1046, 784, 1046] : [392, 349, 330, 262];
    notes.forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.16, i * 0.14));
  }
  // --- Objetos y poderes (vol = 0..1 según la distancia al jugador) ---
  box(): void {
    [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.09, 'triangle', 0.1, i * 0.04));
  }
  roulette(): void {
    this.tone(1400, 0.03, 'square', 0.04);
  }
  itemGet(): void {
    [784, 1046].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.13, i * 0.08));
  }
  powerReady(): void {
    [1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.1, i * 0.06));
  }
  throwBall(vol = 1): void {
    this.tone(200, 0.25, 'sine', 0.22 * vol, 0, 700);
  }
  gum(vol = 1): void {
    this.noise(0.18, 600, 150, 0.2 * vol, 'lowpass');
    this.tone(160, 0.2, 'sine', 0.12 * vol, 0.02, 90);
  }
  hit(vol = 1): void {
    this.tone(520, 0.5, 'sine', 0.16 * vol, 0, 140);
    this.noise(0.15, 1200, 300, 0.15 * vol, 'lowpass');
  }
  stuck(vol = 1): void {
    this.tone(180, 0.4, 'triangle', 0.15 * vol, 0, 110);
  }
  bark(vol = 1): void {
    for (const d of [0, 0.2]) {
      this.tone(520, 0.13, 'sawtooth', 0.2 * vol, d, 260);
      this.noise(0.1, 1500, 700, 0.12 * vol);
    }
  }
  bubble(vol = 1): void {
    this.tone(260, 0.35, 'sine', 0.22 * vol, 0, 980);
    this.tone(400, 0.25, 'sine', 0.1 * vol, 0.12, 1300);
  }
  pop(vol = 1): void {
    this.noise(0.08, 3000, 1200, 0.2 * vol, 'highpass');
  }
  thunder(): void {
    this.noise(0.12, 6000, 2500, 0.35, 'highpass');
    this.noise(1.4, 500, 60, 0.4, 'lowpass');
  }
  fire(vol = 1): void {
    this.noise(1.0, 300, 2600, 0.3 * vol);
    this.tone(150, 0.9, 'sawtooth', 0.07 * vol, 0, 420);
  }
  jump(vol = 1): void {
    this.tone(180, 0.35, 'square', 0.1 * vol, 0, 520);
  }
  quake(vol = 1): void {
    this.tone(70, 0.9, 'sine', 0.4 * vol, 0, 30);
    this.noise(0.8, 300, 60, 0.35 * vol, 'lowpass');
  }
  missile(vol = 1): void {
    this.noise(0.6, 800, 2500, 0.2 * vol);
    [1200, 1200, 1200].forEach((f, i) => this.tone(f, 0.05, 'square', 0.06 * vol, 0.15 + i * 0.12));
  }
  explosion(vol = 1, big = false): void {
    this.noise(big ? 0.9 : 0.5, 900, 50, (big ? 0.45 : 0.3) * vol, 'lowpass');
    this.tone(90, 0.4, 'sine', 0.25 * vol, 0, 35);
  }

  click(): void {
    this.tone(880, 0.05, 'triangle', 0.08);
  }
}
