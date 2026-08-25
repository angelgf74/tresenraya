// www/js/app.js está escrito para el navegador y para Cordova: declara Estado y
// las funciones del juego como globales y, al final del fichero, registra los
// listeners de arranque. Se evalúa con `new Function` igual que game.js (ver
// cargar-juego.js), pasándole como parámetros los mínimos sustitutos que hacen
// falta para llegar al final sin tocar el DOM.
//
// Por defecto se le pasan un par de stubs y solo se prueba la lógica que no
// pinta nada. Con `conDom: true` se carga sobre el DOM de mentira de
// dom-falso.js y se pueden recorrer los flujos completos: jugada, respuesta de
// la IA, deshacer y fin de partida.

const fs = require('node:fs');
const path = require('node:path');
const { cargarJuego } = require('./cargar-juego');
const { crearDocumentoFalso } = require('./dom-falso');

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

// Con `conDom: true` se carga sobre un DOM de mentira (ver dom-falso.js) y se
// devuelven también los flujos completos, para poder probar una partida de
// principio a fin. Sin él basta un par de stubs y solo se prueba lo que no
// pinta nada.
function cargarApp(prefsIniciales, opciones) {
    const { conDom } = opciones || {};
    const { Tablero, Juego } = cargarJuego();
    const codigo = fs.readFileSync(RUTA_APP, 'utf8');
    const noop = () => {};
    const almacen = almacenFalso(prefsIniciales);
    const doc = conDom ? crearDocumentoFalso() : { addEventListener: noop };

    const fabrica = new Function(
        'Tablero', 'Juego', 'document', 'window', 'localStorage', 'navigator',
        't', 'aplicarIdioma', 'playSound', 'setSoundVolume', 'setSoundMuted',
        codigo + '\n;return { Estado, puedeDeshacer, esIA, hayIA, guardarHistorial,'
               + ' guardarSesion, restaurarSesion, CLAVE_SESION, cargarPrefs,'
               + ' anotarEstadisticas, jugadorHumano, NIVELES,'
               + ' NIVEL_FACIL, NIVEL_MEDIO, NIVEL_DIFICIL, NIVEL_IMPOSIBLE,'
               + ' iniciarJuego, jugadaIA, onCeldaClick, deshacerJugada,'
               + ' refrescarEstado, crearCeldasDOM, renderTodo, aceptarModal };'
    );

    const app = fabrica(
        Tablero,
        Juego,
        doc,
        { addEventListener: noop },   // sin window.cordova: toma el camino de navegador
        almacen,
        { language: 'es' },
        (clave) => clave,
        noop, noop, noop, noop
    );
    app.almacen = almacen;
    app.doc = doc;
    return app;
}

// Prepara una partida jugable: crea las celdas y arranca. Devuelve la app.
async function cargarPartida(tipoJugador, nivel, prefsIniciales) {
    const app = cargarApp(prefsIniciales, { conDom: true });
    app.crearCeldasDOM();
    if (tipoJugador) app.Estado.tipoJugador = tipoJugador;
    if (nivel !== undefined) app.Estado.nivel = nivel;
    await app.iniciarJuego();
    return app;
}

module.exports = { cargarApp, cargarPartida };
