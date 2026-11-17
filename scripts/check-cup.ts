// Comprueba los puntos, los desempates y la parrilla de la copa: `npm run check:copa`.
import { Cup, CUP_POINTS } from '../src/game/cup';
import type { Species } from '../src/core/events';

let fails = 0;
const eq = (what: string, got: unknown, want: unknown): void => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FALLA'} ${what}${ok ? '' : `\n      obtenido: ${JSON.stringify(got)}\n      esperado: ${JSON.stringify(want)}`}`);
};

const all: Species[] = ['perro', 'esponja', 'raton', 'zorro', 'dino', 'robot'];
const entrants = all.map((c) => ({ char: c, name: c }));
const race = (...order: Species[]): { char: Species; name: string }[] => order.map((c) => ({ char: c, name: c }));
const pts = (c: Cup): Record<string, number> => Object.fromEntries(c.standings().map((r): [string, number] => [r.char, r.points]).sort((a, b) => a[0].localeCompare(b[0])));
const sorted = (o: Record<string, number>): Record<string, number> => Object.fromEntries(Object.entries(o).sort((a, b) => a[0].localeCompare(b[0])));

eq('tabla de puntos', CUP_POINTS, [10, 8, 6, 4, 3, 2]);

// 1. Suma simple.
const c = new Cup(entrants);
eq('sin carreras no hay parrilla de copa', c.gridOrder(), null);
eq('primera pista', c.trackId, 'cuarto');
c.addRace(race('zorro', 'dino', 'perro', 'raton', 'esponja', 'robot'));
eq('puntos tras la carrera 1', pts(c), sorted({ zorro: 10, dino: 8, perro: 6, raton: 4, esponja: 3, robot: 2 }));
eq('segunda pista', c.trackId, 'bano');
eq('parrilla: el último sale primero', c.gridOrder(), ['robot', 'esponja', 'raton', 'perro', 'dino', 'zorro']);
c.addRace(race('robot', 'esponja', 'raton', 'perro', 'dino', 'zorro'));
eq('puntos tras la carrera 2', pts(c), sorted({ robot: 12, esponja: 11, raton: 10, perro: 10, zorro: 12, dino: 11 }));
c.addRace(race('perro', 'raton', 'zorro', 'dino', 'esponja', 'robot'));
eq('total de puntos repartidos', c.standings().reduce((a, r) => a + r.points, 0), 33 * 3);
eq('copa terminada', c.done, true);

// 2. Desempates: mismos puntos → más victorias → mejor puesto en la última carrera.
const t = new Cup(entrants);
t.addRace(race('zorro', 'dino', 'perro', 'raton', 'esponja', 'robot')); // zorro 10, dino 8
t.addRace(race('dino', 'zorro', 'perro', 'raton', 'esponja', 'robot')); // zorro 18, dino 18 (1 victoria cada uno)
const top2 = t.standings().slice(0, 2).map((r) => r.char);
eq('empate a puntos y victorias: gana el mejor en la última carrera', top2, ['dino', 'zorro']);
// Más victorias: A gana una y luego es 6.º dos veces (10 + 2 + 2); B es 3.º, 4.º, 4.º (6 + 4 + 4). Empatan a 14.
const v = new Cup(entrants);
v.addRace(race('zorro', 'raton', 'perro', 'dino', 'esponja', 'robot'));
v.addRace(race('raton', 'esponja', 'robot', 'perro', 'dino', 'zorro'));
v.addRace(race('raton', 'esponja', 'robot', 'perro', 'dino', 'zorro'));
const zorro = v.standings().find((r) => r.char === 'zorro')!;
const perro = v.standings().find((r) => r.char === 'perro')!;
eq('empate a 14: puntos', [zorro.points, perro.points], [14, 14]);
eq('empate a puntos: gana quien tiene más victorias (aunque llegó peor en la última)', zorro.rank < perro.rank, true);
// Más puntos manda sobre más victorias.
const x = new Cup(entrants);
x.addRace(race('zorro', 'perro', 'dino', 'raton', 'esponja', 'robot')); // zorro 10, perro 8
x.addRace(race('zorro', 'perro', 'dino', 'raton', 'esponja', 'robot')); // zorro 20 (2 v), perro 16
x.addRace(race('perro', 'dino', 'raton', 'esponja', 'robot', 'zorro')); // zorro 22 (2 v), perro 26 (1 v)
eq('el de más puntos gana aunque tenga menos victorias', x.standings()[0].char, 'perro');

// 3. Flechas: ninguna tras la primera carrera; luego, rango anterior y nuevo.
const f0 = new Cup(entrants);
f0.addRace(race('robot', 'dino', 'perro', 'raton', 'esponja', 'zorro'));
eq('sin flechas tras la primera carrera', f0.standings().every((r) => r.prevRank === r.rank), true);
const f = new Cup(entrants);
f.addRace(race('zorro', 'dino', 'perro', 'raton', 'esponja', 'robot'));
f.addRace(race('robot', 'esponja', 'raton', 'perro', 'dino', 'zorro'));
const robot = f.standings().find((r) => r.char === 'robot')!;
eq('robot venía 6.º y sube', [robot.prevRank, robot.rank < robot.prevRank], [6, true]);

// 4. Viaja por la red sin perder nada.
const back = Cup.fromJSON(JSON.parse(JSON.stringify(f.toJSON())));
eq('copia por la red', back.standings(), f.standings());

console.log(fails ? `\n${fails} comprobación(es) fallaron` : '\nTodo bien');
process.exit(fails ? 1 : 0);
