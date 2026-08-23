// www/js/game.js está escrito para el navegador: declara Tablero, Juego y
// LINEAS como globales, sin exports. En vez de ensuciar el fichero de
// producción con código de módulos que Cordova no necesita, se evalúa en un
// contexto de VM y se recogen las globales que declara.
//
// Cada llamada devuelve un contexto nuevo, así que los tests no comparten
// estado entre sí.

const fs = require('node:fs');
const path = require('node:path');

const RUTA_GAME = path.join(__dirname, '..', '..', 'www', 'js', 'game.js');

function cargarJuego() {
    const codigo = fs.readFileSync(RUTA_GAME, 'utf8');

    // Se usa `new Function` y no `vm.runInContext` a propósito: un contexto de
    // VM es otro realm, y los arrays que crease el juego tendrían un
    // Array.prototype distinto, con lo que assert.deepStrictEqual los daría por
    // diferentes aunque su contenido coincidiese. `new Function` evalúa en el
    // realm del propio proceso y devuelve enlaces frescos en cada llamada.
    const fabrica = new Function(codigo + '\n;return { Tablero, Juego, LINEAS };');
    return fabrica();
}

// Juega una partida completa entre dos IAs y devuelve el resultado.
// profundidadX / profundidadO son los niveles de cada bando.
function jugarPartidaIA(Tablero, Juego, profundidadX, profundidadO, primeraJugada) {
    const t = new Tablero();
    const jugadas = [];

    if (primeraJugada !== undefined) {
        t.hacerJugada(primeraJugada);
        jugadas.push(primeraJugada);
    }
    while (!t.terminado) {
        const profundidad = t.turno === 1 ? profundidadX : profundidadO;
        const celda = Juego.mejorJugada(t, profundidad);
        jugadas.push(celda);
        t.hacerJugada(celda);
    }
    return { ganador: t.ganador, jugadas };
}

// Coloca una secuencia de jugadas alternando turnos desde un tablero vacío.
function jugar(t, celdas) {
    celdas.forEach(c => t.hacerJugada(c));
    return t;
}

module.exports = { cargarJuego, jugarPartidaIA, jugar };
