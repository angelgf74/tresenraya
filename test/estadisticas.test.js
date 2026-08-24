const test = require('node:test');
const assert = require('node:assert');
const { cargarApp } = require('./helpers/cargar-app');

// Las estadísticas globales van por símbolo (X/O), pero el desglose contra la
// IA va desde el punto de vista del humano: da igual que juegue con X o con O,
// "ganadas" son las suyas. Es justo donde es fácil equivocarse de signo.

const X = 1, O = 2, TABLAS = -1;

test('las partidas entre dos humanos no cuentan en el desglose contra la IA', () => {
    const app = cargarApp();
    app.Estado.tipoJugador = [0, 0];

    app.anotarEstadisticas(X);
    app.anotarEstadisticas(TABLAS);

    assert.strictEqual(app.Estado.estadisticas.jugadas, 2);
    assert.strictEqual(app.Estado.estadisticas.victoriasX, 1);
    assert.strictEqual(app.Estado.estadisticas.tablas, 1);
    assert.deepStrictEqual(app.Estado.estadisticas.vsIA, {}, 'sin IA no hay nada que desglosar');
});

test('con el humano jugando de X, ganar X cuenta como victoria suya', () => {
    const app = cargarApp();
    app.Estado.tipoJugador = [0, 1];      // humano X, IA O
    app.Estado.nivel = app.NIVEL_DIFICIL;

    app.anotarEstadisticas(X);
    app.anotarEstadisticas(O);
    app.anotarEstadisticas(TABLAS);

    assert.deepStrictEqual(app.Estado.estadisticas.vsIA[app.NIVEL_DIFICIL],
        { jugadas: 3, ganadas: 1, perdidas: 1, tablas: 1 });
});

test('con el humano jugando de O, ganar X cuenta como derrota suya', () => {
    const app = cargarApp();
    app.Estado.tipoJugador = [1, 0];      // IA X, humano O
    app.Estado.nivel = app.NIVEL_DIFICIL;

    app.anotarEstadisticas(X);            // gana la IA
    app.anotarEstadisticas(O);            // gana el humano
    app.anotarEstadisticas(O);

    assert.deepStrictEqual(app.Estado.estadisticas.vsIA[app.NIVEL_DIFICIL],
        { jugadas: 3, ganadas: 2, perdidas: 1, tablas: 0 },
        'el signo depende de quién es el humano, no del símbolo');
    // Las globales siguen contando por símbolo, no por persona
    assert.strictEqual(app.Estado.estadisticas.victoriasO, 2);
});

test('cada nivel lleva su propia cuenta', () => {
    const app = cargarApp();
    app.Estado.tipoJugador = [0, 1];

    app.Estado.nivel = app.NIVEL_FACIL;
    app.anotarEstadisticas(X);
    app.anotarEstadisticas(X);
    app.Estado.nivel = app.NIVEL_IMPOSIBLE;
    app.anotarEstadisticas(TABLAS);

    assert.strictEqual(app.Estado.estadisticas.vsIA[app.NIVEL_FACIL].ganadas, 2);
    assert.strictEqual(app.Estado.estadisticas.vsIA[app.NIVEL_IMPOSIBLE].tablas, 1);
    assert.strictEqual(app.Estado.estadisticas.vsIA[app.NIVEL_MEDIO], undefined);
    assert.strictEqual(app.Estado.estadisticas.jugadas, 3, 'el total las suma todas');
});

test('unas estadísticas guardadas antes del desglose se conservan y no rompen', () => {
    // Formato anterior a R3: sin vsIA
    const app = cargarApp({
        Estadisticas: JSON.stringify({ jugadas: 51, victoriasX: 10, victoriasO: 17, tablas: 24 })
    });
    app.cargarPrefs();

    assert.strictEqual(app.Estado.estadisticas.jugadas, 51, 'el histórico no se tira');
    assert.deepStrictEqual(app.Estado.estadisticas.vsIA, {}, 'el desglose empieza de cero');

    app.Estado.tipoJugador = [0, 1];
    app.Estado.nivel = app.NIVEL_MEDIO;
    app.anotarEstadisticas(X);

    assert.strictEqual(app.Estado.estadisticas.jugadas, 52);
    assert.strictEqual(app.Estado.estadisticas.vsIA[app.NIVEL_MEDIO].ganadas, 1);
});

test('los niveles del desglose son los cuatro del selector, de fácil a imposible', () => {
    const app = cargarApp();
    assert.deepStrictEqual(app.NIVELES.map(n => n.valor),
        [app.NIVEL_FACIL, app.NIVEL_MEDIO, app.NIVEL_DIFICIL, app.NIVEL_IMPOSIBLE]);
});
