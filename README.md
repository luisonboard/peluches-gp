# Peluches GP

Carreras de karts en 3D con los peluches de la casa (three.js 0.180 + TypeScript + Vite).
Plan completo: [`PLAN.md`](PLAN.md) · página del plan: https://claude.ai/artifact/8o3YVSEW8t3RbbNTkvtMkC

## Uso

```sh
npm install
npm run dev        # http://127.0.0.1:5174
npm run build      # dist/index.html (un único archivo)
npm run typecheck
```

## Controles (hito 1)

| Acción | Teclado | Mando (Switch Pro) |
|---|---|---|
| Acelerar | ↑ / W | B o ZR |
| Frenar / reversa | ↓ / S | A |
| Girar | ← → / A D | Palanca izquierda o cruceta |
| Saltito / derrape (mantener y girar) | Espacio | R |
| Pausa | Esc / P | + |
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
| `?seed=texto` | Semilla de lo procedural |
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

### Mediciones (MacBook Pro M3 Pro, Chrome, 1280 × 720, `?bench`)

| Calidad | fps | GPU | Draw calls | Triángulos |
|---|---|---|---|---|
| Bajo | 60 | 0,7 ms | 114 | 35 k |
| Medio | 60 | 1,2 ms | 54 | 106 k |
| Alto | 60 | 2,0 ms | 62 | 107 k |

IA en `?autoplay&speed=6&cpu=dificil`: los 6 karts terminan las 3 vueltas (≈ 29 s por vuelta) sin atascarse ni ir en
sentido contrario.
