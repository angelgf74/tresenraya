// www/js/app.js está escrito para el navegador y para Cordova: declara Estado y
// las funciones del juego como globales y, al final del fichero, registra los
// listeners de arranque. Se evalúa con `new Function` igual que game.js (ver
// cargar-juego.js), pasándole como parámetros los mínimos sustitutos que hacen
// falta para llegar al final sin tocar el DOM.
//
// Esto solo permite probar la lógica que NO renderiza: el resto de app.js llama
// a document.getElementById en cada paso y necesitaría un DOM de verdad.

const fs = require('node:fs');
const path = require('node:path');
const { cargarJuego } = require('./cargar-juego');

const RUTA_APP = path.join(__dirname, '..', '..', 'www', 'js', 'app.js');

function cargarApp() {
    const { Tablero, Juego } = cargarJuego();
    const codigo = fs.readFileSync(RUTA_APP, 'utf8');
    const noop = () => {};

    const fabrica = new Function(
        'Tablero', 'Juego', 'document', 'window', 'localStorage', 'navigator',
        't', 'aplicarIdioma', 'playSound', 'setSoundVolume', 'setSoundMuted',
        codigo + '\n;return { Estado, puedeDeshacer, esIA, hayIA, guardarHistorial };'
    );

    return fabrica(
        Tablero,
        Juego,
        { addEventListener: noop },
        { addEventListener: noop },   // sin window.cordova: toma el camino de navegador
        { getItem: () => null, setItem: noop },
        { language: 'es' },
        (clave) => clave,
        noop, noop, noop, noop
    );
}

module.exports = { cargarApp };
