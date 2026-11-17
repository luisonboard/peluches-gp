# Peluches GP

Carreras de karts en 3D con los peluches de la casa (three.js 0.180 + TypeScript + Vite).
Juego publicado: https://peluches-gp.luisonboard.workers.dev · plan completo: [`PLAN.md`](PLAN.md) · página del plan: https://claude.ai/artifact/8o3YVSEW8t3RbbNTkvtMkC

## Uso

```sh
npm install
npm run dev        # http://127.0.0.1:5174
npm run dev:lan    # https://<IP-del-Mac>:5175 (con relevo de salas multijugador) en la red local (para probar en el teléfono: giroscopio y mandos piden HTTPS)
npm run build      # dist/index.html (un único archivo)
npm run typecheck
```

### Publicar

Un solo Worker de Cloudflare (`wrangler.toml`) sirve el juego compilado (`dist`, recursos estáticos con `_headers`)
y el relevo de salas en `/relay` (`relay/worker.mjs` + `relay/rooms.mjs`, en un Durable Object), en la misma
dirección: https://peluches-gp.luisonboard.workers.dev

- Automático: el Worker está conectado al repositorio de GitHub (Workers Builds: `npm run build`, despliegue
  `npx wrangler deploy`); cada `git push` a `main` publica.
- A mano: `npm run deploy` (pide `npx wrangler login` una vez). Para probar el Worker en local: `npm run dev:worker`.
- El juego busca el relevo en su propia dirección; `VITE_RELAY_URL` permite apuntar a otro. Si no hay relevo,
  conexión directa (PeerJS).
- Íconos: `icons-src/*.svg`, exportados a `public/icon-*.png`.

## Controles

| Acción | Teclado | Mando (Switch Pro) |
|---|---|---|
| Acelerar | ↑ / W | B o ZR |
| Frenar / reversa | ↓ / S | A |
| Girar | ← → / A D | Palanca izquierda o cruceta |
| Saltito / derrape (mantener y girar) | Espacio | R |
| Usar objeto | Shift / K | L, ZL o Y |
| Poder del peluche (barra llena) | E / L | X |
| Pausa | Esc / P | + |
| Mirar atrás (mantener) | C | − o R3 |
| Pantalla completa | F | — |

En el teléfono aparecen botones táctiles (en horizontal). Izquierda: ◀ ▶ (o volante por giroscopio), 👀 (mirar atrás) y
pausa. Derecha: Acelerar y Frenar juntos abajo (sin Acelerar si acelera solo), Derrapar al lado, y Objeto y Poder
juntos encima (en el perfil Peque, un solo botón "¡Usar!"). Ajustes (⚙ en el título o en la pausa): perfil, ayuda de manejo, voz,
volante, nombres de los peluches y prueba del mando.
| Menús | Flechas + Enter | Palanca/cruceta + B |

**Turbo de salida**: acelera durante el último segundo de la cuenta atrás (ni antes ni después).
**Miniturbo**: mantén el derrape; las chispas pasan de blancas a azules, naranjas y rosas. Al soltar, más turbo cuanto más color.

## Parámetros de URL

| Parámetro | Efecto |
|---|---|
| `?autostart` | Empieza la carrera directamente |
| `?autoplay` | La IA maneja también tu kart |
| `?bench` | 20 s de carrera automática; resultado en pantalla y en `window.__bench` |
| `?q=low\|medium\|high` | Fuerza un preset de calidad (por defecto: Bajo en teléfonos, Medio en computadores) |
| `?fps=30\|60\|0` | Límite de fps (0 = sin límite) |
| `?speed=4` | Subpasos de simulación por cuadro (carreras aceleradas para pruebas) |
| `?cpu=facil\|normal\|dificil` | Dificultad de los rivales |
| `?laps=2` | Número de vueltas |
| `?char=zorro` | Peluche del jugador (`perro`, `esponja`, `raton`, `zorro`, `dino`, `robot`) |
| `?cam=top` | Vista cenital de toda la pista |
| `?cam=free` | Cámara quieta, para moverla desde DevTools (`__game.camera`) |
| `?seed=texto` | Semilla de lo procedural |
| `?perfil=peque\|normal` | Aplica un perfil al cargar |
| `?track=cuarto\|bano\|jardin` | Pista al cargar |
| `?copa` | Elige la copa de 3 carreras (con `?autostart`, empieza sola) |
| `?split` | Abre la pantalla dividida para 2 jugadores (con `?autostart`, empieza con teclado + mando 0; con `?bench`, mide en pantalla dividida) |
| `?touch` | Muestra los botones táctiles aunque no sea un teléfono |
| `?sala=ABCD` | Entra directamente a esa sala (lo usa el QR) |
| `?noaudio` | Sin audio |

