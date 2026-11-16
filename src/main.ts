// Peluches GP — arranque, estados (título, carrera, pausa, resultados), efectos y benchmark.
import * as THREE from 'three';
import { bus, installErrorHooks } from './core/events';
import { params } from './core/params';
import { Rng } from './core/rng';
import { Loop } from './core/loop';
import { detectQuality, DynamicResolution, GpuTimer } from './core/quality';
import { Input } from './input/input';
import { createStage, followSun } from './render/scene';
import { makeTextures } from './world/textures';
import { buildTrack } from './world/trackMesh';
import { buildRoom } from './world/room';
import { ROOM_TRACK } from './world/roomTrack';
import { Track } from './game/track';
import { CHARACTERS } from './game/characters';
import { KartModel } from './game/kartModel';
import { Kart, TUNING } from './game/kart';
import { AIDriver } from './game/ai';
import { Race, CPU_LEVELS } from './game/race';
import { ChaseCam, orbitCam, topCam } from './game/camera';
import { Particles } from './fx/particles';
import { GameAudio } from './audio/audio';
import { Hud, type TitleSetup } from './ui/hud';
import { Arena } from './game/arena';
import { PlushMaterials } from './game/plush';
import { displayName } from './game/characters';
import { loadSettings, saveSettings, applyProfile } from './core/settings';
import { Gyro } from './input/gyro';
import { TouchControls, isTouchDevice } from './input/touch';
import { Voice } from './audio/voice';
import { openSettings } from './ui/settings';

installErrorHooks();

const app = document.getElementById('app')!;
const quality = detectQuality(params.quality);
const stage = createStage(app, quality);
const { renderer, scene } = stage;
const rng = new Rng(params.seed);
const tex = makeTextures(rng.fork('texturas'), quality.anisotropy);
const track = new Track(ROOM_TRACK);
const trackVis = buildTrack(track, tex, quality);
scene.add(trackVis.group);
scene.add(buildRoom(track, tex, quality, rng.fork('cuarto')));

const camera = new THREE.PerspectiveCamera(68, 1, 0.3, 1600);
const chase = new ChaseCam(camera);
const sparks = new Particles(quality.particles, true);
const dust = new Particles(Math.round(quality.particles * 0.6), false);
scene.add(sparks.points, dust.points);

const arena = new Arena(track, tex, sparks, dust, rng.fork('objetos'));
scene.add(arena.group);
const plushMats = new PlushMaterials(quality.name !== 'low');

const audio = new GameAudio(!params.noaudio);
const input = new Input();
input.onFirstInteraction = () => audio.unlock();
const hud = new Hud();
hud.setTrack(track);

const loop = new Loop(frame);
if (params.fps !== null) loop.fpsLimit = params.fps;
const dynRes = new DynamicResolution(renderer, Math.min(devicePixelRatio, quality.maxPixelRatio), 1000 / (loop.fpsLimit || 60));
const gpu = new GpuTimer(renderer);

