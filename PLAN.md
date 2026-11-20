# Peluches GP — plan del juego

Carreras de karts en 3D, al estilo de los juegos de karts de los 90 (cámara detrás del kart, derrapes con
miniturbo, cajas de objetos, 3 vueltas), protagonizado por los peluches de la casa, cada uno con un poder propio.
Es un juego original: se usa el género y sus mecánicas, no nombres, pistas, objetos, música ni arte de ningún
juego concreto.

## 1. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Plataforma | Juego web (three.js 0.180.0 + TypeScript + Vite), instalable como PWA | Un solo código para Windows, Mac, Android e iPhone. Se instala en la pantalla de inicio y funciona sin conexión |
| Publicación | **Cloudflare Pages** conectado a GitHub, como las otras PWAs: preset Vite, `npm run build`, salida `dist`. Cada push a `main` publica | HTTPS gratis. En el iPhone, el giroscopio y los mandos solo funcionan con HTTPS |
| Multijugador | Conexión directa entre dispositivos (WebRTC con PeerJS) y un código de sala de 4 letras | No hace falta servidor propio. Un dispositivo crea la sala y los demás escriben el código |
| Mandos | Gamepad API (Switch Pro, Xbox, PlayStation) con vibración donde haya soporte | Chrome, Edge y Safari los reconocen por Bluetooth o USB |
| Gráficos | Todo procedural: peluches hechos con formas suaves y material de tela (*sheen*), texturas en `<canvas>` | Sin descargas, archivo pequeño y carga rápida en teléfonos |
| Sonido | Sintetizado con Web Audio: motor, efectos y música alegre en bucle | Sin archivos de audio |
| Rendimiento | 60 fps en teléfonos de gama media. Presets Bajo/Medio/Alto con detección automática | Así lo pide la guía: el rendimiento entra en el hito 1 |

## 2. Personajes y poderes

**Nombres editables**: en la pantalla de elección de personaje, cada peluche tiene un botón ✏️ para escribir su
nombre (hasta 12 letras). Los nombres se guardan en el dispositivo y se envían a los demás jugadores en el
multijugador. El botón "Restaurar" vuelve a los nombres por defecto. Los de la tabla son solo el punto de partida.

Cada personaje tiene una
**barra de poder** que se llena al conducir y al abrir cajas. Cuando está llena, se activa con un botón.

| Peluche | Nombre por defecto | Poder | Efecto |
|---|---|---|---|
| Perro café | **Canelo** | Ladrido sónico | Una onda alrededor del kart hace girar a los rivales cercanos |
| Esponja amarilla | **Esponjo** | Burbuja atrapadora | Lanza una burbuja hacia el rival de delante, que queda flotando 2 s |
| Ratón eléctrico amarillo | **Chispa** | Rayo | Encoge y frena 3 s a todos los que van por delante |
| Zorro naranja de nueve colas | **Kitsu** | Llama de zorro | Supervelocidad envuelta en fuego, invulnerable, aparta a quien toque |
| Dinosaurio verde | **Dino** | Pisotón | Salta y, al caer, provoca un temblor que frena a los cercanos y destruye trampas |
| Robot rojo | **Robotín** | Brazos telescópicos | Estira el brazo hasta el rival de delante, lo atrapa con la ventosa y se jala hacia él estirando las piernas |

Objetos genéricos de las **cajas regalo**: turbo cohete, pelota saltarina (rebota en las paredes) y chicle
pegajoso (trampa). Los que van atrás reciben más turbos y los que van delante, más trampas.

## 3. Controles

| Acción | Teclado | Mando (Switch Pro) | Teléfono |
|---|---|---|---|
| Acelerar | ↑ / W | B (botón inferior) o ZR | Automático, o botón |
| Frenar / reversa | ↓ / S | A (botón derecho) | Botón |
| Girar | ← → / A D | Palanca izquierda | **Giroscopio (volante)** o botones ◀ ▶ |
| Derrapar / saltito | Espacio | R | Botón (mantener) |
| Usar objeto | Shift / K | L o ZL | Botón |
| Poder | E / L | X (botón superior) | Botón |
| Pausa | Esc | + | Botón ⏸ |

### Giroscopio como volante