Errores en `window.__errors`; estado en `window.__game` (por ejemplo, `__game.TUNING` para ajustar la física en vivo).

## Estado

**Hito 1 — base técnica y sensación del kart** (terminado):

- Bucle con límite de fps (menús a 30, carrera a 60), `dt` acotado, presets con detección automática, resolución
  dinámica, tiempo de GPU real (`EXT_disjoint_timer_query_webgl2`), bus de eventos y RNG con semilla.
- Pista "El Cuarto de Juegos" (935 m): suelo de madera, curva amplia, eses, rampa de cartón que sube a la cama
  (manta amarilla con hojas, barrotes de cuna) y bajada con saltito. Bordillos, alfombra lateral que frena,
  barreras de juguete, 4 placas de turbo, arco de meta con pancarta, juguetes gigantes colocados lejos de la pista.
- Física arcade: aceleración exponencial, derrape con saltito y miniturbo de 3 niveles, turbo de salida,
  barreras que frenan y enderezan, choques entre karts, saltos en las crestas, sentido contrario.
- IA con línea variable, interior de curvas, derrapes, salida de atascos y 3 dificultades; en Fácil afloja si va
  muy por delante del jugador.
- Cámara de persecución con FOV según velocidad y sacudidas; HUD con posición, vuelta, tiempo y minimapa;
  cuenta atrás, pausa, resultados; partículas (chispas, llamas, polvo); motor y efectos sintetizados; vibración del mando.
- Pilotos provisionales (formas simples por especie); los peluches definitivos llegan en el hito 2.

**Hito 2 — peluches y poderes** (terminado):

- Los 6 peluches modelados a partir de los juguetes (tela con brillo de pelusa y relieve), con cabeza, orejas,
  brazos y colas animados al girar, al recibir golpes y al celebrar en la meta.
- Barra de poder (se llena en 26 s o antes abriendo cajas) y los 6 poderes:

  | Peluche | Poder | Efecto |
  |---|---|---|
  | Canelo | Ladrido sónico | Ondas que hacen girar a quien esté a menos de 16 m y barren pelotas y chicles |
  | Esponjo | Burbuja atrapadora | Burbuja que persigue al de delante y lo deja flotando 2 s |
  | Chispa | Rayo | Relámpago sobre todos los que van delante: se encogen y frenan 3 s (un kart normal los aplasta) |
  | Kitsu | Llama de zorro | 3,5 s de supervelocidad con fuego, invulnerable; aparta a quien toca |
  | Dino | Pisotón | Salto y temblor al caer: voltereta a quien esté a menos de 18 m; rompe los chicles |
  | Robotín | Brazos telescópicos | Estira el brazo con su ventosa, atrapa al de delante (lo hace girar) y se jala con un impulso mientras estira las piernas. Si va primero, se agarra de la pista |

- 16 cajas regalo en 4 filas (reaparecen a los 2,5 s) con ruleta de 1 s y 3 objetos: turbo cohete, pelota saltarina
  (rebota en las barreras) y chicle pegajoso (frena 1,4 s). Los de atrás reciben más turbos; los de delante, más chicles.
- IA que usa objetos y poderes con criterio (pelota si hay alguien delante y alineado, chicle si la siguen, Kitsu en
  rectas…). En Fácil reacciona más tarde y no usa poderes en la primera vuelta.