function resize(): void {
  const w = app.clientWidth;
  const h = app.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------------- Estado del juego ----------------

type Mode = 'title' | 'race' | 'paused' | 'results';
let mode: Mode = 'title';
let titleT = 0;
const settings = loadSettings();
const charFromParam = CHARACTERS.findIndex((c) => c.id === params.char || c.defaultName.toLowerCase() === params.char?.toLowerCase());
if (charFromParam >= 0) settings.charIndex = charFromParam;
if (params.cpu === 'facil' || params.cpu === 'normal' || params.cpu === 'dificil') settings.cpu = params.cpu;
if (params.laps) settings.laps = params.laps;
if (params.profile === 'normal' || params.profile === 'peque') applyProfile(settings, params.profile);
const setup: TitleSetup = {
  charIndex: settings.charIndex,
  cpu: CPU_LEVELS.find((l) => l.id === settings.cpu) ?? CPU_LEVELS[0],
  laps: settings.laps,
};
let race: Race;
let karts: Kart[] = [];
let resultsShownAt = -1;

const gyro = new Gyro();
const voice = new Voice();
const touchOn = isTouchDevice();
hud.touchMode = isTouchDevice();
const touch = new TouchControls(gyro, () => {
  if (mode === 'race') pause();
});

/** Lleva los ajustes guardados a los sistemas que los usan. */
function applySettings(): void {
  gyro.sens = settings.gyroSens;
  gyro.invert = settings.gyroInvert;
  voice.enabled = settings.voice && !params.noaudio;
  touch.configure(settings);
  if (race) {
    race.assist = { autoAccel: settings.autoAccel, smartSteer: settings.smartSteer };
    race.autoPower = settings.autoPower;
    const p = karts[0];
    p.hitScale = settings.profile === 'peque' ? 0.85 : 1;
    p.driftChargeMult = settings.smartSteer ? 0.8 : 1;
  }
}

function storeSetup(): void {
  settings.charIndex = setup.charIndex;
  settings.cpu = setup.cpu.id;
  settings.laps = setup.laps;
  saveSettings(settings);
}

function buildRace(): void {
  for (const k of karts) scene.remove(k.model.root);
  const others = CHARACTERS.filter((_, i) => i !== setup.charIndex);
  const roster = [CHARACTERS[setup.charIndex], ...others];
  const aiRng = rng.fork(`ia-${Date.now()}`);
  karts = roster.map((c, i) => {
    const model = new KartModel(c, quality.shadowMap > 0 ? null : tex.blob, quality.shadowMap > 0, plushMats);
    scene.add(model.root);
    return new Kart(i, c, i === 0, model, track);
  });
  const ais = karts.map((_, i) => new AIDriver(aiRng.fork(`p${i}`), i === 0 ? 0.8 : setup.cpu.driftSkill));
  race = new Race(karts, ais, setup.laps, setup.cpu, params.autoplay, aiRng.fork('carrera'), arena);
  applySettings();
  chase.reset();
}

function titleStatus(): string {
  const parts = [settings.profile === 'peque' ? 'Perfil Peque' : 'Perfil Normal'];
  if (settings.autoAccel || settings.smartSteer) parts.push('ayuda de manejo activada');
  if (touchOn) parts.push(settings.steerMode === 'giro' ? 'volante: giroscopio' : 'volante: botones');
  return parts.join(' · ');
}

let closeSettings: (() => void) | null = null;
function showSettings(after: () => void): void {
  closeSettings = openSettings({
    settings,
    gyro,
    padInfo: () => input.padInfo(),
    onChange: () => {
      saveSettings(settings);
      const lv = CPU_LEVELS.find((l) => l.id === settings.cpu);
      if (lv && mode === 'title') setup.cpu = lv;
      applySettings();
    },
    onClose: () => {
      closeSettings = null;
      after();
    },
  });
}

function showTitle(): void {
  mode = 'title';
  loop.fpsLimit = params.fps ?? 30;
  buildRace();
  hud.setRaceVisible(false);
  touch.show(false);
  hud.showTitle(
    setup,
    (s) => {
      const charChanged = s.charIndex !== setup.charIndex;
      Object.assign(setup, s);
      storeSetup();
      if (charChanged) buildRace();
      audio.click();
    },
    startRace,
    () => showSettings(showTitle),
    titleStatus(),
  );
}

function startRace(): void {
  audio.unlock();
  if (touchOn) {
    // En el teléfono: pantalla completa y horizontal donde el navegador lo permita (no en iPhone).
    const de = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (!document.fullscreenElement && de.requestFullscreen) {
      de.requestFullscreen()
        .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
        .catch(() => {});
    }
    if (settings.steerMode === 'giro' && !gyro.active) void gyro.enable();
  }
  hud.closeScreen();
  buildRace();
  mode = 'race';
  loop.fpsLimit = params.fps ?? 60;
  dynRes.targetMs = 1000 / (loop.fpsLimit || 60);
  hud.setRaceVisible(true);
  touch.show(touchOn);
  resultsShownAt = -1;
  race.start();
  // La posición en que sostiene el teléfono al empezar cuenta como "recto".
  setTimeout(() => gyro.calibrate(), 600);
}

function pause(): void {
  if (mode !== 'race') return;
  mode = 'paused';
  touch.show(false);
  const resume = (): void => {
    hud.closeScreen();
    mode = 'race';
    touch.show(touchOn);
  };
  hud.showPause(resume, startRace, showTitle, () => showSettings(pause2));
  function pause2(): void {
    mode = 'race';
    pause();
  }
}

// ---------------- Eventos → audio, cámara, efectos ----------------

bus.on('race:countdown', ({ n }) => {
  hud.flash(String(n));
  audio.countdown(n);
  voice.say(['', 'uno', 'dos', 'tres'][n]);
});
bus.on('race:go', () => {
  hud.flash('¡Ya!', false, '#ffd23a');
  audio.countdown(0);
  voice.say('¡Ya!');
});
bus.on('kart:lap', ({ kart, lap }) => {
  if (kart !== 0 || !race) return;
  if (lap === race.laps) {
    hud.flash('¡Última vuelta!', true, '#ffd23a');
    audio.lap(true);
    voice.say('¡Última vuelta!');
  } else if (lap > 1 && lap <= race.laps) {
    hud.flash(`Vuelta ${lap}`, true);
    audio.lap(false);
  }
});
bus.on('kart:finish', ({ kart, place }) => {
  if (kart !== 0) return;
  hud.flash(place === 1 ? '¡Ganaste!' : '¡Meta!', false, '#ffd23a');
  audio.finish(place);
  voice.say(place === 1 ? '¡Ganaste!' : `¡Llegaste en el lugar ${place}!`);
  input.rumble(0.6, 0.6, 400);
});
bus.on('kart:boost', ({ kart }) => {
  if (kart !== 0) return;
  audio.boost();
  chase.shake(0.15);
  input.rumble(0.2, 0.6, 250);
});
bus.on('kart:drift', ({ kart, level }) => {
  if (kart === 0) audio.driftLevel(level);
});
bus.on('kart:bump', ({ kart, strength }) => {
  if (kart !== 0) return;
  audio.bump(strength);
  chase.shake(Math.min(0.5, strength * 0.04));
  input.rumble(Math.min(1, strength * 0.08), 0.3, 150);
});
bus.on('kart:hop', ({ kart }) => {
  if (kart === 0) audio.hop();
});
bus.on('kart:land', ({ kart, strength }) => {
  const k = karts[kart];
  if (!k) return;
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    dust.spawn(k.pos.x + Math.cos(a) * 1.2, k.pos.y + 0.2, k.pos.z + Math.sin(a) * 1.2, Math.cos(a) * 3, 1.5, Math.sin(a) * 3, 0.5, 0.6, 1.5, 0xf2e8d0, 0.5, 2, 2);
  }
  if (kart === 0 && strength > 6) {
    audio.land();
    chase.shake(0.25);
  }
});

