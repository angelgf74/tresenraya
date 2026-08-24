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

// Regresión del bug encontrado en la ronda 1: "Medio" estaba en profundidad 4 y
// perdía 4 de las 9 aperturas contra juego perfecto, más que "Fácil"
// (profundidad 2, 2 de 9). Un nivel superior nunca debe jugar peor que el
// inferior. Se mide con la IA de O contra un X perfecto en las 9 aperturas.
function derrotasContraPerfecto(profundidad) {
    return APERTURAS.filter(apertura =>
        jugarPartidaIA(Tablero, Juego, PERFECTA, profundidad, apertura).ganador === 1
    ).length;
}

test('la dificultad no retrocede: cada nivel pierde igual o menos que el anterior', () => {
    const NIVELES = [
        { nombre: 'Fácil',     profundidad: 2 },
        { nombre: 'Medio',     profundidad: 3 },
        { nombre: 'Difícil',   profundidad: 6 },
        { nombre: 'Imposible', profundidad: 9 }
    ];

    const derrotas = NIVELES.map(n => ({ ...n, derrotas: derrotasContraPerfecto(n.profundidad) }));

    for (let i = 1; i < derrotas.length; i++) {
        const previo = derrotas[i - 1];
        const actual = derrotas[i];
        assert.ok(actual.derrotas <= previo.derrotas,
            `${actual.nombre} (prof. ${actual.profundidad}) pierde ${actual.derrotas}/9, ` +
            `peor que ${previo.nombre} (prof. ${previo.profundidad}) con ${previo.derrotas}/9`);
    }

    // El nivel máximo, además, no puede perder ninguna
    assert.strictEqual(derrotas[derrotas.length - 1].derrotas, 0);
});

test('los niveles del selector de la interfaz son los que se prueban aquí', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const html = fs.readFileSync(
        path.join(__dirname, '..', 'www', 'index.html'), 'utf8');

    const bloque = html.slice(html.indexOf('id="txtNivel"'), html.indexOf('</select>'));
    const valores = [...bloque.matchAll(/value="(\d+)"/g)].map(m => Number(m[1]));

    assert.deepStrictEqual(valores, [2, 3, 6, 9],
        'si cambian las profundidades del selector, actualiza también el test de dificultad');
});