- HUD con casilla de objeto, barra de poder que brilla al llenarse, avisos ("¡Chicle! Dino te dio"), destello del
  rayo, sonidos de cada poder y objeto (bajan con la distancia) y vibración del mando.

**Hito 3 — controles para todos** (terminado):

- Ajustes guardados en el dispositivo, con dos perfiles. **Peque** (por defecto): aceleración automática, dirección
  asistida, poder automático, voz, rivales en Fácil y golpes un 15 % más cortos. **Normal**: todo manual.
- **Dirección asistida**: mira la pista por delante y corrige si el kart va a salirse; si el niño no gira, conduce
  sola; si gira, manda él salvo cerca de la barrera, que además está "acolchada". Estrella guía detrás del kart y
  miniturbo un 20 % más lento. Con aceleración automática, el turbo de salida llega solo.
- **Giroscopio como volante** (`devicemotion`, gravedad en el plano de la pantalla, según la orientación):
  calibración al empezar cada carrera y con el botón Centrar, zona muerta de 4°, sensibilidad 20°/30°/42°,
  opción Invertir y permiso para el iPhone.
- **Botones táctiles** multitáctiles, aviso para girar el teléfono, pantalla completa y bloqueo en horizontal
  (donde el navegador lo permite).
- **Nombres editables** (hasta 12 letras) y **prueba del mando** en Ajustes; voz en español con la síntesis del sistema.

Comprobado con `?autostart&perfil=peque` y sin tocar nada: 3 vueltas, 0 choques contra las barreras, 0 % fuera del
asfalto. Manteniendo la derecha o girando al azar: 0 choques. Giroscopio simulado: inclinar 15° = medio giro,
30° = giro completo, hacia el lado correcto.

**Hito 4 — multijugador en línea** (terminado):

- "👫 Jugar con otros" en el título: **Crear sala** da un código de 4 letras (sin I ni O) y un QR con el enlace
  `?sala=CÓDIGO`; los demás escriben el código o escanean el QR. Hasta 6 jugadores; la IA llena los puestos libres.
- Sala de espera común: cada uno elige su peluche (no se repiten) y su nombre viaja con él; el anfitrión elige
  vueltas y dificultad de la IA y pulsa ¡A correr!.
- Dos formas de conectar, elegidas solas: **relevo** por WebSocket (`/relay`) cuando el servidor que sirve el juego lo
  tiene (el de desarrollo sí: `relay/rooms.mjs`), que funciona en cualquier red; si no, **conexión directa** con
  PeerJS 1.5.4 (WebRTC), que depende de que la red deje conectar los dispositivos entre sí (muchas Wi-Fi caseras no lo
  permiten). Topología en estrella: el anfitrión reenvía.
- Cada dispositivo simula su kart (sin retraso al manejar) y envía su estado 20 veces por segundo; los demás karts se
  predicen con su última velocidad y se suavizan. El anfitrión simula la IA y decide los puestos de llegada.
- Objetos y poderes en red: quien los usa avisa a todos (con el objetivo ya elegido) y cada dispositivo decide los
  golpes de sus propios karts; las cajas abiertas y los proyectiles que ya golpearon se comunican a los demás.
- Latido cada segundo: si un invitado se va, la IA del anfitrión toma su kart donde quedó; si se va el anfitrión,
  los invitados vuelven al menú con un aviso. Al terminar, el anfitrión lleva a todos de vuelta a la sala.
- En línea, la pausa no detiene la carrera (los demás siguen corriendo).

Comprobado con dos pestañas (anfitrión e invitado): sala con los dos jugadores, kart del invitado visto por el
anfitrión a 1–2 m (interpolación a 30 m/s), IA del anfitrión vista por el invitado, poder del invitado recibido por
el anfitrión, mismo orden de llegada en los dos, vuelta a la sala, desconexión del invitado (la IA toma su kart) y
del anfitrión (aviso al invitado).

**Hito 5 — presentación y sonido** (terminado):

- Título con el peluche elegido en 3D a un lado (gira sobre sí mismo y saluda) y el menú al otro; en vertical, el
  menú abajo. También detrás de la sala de espera.