// Objetos y poderes: el sonido baja con la distancia al jugador.
function volAt(x: number, z: number): number {
  const p = karts[0];
  if (!p) return 0;
  return Math.max(0, 1 - Math.hypot(p.pos.x - x, p.pos.z - z) / 90);
}
const volKart = (i: number): number => (i === 0 ? 1 : karts[i] ? volAt(karts[i].pos.x, karts[i].pos.z) : 0);
const POWER_SAY: Record<string, string> = {
  perro: '¡Guau guau!', esponja: '¡Burbuja!', raton: '¡Rayo!', zorro: '¡Fuego de zorro!', dino: '¡Pisotón!', robot: '¡Misil imán!',
};

bus.on('box:open', ({ kart }) => {
  if (kart === 0) audio.box();
});
let rouletteTick = 0;
bus.on('item:get', ({ kart }) => {
  if (kart === 0) audio.itemGet();
});
bus.on('item:use', ({ kart, item }) => {
  const v = volKart(kart);
  if (item === 'pelota') audio.throwBall(v);
  else if (item === 'chicle') audio.gum(v);
});
bus.on('power:ready', ({ kart }) => {
  if (kart === 0) audio.powerReady();
});
bus.on('power:use', ({ kart, power }) => {
  const v = volKart(kart);
  if (kart === 0) hud.flash(POWER_SAY[power], true, '#ffd23a');
  else if (v > 0.3) hud.toast(`${displayName(karts[kart].char)}: ${karts[kart].char.power}`, '#ffe9a8');
  if (power === 'perro') {
    audio.bark(v);
    if (kart === 0 || v > 0.6) chase.shake(0.2);
  } else if (power === 'esponja') audio.bubble(v);
  else if (power === 'zorro') audio.fire(v);
  else if (power === 'dino') audio.jump(v);
  else if (power === 'robot') audio.missile(v);
});
bus.on('fx:lightning', () => {
  audio.thunder();
  hud.screenFlash(0.8);
});
bus.on('fx:quake', ({ x, z }) => {
  const v = volAt(x, z);
  audio.quake(v);
  chase.shake(0.7 * v);
  input.rumble(0.8 * v, 0.4 * v, 450);
});
bus.on('fx:explode', ({ x, z, big }) => {
  const v = volAt(x, z);
  audio.explosion(v, big);
  if (v > 0.6) chase.shake(big ? 0.45 : 0.2);
});
bus.on('kart:hit', ({ kart, kind, by }) => {
  const v = volKart(kart);
  if (kind === 'stuck') audio.stuck(v);
  else if (kind === 'bubble') audio.pop(v);
  else if (kind !== 'shrink') audio.hit(v);
  if (kart === 0) {
    input.rumble(0.9, 0.5, 350);
    chase.shake(0.35);
    const who = by >= 0 && by !== 0 ? karts[by] : null;
    const what = { spin: '¡Uy!', stuck: '¡Chicle!', bubble: '¡Atrapado!', shrink: '¡Pequeñito!', tumble: '¡Bum!' }[kind];
    hud.toast(who ? `${what} ${displayName(who.char)} te dio` : what, '#ffb0b0');
  }
});

