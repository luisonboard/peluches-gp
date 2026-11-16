// Indicaciones en voz alta (síntesis de voz del sistema, en español).
export class Voice {
  enabled = true;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (!('speechSynthesis' in window)) return;
    const pick = (): void => {
      const vs = speechSynthesis.getVoices();
      this.voice = vs.find((v) => v.lang.startsWith('es') && /MX|US|419|ES/.test(v.lang)) ?? vs.find((v) => v.lang.startsWith('es')) ?? null;
    };
    pick();
    speechSynthesis.addEventListener?.('voiceschanged', pick);
  }

  say(text: string, interrupt = true): void {
    if (!this.enabled || !('speechSynthesis' in window)) return;
    try {
      if (interrupt) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = this.voice?.lang ?? 'es-ES';
      if (this.voice) u.voice = this.voice;
      u.rate = 1.05;
      u.pitch = 1.25;
      speechSynthesis.speak(u);
    } catch {
      /* sin voz disponible */
    }
  }
}