- El teléfono en horizontal se gira como un volante. Se lee `DeviceOrientationEvent` y se tiene en cuenta si la
  pantalla está girada a la izquierda o a la derecha.
- **Calibración**: al empezar la carrera, la posición en la que se sostiene el teléfono se toma como "recto". Un botón
  permite recalibrar.
- Zona muerta de ±4°. Giro máximo a ±30° (ajustable: sensible, normal o suave). Suavizado para que no tiemble.
- En el iPhone hay que pedir permiso con un toque ("Activar volante"), que es lo que exige Safari. Si se niega, se
  usan los botones ◀ ▶.
- Se puede usar el giroscopio aunque haya un mando conectado al teléfono (por ejemplo, con un soporte).

### Ayuda de manejo (para niños)

Se activa por jugador en el menú y también durante la carrera (en pausa). Tiene dos partes independientes, como en
las ediciones modernas de los juegos de karts:

1. **Aceleración automática**: el kart acelera solo. El niño solo gira.
2. **Dirección asistida**: corrige el volante para que el kart no choque con las paredes ni salga de la pista. Se
   anticipa la pista unos metros por delante y, si el kart va a salirse, se suma una corrección suave hacia el
   centro. La ayuda es menor en las rectas, así que el niño sigue sintiendo que maneja. Mientras está activa, un
   **icono de estrella guía** brilla detrás del kart.

Para que siga siendo justo, la dirección asistida no permite atajos fuera de pista y hace un poco más lentos
los derrapes con miniturbo.

**Ajustes pensados para 5 años** (valores por defecto en el perfil "Peque"):

- Ayuda de manejo activada desde el principio, con las dos partes.
- IA en dificultad **Fácil**: un 15 % más lenta y sin poderes en la primera vuelta. Además, si el niño va último, la IA
  afloja.
- Los golpes solo frenan 1 s, en vez de hacer girar 1,5 s, y no hay caídas de la pista.
- Los objetos y los poderes se usan con **un solo botón grande**. El poder se activa solo cuando la barra está llena,
  si se activa la opción "Poder automático".
