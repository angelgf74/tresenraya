const test = require('node:test');
const assert = require('node:assert');
const { cargarJuego, jugarPartidaIA, jugar } = require('./helpers/cargar-juego');

const { Tablero, Juego } = cargarJuego();

const PERFECTA = 9;   // profundidad que agota el árbol de juego
const APERTURAS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

test('mejorJugada devuelve -1 con el tablero lleno', () => {
    const t = jugar(new Tablero(), [0, 1, 2, 4, 3, 5, 7, 6, 8]);
    assert.strictEqual(Juego.mejorJugada(t, PERFECTA), -1);
});

test('mejorJugada devuelve siempre una celda libre', () => {
    const t = jugar(new Tablero(), [4, 0, 8]);
    const elegida = Juego.mejorJugada(t, PERFECTA);
    assert.ok(t.celdasLibres().includes(elegida), `${elegida} no está libre`);
});

test('remata cuando tiene la victoria a un movimiento', () => {
    // X en 0 y 1; le toca a X y debe cerrar en 2
    const t = jugar(new Tablero(), [0, 4, 1, 5]);
    assert.strictEqual(t.turno, 1);
    assert.strictEqual(Juego.mejorJugada(t, PERFECTA), 2);
});

test('bloquea la victoria inmediata del rival', () => {
    // X amenaza 0-1-2; le toca a O, que debe tapar el 2
    const t = jugar(new Tablero(), [0, 4, 1]);
    assert.strictEqual(t.turno, 2);
    assert.strictEqual(Juego.mejorJugada(t, PERFECTA), 2);
});

test('con jugadas empatadas, la IA varía la elección en vez de repetir siempre la misma', () => {
    // Desde el tablero vacío, las 9 aperturas empatan a valor minimax (todas
    // acaban en tablas contra rival perfecto): si la elección fuera
    // determinista, la partida se repetiría siempre igual.
    const elegidas = new Set();
    for (let i = 0; i < 50; i++) {
        elegidas.add(Juego.mejorJugada(new Tablero(), PERFECTA));
    }
    assert.ok(elegidas.size > 1, `siempre eligió la misma celda: ${[...elegidas]}`);
});

test('juego perfecto contra juego perfecto siempre acaba en tablas', () => {
    // Sin primera jugada forzada y con cada una de las nueve aperturas
    const libre = jugarPartidaIA(Tablero, Juego, PERFECTA, PERFECTA);
    assert.strictEqual(libre.ganador, -1);

    for (const apertura of APERTURAS) {
        const r = jugarPartidaIA(Tablero, Juego, PERFECTA, PERFECTA, apertura);
        assert.strictEqual(r.ganador, -1,
            `abriendo en ${apertura} debería quedar en tablas, no ganar ${r.ganador}`);
    }
});

test('la IA perfecta no pierde nunca, ni de primera ni de segunda', () => {
    for (const nivelRival of [1, 2, 3, 4, 5, 6, 9]) {
        // IA perfecta como X (mueve primera)
        const comoX = jugarPartidaIA(Tablero, Juego, PERFECTA, nivelRival);
        assert.notStrictEqual(comoX.ganador, 2,
            `la perfecta perdió como X contra el nivel ${nivelRival}`);

        // IA perfecta como O, contra cada apertura posible del rival
        for (const apertura of APERTURAS) {
            const comoO = jugarPartidaIA(Tablero, Juego, nivelRival, PERFECTA, apertura);
            assert.notStrictEqual(comoO.ganador, 1,
                `la perfecta perdió como O ante el nivel ${nivelRival} abriendo en ${apertura}`);
        }
    }
});

// R2-P6: la dificultad ya no depende de la profundidad de búsqueda (siempre
// juega a profundidad completa) sino de `probabilidadAzar`, la probabilidad
// de ignorar la mejor jugada. Fácil elige entre cualquier celda libre;
// Medio/Difícil solo entre las que no son una derrota forzada.
const NIVELES_UI = [
    { nombre: 'Fácil',     valor: 50, soloNoPerdedoras: false },
    { nombre: 'Medio',     valor: 25, soloNoPerdedoras: true },
    { nombre: 'Difícil',   valor: 10, soloNoPerdedoras: true },
    { nombre: 'Imposible', valor: 0,  soloNoPerdedoras: true }
];

