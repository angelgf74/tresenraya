const test = require('node:test');
const assert = require('node:assert');
const { cargarApp } = require('./helpers/cargar-app');

// Regresión del bloqueo encontrado en la ronda 3: con la IA como jugador 1
// (X, mueve primera), la primera posición del historial tiene turno de IA.
// puedeDeshacer() solo miraba que el historial no estuviese vacío, así que
// ofrecía deshacer hasta esa posición — y el tablero quedaba esperando una
// jugada de IA que ya nadie dispara: celdas bloqueadas, botón oculto y
// partida congelada, sin más salida que cambiar de nivel o de jugador.
//
// La condición correcta es que quede en la pila alguna posición con turno
// humano, que es a la que deshacerJugada() sabe volver.

test('deshacer no se ofrece si en la pila solo quedan posiciones con turno de IA', () => {
    const app = cargarApp();
    app.Estado.tipoJugador = [1, 0]; // jugador 1 = IA (X), jugador 2 = humano (O)

    app.guardarHistorial();            // tablero vacío, turno de la IA
    app.Estado.tablero.hacerJugada(6); // juega la IA -> turno del humano

    assert.strictEqual(app.Estado.historial.length, 1);
    assert.strictEqual(app.puedeDeshacer(), false,
        'la única posición guardada es la de la IA: no hay nada a lo que volver');
});

test('deshacer se ofrece en cuanto la pila tiene una posición con turno humano', () => {
    const app = cargarApp();
    app.Estado.tipoJugador = [1, 0];

    app.guardarHistorial();            // tablero vacío, turno de la IA
    app.Estado.tablero.hacerJugada(6); // juega la IA -> turno del humano
    app.guardarHistorial();            // posición con turno humano
    app.Estado.tablero.hacerJugada(4); // juega el humano -> turno de la IA

    assert.strictEqual(app.puedeDeshacer(), true);
});

test('deshacer está disponible tras cualquier jugada en humano vs humano', () => {
    const app = cargarApp();
    app.Estado.tipoJugador = [0, 0];

    app.guardarHistorial();
    app.Estado.tablero.hacerJugada(0);

    assert.strictEqual(app.puedeDeshacer(), true);
});

test('deshacer se bloquea mientras la IA piensa y con la partida terminada', () => {
    const app = cargarApp();
    app.Estado.tipoJugador = [0, 1]; // humano (X) contra IA (O)

    app.guardarHistorial();
    app.Estado.tablero.hacerJugada(0);
    assert.strictEqual(app.puedeDeshacer(), true);

    app.Estado.esperandoIA = true;
    assert.strictEqual(app.puedeDeshacer(), false, 'mientras la IA piensa');
    app.Estado.esperandoIA = false;

    // X completa la fila superior: 0-1-2
    app.Estado.tablero.hacerJugada(3);
    app.Estado.tablero.hacerJugada(1);
    app.Estado.tablero.hacerJugada(4);
    app.Estado.tablero.hacerJugada(2);

    assert.ok(app.Estado.tablero.terminado);
    assert.strictEqual(app.puedeDeshacer(), false, 'con la partida terminada');
});