const DRIFT_COLORS = [0xfff3d6, 0x4aa8ff, 0xff9a2a, 0xff5ad8];

function kartFx(k: Kart, dt: number): void {
  const fx = Math.sin(k.heading);
  const fz = Math.cos(k.heading);
  const rx = -fz;
  const rz = fx;
  const q = quality.particles / 1200;
  if (k.drift !== 0 && k.grounded) {
    const rate = (k.driftLevel > 0 ? 70 : 30) * q;
    const n = rate * dt + Math.random();
    for (let i = 0; i < Math.floor(n); i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = k.pos.x - fx * 1.0 + rx * side * 0.95;
      const z = k.pos.z - fz * 1.0 + rz * side * 0.95;
      const c = DRIFT_COLORS[k.driftLevel];
      const spread = 2.5;
      if (k.driftLevel > 0)
        sparks.spawn(x, k.pos.y + 0.25, z, -fx * 4 + (Math.random() - 0.5) * spread, Math.random() * 4 + 1.5, -fz * 4 + (Math.random() - 0.5) * spread, 0.3, 0.45, 0.05, c, 1, 12, 1);
      else dust.spawn(x, k.pos.y + 0.2, z, -fx * 2, 0.8, -fz * 2, 0.4, 0.5, 1.2, c, 0.35, 0, 2);
    }
  }
  if (k.boostT > 0) {
    const n = 50 * q * dt + Math.random();
    for (let i = 0; i < Math.floor(n); i++) {
      for (const side of [-0.32, 0.32]) {
        const x = k.pos.x - fx * 1.8 + rx * side;
        const z = k.pos.z - fz * 1.8 + rz * side;
        sparks.spawn(x, k.pos.y + 0.9, z, -fx * 7 + k.vel.x * 0.6, 0.5, -fz * 7 + k.vel.z * 0.6, 0.22, 0.9, 0.15, Math.random() < 0.5 ? 0xffb52a : 0xff6a1a, 1, -2, 3);
      }
    }
  }
  if (k.fireT > 0) {
    const n = 90 * q * dt + Math.random();
    for (let i = 0; i < Math.floor(n); i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.1 + Math.random() * 0.6;
      sparks.spawn(k.pos.x + Math.cos(a) * r, k.pos.y + 0.3 + Math.random() * 1.8, k.pos.z + Math.sin(a) * r, k.vel.x * 0.5, 2.5 + Math.random() * 2, k.vel.z * 0.5, 0.4, 1.1, 0.2, Math.random() < 0.5 ? 0xff7a1a : 0xffd23a, 1, -3, 1);
    }
  }
  if (k.offroad && k.grounded && Math.abs(k.speed) > 6) {
    if (Math.random() < 14 * q * dt * (Math.abs(k.speed) / 15)) {
      const col = k.surface === 'bed' ? 0xf3ea9c : k.surface === 'ramp' ? 0xd8b484 : 0x9fcf8a;
      dust.spawn(k.pos.x - fx * 1.2, k.pos.y + 0.3, k.pos.z - fz * 1.2, -fx * 2 + (Math.random() - 0.5) * 2, 1.2, -fz * 2 + (Math.random() - 0.5) * 2, 0.6, 0.6, 1.4, col, 0.4, 1, 1.5);
    }
  }
}

// ---------------- Benchmark (?bench) ----------------

