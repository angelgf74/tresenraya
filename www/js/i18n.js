// ── Internacionalización ────────────────────────────────
// Diccionario simple clave -> texto por idioma. Los elementos estáticos del
// HTML se marcan con data-i18n (textContent), data-i18n-title (atributo
// title) o data-i18n-aria (aria-label); aplicarIdioma() los recorre y
// sustituye el texto. Las cadenas generadas dinámicamente en app.js llaman
// a t('clave', variables) directamente.

const TRADUCCIONES = {
    es: {
        tituloApp: 'Tres en Raya',
        cambiarTema: 'Cambiar tema',
        ayuda: 'Ayuda',
        cambiarIdioma: 'Change to English',
        volumen: 'Volumen',
        silenciar: 'Silenciar',
        activarSonido: 'Activar sonido',
        jugadorEsHumano: 'Jugador {n}: humano. Pulsa para cambiar a IA',
        jugadorEsIA: 'Jugador {n}: IA. Pulsa para cambiar a humano',
        nivelFacil: 'Fácil',
        nivelMedio: 'Medio',
        nivelDificil: 'Difícil',
        nivelImposible: 'Imposible',
        tableroAriaLabel: 'Tablero de juego',
        casillaVacia: 'Casilla {n}, vacía',
        casillaX: 'Casilla {n}, X',
        casillaO: 'Casilla {n}, O',
        deshacer: 'Deshacer',
        pensando: 'Pensando',
        reiniciarMarcador: 'Reiniciar marcador',
        temporizadorTurno: 'Temporizador de turno',
        modoTorneo: 'Modo torneo',
        estadisticas: 'Estadísticas',
        alMejorDe3: 'Al mejor de 3',
        alMejorDe5: 'Al mejor de 5',
        ariaResultadoPartida: 'Resultado de la partida',
        ariaResultadoTorneo: 'Resultado del torneo',
        partidaTerminada: 'Partida terminada',
        aceptar: 'Aceptar',
        tablas: 'TABLAS',
        ganador: '¡Ganador!',
        torneoTerminado: '¡Torneo terminado!',
        campeon: '¡Campeón!',
        nuevoTorneo: 'Nuevo torneo',
        borrarEstadisticas: 'Borrar estadísticas',
        cerrar: 'Cerrar',
        partidasJugadas: 'Partidas jugadas',
        victoriasX: 'Victorias X',
        victoriasO: 'Victorias O',
        tablasStats: 'Tablas',
        ayudaComoJugarTitulo: '¿Cómo jugar?',
        ayudaComoJugarTexto: 'Coloca tu ficha en una casilla vacía. Gana el primero en completar una fila, columna o diagonal. Si se llenan todas las casillas sin ganador, es un empate.',
        ayudaFichasTitulo: 'Fichas',
        ayudaFichasTexto: 'El jugador de la izquierda juega con <strong class="ayuda-x">X</strong> y el de la derecha con <strong class="ayuda-o">O</strong>. En cada nueva partida se alternan quién empieza.',
        ayudaTipoJugadorTitulo: 'Tipo de jugador',
        ayudaTipoJugadorTexto: 'Pulsa el icono de cada jugador para cambiar entre <strong>humano</strong> e <strong>IA</strong>. Siempre debe haber al menos un jugador humano.',
        ayudaNivelTitulo: 'Nivel de dificultad',
        ayudaNivelFacil: '<strong>Fácil</strong> — 2 jugadas por delante.',
        ayudaNivelMedio: '<strong>Medio</strong> — 3 jugadas por delante.',
        ayudaNivelDificil: '<strong>Difícil</strong> — 6 jugadas por delante.',
        ayudaNivelImposible: '<strong>Imposible</strong> — árbol de juego completo.',
        ayudaDeshacerTitulo: 'Deshacer',
        ayudaDeshacerTexto: 'En modo humano vs humano aparece el botón <strong>Deshacer</strong> para retirar la última ficha.',
        ayudaTemporizadorTitulo: 'Temporizador',
        ayudaTemporizadorTexto: 'Activa el reloj con el botón del reloj. Cuando el tiempo se agota, se coloca una ficha aleatoria. Elige entre 10, 15 o 30 segundos.',
        ayudaTorneoTitulo: 'Modo torneo',
        ayudaTorneoTexto: 'Juega al mejor de 3 o 5 partidas; gana quien antes alcance la mayoría de victorias.',
        pulsaAtrasSalir: 'Pulsa atrás otra vez para salir'
    },
    en: {
        tituloApp: 'Tic-Tac-Toe',
        cambiarTema: 'Toggle theme',
        ayuda: 'Help',
        cambiarIdioma: 'Cambiar a español',
        volumen: 'Volume',
        silenciar: 'Mute',
        activarSonido: 'Unmute',
        jugadorEsHumano: 'Player {n}: human. Tap to switch to AI',
        jugadorEsIA: 'Player {n}: AI. Tap to switch to human',
        nivelFacil: 'Easy',
        nivelMedio: 'Medium',
        nivelDificil: 'Hard',
        nivelImposible: 'Impossible',
        tableroAriaLabel: 'Game board',
        casillaVacia: 'Cell {n}, empty',
        casillaX: 'Cell {n}, X',
        casillaO: 'Cell {n}, O',
        deshacer: 'Undo',
        pensando: 'Thinking',
        reiniciarMarcador: 'Reset score',
        temporizadorTurno: 'Turn timer',
        modoTorneo: 'Tournament mode',
        estadisticas: 'Statistics',
        alMejorDe3: 'Best of 3',
        alMejorDe5: 'Best of 5',
        ariaResultadoPartida: 'Game result',
        ariaResultadoTorneo: 'Tournament result',
        partidaTerminada: 'Game over',
        aceptar: 'Accept',
        tablas: 'DRAW',
        ganador: 'Winner!',
        torneoTerminado: 'Tournament over!',
        campeon: 'Champion!',
        nuevoTorneo: 'New tournament',
        borrarEstadisticas: 'Clear statistics',
        cerrar: 'Close',
        partidasJugadas: 'Games played',
        victoriasX: 'X wins',
        victoriasO: 'O wins',
        tablasStats: 'Draws',
        ayudaComoJugarTitulo: 'How to play?',
        ayudaComoJugarTexto: 'Place your mark on an empty cell. The first to complete a row, column or diagonal wins. If every cell fills up with no winner, it\'s a draw.',
        ayudaFichasTitulo: 'Marks',
        ayudaFichasTexto: 'The player on the left plays <strong class="ayuda-x">X</strong> and the one on the right plays <strong class="ayuda-o">O</strong>. Each new game alternates who goes first.',
        ayudaTipoJugadorTitulo: 'Player type',
        ayudaTipoJugadorTexto: 'Tap each player\'s icon to switch between <strong>human</strong> and <strong>AI</strong>. There must always be at least one human player.',
        ayudaNivelTitulo: 'Difficulty level',
        ayudaNivelFacil: '<strong>Easy</strong> — 2 moves ahead.',
        ayudaNivelMedio: '<strong>Medium</strong> — 3 moves ahead.',
        ayudaNivelDificil: '<strong>Hard</strong> — 6 moves ahead.',
        ayudaNivelImposible: '<strong>Impossible</strong> — full game tree.',
        ayudaDeshacerTitulo: 'Undo',
        ayudaDeshacerTexto: 'In human vs human mode, an <strong>Undo</strong> button appears to take back the last move.',
        ayudaTemporizadorTitulo: 'Timer',
        ayudaTemporizadorTexto: 'Turn on the clock with the clock button. When time runs out, a random cell is played. Choose 10, 15 or 30 seconds.',
        ayudaTorneoTitulo: 'Tournament mode',
        ayudaTorneoTexto: 'Play best of 3 or 5 games; whoever reaches the majority of wins first takes the tournament.',
        pulsaAtrasSalir: 'Press back again to exit'
    }
};

function t(clave, vars) {
    const dic = TRADUCCIONES[Estado.idioma] || TRADUCCIONES.es;
    let texto = dic[clave] !== undefined ? dic[clave] : (TRADUCCIONES.es[clave] || clave);
    if (vars) {
        Object.keys(vars).forEach(k => { texto = texto.replace(`{${k}}`, vars[k]); });
    }
    return texto;
}

function aplicarIdioma() {
    document.documentElement.setAttribute('lang', Estado.idioma);
    document.title = t('tituloApp');

    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.innerHTML = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });

    const btnIdioma = document.getElementById('btnIdioma');
    if (btnIdioma) btnIdioma.title = t('cambiarIdioma');
}
