# Peluches GP

Carreras de karts en 3D con los peluches de la casa (three.js 0.180 + TypeScript + Vite).
Plan completo: [`PLAN.md`](PLAN.md) · página del plan: https://claude.ai/artifact/8o3YVSEW8t3RbbNTkvtMkC

## Uso

```sh
npm install
npm run dev        # http://127.0.0.1:5174
npm run dev:lan    # https://<IP-del-Mac>:5175 (con relevo de salas multijugador) en la red local (para probar en el teléfono: giroscopio y mandos piden HTTPS)
npm run build      # dist/index.html (un único archivo)
npm run typecheck
```

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

En el teléfono aparecen botones táctiles (en horizontal): ◀ ▶ o volante por giroscopio, Frenar, Derrapar, Objeto/Poder y 👀 (mirar atrás)
(en el perfil Peque, un solo botón "¡Usar!"). Ajustes (⚙ en el título o en la pausa): perfil, ayuda de manejo, voz,
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
  | Robotín | Misil imán | Sigue la pista hasta el kart de delante y lo voltea |

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

### Mediciones (MacBook Pro M3 Pro, Chrome, 1280 × 720, `?bench`, hito 2)

| Calidad | fps | GPU | Triángulos |
|---|---|---|---|
| Bajo | 60 | 0,8 ms | 57 k |
| Medio | 60 | 1,7 ms | 129 k |
| Alto | 60 | 1,9 ms | 133 k |

10 carreras seguidas con `?autoplay&speed=8&cpu=normal`: las 10 terminan con los 6 karts en meta, sin sentido
contrario y con ≤ 0,3 % de muestras paradas. Se usaron los 6 poderes (33–42 veces cada uno), 288 objetos y hubo
333 golpes.