- Música sintetizada en tiempo real (`src/audio/music.ts`): pista tranquila con campanitas para los menús y pista
  alegre para la carrera (batería, bajo, acordes y melodía, que alterna con un arpegio); en la última vuelta se
  acelera un 12 %. Se baja en la pausa. Ajustes → Sonido: Música y Efectos por separado.
- Podio final (`src/world/podium.ts`): bloques de juguete 1-2-3 con los tres primeros peluches celebrando, confeti
  y la tabla de resultados a un lado (abajo en vertical).
- Pantallas revisadas a 1280 × 720, 844 × 390 y 390 × 844: título, Ajustes, sala, pausa y resultados sin textos que
  se pisen ni botones fuera de la pantalla.

**Hito 6 — app instalable y publicación** (terminado):

- PWA: `manifest.webmanifest` (pantalla completa, horizontal), íconos 180/192/512 y máscara para Android, metas de
  iOS. Service worker: la página se pide a la red y, sin red, sale de la caché; abre sin conexión.
- Ajustes → Instalar como app: botón en Android/Chrome; instrucciones de Safari en el iPhone.
- Publicado como un único Worker de Cloudflare: el juego y el relevo de salas (`relay/worker.mjs`, mismo código de
  salas que el servidor de desarrollo, dentro de un Durable Object; mensajes de hasta 32 KB, 600 conexiones).

Comprobado en Chrome sin interfaz con el Worker en `wrangler dev`: manifiesto
sin errores, service worker activo y controlando la página, recarga sin red con el juego en el título y 0 errores,
y una sala creada en una pestaña y unida desde otra a través del Worker (transporte "relevo", los dos ven a los dos).
Repetido con lo publicado en https://peluches-gp.luisonboard.workers.dev: mismos resultados; ida y vuelta
de un mensaje por el relevo ≈ 68 ms desde Ecuador.

**Hito 7 — pistas intercambiables** (terminado, fase 2):

- Registro de pistas en `src/world/tracks.ts`: cada pista trae su trazado (`TrackDef` con `id` y superficie por
  punto de control o por altura), su escenario, su luz y cielo (`TrackLook`: niebla, luces, exposición, colores de
  la franja lateral y de las barreras) y el sitio del podio. Bañera Burbujeante y Jardín de Noche aparecen como
  "Pronto".
- `loadTrack(id)` en `main.ts` monta una pista y libera la anterior con `render/dispose.ts`. Lo compartido
  (texturas de `makeTextures`, cachés de karts y peluches) lleva `userData.shared` y no se libera. Los karts de
  la carrera anterior también se liberan ahora (antes quedaban ≈ 50 geometrías por carrera).
- Elección de pista en el título (tarjetas con minimapa) y en la sala (la elige el anfitrión). Se guarda en los
  ajustes. Protocolo 2: `lobby` y `start` llevan `track`; un dispositivo con la versión anterior recibe
  "Actualiza el juego".

Comprobado: el Cuarto de Juegos se ve igual que antes (misma vista fija; difiere el 0,1 % de los píxeles, en las
piezas animadas). 10 cambios de pista seguidos y 5 carreras nuevas: geometrías y texturas estables (98/20 en el
título, 134/63 en carrera). Carrera completa en automático sin errores. Sala por el relevo con dos pestañas: el
invitado ve la pista elegida y la carrera corre en los dos. Build de 813 KB. `?bench` en Medio: 60 fps, 2,8 ms de
GPU, 129 k triángulos.

**Hito 8 — Bañera Burbujeante** (terminado, fase 2):

- Pista `bano` (`src/world/bathTrack.ts`, ≈ 1090 m): suelo de baldosas, alfombra de baño (franja rosa), subida
  por una toalla doblada, tramo estrecho (6,5 m de medio ancho) por el borde de la bañera a 10 m de altura,
  tobogán de esponja con bajada suave y un salto corto al final.
- Escenario (`src/world/bath.ts`): baldosas en `<canvas>`, bañera con agua, espuma, patito flotando, grifo y
  patas doradas, ventana, burbujas que suben, y champús, papel higiénico, jabón, vaso con cepillos y toallas
  enrolladas gigantes.