const bench = { active: params.bench, start: -1, frames: [] as number[], gpu: [] as number[], done: false };
function benchFrame(intervalMs: number): void {
  if (!bench.active || bench.done || mode !== 'race' || race.phase === 'countdown') return;
  if (bench.start < 0) bench.start = race.time + 2;
  if (race.time < bench.start) return;
  bench.frames.push(intervalMs);
  if (gpu.lastMs >= 0) bench.gpu.push(gpu.lastMs);
  const elapsed = race.time - bench.start;
  hud.bench(`bench ${quality.name}: ${elapsed.toFixed(0)}/20 s`);
  if (elapsed >= 20) {
    bench.done = true;
    const sorted = [...bench.frames].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const gpuAvg = bench.gpu.length ? bench.gpu.reduce((a, b) => a + b, 0) / bench.gpu.length : -1;
    const res = {
      quality: quality.name,
      pixelRatio: +dynRes.pixelRatio.toFixed(2),
      frames: sorted.length,
      avgFrameMs: +avg.toFixed(2),
      p95FrameMs: +p95.toFixed(2),
      fps: +(1000 / avg).toFixed(1),
      gpuMs: +gpuAvg.toFixed(2),
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    };
    window.__bench = res;
    hud.bench(
      `bench ${res.quality} · ${res.fps} fps · cuadro ${res.avgFrameMs} ms (p95 ${res.p95FrameMs})\n` +
        `GPU ${res.gpuMs >= 0 ? res.gpuMs + ' ms' : 'n/d'} · ${res.drawCalls} draws · ${(res.triangles / 1000).toFixed(0)}k tris · dpr ${res.pixelRatio}`,
    );
  }
}

// ---------------- Bucle ----------------

function frame(dt: number): void {
  dynRes.sample(loop.lastIntervalMs, dt);
  const ctl = input.read();
  if (mode === 'race') touch.merge(ctl, dt, karts[0].power >= 1);
  if (input.consumePause()) {
    if (mode === 'race') pause();
    else if (mode === 'paused' && !closeSettings) {
      hud.closeScreen();
      mode = 'race';
      touch.show(touchOn);
    }
  }
  const menuKeys = input.consumeMenu();
  if (closeSettings) {
    if (menuKeys.includes('back')) closeSettings();
  } else if (hud.menuOpen) hud.menuInput(menuKeys);

  if (mode === 'title') {
    titleT += dt;
    race.update(dt, ctl, camera);
  } else if (mode === 'race' || mode === 'results') {
    for (let s = 0; s < params.speed; s++) race.update(dt, ctl, camera);
    for (const k of karts) kartFx(k, dt);
    if (race.phase === 'done') {
      if (resultsShownAt < 0 && race.time - race.doneAt > 2.5) {
        resultsShownAt = race.time;
        mode = 'results';
        touch.show(false);
        hud.showResults(race, startRace, showTitle);
      } else if (resultsShownAt >= 0) hud.refreshResults(race);
    }
  }

  // Cámara.
  const p = karts[0];
  if (params.cam === 'free') {
    /* cámara libre: se mueve desde DevTools (__game.camera) */
  } else if (params.cam === 'top') topCam(camera, track);
  else if (mode === 'title') orbitCam(camera, track, titleT);
  else if (mode !== 'paused') chase.update(dt, p);
  followSun(stage, p.pos.x, p.pos.y, p.pos.z);

  if (mode !== 'paused') {
    trackVis.update(dt);
    sparks.update(dt, camera, renderer.domElement.height);
    dust.update(dt, camera, renderer.domElement.height);
  }
  if (mode === 'race' || mode === 'results') {
    hud.update(race);
    if (p.rouletteT > 0 && (rouletteTick += dt) > 0.08) {
      rouletteTick = 0;
      audio.roulette();
    }
  }
  const racing = mode === 'race' || mode === 'results';
  audio.setEngine(Math.min(1.3, Math.abs(p.speed) / TUNING.maxSpeed), racing ? 1 : 0, p.boostT > 0, p.driftLevel, p.drift !== 0 && p.grounded, racing && !p.finished);

  gpu.begin();
  renderer.render(scene, camera);
  gpu.end();
  benchFrame(loop.lastIntervalMs);
}

// ---------------- Arranque ----------------

showTitle();
if (params.autostart) startRace();
loop.start();

window.__game = {
  get race() {
    return race;
  },
  get karts() {
    return karts;
  },
  get mode() {
    return mode;
  },
  track,
  camera,
  renderer,
  scene,
  bus,
  settings,
  gyro,
  touch,
  applySettings,
  arena,
  quality,
  dynRes,
  loop,
  TUNING,
  params,
  startRace,
  showTitle,
  sparks,
  dust,
};
