const test = require('node:test');
const assert = require('node:assert');
const { cargarPartida } = require('./helpers/cargar-app');

// Estos tests recorren los flujos completos de app.js —jugada, respuesta de la
// IA, deshacer, fin de partida— sobre un DOM de mentira. Son los flujos donde
// aparecieron los dos bugs de la ronda 3, que ninguna prueba de funciones
// sueltas habría cazado.

const esperar = (ms) => new Promise(r => setTimeout(r, ms));
const dibujo = (app) => app.Estado.tablero.celdas.map(n => '.XO'[n]).join('');
const fichas = (app) => app.Estado.tablero.celdas.filter(c => c !== 0).length;

test('una jugada humana desencadena la respuesta de la IA', async () => {
    const app = await cargarPartida([0, 1], 0);   // humano X contra IA imposible

    await app.onCeldaClick(4);

    assert.strictEqual(app.Estado.tablero.celdas[4], 1, 'la ficha humana entra donde se toca');
    assert.strictEqual(fichas(app), 2, 'y la IA contesta');
    assert.strictEqual(app.Estado.tablero.turno, 1, 'devolviendo el turno al humano');
    assert.strictEqual(app.Estado.esperandoIA, false);
});

test('reiniciar mientras la IA piensa no deja una ficha fantasma', async () => {
    const app = await cargarPartida([0, 1], 0);

    // No se espera a que termine: la IA se queda "pensando" 380 ms
    const enVuelo = app.onCeldaClick(4);
    await esperar(120);

    // A media espera se empieza otra partida, como al cambiar de nivel o de
    // tipo de jugador. La jugada en vuelo ya no corresponde a este tablero.
    app.Estado.tipoJugador = [0, 0];
    await app.iniciarJuego();
    await enVuelo;
    await esperar(400);   // margen por si la jugada abortada siguiera viva

    assert.strictEqual(dibujo(app), '.........',
        'la partida nueva empieza vacía: la IA no llega a colocar nada');
});

test('deshacer contra la IA retira su respuesta y la jugada propia, y deja el tablero jugable', async () => {
    const app = await cargarPartida([0, 1], 0);

    await app.onCeldaClick(4);
    assert.strictEqual(fichas(app), 2);

    await app.deshacerJugada();

    assert.strictEqual(dibujo(app), '.........', 'se retiran las dos jugadas');
    assert.strictEqual(app.Estado.tablero.turno, 1, 'y le toca al humano');
    assert.strictEqual(app.puedeDeshacer(), false, 'ya no queda nada que deshacer');

    // Lo que fallaba antes: el tablero quedaba bloqueado esperando a la IA
    await app.onCeldaClick(0);
    assert.strictEqual(app.Estado.tablero.celdas[0], 1, 'se puede seguir jugando');
});

test('al terminar la partida se anotan marcador y estadísticas', async () => {
    const app = await cargarPartida([0, 0]);      // humano contra humano

    for (const c of [0, 3, 1, 4, 2]) await app.onCeldaClick(c);   // X gana 0-1-2

    assert.strictEqual(app.Estado.tablero.ganador, 1);
    assert.deepStrictEqual(app.Estado.marcador, [0, 1, 0], 'una victoria de X');
    assert.strictEqual(app.Estado.estadisticas.jugadas, 1);
    assert.strictEqual(app.Estado.estadisticas.victoriasX, 1);
    assert.deepStrictEqual(app.Estado.estadisticas.vsIA, {}, 'sin IA no hay desglose');
});

test('reiniciar durante la pausa del final no abre el modal sobre la partida nueva', async () => {
    const app = await cargarPartida([0, 0]);
    const modal = app.doc.getElementById('modalPartida');
    modal.style.display = 'none';

    // Las cuatro primeras jugadas se completan; la quinta termina la partida y
    // deja a refrescarEstado esperando 1600 ms antes de abrir el modal.
    for (const c of [0, 3, 1, 4]) await app.onCeldaClick(c);
    const ultima = app.onCeldaClick(2);

    await esperar(200);
    await app.iniciarJuego();     // se empieza otra antes de que abra el modal
    await ultima;
    await esperar(300);

    assert.strictEqual(modal.style.display, 'none',
        'el modal de la partida vieja no puede abrirse sobre el tablero nuevo');
    assert.strictEqual(app.Estado.estadisticas.jugadas, 1,
        'pero la partida sí se contó: terminó de verdad');
});