- Patitos de goma (`src/game/obstacles.ts`): cruzan la pista de lado a lado según el tiempo de carrera (igual en
  todos los dispositivos sin enviar nada). Empujan y frenan, sin trompo. La IA y la dirección asistida los esquivan
  prediciendo dónde estarán.
- Charcos de jabón (`slicks` en la pista): 0,7 s con un 25 % del agarre y menos giro, burbujas, sonido y "¡Jabón!".
- Cada pista define los colores de la franja, barreras, polvo y faldón por superficie (`TrackLook`).

Comprobado: 10 carreras con `?autoplay&speed=8&cpu=normal&track=bano`: las 10 terminan con los 6 karts, nadie
parado más de 2 s, vueltas del jugador automático de 31–39 s (el mismo piloto da 26–31 s en el Cuarto),
≈ 22 choques con patitos y ≈ 24 charcos por carrera (entre los 6 karts). Perfil Peque sin tocar nada: 3 vueltas
de ≈ 33 s, 0 choques contra barreras, 0 % fuera de la pista. `?bench` en Medio: 60 fps, 2,9 ms de GPU, 161 k
triángulos (con la pasada de sombras); en Bajo (el de los teléfonos): 60 fps, 1,7 ms, 66 k. Cambiar 10 veces
entre Cuarto y Bañera: memoria estable.

**Hito 9 — Jardín de Noche** (terminado, fase 2):

- Pista `jardin` (`src/world/gardenTrack.ts`, ≈ 990 m) de noche: túnel bajo una maceta tumbada, sendero de
  piedras, **salto sobre el arroyo**, puente de tabla sobre un charco y bache sobre una manguera.
- Saltos (`jumps` en la pista): dos filas de **aceleradores a todo el ancho** (de barrera a barrera, también sobre
  la franja lateral), rampa recta de 14 m que sube 3 m y un hueco de 12 m sin suelo. Con el turbo se cruza
  desde ≈ 20 m/s; quien cae al agua salpica y reaparece en la otra orilla a 10 m/s ("¡Al agua!"). Con `gap: 0`
  es un bache (la manguera).
- Escenario (`src/world/garden.ts`): césped, cerca con farolitos, pared de la casa con ventanas encendidas, luna y
  estrellas, arroyo con piedras que acaba en un estanque, flores, arbustos, setas que brillan, luciérnagas y
  luces en el borde de la pista cada 8 m. Todo lo que brilla es emisivo (sin luces puntuales).
- Faros en los karts en las pistas de noche (`look.night`): dos luces y un haz en el suelo.

Comprobado: 10 carreras con `?autoplay&speed=8&cpu=normal&track=jardin`: las 10 terminan con los 6 karts, nadie
parado más de 2 s, vueltas del jugador automático de 27–35 s, salto de ≈ 0,7 s en el aire y 4 caídas al agua en
180 cruces (karts que llegaban sin turbo tras un golpe). Perfil Peque sin tocar nada: 3 vueltas de ≈ 30 s,
0 choques contra barreras, 0 caídas, 0 % fuera de la pista. `?bench`: Medio 60 fps, 3,8 ms de GPU; Bajo 60 fps,
1,5 ms, 99 k triángulos. Cambiar 9 veces entre las tres pistas: memoria estable.

**Hito 10 — Copa Peluche** (terminado, fase 2):

- Cuarta tarjeta en el menú, "Copa": Cuarto de Juegos → Bañera Burbujeante → Jardín de Noche. Puntos 10/8/6/4/3/2
  (`src/game/cup.ts`). Desempates: más victorias y luego mejor puesto en la última carrera.
- Tras cada carrera, "Ver la copa ▶" muestra la clasificación con los puntos ganados y flechas ▲▼. La siguiente
  carrera sale con la parrilla al revés de la clasificación (el líder sale último). Al final, los tres primeros de
  la copa en el podio con trofeos de oro, plata y bronce, y "Otra copa".
