const test = require('node:test');
const assert = require('node:assert');
const { cargarApp } = require('./helpers/cargar-app');

// La partida en curso se guarda en localStorage para sobrevivir al cierre de
// la app. Lo que llega de ahí es texto que pudo quedar a medias o venir de una
// versión anterior, así que lo importante de estos tests es que un dato roto
// nunca deje la app en un estado imposible: ante la duda, partida limpia.

function partidaEnCurso(app) {
    app.Estado.tipoJugador = [0, 1];
    app.guardarHistorial();
    app.Estado.tablero.hacerJugada(4); // X en el centro
    app.guardarHistorial();
    app.Estado.tablero.hacerJugada(0); // O en la esquina
    app.Estado.marcador = [1, 2, 0];
    app.Estado.modoTorneo = true;
    app.Estado.bestOf = 5;
    app.Estado.timerActivo = true;
    app.Estado.tiempoLimite = 30;
}

test('la partida en curso se guarda y se recupera igual', () => {
    const app = cargarApp();
    partidaEnCurso(app);
    app.guardarSesion();

    // Otra sesión de la app, arrancando con lo que quedó guardado
    const otra = cargarApp(app.almacen.datos);
    assert.strictEqual(otra.restaurarSesion(), true);

    assert.deepStrictEqual(otra.Estado.tablero.celdas, [2, 0, 0, 0, 1, 0, 0, 0, 0]);
    assert.strictEqual(otra.Estado.tablero.turno, 1);
    assert.strictEqual(otra.Estado.historial.length, 2);
    assert.deepStrictEqual(otra.Estado.marcador, [1, 2, 0]);
    assert.strictEqual(otra.Estado.modoTorneo, true);
    assert.strictEqual(otra.Estado.bestOf, 5);
    assert.strictEqual(otra.Estado.timerActivo, true);
    assert.strictEqual(otra.Estado.tiempoLimite, 30);
});

test('el historial recuperado son tableros de verdad, no objetos planos', () => {
    const app = cargarApp();
    partidaEnCurso(app);
    app.guardarSesion();

    const otra = cargarApp(app.almacen.datos);
    otra.restaurarSesion();

    // Si fuesen objetos planos, deshacerJugada() los pondría como tablero y
    // reventaría al llamar a cualquier método
    const previo = otra.Estado.historial[otra.Estado.historial.length - 1];
    assert.strictEqual(typeof previo.hacerJugada, 'function');
    assert.strictEqual(typeof previo.celdasLibres, 'function');
    assert.strictEqual(previo.terminado, false);
});

test('una partida terminada no se reanuda, pero sus ajustes sí se conservan', () => {
    const app = cargarApp();
    app.Estado.tipoJugador = [0, 0];
    [0, 3, 1, 4, 2].forEach(c => app.Estado.tablero.hacerJugada(c)); // X gana 0-1-2
    assert.ok(app.Estado.tablero.terminado);
    app.Estado.marcador = [0, 3, 1];
    app.Estado.modoTorneo = true;
    app.guardarSesion();

    const otra = cargarApp(app.almacen.datos);
    assert.strictEqual(otra.restaurarSesion(), false, 'no se reanuda una partida acabada');
    assert.deepStrictEqual(otra.Estado.marcador, [0, 3, 1], 'el marcador sí se mantiene');
    assert.strictEqual(otra.Estado.modoTorneo, true, 'y el modo torneo también');
});

test('una sesión corrupta, de otra versión o ausente se ignora sin romper nada', () => {
    const casos = {
        'sin nada guardado': undefined,
        'texto que no es JSON': '{roto',
        'otra versión': JSON.stringify({ v: 99, tablero: { celdas: new Array(9).fill(0), turno: 1, ganador: 0 } }),
        'tablero de tamaño imposible': JSON.stringify({ v: 1, tablero: { celdas: [0, 1], turno: 1, ganador: 0 } }),
        'celdas con valores inventados': JSON.stringify({ v: 1, tablero: { celdas: new Array(9).fill(7), turno: 1, ganador: 0 } }),
        'turno fuera de rango': JSON.stringify({ v: 1, tablero: { celdas: new Array(9).fill(0), turno: 5, ganador: 0 } })
    };

    for (const [nombre, valor] of Object.entries(casos)) {
        const app = cargarApp(valor === undefined ? {} : { Sesion: valor });
        assert.strictEqual(app.restaurarSesion(), false, nombre);
        assert.deepStrictEqual(app.Estado.tablero.celdas, new Array(9).fill(0),
            `${nombre}: el tablero debe quedar limpio`);
    }
});

test('las entradas rotas del historial se descartan sin perder las buenas', () => {
    const bueno = { celdas: new Array(9).fill(0), turno: 1, ganador: 0 };
    const app = cargarApp({
        Sesion: JSON.stringify({
            v: 1,
            tablero: { celdas: [1, 0, 0, 0, 2, 0, 0, 0, 0], turno: 1, ganador: 0 },
            historial: [bueno, { celdas: 'no soy un tablero' }, null, bueno]
        })
    });

    assert.strictEqual(app.restaurarSesion(), true);
    assert.strictEqual(app.Estado.historial.length, 2);
});