- En los menús hay iconos grandes y pocas palabras. Las indicaciones también se dicen en voz alta ("¡Tres, dos, uno,
  ya!").
- 3 vueltas, con la opción de 2.

## 4. Pista del hito 1: "El Cuarto de Juegos"

Un circuito en el que los peluches son pequeños y el cuarto es gigante: suelo de madera, pared azul, barrotes de
cuna de madera, bloques de letras, crayones, libros apilados y una pelota. Tendrá una **rampa que sube a la cama**
(manta amarilla y verde, como la de la foto) y luego baja. Dura unos 35 s por vuelta, con 3 vueltas, 6 corredores,
cajas regalo y placas de turbo.

Más adelante: "Bañera Burbujeante" y "Jardín de Noche".

## 5. Multijugador

- **En línea (dispositivos distintos)**: un dispositivo es el anfitrión, crea la sala y muestra un código de 4
  letras (y un QR). Los demás entran con el código, hasta 6 jugadores. Si faltan jugadores, la máquina rellena los
  puestos.
- El anfitrión dirige la carrera: cuenta atrás, IA, cajas, objetos, poderes y posiciones. Cada dispositivo simula
  su propio kart (sin retraso al manejar) y envía su estado 20 veces por segundo. Los karts de los demás se
  interpolan.
- Cada jugador elige su peluche en una sala de espera común. Solo puede haber un peluche de cada tipo.
- Funciona en la misma red Wi-Fi y también por Internet. Para encontrarse se usa un servidor público y gratuito de
  PeerJS. Los datos de la carrera viajan directamente entre los dispositivos.
- Más adelante, opcional: **pantalla dividida** para 2 jugadores con 2 mandos en el mismo computador.

## 6. Hitos

Un hito por petición. Cada uno termina con un commit, capturas en el navegador (escritorio y tamaño de teléfono) y
`window.__errors` vacío.

| # | Hito | Criterio de éxito |
|---|---|---|
| 1 | **Base técnica y sensación del kart**: bucle con fps limitados, presets, resolución dinámica, bus de eventos, `?autostart`, `?autoplay`, `?bench`. Pista "Cuarto de Juegos", física arcade con derrape, miniturbo y saltito, cámara de persecución, vueltas, posiciones, cuenta atrás y resultados | Una vuelta completa sin atravesar paredes. 60 fps en Medio con 6 karts. El derrape se siente bien (lo prueba tu hijo) |
| 2 | **Peluches y poderes**: los 6 modelos, barra de poder, los 6 poderes, cajas regalo y 3 objetos, IA con 3 dificultades | La IA termina las carreras sin quedarse atascada (`?autoplay` x10). Cada poder se ve y se oye claramente |
| 3 | **Controles para todos**: teclado, mando (Switch Pro) con vibración, botones táctiles, **giroscopio con calibración**, **ayuda de manejo** y nombres editables | Con la ayuda activada y sin tocar el volante, el kart da una vuelta sin chocar. Prueba real con el Switch Pro y con un iPhone/Android |
| 4 | **Multijugador en línea**: salas con código, sala de espera, sincronización, objetos y poderes en red, reconexión | 3 dispositivos (Mac, Android, iPhone) terminan una carrera juntos sin saltos visibles |
| 5 | **Presentación y sonido**: menús con los peluches en 3D, música, efectos, vibración, podio final y pantalla de título | Capturas a 1280 × 720 y en teléfono vertical/horizontal sin textos que se pisen |
| 6 | **PWA y publicación**: manifiesto, iconos, funcionamiento sin conexión, despliegue en Cloudflare Pages | Se instala en la pantalla de inicio del iPhone y del Android y abre sin conexión |
| 7–12 (fase 2) | Más pistas, copa de 3 carreras, contrarreloj, pantalla dividida. Detalle en la sección 10 | — |

**Fuera de alcance**: cuentas de usuario, clasificaciones en línea, emparejamiento con desconocidos y tiendas de
aplicaciones (App Store o Play Store). Si algún día se quiere publicar en las tiendas, se puede empaquetar con
Capacitor.

## 7. Presupuesto de rendimiento

- Teléfono de gama media: 60 fps en Bajo/Medio, ≤ 8 ms de GPU y ≤ 150 000 triángulos en pantalla.
- Mac M3 Pro: Alto a 60 fps, ≤ 6 ms de GPU.
- Archivo final ≤ 1,5 MB y carga en menos de 2 s.
- Sombras solo de los karts y los objetos cercanos. En teléfonos, la resolución se limita a 1,5× y baja de forma
  dinámica si cae el rendimiento.

## 8. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| El iPhone no da acceso al giroscopio sin HTTPS ni sin un toque del usuario | Publicar con HTTPS. Botón "Activar volante". Usar los botones como respaldo |
| Los mandos tienen un mapeo distinto en cada navegador | Usar el mapeo "standard" y una pantalla de prueba del mando que muestre los botones pulsados |
| El multijugador va con retraso en una Wi-Fi lenta | Cada uno simula su kart, se interpola a los demás y se envía poco (20 veces por segundo, < 2 KB/s) |
| Una red muy cerrada (empresa, datos móviles) bloquea la conexión directa | Avisar si falla y recomendar la misma Wi-Fi. Más adelante, servidor TURN propio |
| La dirección asistida resulta demasiado fuerte o demasiado débil | Ajuste en vivo en `window.__game` y prueba con tu hijo |
| Calentamiento y batería en el teléfono | 30 fps en los menús y preset Bajo automático en equipos lentos |

## 9. Decisiones del usuario (16 nov 2026)

1. Los personajes se pueden renombrar desde el juego.
2. Se publica en Cloudflare Pages, como las otras PWAs.
3. El jugador principal tiene 5 años: perfil "Peque" con ayuda de manejo y la IA en Fácil por defecto.

## 10. Fase 2 (plan del 17 nov 2026)

La fase 2 añade dos pistas, la copa de 3 carreras, la contrarreloj y la pantalla dividida para 2 jugadores. Se
mantiene la regla de la fase 1: un hito por petición, cada uno con commit, capturas (escritorio y teléfono) y
`window.__errors` vacío.

### Punto de partida en el código

- Hay **una sola pista fija**: `main.ts` crea `Track(ROOM_TRACK)`, `buildTrack`, `buildRoom`, la `Arena` y el podio
  al arrancar. La superficie (`floor`/`ramp`/`bed`) se deduce de la altura (`y > 7.5` = cama) y la escena (cielo,
  niebla, luces) está pensada para el cuarto.
- **Un solo jugador local**: `Input.read()` mezcla teclado y el primer mando, y hay 23 sitios que suponen que el
  jugador es `karts[0]` (`kart === 0` en los eventos de sonido, vibración y HUD). Hay una sola `ChaseCam` y un HUD.
- La red manda `laps` y `cpu` en `lobby` y `start`, pero no la pista (`PROTOCOL = 1`).

### Hitos

| # | Hito | Contenido | Listo cuando |
|---|---|---|---|
| 7 | **Pistas intercambiables** | `TrackDef` gana `id`, superficie por punto de control (en vez de por altura), posición del podio y un `theme` (escenario, cielo, niebla, luces, colores de barrera, tempo de la música). Registro `TRACKS` en `src/world/tracks.ts`. `loadTrack(id)` crea pista, escenario, arena y podio y libera (`dispose`) los anteriores. Elección de pista en el título (tarjetas grandes con el minimapa) y en la sala (la elige el anfitrión). Protocolo 2: `lobby` y `start` llevan `track`; un invitado con la versión vieja recibe "Actualiza el juego". `?track=` para pruebas | El Cuarto de Juegos se ve igual que antes (captura comparada). Cambiar de pista 10 veces no hace crecer `renderer.info.memory`. Build ≤ 1,5 MB |
| 8 | **Bañera Burbujeante** | Baño de azulejos: suelo de baldosas, alfombra de baño (franja lenta), subida por una toalla doblada al borde de la bañera, tramo estrecho por el borde con barandas, bajada por un tobogán de esponja con salto. Patitos de goma que se mueven despacio como obstáculos y charcos de jabón (menos agarre, sin trompo). Burbujas flotando con las partículas que ya existen | Vuelta de 35–40 s. La IA termina 10 carreras sin atascarse (`?autoplay`). 60 fps en Medio con 6 karts |
| 9 | **Jardín de Noche** | Luna (luz azulada), luciérnagas, farolitos en la valla. Césped como borde lento, sendero de piedras, salto sobre una manguera, túnel bajo una maceta tumbada, puente de tabla sobre un charco. Faros en los karts y luces en el borde de la pista cada 8 m para que se vean las curvas. Todo emisivo: sin luces puntuales en Bajo y Medio | Mismos criterios que el hito 8. Con el brillo del teléfono al mínimo se distinguen las curvas y los rivales |
| 10 | **Copa de 3 carreras** | "Copa Peluche": Cuarto de Juegos → Bañera → Jardín. Puntos 10/8/6/4/3/2. Entre carreras, tabla con los peluches que suben y bajan; la parrilla de la siguiente sale en orden inverso a la clasificación. Al final, trofeo de oro, plata o bronce en el podio. En línea, el anfitrión lleva los puntos y los envía en un mensaje `cup`; si alguien se va, la IA sigue con sus puntos | Una copa entera con `?autoplay&copa` sin errores. Prueba de la suma de puntos y desempates |
| 11 | **Contrarreloj** | Sin IA ni cajas, con 3 turbos cohete al salir. Mejor tiempo y mejor vuelta por pista. Fantasma de la mejor carrera: posición y rumbo 20 veces por segundo, cuantizados (≈ 20 KB por pista en el dispositivo). Medallas de bronce, plata y oro por pista; el bronce se puede ganar con la ayuda de manejo. Los tiempos hechos con ayuda llevan una estrella | El fantasma repite la carrera grabada con < 0,5 m de error. Los récords siguen tras recargar la página |
| 12 | **Pantalla dividida (2 jugadores)** | Entrada por jugador: el jugador 1 usa teclado o mando 1 y el jugador 2 el mando 2, con una pantalla "Pulsa un botón para unirte". `localPlayers` sustituye a `karts[0]`: los 23 `kart === 0` pasan a `isLocal(kart)`. Ajustes de ayuda y perfil por jugador (Peque y Normal a la vez). Dos `ChaseCam` con `setViewport`/`setScissor`, arriba y abajo, HUD por mitad y minimapa compartido. Vibración en el mando de cada uno. En pantalla dividida la calidad baja un nivel (sombras y partículas). Vale para carrera normal y copa; no para contrarreloj, en línea ni en el teléfono | Dos mandos terminan una copa y cada uno maneja solo su kart. 60 fps en el Mac M3 Pro en Alto y ≥ 45 fps en una tablet de gama media en Bajo |
| 13 | **Teléfono como mando** | En la pantalla de unirse, un QR abre `?mando=ABCD` en el teléfono: página ligera sin three.js que manda los controles (botones táctiles o giroscopio) por el relevo unas 30 veces por segundo, con flechas y OK para los menús. El computador la trata como un dispositivo más (`tel1`…) y le manda qué mostrar y un HUD mínimo (puesto, vuelta, objeto, poder) y las vibraciones. Que el teléfono dibuje su propia vista (mezclar pantalla dividida y en línea) queda para más adelante | Un teléfono y el teclado terminan una carrera en pantalla dividida, y el teléfono vuelve a su kart tras recargar la página |
| — | **Copa Escuelita** | Segunda copa con tres pistas sobre la escuelita: El Aula (pila de libros, mesa de la maestra, regla, pegamento), Patio de Recreo (túnel de gusano, arenero, salto sobre la piscina de pelotas, castillo, sube y baja, pelotas que ruedan) y El Comedor (bandeja, salto entre dos mesas, servilleta, jugo derramado, naranjas). `CUPS` en `src/game/cup.ts`; protocolo 5 | La IA termina carreras en las tres pistas sin atascarse y una copa entera con `?copa=escuela&autoplay` |

**Orden**: el 7 va primero porque todo lo demás depende de él. La copa (10) necesita las tres pistas. La pantalla
dividida es el cambio más grande y va al final; si se quiere jugar en pareja antes, puede adelantarse justo
después del 7, ya que no depende de las pistas nuevas.

### Riesgos de la fase 2

| Riesgo | Mitigación |
|---|---|
| El archivo pasa de 1,5 MB con tres escenarios | Todo sigue siendo procedural. Medir el build en cada hito; cada escenario nuevo, ≤ 60 KB de código |
| El iPhone se queda sin memoria al cambiar de pista | `dispose` de geometrías, materiales y texturas al cambiar, y la prueba de memoria del hito 7 |
| La pantalla dividida duplica el coste de dibujo | Bajar un nivel de calidad en pantalla dividida y medir con `?bench&split` |
| Un invitado con la versión vieja entra en una sala nueva | Protocolo 2 y aviso "Actualiza el juego" en vez de errores raros |
| El jardín resulta demasiado oscuro para un niño de 5 años | Luces en el borde, faros y prueba con tu hijo; si cuesta, la luna ilumina más en el perfil Peque |

### Decisiones de la fase 2 (17 nov 2026)

1. Puntos de la copa: 10/8/6/4/3/2.
2. La pantalla dividida va al final (hito 12).
3. Una copa a medias no se guarda: si se sale, se pierde.
4. El hito 11 (contrarreloj) se salta por ahora y se hace el 12 (pantalla dividida) antes.
5. En la pantalla dividida, cada jugador se une con el dispositivo con el que pulsa primero: teclado + mando o
   dos mandos.
6. Hito 13 (17 nov 2026): el teléfono sirve de mando en la pantalla dividida, con un HUD mínimo en el teléfono. No
   se transmite video al teléfono (retraso y costo de dibujo). Si se quiere la vista propia en el teléfono, el
   camino es mezclar la pantalla dividida con el modo en línea, en un hito aparte.
7. 18 nov 2026: la pantalla dividida admite hasta 4 jugadores (cuadrícula 2 × 2; con 3, el cuarto cuadrante lleva
   el minimapa). Para que el equipo anfitrión no se caliente: con 3 o 4 jugadores, calidad Baja sin mapa de
   sombras y resolución ≤ 1,25×; pausa sin redibujar; resultados a 30 fps; y paso automático a 30 fps estables si
   ni con la resolución al mínimo llega a 60.