- En línea: en la sala, Pista → "🏆 Copa (3 pistas)". El anfitrión lleva los puntos (por peluche: si alguien se
  va, la IA sigue con su peluche y sus puntos) y los manda a todos (protocolo 3: `cup` y la copa en `start`).
  Una copa a medias no se guarda.
- En el menú, las tarjetas de pista usan nombres cortos (Cuarto, Bañera, Jardín, Copa); el nombre completo está
  en la ayuda.

Comprobado: `npm run check:copa` (puntos, desempates, parrilla, flechas y copia por la red). Copa entera con
`?copa&autostart&autoplay` sin errores: las tres pistas en orden y la parrilla de las carreras 2 y 3 igual a la
clasificación al revés. Copa en línea con dos pestañas por el relevo: las dos ven la misma clasificación final.
Menú a 1280 × 720 y 844 × 390 sin botones fuera de la pantalla.

**Hito 11 — Contrarreloj**: se dejó para más adelante (decisión del 17 nov 2026).

**Hito 12 — Pantalla dividida para 2 jugadores** (terminado, fase 2):

- Botón "👥 2 jugadores" en el título (no aparece en el teléfono ni en línea). Usa la pista o la copa, los rivales y
  las vueltas elegidos en el menú.
- Pantalla "Pulsa un botón para unirte" (`src/ui/split.ts`): cada jugador se une con su dispositivo (teclado con
  Enter, o un mando con B) y con ese mismo dispositivo elige peluche (◀ ▶), perfil Peque o Normal (▲ ▼) y dice
  "listo" (B / Enter). Con los dos listos, empieza. También se puede hacer con el ratón. Se recuerda el peluche y
  el perfil del jugador 2 (`settings.p2`); el jugador 1 usa los ajustes generales.
- Entrada por dispositivo (`Input.poll` + `readDevice`): teclado + mando, o dos mandos. Cada kart responde solo a
  su dispositivo, con su ayuda de manejo y poder automático, y la vibración va al mando de cada uno.
- La carrera admite varios pilotos locales (`Race.pilots`); los avisos, sacudidas de cámara y vibraciones van al
  jugador correspondiente (`Kart.localNo` en vez de `kart === 0`). La carrera termina cuando llegan los dos.
- Dos cámaras de persecución (arriba el jugador 1, abajo el 2) con `setViewport`/`setScissor` y un campo de visión
  más cerrado; la sombra sigue a cada kart en su vista. HUD por mitad (posición, vuelta, objeto, poder, avisos y
  etiqueta J1/J2) y minimapa compartido en el centro con un anillo de color por jugador.
- En pantalla dividida la calidad baja un nivel (Alto → Medio, Medio → Bajo: sombras, partículas y resolución) y
  vuelve al salir. Vale para carrera suelta y copa (resultados y copa marcan "(J1)" y "(J2)").

Comprobado con dos mandos simulados (Gamepad API): unirse, cambiar peluche y perfil, y cada mando acelera y gira
solo su kart. Copa entera con `?split&autostart&autoplay&copa`: las tres pistas, puntos de los dos jugadores y
podio final, sin errores. Entrar y salir 5 veces de la pantalla dividida: memoria estable y calidad restaurada.
`?bench&split`: en Alto (pasa a Medio) 60 fps y 3,2 ms de GPU; en Medio con el Jardín (pasa a Bajo) 60 fps y
2,3 ms. Falta: la prueba con dos mandos reales y en una tablet de gama media (objetivo ≥ 45 fps en Bajo).

### Mediciones (MacBook Pro M3 Pro, Chrome, 1280 × 720, `?bench`, hito 2)

| Calidad | fps | GPU | Triángulos |
|---|---|---|---|
| Bajo | 60 | 0,8 ms | 57 k |
| Medio | 60 | 1,7 ms | 129 k |
| Alto | 60 | 1,9 ms | 133 k |

10 carreras seguidas con `?autoplay&speed=8&cpu=normal`: las 10 terminan con los 6 karts en meta, sin sentido
contrario y con ≤ 0,3 % de muestras paradas. Se usaron los 6 poderes (33–42 veces cada uno), 288 objetos y hubo
333 golpes.
