// Parámetros de URL para probar sin jugar a mano (ver README).
const q = new URLSearchParams(location.search);
const num = (k: string, d: number): number => {
  const v = Number(q.get(k));
  return q.has(k) && Number.isFinite(v) ? v : d;
};

export const params = {
  bench: q.has('bench'),
  autostart: q.has('autostart') || q.has('bench'),
  autoplay: q.has('autoplay') || q.has('bench'),
  quality: q.get('q'),
  fps: q.has('fps') ? num('fps', 60) : null,
  seed: q.get('seed') ?? 'peluches',
  noaudio: q.has('noaudio'),
  speed: Math.max(1, Math.min(16, Math.round(num('speed', 1)))),
  laps: q.has('laps') ? Math.max(1, Math.min(9, Math.round(num('laps', 3)))) : null,
  cpu: q.get('cpu'),
  char: q.get('char'),
  cam: q.get('cam'),
  debug: q.has('debug'),
  profile: q.get('perfil'),
  /** Pista por id (`cuarto`, …). */
  track: q.get('track'),
  /** Copa de 3 carreras (con `?autostart` empieza sola): `?copa` = Copa Peluche, `?copa=escuela` = Copa Escuelita. */
  copa: q.has('copa') ? (q.get('copa') ? `copa-${q.get('copa')}` : 'copa') : null,
  /** Pantalla dividida (con `?autostart`: teclado + mandos 0, 1…). `?split=3` o `?split=4`: cuántos jugadores (2 por defecto). */
  split: q.has('split'),
  splitPlayers: Math.max(2, Math.min(4, Math.round(num('split', 2)) || 2)),
};