// PRNG determinista (mulberry32): las pruebas de dificultad dependen del
// azar de Juego.jugada(), y sustituir Math.random por este generador con
// semilla fija hace que sean reproducibles en vez de intermitentes.
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function conAzarDeterminista(seed, fn) {
    const original = Math.random;
    Math.random = mulberry32(seed);
    try {
        return fn();
    } finally {
        Math.random = original;
    }
}

// El rival (X) juega perfecto con mejorJugada(); el nivel bajo prueba (O)
// juega con jugada(). Se repiten las 9 aperturas hasta completar
// `repeticiones` partidas, para que el azar tenga suficientes tiradas.
function derrotasNivel(valorNivel, soloNoPerdedoras, repeticiones) {
    let derrotas = 0;
    for (let i = 0; i < repeticiones; i++) {
        const t = new Tablero();
        t.hacerJugada(APERTURAS[i % APERTURAS.length]);
        while (!t.terminado) {
            const celda = t.turno === 1
                ? Juego.mejorJugada(t, PERFECTA)
                : Juego.jugada(t, PERFECTA, valorNivel / 100, soloNoPerdedoras);
            t.hacerJugada(celda);
        }
        if (t.ganador === 1) derrotas++;
    }
    return derrotas;
}

test('la dificultad no retrocede: cada nivel pierde igual o menos que el anterior', () => {
    const REPETICIONES = 300; // tiradas suficientes para que la diferencia entre niveles no sea ruido

    const derrotas = conAzarDeterminista(12345, () =>
        NIVELES_UI.map(n => ({ ...n, derrotas: derrotasNivel(n.valor, n.soloNoPerdedoras, REPETICIONES) }))
    );

    for (let i = 1; i < derrotas.length; i++) {
        const previo = derrotas[i - 1];
        const actual = derrotas[i];
        assert.ok(actual.derrotas <= previo.derrotas,
            `${actual.nombre} (azar ${actual.valor}%) pierde ${actual.derrotas}/${REPETICIONES}, ` +
            `peor que ${previo.nombre} (azar ${previo.valor}%) con ${previo.derrotas}/${REPETICIONES}`);
    }

    // El nivel máximo, además, no puede perder ninguna: probabilidadAzar es 0,
    // así que jugada() nunca entra en la rama de azar y equivale a mejorJugada()
    assert.strictEqual(derrotas[derrotas.length - 1].derrotas, 0);
});

test('los niveles del selector de la interfaz son los que se prueban aquí', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const html = fs.readFileSync(
        path.join(__dirname, '..', 'www', 'index.html'), 'utf8');

    const bloque = html.slice(html.indexOf('id="txtNivel"'), html.indexOf('</select>'));
    const valores = [...bloque.matchAll(/value="(\d+)"/g)].map(m => Number(m[1]));

    assert.deepStrictEqual(valores, NIVELES_UI.map(n => n.valor),
        'si cambian los valores de probabilidad del selector, actualiza también el test de dificultad');
});

test('jugada(): en Fácil el azar puede ser cualquier celda libre; en el resto, solo no perdedoras', () => {
    // Posición con una derrota forzada disponible: X en 0-1 amenaza, O no ha
    // tapado el 2. Si O (turno) juega algo que no sea 2, pierde seguro.
    const base = jugar(new Tablero(), [0, 4, 1]);
    assert.strictEqual(base.turno, 2);

    conAzarDeterminista(1, () => {
        // probabilidadAzar=1 fuerza siempre la rama de azar
        let vioNoOptima = false;
        for (let i = 0; i < 200; i++) {
            const celda = Juego.jugada(base, PERFECTA, 1, true);
            assert.strictEqual(celda, 2, 'soloNoPerdedoras debería excluir toda celda salvo el bloqueo');
            if (celda !== 2) vioNoOptima = true;
        }
        assert.ok(!vioNoOptima);
    });

    conAzarDeterminista(2, () => {
        const vistas = new Set();
        for (let i = 0; i < 200; i++) {
            vistas.add(Juego.jugada(base, PERFECTA, 1, false));
        }
        assert.ok(vistas.size > 1,
            `con soloNoPerdedoras=false debería poder elegir celdas perdedoras también: ${[...vistas]}`);
    });
});
