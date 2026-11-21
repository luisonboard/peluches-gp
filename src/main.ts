// Peluches GP — arranque, estados (título, carrera, pausa, resultados), efectos y benchmark.
import * as THREE from 'three';
import { bus, installErrorHooks } from './core/events';
import { params } from './core/params';
import { Rng } from './core/rng';
import { Loop } from './core/loop';
import { detectQuality, DynamicResolution, GpuTimer, HeatGuard, PRESETS, type QualityName } from './core/quality';
import { Input, type Controls, type DeviceId } from './input/input';
import { createStage, followSun, applyLook, setShadows } from './render/scene';
import { disposeTree } from './render/dispose';
import { makeTextures } from './world/textures';
import { buildTrack, type TrackVisual } from './world/trackMesh';
import { readyTrack, dustColor, type ReadyTrack } from './world/tracks';
import { Obstacles } from './game/obstacles';
import { Cup, cupDef, isCupId } from './game/cup';
import { Track } from './game/track';
import { CHARACTERS } from './game/characters';
import { KartModel } from './game/kartModel';
import { Kart, TUNING } from './game/kart';
import { AIDriver } from './game/ai';
import { Race, CPU_LEVELS } from './game/race';
import { ChaseCam, topCam, showroomCam, podiumCam } from './game/camera';
import { Podium } from './world/podium';
import { Particles } from './fx/particles';
import { GameAudio } from './audio/audio';
import { Hud, LOCAL_COLORS, type TitleSetup } from './ui/hud';
import { PadHub } from './net/pad';
import { openPhonePanel } from './ui/phonePanel';
import { Arena } from './game/arena';
import { PlushMaterials } from './game/plush';
import { displayName } from './game/characters';
import { loadSettings, saveSettings, applyProfile, profileAssist, type Profile, type PlayerPrefs } from './core/settings';
import { openSplitJoin, type SplitPlayer } from './ui/split';
import { Gyro } from './input/gyro';
import { TouchControls, isTouchDevice } from './input/touch';
import { Voice } from './audio/voice';
import { openSettings } from './ui/settings';
import { toggleFullscreen, fullscreenSupported } from './ui/fullscreen';
import { Session } from './net/session';
import type { RosterEntry } from './net/protocol';
import type { Species } from './core/events';
import { showOnlineMenu, showLobby, closeLobbyScreen } from './ui/lobby';
import { normalizeCode } from './net/net';
import { NO_CTL } from './game/kart';
import { installPwa } from './pwa';

