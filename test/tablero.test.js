const test = require('node:test');
const assert = require('node:assert');
const { cargarJuego, jugar } = require('./helpers/cargar-juego');

const { Tablero, LINEAS } = cargarJuego();

test('tablero nuevo: vacío, empieza X y no está terminado', () => {
    const t = new Tablero();
    assert.deepStrictEqual(t.celdas, new Array(9).fill(0));
    assert.strictEqual(t.turno, 1);
    assert.strictEqual(t.ganador, 0);
    assert.strictEqual(t.terminado, false);
});

test('hacerJugada alterna el turno', () => {
    const t = new Tablero();
    assert.strictEqual(t.hacerJugada(0), true);
    assert.strictEqual(t.celdas[0], 1);
    assert.strictEqual(t.turno, 2);

    assert.strictEqual(t.hacerJugada(1), true);
    assert.strictEqual(t.celdas[1], 2);
    assert.strictEqual(t.turno, 1);
});

test('hacerJugada rechaza celda ocupada y fuera de rango', () => {
    const t = new Tablero();
    t.hacerJugada(4);

    assert.strictEqual(t.hacerJugada(4), false, 'celda ocupada');
    assert.strictEqual(t.hacerJugada(-1), false, 'índice negativo');
    assert.strictEqual(t.hacerJugada(9), false, 'índice fuera del tablero');
    assert.strictEqual(t.turno, 2, 'un rechazo no debe consumir turno');
});

test('hacerJugada no admite más jugadas con la partida terminada', () => {
    const t = jugar(new Tablero(), [0, 3, 1, 4, 2]);   // X gana la fila superior
    assert.strictEqual(t.terminado, true);
    assert.strictEqual(t.hacerJugada(5), false);
    assert.strictEqual(t.celdas[5], 0);
});

// Devuelve tres celdas del conjunto dado que no formen línea, para que el
// rival las ocupe sin ganar antes de tiempo.
function trioSinLinea(celdas) {
    for (let i = 0; i < celdas.length; i++)
        for (let j = i + 1; j < celdas.length; j++)
            for (let k = j + 1; k < celdas.length; k++) {
                const trio = [celdas[i], celdas[j], celdas[k]];
                if (!LINEAS.some(l => l.every(c => trio.includes(c)))) return trio;
            }
    throw new Error('no hay tres celdas sin línea en ' + celdas.join(','));
}

test('detecta la victoria en las ocho líneas, para ambos jugadores', () => {
    for (const linea of LINEAS) {
        for (const jugador of [1, 2]) {
            const t = new Tablero();
            const ajenas = trioSinLinea([0,1,2,3,4,5,6,7,8].filter(c => !linea.includes(c)));

            // El ganador completa su línea en su tercera jugada; al rival solo
            // le da tiempo a colocar dos fichas antes, que nunca hacen línea.
            if (jugador === 1) {
                [0, 1, 2].forEach(i => {
                    t.hacerJugada(linea[i]);
                    if (!t.terminado) t.hacerJugada(ajenas[i]);
                });
            } else {
                [0, 1, 2].forEach(i => {
                    t.hacerJugada(ajenas[i]);
                    t.hacerJugada(linea[i]);
                });
            }

            assert.strictEqual(t.ganador, jugador,
                `la línea ${linea.join('')} debería ganarla el jugador ${jugador}`);
            assert.deepStrictEqual(t.lineaGanadora(), linea);
        }
    }
});

test('detecta las tablas con el tablero lleno', () => {
    // X O X / X O O / O X X  -> sin tres en raya
    const t = jugar(new Tablero(), [0, 1, 2, 4, 3, 5, 7, 6, 8]);
    assert.strictEqual(t.celdas.every(c => c !== 0), true, 'tablero lleno');
    assert.strictEqual(t.ganador, -1);
    assert.strictEqual(t.terminado, true);
    assert.strictEqual(t.lineaGanadora(), null);
});

test('lineaGanadora devuelve null mientras no hay ganador', () => {
    const t = jugar(new Tablero(), [0, 4]);
    assert.strictEqual(t.lineaGanadora(), null);
});

test('celdasLibres refleja las celdas vacías', () => {
    const t = new Tablero();
    assert.strictEqual(t.celdasLibres().length, 9);

    jugar(t, [0, 8]);
    assert.deepStrictEqual(t.celdasLibres(), [1, 2, 3, 4, 5, 6, 7]);
});

test('clonar hace copia profunda: mutar el clon no toca el original', () => {
    const t = jugar(new Tablero(), [0, 4]);
    const clon = t.clonar();

    assert.deepStrictEqual(clon.celdas, t.celdas);
    assert.strictEqual(clon.turno, t.turno);

    clon.hacerJugada(8);
    assert.strictEqual(t.celdas[8], 0, 'el original no debe cambiar');
    assert.notStrictEqual(clon.celdas, t.celdas, 'no debe compartir el array');
});

test('reset vacía el tablero y respeta el turno inicial', () => {
    const t = jugar(new Tablero(), [0, 3, 1, 4, 2]);

    t.reset(2);
    assert.deepStrictEqual(t.celdas, new Array(9).fill(0));
    assert.strictEqual(t.turno, 2);
    assert.strictEqual(t.ganador, 0);

    t.reset();
    assert.strictEqual(t.turno, 1, 'sin argumento debe empezar el jugador 1');
});
