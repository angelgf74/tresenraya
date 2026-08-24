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

// localStorage de mentira con memoria, para poder probar el guardado y la
// restauración de la sesión sin un navegador.
function almacenFalso(inicial) {
    const datos = Object.assign({}, inicial);
    return {
        datos,
        getItem: (k) => (k in datos ? datos[k] : null),
        setItem: (k, v) => { datos[k] = String(v); }
    };
}

function cargarApp(prefsIniciales) {
    const { Tablero, Juego } = cargarJuego();
    const codigo = fs.readFileSync(RUTA_APP, 'utf8');
    const noop = () => {};
    const almacen = almacenFalso(prefsIniciales);

    const fabrica = new Function(
        'Tablero', 'Juego', 'document', 'window', 'localStorage', 'navigator',
        't', 'aplicarIdioma', 'playSound', 'setSoundVolume', 'setSoundMuted',
        codigo + '\n;return { Estado, puedeDeshacer, esIA, hayIA, guardarHistorial,'
               + ' guardarSesion, restaurarSesion, CLAVE_SESION, cargarPrefs,'
               + ' anotarEstadisticas, jugadorHumano, NIVELES,'
               + ' NIVEL_FACIL, NIVEL_MEDIO, NIVEL_DIFICIL, NIVEL_IMPOSIBLE };'
    );

    const app = fabrica(
        Tablero,
        Juego,
        { addEventListener: noop },
        { addEventListener: noop },   // sin window.cordova: toma el camino de navegador
        almacen,
        { language: 'es' },
        (clave) => clave,
        noop, noop, noop, noop
    );
    app.almacen = almacen;
    return app;
}

module.exports = { cargarApp };