/** Arranca el juego (lo llama entry.ts; no se ejecuta al importar, porque el archivo único carga todos los módulos). */
export function startGame(): void {
  installErrorHooks();
  installPwa();

  const app = document.getElementById('app')!;
  const quality = detectQuality(params.quality);
  /** Calidad elegida (o detectada); en pantalla dividida se baja (un nivel con 2 jugadores, a Bajo con 3 o 4) y al salir se vuelve a esta. */
  const baseQuality: QualityName = quality.name;
  const LOWER: Record<QualityName, QualityName> = { high: 'medium', medium: 'low', low: 'low' };
  const stage = createStage(app, quality);
  const { renderer, scene } = stage;
  const rng = new Rng(params.seed);
  const tex = makeTextures(rng.fork('texturas'), quality.anisotropy);
  const settings = loadSettings();

  // ---------------- Pista ----------------
  // Solo hay una pista montada a la vez. Al cambiar, se libera la anterior (geometrías, materiales y texturas propias).
  let trackEntry!: ReadyTrack;
  let track!: Track;
  let trackVis!: TrackVisual;
  let scenery!: THREE.Group;
  let obstacles!: Obstacles;

  function mountTrack(id: string): void {
    trackEntry = readyTrack(id);
    track = new Track(trackEntry.def);
    applyLook(stage, trackEntry.look);
    trackVis = buildTrack(track, tex, quality, trackEntry.look);
    // `fork` no avanza el generador: la misma pista sale con el mismo decorado cada vez.
    scenery = trackEntry.scenery(track, tex, quality, rng.fork(trackEntry.seed));
    obstacles = new Obstacles(track, quality.shadowMap > 0);
    scene.add(trackVis.group, scenery, obstacles.group);
  }
  const wantsCup = cupDef(params.copa ?? (params.track ? null : settings.cup))?.id ?? null;
  mountTrack(params.track ?? (wantsCup ? cupDef(wantsCup)!.tracks[0] : settings.trackId));

  const camera = new THREE.PerspectiveCamera(68, 1, 0.3, 1600);
  // Una cámara por jugador de la pantalla dividida (la del jugador 1 es también la del título y el podio).
  const cameras = [camera, ...[1, 2, 3].map(() => new THREE.PerspectiveCamera(68, 1, 0.3, 1600))];
  const chases = cameras.map((c) => new ChaseCam(c));
  const chase = chases[0];
  const sparks = new Particles(quality.particles, true);
  const dust = new Particles(Math.round(quality.particles * 0.6), false);
  scene.add(sparks.points, dust.points);

  const arena = new Arena(track, tex, sparks, dust, rng.fork('objetos'));
  scene.add(arena.group);
  const plushMats = new PlushMaterials(quality.name !== 'low');
  const podium = new Podium(new THREE.Vector3(), 0, tex, plushMats, dust);
  scene.add(podium.group);
  /** Podio de la pista (en el cuarto: en el centro del circuito, mirando hacia la recta de salida). */
  function placePodium(): void {
    const p = trackEntry.podium;
    podium.place(p.x * track.def.scale, 0, p.z * track.def.scale, p.yaw);
  }
  placePodium();

  const audio = new GameAudio(!params.noaudio);
  const input = new Input();
  input.onFirstInteraction = () => audio.unlock();
  input.onFullscreenKey = () => toggleFullscreen();
  const hud = new Hud();
  hud.setTrack(track);

  // Teléfonos como mando (se abre la sala de mandos al entrar en «2–4 jugadores» o en «📱 Mando»).
  // En «2–4 jugadores» cada teléfono maneja a su jugador. Fuera de ahí, solo maneja el que se eligió como mando del
  // jugador 1 (`input.soloRemote`, botón «🎮 Usar como mando» en el teléfono); los demás quedan conectados sin manejar.
  const pads = new PadHub();
  /** Panel «📱 Mando» abierto. */
  let phonePanel: ReturnType<typeof openPhonePanel> | null = null;
  pads.onControls = (dev, c, label) => input.setRemote(dev, c, label);
  pads.onKey = (dev, k) => {
    if (k === 'solo') return setSoloPhone(dev);
    if (k === 'unsolo') return input.soloRemote === dev ? setSoloPhone(null) : undefined;
    // Las teclas de menú cuentan si el teléfono maneja a alguien (o en la pantalla de unirse, para unirse).
    if (join || split?.devs.includes(dev) || input.soloRemote === dev) input.pushRemote(dev, k);
  };
  pads.onJoin = (dev) => {
    join?.refresh();
    phonePanel?.refresh();
    hud.toast(`📱 ${pads.label(dev)} conectado`, '#c8f7c5');
  };
  pads.onLeave = (_dev, label) => {
    join?.refresh();
    phonePanel?.refresh();
    hud.toast(`📱 ${label} se desconectó`, '#ffe9a8');
  };
  function setSoloPhone(dev: DeviceId | null): void {
    if (input.soloRemote === dev) return;
    input.soloRemote = dev;
    phonePanel?.refresh();
    hud.toast(dev ? `📱 ${pads.label(dev)} maneja al jugador 1` : '📱 El teléfono ya no maneja', dev ? '#c8f7c5' : '#ffe9a8');
  }
  input.onRemoteRumble = (dev, ms) => pads.buzz(dev, ms);

  /** Cambia de pista: libera la actual y monta la nueva (arena, podio y minimapa incluidos). `force`: recargar aunque sea la misma. */
  function loadTrack(id: string, force = false): boolean {
    if (!force && readyTrack(id).id === trackEntry.id) return false;
    for (const k of karts) disposeTree(k.model.root);
    karts = [];
    disposeTree(trackVis.group);
    disposeTree(scenery);
    disposeTree(obstacles.group);
    mountTrack(id);
    arena.setTrack(track);
    placePodium();
    hud.setTrack(track);
    for (const c of chases) c.reset();
    return true;
  }

  /** Cambia el preset en plena partida (sombras, partículas, resolución) y vuelve a montar la pista con él. */
  function applyQuality(name: QualityName): void {
    if (quality.name === name) return;
    Object.assign(quality, PRESETS[name]);
    setShadows(stage, quality.shadowMap);
    sparks.limit = quality.particles;
    dust.limit = Math.round(quality.particles * 0.6);
    dynRes.setBase(Math.min(devicePixelRatio, quality.maxPixelRatio));
    loadTrack(trackEntry.id, true);
  }

  const loop = new Loop(frame);
  if (params.fps !== null) loop.fpsLimit = params.fps;
  const dynRes = new DynamicResolution(renderer, Math.min(devicePixelRatio, quality.maxPixelRatio), 1000 / (loop.fpsLimit || 60));
  const gpu = new GpuTimer(renderer);
  /** 3 y 4 jugadores: si el equipo no da más, pasa a 30 fps estables (ver HeatGuard). */
  const heat = new HeatGuard();
  /** Cuadros seguidos en pausa (local): la escena está quieta, así que tras dibujarla una vez no se vuelve a dibujar. */
  let pausedFrames = 0;
  /** fps de la carrera: 60, o 30 si el protector de temperatura lo decidió. */
  const raceFps = (): number => params.fps ?? (heat.tripped ? 30 : 60);

  function resize(): void {
    pausedFrames = 0;
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
  let podiumT = 0;

  /** Título: el kart elegido va a un tramo vacío de la pista, lejos de la parrilla. */
  function placeShowroomKart(): void {
    karts[0]?.placeAt(track.N - 48, 0);
  }

  /** En el título, el peluche queda a un lado y el menú al otro (o arriba y abajo en vertical). */
  function frameShowroom(side = 0.22, top = 0.3): void {
    const w = app.clientWidth;
    const h = app.clientHeight;
    const wide = w / h > 1.2 && w >= 820;
    const tall = h / w > 1.2;
    const ox = wide ? w * side : 0;
    const oy = tall ? h * top : 0;
    if (!ox && !oy) {
      if (camera.view?.enabled) camera.clearViewOffset();
      return;
    }
    const v = camera.view;
    if (!v?.enabled || v.offsetX !== ox || v.offsetY !== oy || v.fullWidth !== w || v.fullHeight !== h) camera.setViewOffset(w, h, ox, oy, w, h);
  }
  let mode: Mode = 'title';
  let titleT = 0;
  const charFromParam = CHARACTERS.findIndex((c) => c.id === params.char || c.defaultName.toLowerCase() === params.char?.toLowerCase());
  if (charFromParam >= 0) settings.charIndex = charFromParam;
  if (params.cpu === 'facil' || params.cpu === 'normal' || params.cpu === 'dificil') settings.cpu = params.cpu;
  if (params.laps) settings.laps = params.laps;
  if (params.profile === 'normal' || params.profile === 'peque') applyProfile(settings, params.profile);
  const setup: TitleSetup = {
    charIndex: settings.charIndex,
    trackId: wantsCup ? settings.trackId : trackEntry.id,
    cup: wantsCup,
    cpu: CPU_LEVELS.find((l) => l.id === settings.cpu) ?? CPU_LEVELS[0],
    laps: settings.laps,
  };
  let race: Race;
  let karts: Kart[] = [];
  /** Copa local en curso (en línea la lleva la sesión). */
  let cup: Cup | null = null;
  /** Pantalla dividida en curso: el dispositivo de cada jugador (2: arriba y abajo; 3 o 4: J1 J2 arriba, J3 J4 abajo). */
  let split: { devs: DeviceId[] } | null = null;
  /** Pantalla "Pulsa un botón para unirte" abierta. */
  let join: ReturnType<typeof openSplitJoin> | null = null;
  const activeCup = (): Cup | null => (session.active ? session.cup : cup);
  /** Pista que se ve en el menú: la elegida, o la primera de la copa. */
  const titleTrack = (): string => cupDef(setup.cup)?.tracks[0] ?? setup.trackId;
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
    audio.setMusicOn(settings.music);
    audio.muted = !settings.sfx;
    touch.configure(settings);
    if (race) {
      // Jugador 1 con los ajustes generales; jugadores 2 a 4 (pantalla dividida) con los suyos.
      const prefs = playerPrefs();
      race.pilots = karts
        .filter((k) => k.localNo >= 0)
        .sort((a, b) => a.localNo - b.localNo)
        .map((k) => {
          const pr = prefs[k.localNo];
          k.hitScale = pr.profile === 'peque' ? 0.85 : 1;
          k.driftChargeMult = pr.smartSteer ? 0.8 : 1;
          return { kart: k, assist: { autoAccel: pr.autoAccel, smartSteer: pr.smartSteer }, autoPower: pr.autoPower };
        });
    }
  }

  function storeSetup(): void {
    settings.charIndex = setup.charIndex;
    settings.cpu = setup.cpu.id;
    settings.laps = setup.laps;
    settings.trackId = setup.trackId;
    settings.cup = setup.cup;
    saveSettings(settings);
  }

  /** `net`: orden de carrera recibido en una partida en línea (el propio kart va primero en la lista local). */
  function buildRace(net?: RosterEntry[]): void {
    for (const k of karts) disposeTree(k.model.root);
    const aiRng = rng.fork(`ia-${Date.now()}`);
    const makeKart = (i: number, c: (typeof CHARACTERS)[number], isPlayer: boolean): Kart => {
      const model = new KartModel(c, quality.shadowMap > 0 ? null : tex.blob, quality.shadowMap > 0, plushMats);
      model.setHeadlights(!!trackEntry.look.night);
      scene.add(model.root);
      return new Kart(i, c, isPlayer, model, track);
    };
    if (net) {
      const mine = net.find((e) => e.owner === session.ownerId)!;
      const ordered = [mine, ...net.filter((e) => e !== mine)];
      karts = ordered.map((e, i) => {
        const c = CHARACTERS.find((x) => x.id === e.char)!;
        const k = makeKart(i, c, e === mine);
        k.localNo = e === mine ? 0 : -1;
        k.slot = e.slot;
        k.name = e.name || displayName(c);
        // El anfitrión simula su kart y la IA; cada invitado solo el suyo.
        k.remote = e !== mine && !(session.isHost && e.owner === 'ai');
        return k;
      });
    } else {
      // Los jugadores de este dispositivo van primero (en pantalla dividida, del 1 al 4).
      const mine = split ? playerPrefs().slice(0, split.devs.length).map((p, i) => (i ? p.charIndex : setup.charIndex)) : [setup.charIndex];
      const roster = [...mine.map((i) => CHARACTERS[i]), ...CHARACTERS.filter((_, i) => !mine.includes(i))];
      karts = roster.map((c, i) => {
        const k = makeKart(i, c, i < mine.length);
        k.localNo = i < mine.length ? i : -1;
        k.slot = i;
        k.name = displayName(c);
        return k;
      });
    }
    // En la copa, el último de la clasificación sale primero.
    const grid = !net && cup ? cup.gridOrder() : null;
    if (grid) for (const k of karts) k.slot = Math.max(0, grid.indexOf(k.char.id));
    const ais = karts.map((k, i) => new AIDriver(aiRng.fork(`p${i}`), k.isPlayer ? 0.8 : setup.cpu.driftSkill));
    race = new Race(karts, ais, setup.laps, setup.cpu, net ? false : params.autoplay, aiRng.fork('carrera'), arena, !!net || !!grid);
    race.hazards = obstacles.hazards;
    if (net) session.attach(race, karts);
    else arena.net = null;
    applySettings();
    for (const c of chases) c.reset();
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
      players: split?.devs.length ?? 1,
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
    cup = null;
    join?.close();
    join = null;
    leaveSplit();
    loop.fpsLimit = params.fps ?? 30;
    loadTrack(titleTrack());
    buildRace();
    placeShowroomKart();
    hud.setRaceVisible(false);
    touch.show(false);
    hud.showTitle(
      setup,
      changeSetup,
      () => (setup.cup ? startCup() : startRace()),
      () => showSettings(showTitle),
      titleStatus(),
      fullscreenSupported() ? toggleFullscreen : null,
      () => openOnline(),
      touchOn ? null : openSplit,
      touchOn ? null : openPhones,
    );
    hud.screenClass('title');
    podium.hide();
    audio.playMusic('menu');
  }

  /** Cambia peluche, pista, rivales o vueltas desde un menú: lo guarda y pone de fondo la pista y el kart elegidos. */
  function changeSetup(s: TitleSetup): void {
    const charChanged = s.charIndex !== setup.charIndex;
    const before = titleTrack();
    Object.assign(setup, s);
    storeSetup();
    const trackChanged = loadTrack(titleTrack()) || before !== titleTrack();
    if (charChanged || trackChanged) {
      buildRace();
      placeShowroomKart();
    }
    audio.click();
  }

  /** Copa local: sus tres pistas seguidas. */
  function startCup(): void {
    cup = new Cup(CHARACTERS.map((c) => ({ char: c.id, name: displayName(c) })), setup.cup ?? undefined);
    loadTrack(cup.trackId);
    startRace();
  }

  /** Tras una carrera de copa: suma los puntos (en el orden en que van) y muestra la clasificación. */
  function cupOrder(): { char: Species; name: string }[] {
    return race.order.map((k) => ({ char: k.char.id, name: k.name }));
  }

  function showCupStandings(c: Cup): void {
    const me = localKarts().map((k) => k.char.id);
    if (c.done) {
      const top = c.standings().slice(0, 3).map((r) => CHARACTERS.find((x) => x.id === r.char)!);
      podium.show(top, true);
      podiumT = 0;
      const mine = c.standings().find((r) => me.includes(r.char));
      if (mine && me.length > 1) voice.say(mine.rank === 1 ? `¡${mine.name} ganó la copa!` : `¡${mine.name} quedó en el lugar ${mine.rank} de la copa!`);
      else if (mine) voice.say(mine.rank === 1 ? '¡Ganaste la copa!' : `¡Quedaste en el lugar ${mine.rank} de la copa!`);
    }
    if (session.active && session.isHost)
      hud.showCup(c, me, {
        onNext: c.done ? backToRoom : () => session.start(),
        nextLabel: c.done ? 'Volver a la sala' : '¡Siguiente carrera!',
        onMenu: leaveOnline,
        menuLabel: 'Cerrar sala',
      });
    else if (session.active)
      hud.showCup(c, me, { onNext: null, nextLabel: '', onMenu: leaveOnline, menuLabel: 'Salir', wait: 'Esperando al anfitrión…' });
    else
      hud.showCup(c, me, {
        onNext: c.done ? startCup : nextCupRace,
        nextLabel: c.done ? 'Otra copa' : '¡Siguiente carrera!',
        onMenu: showTitle,
        menuLabel: 'Menú',
      });
    hud.screenClass('side');
  }

  function nextCupRace(): void {
    if (!cup || cup.done) return;
    loadTrack(cup.trackId);
    startRace();
  }

  /** Anfitrión: todos de vuelta a la sala de espera. */
  function backToRoom(): void {
    hud.closeScreen();
    toTitleQuiet();
    session.backToLobby();
  }

  /** Invitado: puntos que llegaron mientras su carrera aún no mostraba resultados. */
  let pendingCup: Cup | null = null;
  /** La carrera de copa en curso ya sumó sus puntos (evita sumarla dos veces). */
  let scoredThisRace = false;

  function scoreLocalCup(): void {
    if (!cup || scoredThisRace || race.phase !== 'done') return;
    scoredThisRace = true;
    cup.addRace(cupOrder());
    showCupStandings(cup);
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
    beginRace();
  }

  /** Parte común de empezar: pantallas, fps, botones táctiles y cuenta atrás. */
  function beginRace(): void {
    hud.closeScreen();
    closeLobbyScreen();
    podium.hide();
    camera.clearViewOffset();
    audio.playMusic('race');
    mode = 'race';
    loop.fpsLimit = raceFps();
    dynRes.targetMs = 1000 / (loop.fpsLimit || 60);
    hud.setRaceVisible(true);
    touch.show(touchOn && !split);
    resultsShownAt = -1;
    race.start();
    scoredThisRace = false;
    const c = activeCup();
    if (c) {
      hud.flash(`Copa · carrera ${c.raced + 1} de ${c.total}`, true, '#ffd23a');
      voice.say(`Carrera ${c.raced + 1} de la copa`);
    }
    // La posición en que sostiene el teléfono al empezar cuenta como "recto".
    setTimeout(() => gyro.calibrate(), 600);
  }

  function pause(): void {
    if (mode !== 'race') return;
    mode = 'paused';
    touch.show(false);
    audio.music?.duck(true);
    // En pausa (sin red) la escena está quieta: menos cuadros y, tras el primero, sin volver a dibujar.
    if (!session.active) loop.fpsLimit = params.fps ?? 30;
    const resume = (): void => {
      hud.closeScreen();
      audio.music?.duck(false);
      mode = 'race';
      loop.fpsLimit = raceFps();
      touch.show(touchOn && !split);
    };
    if (session.active) hud.showPause(resume, null, leaveOnline, () => showSettings(pause2), fullscreenSupported() ? toggleFullscreen : null, 'Salir de la sala');
    else hud.showPause(resume, startRace, showTitle, () => showSettings(pause2), fullscreenSupported() ? toggleFullscreen : null);
    function pause2(): void {
      mode = 'race';
      pause();
    }
  }

  // ---------------- Pantalla dividida (2 a 4 jugadores) ----------------

  /** Ajustes de cada jugador: el 1 usa los generales; del 2 al 4, los suyos. */
  function playerPrefs(): PlayerPrefs[] {
    return [settings, ...settings.others];
  }

  /** Karts de este dispositivo, en orden (jugador 1, 2, 3, 4). */
  function localKarts(): Kart[] {
    return karts.filter((k) => k.localNo >= 0).sort((a, b) => a.localNo - b.localNo);
  }
  /** Número de jugador local que maneja el kart `i` (−1 si nadie de este dispositivo). */
  const localOf = (i: number): number => karts[i]?.localNo ?? -1;
  /** Vibración en el mando de ese jugador. */
  function rumbleFor(L: number, strong: number, weak: number, ms: number): void {
    input.rumble(strong, weak, ms, split ? split.devs[L] : undefined);
  }

  function openSplit(): void {
    hud.closeScreen();
    join = openSplitJoin({
      saved: playerPrefs().map((p, i) => ({ charIndex: i ? p.charIndex : setup.charIndex, profile: p.profile })),
      setup: () => ({ ...setup }),
      onSetup: changeSetup,
      deviceName: (d) => input.deviceName(d),
      phoneUrl: pads.start().then(() => ({ url: pads.url(), code: pads.code })),
      onStart: (players) => {
        join = null;
        startSplit(players);
      },
      onBack: () => {
        join = null;
        showTitle();
      },
    });
  }

  /** Ayudas de un perfil para el jugador 1 (los ajustes generales) sin tocar la voz ni los rivales. */
  function setP1Profile(p: Profile): void {
    if (settings.profile === p) return;
    settings.profile = p;
    Object.assign(settings, profileAssist(p));
  }

  function startSplit(players: SplitPlayer[]): void {
    const n = Math.min(players.length, cameras.length);
    if (n < 2) return;
    players = players.slice(0, n);
    split = { devs: players.map((p) => p.dev) };
    setup.charIndex = players[0].charIndex;
    setP1Profile(players[0].profile);
    players.slice(1).forEach((p, i) => {
      settings.others[i] = { ...settings.others[i], profile: p.profile, ...profileAssist(p.profile), charIndex: p.charIndex };
    });
    storeSetup();
    hud.setPlayers(n);
    // Con 2, cada vista es el doble de ancha que alta: campo de visión más cerrado. En la cuadrícula 2 × 2 cada
    // vista tiene la forma de la pantalla, pero es pequeña: un poco más cerrado que a pantalla completa.
    for (const c of chases) c.baseFov = n === 2 ? 52 : 62;
    // Rendimiento (que el equipo no se caliente): cada vista dibuja la escena entera otra vez.
    // - 2 jugadores: la calidad baja un nivel (sombras y partículas).
    // - 3 y 4: calidad Baja (sin mapa de sombras, que se tendría que dibujar una vez por vista; menos partículas y
    //   decorado), resolución hasta 1,25× y, si aun así no llega, 30 fps estables.
    applyQuality(n === 2 ? LOWER[baseQuality] : 'low');
    dynRes.setBase(Math.min(devicePixelRatio, quality.maxPixelRatio, n >= 3 ? 1.25 : Infinity));
    heat.reset(n >= 3 && params.fps === null);
    if (setup.cup) startCup();
    else startRace();
  }

  function leaveSplit(): void {
    if (!split) return;
    split = null;
    hud.setPlayers(1);
    for (const c of chases) c.baseFov = 68;
    applyQuality(baseQuality);
    dynRes.setBase(Math.min(devicePixelRatio, quality.maxPixelRatio));
    heat.reset(false);
  }

  /**
   * Rectángulos de cada vista en píxeles CSS, con y desde abajo (como `setViewport`).
   * 2 jugadores: arriba y abajo. 3 y 4: cuadrícula 2 × 2 (con 3, el cuarto cuadrante queda para el minimapa).
   */
  function splitRects(n: number, W: number, H: number): [x: number, y: number, w: number, h: number][] {
    const hh = Math.floor(H / 2);
    if (n === 2) return [[0, H - hh, W, hh], [0, 0, W, H - hh]];
    const hw = Math.floor(W / 2);
    const all: [number, number, number, number][] = [[0, H - hh, hw, hh], [hw, H - hh, W - hw, hh], [0, 0, hw, H - hh], [hw, 0, W - hw, H - hh]];
    return all.slice(0, n);
  }

  // ---------------- En línea ----------------

  const session: Session = new Session(
    {
      onLobby: () => {
        if (mode === 'title' && !closeSettings) renderLobby();
      },
      onStart: (roster, laps, cpu, trackId) => {
        pendingCup = null;
        loadTrack(trackId);
        setup.laps = laps;
        setup.cpu = CPU_LEVELS.find((l) => l.id === cpu) ?? CPU_LEVELS[0];
        audio.unlock();
        buildRace(roster);
        beginRace();
      },
      onCup: (c) => {
        if (mode === 'results') showCupStandings(c);
        else pendingCup = c;
      },
      onMenu: () => {
        // El anfitrión volvió a la sala: todos a la sala de espera.
        hud.closeScreen();
        toTitleQuiet();
        renderLobby();
      },
      onError: (text) => {
        hud.closeScreen();
        toTitleQuiet();
        openOnline(text);
      },
      onNotice: (text) => hud.toast(text, '#ffe9a8'),
    },
    arena,
  );

  /** Vuelve al estado de título sin dibujar su menú (lo tapa la sala). */
  function toTitleQuiet(): void {
    mode = 'title';
    podium.hide();
    audio.playMusic('menu');
    loop.fpsLimit = params.fps ?? 30;
    hud.setRaceVisible(false);
    touch.show(false);
    if (split) {
      leaveSplit();
      buildRace();
    } else if (!race || race.phase !== 'grid') buildRace();
    placeShowroomKart();
  }

  function myChar(): (typeof CHARACTERS)[number] {
    return CHARACTERS[setup.charIndex];
  }

  function openOnline(error?: string, code?: string): void {
    hud.closeScreen();
    showOnlineMenu({
      error,
      code,
      onCreate: () => {
        showOnlineMenu({ busy: 'Creando la sala…', onCreate: () => {}, onJoin: () => {}, onBack: () => openOnline() });
        session.create(myChar().id, displayName(myChar()), setup.laps, setup.cpu.id, setup.cup ?? trackEntry.id).catch((e: Error) => openOnline(e.message));
      },
      onJoin: (raw) => {
        const c = normalizeCode(raw);
        if (c.length !== 4) return openOnline('El código tiene 4 letras.', c);
        showOnlineMenu({ code: c, busy: 'Buscando la sala…', onCreate: () => {}, onJoin: () => {}, onBack: () => openOnline() });
        session.join(c, myChar().id, displayName(myChar())).catch((e: Error) => openOnline(e.message, c));
      },
      onBack: () => {
        closeLobbyScreen();
        showTitle();
      },
    });
  }

  function renderLobby(): void {
    hud.closeScreen();
    showLobby(session, {
      pick: (c) => {
        const ch = CHARACTERS.find((x) => x.id === c)!;
        setup.charIndex = CHARACTERS.indexOf(ch);
        storeSetup();
        session.pick(c, displayName(ch));
        buildRace();
        placeShowroomKart();
      },
      options: (laps, cpu, trackId) => {
        session.setOptions(laps, cpu, trackId);
        setup.cup = isCupId(trackId) ? trackId : null;
        if (!setup.cup) setup.trackId = trackId;
        storeSetup();
        if (loadTrack(titleTrack())) {
          buildRace();
          placeShowroomKart();
        }
      },
      start: () => session.start(),
      leave: leaveOnline,
    });
  }

  function leaveOnline(): void {
    session.leave();
    closeLobbyScreen();
    hud.closeScreen();
    showTitle();
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
    const L = localOf(kart);
    if (L < 0 || !race) return;
    if (lap === race.laps) {
      hud.flash('¡Última vuelta!', true, '#ffd23a', L);
      audio.lap(true);
      voice.say('¡Última vuelta!');
      if (audio.music) audio.music.tempoMul = 1.12;
    } else if (lap > 1 && lap <= race.laps) {
      hud.flash(`Vuelta ${lap}`, true, '#ffffff', L);
      audio.lap(false);
    }
  });
  bus.on('kart:finish', ({ kart, place }) => {
    const L = localOf(kart);
    if (L < 0) return;
    const k = karts[kart];
    hud.flash(place === 1 ? '¡Ganaste!' : '¡Meta!', false, '#ffd23a', L);
    audio.finish(place);
    if (split) voice.say(place === 1 ? `¡Ganó ${k.name}!` : `¡${k.name} llegó en el lugar ${place}!`);
    else voice.say(place === 1 ? '¡Ganaste!' : `¡Llegaste en el lugar ${place}!`);
    // La música se apaga cuando han llegado todos los jugadores de este dispositivo.
    if (localKarts().every((x) => x.finished)) audio.playMusic('none');
    rumbleFor(L, 0.6, 0.6, 400);
  });
  bus.on('kart:boost', ({ kart }) => {
    const L = localOf(kart);
    if (L < 0) return;
    audio.boost();
    chases[L].shake(0.15);
    rumbleFor(L, 0.2, 0.6, 250);
  });
  bus.on('kart:drift', ({ kart, level }) => {
    if (localOf(kart) >= 0) audio.driftLevel(level);
  });
  bus.on('kart:bump', ({ kart, strength }) => {
    const L = localOf(kart);
    if (L < 0) return;
    audio.bump(strength);
    chases[L].shake(Math.min(0.5, strength * 0.04));
    rumbleFor(L, Math.min(1, strength * 0.08), 0.3, 150);
  });
  bus.on('kart:fall', ({ kart, x, z }) => {
    // Chapuzón en el arroyo: salpicadura donde cayó (el kart ya está en la otra orilla).
    const fallFx = trackEntry.look.fall ?? { word: '¡Al agua! ¡Más rápido la próxima!', color: 0xbfe6ff };
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 2;
      dust.spawn(x + Math.cos(a) * r, 0.3, z + Math.sin(a) * r, Math.cos(a) * 3, 5 + Math.random() * 5, Math.sin(a) * 3, 1, 0.8, 0.3, fallFx.color, 0.9, 1.5, 1.4);
    }
    const v = volKart(kart);
    audio.pop(v);
    audio.land();
    const L = localOf(kart);
    if (L >= 0) {
      hud.toast(fallFx.word, '#bfe6ff', L);
      rumbleFor(L, 0.6, 0.4, 300);
      chases[L].reset();
    }
  });
  bus.on('kart:slip', ({ kart }) => {
    const k = karts[kart];
    if (!k) return;
    const slickFx = trackEntry.look.slick ?? { word: '¡Jabón!', particle: 0xe8f8ff };
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      dust.spawn(k.pos.x + Math.cos(a) * 1.4, k.pos.y + 0.4, k.pos.z + Math.sin(a) * 1.4, Math.cos(a) * 2, 2.5 + Math.random() * 2, Math.sin(a) * 2, 0.9, 0.7, 0.2, slickFx.particle, 0.8, 0.5, 1.2);
    }
    const L = localOf(kart);
    if (L >= 0) {
      audio.bubble(0.7);
      hud.toast(slickFx.word, '#bfe9ff', L);
      rumbleFor(L, 0.3, 0.2, 200);
    }
  });
  bus.on('kart:hop', ({ kart }) => {
    if (localOf(kart) >= 0) audio.hop();
  });
  bus.on('kart:land', ({ kart, strength }) => {
    const k = karts[kart];
    if (!k) return;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      dust.spawn(k.pos.x + Math.cos(a) * 1.2, k.pos.y + 0.2, k.pos.z + Math.sin(a) * 1.2, Math.cos(a) * 3, 1.5, Math.sin(a) * 3, 0.5, 0.6, 1.5, 0xf2e8d0, 0.5, 2, 2);
    }
    const L = localOf(kart);
    if (L >= 0 && strength > 6) {
      audio.land();
      chases[L].shake(0.25);
    }
  });

  // Objetos y poderes: el sonido baja con la distancia al jugador (con dos, al más cercano).
  function volFrom(k: Kart, x: number, z: number): number {
    return Math.max(0, 1 - Math.hypot(k.pos.x - x, k.pos.z - z) / 90);
  }
  function volAt(x: number, z: number): number {
    let v = 0;
    for (const k of localKarts()) v = Math.max(v, volFrom(k, x, z));
    return v;
  }
  const volKart = (i: number): number => (localOf(i) >= 0 ? 1 : karts[i] ? volAt(karts[i].pos.x, karts[i].pos.z) : 0);
  const POWER_SAY: Record<string, string> = {
    perro: '¡Guau guau!', esponja: '¡Burbuja!', raton: '¡Rayo!', zorro: '¡Fuego de zorro!', dino: '¡Pisotón!', robot: '¡Brazos telescópicos!', nieve: '¡Aliento helado!',
  };

  bus.on('box:open', ({ kart }) => {
    if (localOf(kart) >= 0) audio.box();
  });
  let rouletteTick = 0;
  bus.on('item:get', ({ kart }) => {
    if (localOf(kart) >= 0) audio.itemGet();
  });
  bus.on('item:use', ({ kart, item }) => {
    const v = volKart(kart);
    if (item === 'pelota') audio.throwBall(v);
    else if (item === 'chicle') audio.gum(v);
  });
  bus.on('power:ready', ({ kart }) => {
    if (localOf(kart) >= 0) audio.powerReady();
  });
  bus.on('power:use', ({ kart, power }) => {
    const v = volKart(kart);
    const L = localOf(kart);
    if (L >= 0) hud.flash(POWER_SAY[power], true, '#ffd23a', L);
    else if (v > 0.3) hud.toast(`${karts[kart].name}: ${karts[kart].char.power}`, '#ffe9a8');
    if (power === 'perro') {
      audio.bark(v);
      for (const k of localKarts()) if (k.index === kart || volFrom(k, karts[kart].pos.x, karts[kart].pos.z) > 0.6) chases[k.localNo].shake(0.2);
    } else if (power === 'esponja') audio.bubble(v);
    else if (power === 'zorro') audio.fire(v);
    else if (power === 'dino') audio.jump(v);
    else if (power === 'robot') audio.stretch(v);
    else if (power === 'nieve') audio.frost(v);
  });
  bus.on('fx:grab', ({ kart, caught }) => {
    const v = volKart(kart);
    audio.boing(v, caught);
    const L = localOf(kart);
    if (L >= 0 && caught) chases[L].shake(0.25);
  });
  bus.on('fx:lightning', () => {
    audio.thunder();
    hud.screenFlash(0.8);
  });
  bus.on('fx:quake', ({ x, z }) => {
    audio.quake(volAt(x, z));
    for (const k of localKarts()) {
      const v = volFrom(k, x, z);
      chases[k.localNo].shake(0.7 * v);
      rumbleFor(k.localNo, 0.8 * v, 0.4 * v, 450);
    }
  });
  bus.on('fx:explode', ({ x, z, big }) => {
    audio.explosion(volAt(x, z), big);
    for (const k of localKarts()) if (volFrom(k, x, z) > 0.6) chases[k.localNo].shake(big ? 0.45 : 0.2);
  });
  bus.on('kart:hit', ({ kart, kind, by }) => {
    const v = volKart(kart);
    if (kind === 'stuck') audio.stuck(v);
    else if (kind === 'bubble') audio.pop(v);
    else if (kind === 'freeze') audio.freeze(v);
    else if (kind !== 'shrink') audio.hit(v);
    const L = localOf(kart);
    if (L >= 0) {
      rumbleFor(L, 0.9, 0.5, 350);
      chases[L].shake(0.35);
      const who = by >= 0 && by !== kart ? karts[by] : null;
      const what = { spin: '¡Uy!', stuck: '¡Chicle!', bubble: '¡Atrapado!', shrink: '¡Pequeñito!', tumble: '¡Bum!', freeze: '¡Congelado!' }[kind];
      hud.toast(who ? `${what} ${who.name} te dio` : what, '#ffb0b0', L);
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
        const col = dustColor(trackEntry.look, k.surface);
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

  // ---------------- Teléfonos como mando ----------------

  /** Panel «📱 Mando» del título: QR para usar un teléfono en partidas de 1 jugador. */
  function openPhones(): void {
    hud.closeScreen();
    phonePanel = openPhonePanel({
      phoneUrl: pads.start().then(() => ({ url: pads.url(), code: pads.code })),
      phones: () => pads.devices.map((d) => ({ label: pads.label(d), solo: input.soloRemote === d })),
      onRelease: () => setSoloPhone(null),
      onClose: () => {
        phonePanel = null;
        showTitle();
      },
    });
  }

  let padHudT = 0;
  /** Dice a cada teléfono qué mostrar (unirse, manejar, menú) y le manda su HUD mínimo unas 7 veces por segundo. */
  function syncPads(dt: number): void {
    padHudT += dt;
    const sendHud = padHudT >= 0.15;
    if (sendHud) padHudT = 0;
    for (const dev of pads.devices) {
      if (join) {
        const i = join.info(dev);
        pads.setState(dev, i ? { mode: 'join', who: i.who, name: i.name, color: LOCAL_COLORS[i.who], ready: i.ready } : { mode: 'join', who: -1 });
        continue;
      }
      // En pantalla dividida maneja su jugador; con un solo jugador, solo el teléfono elegido maneja al jugador 1.
      const L = split ? split.devs.indexOf(dev) : input.soloRemote === dev ? 0 : -1;
      const pick = split ? {} : L === 0 ? { solo: true } : { canSolo: true };
      const k = L >= 0 ? localKarts()[L] : undefined;
      const who = k ? { who: L, name: k.name, color: LOCAL_COLORS[L] } : { who: -1 };
      if (mode === 'race' && k) {
        const pr = playerPrefs()[L] ?? settings;
        pads.setState(dev, { mode: 'race', ...who, ...pick, auto: pr.autoAccel, peque: pr.profile === 'peque' });
        if (sendHud)
          pads.setHud(dev, {
            pos: k.finished && k.place ? k.place : k.position,
            lap: Math.min(k.lap, setup.laps),
            laps: setup.laps,
            item: k.rouletteT > 0 ? '' : k.item ?? '',
            roul: k.rouletteT > 0,
            pow: Math.round(k.power * 20) / 20,
            fin: k.finished,
          });
      } else if (mode === 'race') pads.setState(dev, { mode: 'wait', ...who, ...pick });
      else
        pads.setState(dev, {
          mode: 'menu',
          ...who,
          ...pick,
          note: L < 0 ? undefined : mode === 'paused' ? 'Pausa: elige con las flechas' : mode === 'results' ? 'Resultados: elige con las flechas' : undefined,
        });
    }
  }

  // ---------------- Bucle ----------------

  function frame(dt: number): void {
    dynRes.sample(loop.lastIntervalMs, dt);
    input.poll();
    if (pads.open) {
      pads.tick();
      syncPads(dt);
    }
    // Un control por jugador de este dispositivo: en pantalla dividida, cada uno con su teclado o mando.
    const ctls: Controls[] = split ? split.devs.map((d) => input.readDevice(d)) : [input.read()];
    const ctl = ctls[0];
    if (mode === 'race' && !split) touch.merge(ctl, dt, karts[0].power >= 1);
    if (input.consumePause()) {
      if (mode === 'race') pause();
      else if (mode === 'paused' && !closeSettings) {
        hud.closeScreen();
        audio.music?.duck(false);
        mode = 'race';
        loop.fpsLimit = raceFps();
        touch.show(touchOn && !split);
      }
    }
    if (join) join.input(input.consumeMenuEvents());
    else {
      const menuKeys = input.consumeMenu();
      if (phonePanel) {
        if (menuKeys.includes('back') || menuKeys.includes('ok')) phonePanel.close();
      } else if (closeSettings) {
        if (menuKeys.includes('back')) closeSettings();
      } else if (hud.menuOpen) hud.menuInput(menuKeys);
    }

    if (mode === 'title') {
      titleT += dt;
      // El peluche elegido gira despacio sobre sí mismo y saluda.
      const me = karts[0];
      me.heading += dt * 0.55;
      me.showoff = true;
      race.update(dt, ctls, camera);
      obstacles.update(titleT, []);
    } else if (mode === 'race' || mode === 'results' || (mode === 'paused' && session.active)) {
      // En línea la carrera no se detiene en la pausa (los demás siguen corriendo).
      const c = mode === 'paused' ? ctls.map(() => NO_CTL) : ctls;
      for (let s = 0; s < params.speed; s++) {
        race.update(dt, c, camera);
        obstacles.update(race.time, karts);
      }
      if (session.active) session.tick(dt);
      for (const k of karts) kartFx(k, dt);
      if (race.phase === 'done') {
        if (resultsShownAt < 0 && race.time - race.doneAt > 2.5 && mode !== 'paused' && (!session.active || karts[0].place > 0)) {
          resultsShownAt = race.time;
          mode = 'results';
          // Podio y tabla: no hace falta ir a 60 fps (menos calor mientras se mira la clasificación).
          loop.fpsLimit = params.fps ?? 30;
          touch.show(false);
          podium.show(race.order.slice(0, 3).map((k) => k.char));
          hud.setRaceVisible(false);
          podiumT = 0;
          audio.playMusic('menu');
          const c = activeCup();
          if (session.active && session.isHost && c)
            hud.showResults(race, () => {
              const scored = session.scoreCup(cupOrder());
              if (scored) showCupStandings(scored);
            }, leaveOnline, 'Ver la copa ▶', 'Cerrar sala');
          else if (session.active && session.isHost) hud.showResults(race, backToRoom, leaveOnline, 'Volver a la sala', 'Cerrar sala');
          else if (session.active && pendingCup) showCupStandings(pendingCup);
          else if (session.active) hud.showResults(race, () => {}, leaveOnline, 'Esperando al anfitrión…', 'Salir');
          else if (cup) hud.showResults(race, scoreLocalCup, showTitle, 'Ver la copa ▶', 'Salir de la copa');
          else hud.showResults(race, startRace, showTitle);
          hud.screenClass('side');
        } else if (resultsShownAt >= 0) hud.refreshResults(race);
      }
    }

    // Cámara.
    const p = karts[0];
    if (params.cam === 'free') {
      /* cámara libre: se mueve desde DevTools (__game.camera) */
    } else if (params.cam === 'top') topCam(camera, track);
    else if (mode === 'title') {
      showroomCam(camera, p, titleT);
      frameShowroom();
    } else if (mode === 'results' && podium.visible) {
      podiumT += dt;
      podiumCam(camera, podium.pos, podium.facing, podiumT);
      frameShowroom(0.19, 0.24);
    }
    else if (mode !== 'paused') {
      if (split) localKarts().forEach((k, L) => chases[L]?.update(dt, k, mode === 'race' && !!ctls[L]?.look));
      else chase.update(dt, p, mode === 'race' && ctl.look);
    }
    if (mode !== 'title' && !(mode === 'results' && podium.visible) && camera.view?.enabled) camera.clearViewOffset();
    // Pantalla dividida: una vista por jugador mientras se corre; el podio, a pantalla completa.
    const locals = split ? localKarts() : [];
    const splitView = !!split && locals.length === split.devs.length && params.cam !== 'top' && params.cam !== 'free' && (mode === 'race' || mode === 'paused' || (mode === 'results' && !podium.visible));
    const W = app.clientWidth;
    const H = app.clientHeight;
    const rects = splitView ? splitRects(locals.length, W, H) : [];
    if (splitView) rects.forEach(([, , w, h], i) => setAspect(cameras[i], w / h));
    else setAspect(camera, W / H);
    if (podium.visible) followSun(stage, podium.pos.x, podium.pos.y, podium.pos.z);
    else followSun(stage, p.pos.x, p.pos.y, p.pos.z);
    podium.update(dt);

    if (mode !== 'paused') {
      trackVis.update(dt);
      const vh = renderer.domElement.height * (splitView ? 0.5 : 1);
      sparks.update(dt, camera, vh);
      dust.update(dt, camera, vh);
    }
    if (mode === 'race' || mode === 'results') {
      hud.update(race);
      if (localKarts().some((k) => k.rouletteT > 0) && (rouletteTick += dt) > 0.08) {
        rouletteTick = 0;
        audio.roulette();
      }
    }
    const racing = mode === 'race' || mode === 'results';
    // Motor: el del jugador que va más rápido (con uno, el suyo).
    const e = split ? localKarts().reduce((a, b) => (Math.abs(b.speed) > Math.abs(a.speed) ? b : a), p) : p;
    audio.setEngine(Math.min(1.3, Math.abs(e.speed) / TUNING.maxSpeed), racing ? 1 : 0, e.boostT > 0, e.driftLevel, e.drift !== 0 && e.grounded, racing && !localKarts().every((k) => k.finished));

    // Protector de temperatura (3 y 4 jugadores): si no llega a 60 fps ni con la resolución al mínimo, 30 fps estables.
    if (mode === 'race' && heat.sample(dt, loop.frameMs, dynRes.targetMs, dynRes.atFloor)) {
      loop.fpsLimit = raceFps();
      dynRes.targetMs = 1000 / loop.fpsLimit;
      hud.toast('🌡️ Modo fresco: 30 fps para que el equipo no se caliente', '#bfe6ff');
    }

    // En pausa (sin red) la imagen no cambia: se dibuja un par de veces y después el lienzo conserva la última.
    pausedFrames = mode === 'paused' && !session.active ? pausedFrames + 1 : 0;
    if (pausedFrames > 2) return;

    gpu.begin();
    if (splitView) {
      renderer.setScissorTest(true);
      // Sin mapa de sombras no hace falta mover el sol en cada vista (con sombras, sigue a cada kart en la suya).
      const shadows = quality.shadowMap > 0;
      rects.forEach(([x, y, w, h], i) => {
        const k = locals[i];
        if (shadows) followSun(stage, k.pos.x, k.pos.y, k.pos.z);
        renderer.setViewport(x, y, w, h);
        renderer.setScissor(x, y, w, h);
        renderer.render(scene, cameras[i]);
      });
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, W, H);
    } else renderer.render(scene, camera);
    gpu.end();
    benchFrame(loop.lastIntervalMs);
  }

  function setAspect(cam: THREE.PerspectiveCamera, a: number): void {
    if (Math.abs(cam.aspect - a) < 1e-4) return;
    cam.aspect = a;
    cam.updateProjectionMatrix();
  }

  // ---------------- Arranque ----------------

  showTitle();
  if (params.split && !touchOn) {
    // Pruebas: `?split&autostart` empieza con teclado (jugador 1) y el mando 0 (jugador 2); `?split=4&autostart`, con
    // teclado y los mandos 0, 1 y 2. `?split` abre la pantalla de unirse.
    if (params.autostart) {
      // `?split=N&autostart`: teclado (jugador 1) y los mandos 0, 1, 2 (jugadores 2 a 4), cada uno con otro peluche.
      const used = new Set([setup.charIndex]);
      const players: SplitPlayer[] = [{ dev: 'kbd', charIndex: setup.charIndex, profile: settings.profile }];
      for (let i = 1; i < params.splitPlayers; i++) {
        const pr = settings.others[i - 1];
        let c = pr.charIndex;
        while (used.has(c)) c = (c + 1) % CHARACTERS.length;
        used.add(c);
        players.push({ dev: `pad${i - 1}`, charIndex: c, profile: pr.profile });
      }
      startSplit(players);
    } else openSplit();
  } else if (params.autostart) {
    if (setup.cup) startCup();
    else startRace();
  }
  const salaParam = new URLSearchParams(location.search).get('sala');
  if (salaParam && !params.autostart) {
    // Enlace o QR de una sala: se intenta entrar directamente.
    const c = normalizeCode(salaParam);
    openOnline(undefined, c);
    showOnlineMenu({ code: c, busy: 'Buscando la sala…', onCreate: () => {}, onJoin: () => {}, onBack: () => openOnline() });
    session.join(c, myChar().id, displayName(myChar())).catch((e: Error) => openOnline(e.message, c));
  }
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
    get track() {
      return track;
    },
    get cup() {
      return activeCup();
    },
    /** Para las pruebas: pasa de los resultados a la clasificación de la copa y a la siguiente carrera. */
    cupNext() {
      if (!cup) return;
      if (mode === 'results' && !scoredThisRace) scoreLocalCup();
      else if (!cup.done) nextCupRace();
    },
    get obstacles() {
      return obstacles;
    },
    get trackId() {
      return trackEntry.id;
    },
    get split() {
      return split;
    },
    /** Para las pruebas: empieza la pantalla dividida con esos dispositivos. */
    startSplit,
    pads,
    chases,
    cameras,
    heat,
    input,
    loadTrack,
    camera,
    renderer,
    scene,
    bus,
    session,
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
}
