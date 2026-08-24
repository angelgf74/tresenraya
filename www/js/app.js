// ── Dificultad de la IA ─────────────────────────────────
// Estado.nivel guarda la probabilidad (%) de que la IA ignore la mejor
// jugada y elija una al azar; la búsqueda siempre llega a profundidad
// completa (juego perfecto). Solo en Fácil el azar es total: en el resto se
// limita a jugadas que no sean una derrota forzada.
const PROFUNDIDAD_IA = 9;
const NIVEL_FACIL     = 50;
const NIVEL_MEDIO     = 25;
const NIVEL_DIFICIL   = 10;
const NIVEL_IMPOSIBLE = 0;

// ── Estado global ──────────────────────────────────────
const Estado = {
    tablero: new Tablero(),
    marcador: [0, 0, 0], // [tablas, X, O]
    nivel: NIVEL_MEDIO,
    turnoInicial: 1,
    esperandoIA: false,
    tipoJugador: [0, 1], // 0=humano, 1=IA
    historial: [], // pila de tableros previos a cada jugada, para deshacer
    // Se incrementa en cada partida nueva. Las funciones que esperan (la IA
    // "pensando", la pausa antes del modal de resultado) capturan su valor y
    // se abortan al despertar si ha cambiado: sin esto, una jugada en vuelo
    // cae sobre el tablero de la partida siguiente.
    generacion: 0,
    tema: 'claro',
    volumen: 80,
    silenciado: false,
    idioma: 'es',

    // Timer
    timerActivo: false,
    tiempoLimite: 15,
    tiempoRestante: 0,
    timerInterval: null,
    timerPausado: false,  // congelado por un modal abierto o por la app en segundo plano
    appEnPausa: false,
    salidaPendiente: false, // primer "atrás" pulsado, esperando confirmacion

    // Torneo
    modoTorneo: false,
    bestOf: 3,
    ganadorTorneo: 0,

    // AdMob — contador para mostrar interstitial cada 2 partidas
    partidasJugadas: 0,
    interstitialPendiente: false,

    // Estadísticas históricas (persisten entre reinicios de la app)
    estadisticas: { jugadas: 0, victoriasX: 0, victoriasO: 0, tablas: 0 }
};

// ── Helpers ────────────────────────────────────────────
const hayIA       = () => Estado.tipoJugador[0] === 1 || Estado.tipoJugador[1] === 1;
const esIA        = (jug) => Estado.tipoJugador[jug - 1] === 1;
// Solo se puede deshacer si en la pila queda alguna posición con turno humano.
// No basta con que la pila no esté vacía: deshaciendo hasta una posición con
// turno de IA el tablero queda esperando una jugada que ya nadie dispara —
// celdas bloqueadas, botón oculto y partida congelada. Con esta condición,
// deshacerJugada() siempre encuentra una posición jugable antes de vaciarla.
const puedeDeshacer = () => !Estado.tablero.terminado && !Estado.esperandoIA &&
    Estado.historial.some(t => !esIA(t.turno));
const metaTorneo  = () => Math.ceil(Estado.bestOf / 2);
const delay       = (ms) => new Promise(r => setTimeout(r, ms));
const guardarHistorial = () => Estado.historial.push(Estado.tablero.clonar());

// ── Persistencia ───────────────────────────────────────
function cargarPrefs() {
    try {
        const t = localStorage.getItem('Tema');
        if (t) { Estado.tema = t; document.documentElement.setAttribute('data-tema', t); }

        const vol = parseInt(localStorage.getItem('Volumen'));
        if (!isNaN(vol)) Estado.volumen = vol;

        const sil = localStorage.getItem('Silenciado');
        if (sil !== null) Estado.silenciado = sil === 'true';

        const idi = localStorage.getItem('Idioma');
        if (idi === 'es' || idi === 'en') {
            Estado.idioma = idi;
        } else if (/^en/i.test(navigator.language || '')) {
            Estado.idioma = 'en';
        }

        // Antes de R2-P6 'Nivel' guardaba una profundidad (2/3/6/9); si queda
        // un valor de esa época en el dispositivo, se ignora y se usa el
        // nivel por defecto en vez de leerlo como probabilidad de azar.
        const n = parseInt(localStorage.getItem('Nivel'));
        if ([NIVEL_FACIL, NIVEL_MEDIO, NIVEL_DIFICIL, NIVEL_IMPOSIBLE].includes(n)) Estado.nivel = n;

        const jugs = JSON.parse(localStorage.getItem('Jugadores'));
        if (Array.isArray(jugs) && jugs.length === 2) Estado.tipoJugador = jugs;

        const est = JSON.parse(localStorage.getItem('Estadisticas'));
        if (est && typeof est.jugadas === 'number') Estado.estadisticas = est;
    } catch (e) {
        // localStorage no disponible (incógnito, cuota, etc.) — se sigue con valores por defecto
    }

    setSoundVolume(Estado.volumen / 100);
    setSoundMuted(Estado.silenciado);
}

function guardarPref(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch (e) {}
}

// ── AdMob (cordova-plugin-admob-free) ─────────────────
const ADMOB_IDS = {
    banner:       'ca-app-pub-8600791204816041/8820270638',
    interstitial: 'ca-app-pub-8600791204816041/5219883075'
};

function initAdMob() {
    if (typeof admob === 'undefined') return;

    // Banner inferior siempre visible
    admob.banner.config({
        id: ADMOB_IDS.banner,
        isTesting: !!window.APP_DEBUG,
        autoShow: true,
        bannerAtTop: false,
        overlap: true
    });
    admob.banner.prepare().catch(() => {});

    // El hueco para el banner solo se reserva si realmente carga; si no,
    // queda un espacio muerto permanente al pie del tablero.
    document.addEventListener('admob.banner.events.LOAD', () => {
        document.querySelector('.game-container').style.paddingBottom = 'calc(2rem + 60px)';
    });
    document.addEventListener('admob.banner.events.LOAD_FAIL', () => {
        document.querySelector('.game-container').style.paddingBottom = '';
    });

    // Precargar interstitial y recargarlo al cerrarse
    precargarInterstitial();
    document.addEventListener('admob.interstitial.events.CLOSE', precargarInterstitial);
}

function precargarInterstitial() {
    if (typeof admob === 'undefined') return;
    admob.interstitial.config({
        id: ADMOB_IDS.interstitial,
        isTesting: !!window.APP_DEBUG,
        autoShow: false
    });
    // Un fallo de carga (sin red, sin relleno) no debe volcarse como una
    // promesa rechazada sin capturar; sencillamente no habrá anuncio listo.
    admob.interstitial.prepare().catch(() => {});
}

// mostrarInterstitial() devuelve la promesa real de admob.interstitial.show(),
// que antes se perdía: mostrarInterstitial() no devolvía nada y el
// `await mostrarInterstitial()` de quien la llamaba esperaba undefined.
async function mostrarInterstitial() {
    if (typeof admob === 'undefined') return;
    try {
        const listo = await admob.interstitial.isReady();
        if (listo) await admob.interstitial.show();
    } catch (e) {
        // Sin anuncio cargado o SDK sin responder: se sigue sin anuncio.
    }
}

// ── Iconos ─────────────────────────────────────────────
// Los iconos son SVG del sprite de index.html, no glifos de una fuente: para
// cambiar uno se reapunta el <use>, y para generarlo desde JS se usa svgIco().
// .ico mide 1em, así que el tamaño lo sigue mandando el font-size del contenedor.
const svgIco = (id, clases) =>
    `<svg class="ico${clases ? ' ' + clases : ''}" aria-hidden="true"><use href="#${id}"></use></svg>`;

function ponIcono(contenedor, id) {
    const uso = contenedor.querySelector('use');
    if (uso) uso.setAttribute('href', `#${id}`);
}

// ── Renderizado ────────────────────────────────────────
function renderTodo() {
    aplicarIdioma();
    renderTema();
    renderVolumen();
    renderJugadores();
    renderNivel();
    renderTablero();
    renderMarcador();
    renderBajoTablero();
    renderExtras();
}

// Los controles de icono son <button> con un <svg> dentro: el dibujo se cambia
// reapuntando el <use>, y la clase de estado (conturno/sinturno) va en el botón.
function renderTema() {
    ponIcono(document.getElementById('btnTema'), Estado.tema === 'claro' ? 'i-luna' : 'i-sol');
}

function renderVolumen() {
    document.getElementById('volSlider').value = Estado.volumen;
    const btn  = document.getElementById('btnVolumen');
    const mudo = Estado.silenciado || Estado.volumen === 0;

    ponIcono(btn, mudo ? 'i-vol-mudo' : Estado.volumen <= 50 ? 'i-vol-bajo' : 'i-vol-alto');
    btn.setAttribute('aria-label', t(mudo ? 'activarSonido' : 'silenciar'));
}

function renderJugadores() {
    for (let idx = 0; idx < 2; idx++) {
        const btn = document.getElementById(`jug${idx + 1}`);
        const esIa = Estado.tipoJugador[idx] === 1;
        // jug1(idx=0) es el jugador 1 (X) y jug2(idx=1) el jugador 2 (O),
        // asi que tiene el turno el que coincide con tablero.turno (idx + 1).
        const conTurno = Estado.tablero.turno === idx + 1 && !Estado.tablero.terminado;

        ponIcono(btn, esIa ? 'i-ia' : 'i-humano');
        btn.className = `tipojugador ${conTurno ? 'conturno' : 'sinturno'}`;
        btn.setAttribute('aria-label', t(esIa ? 'jugadorEsIA' : 'jugadorEsHumano', { n: idx + 1 }));

        const col = document.getElementById(`colJugador${idx + 1}`);
        col.style.background = conTurno ? 'var(--jugador-activo-bg)' : '';
    }
}

function renderNivel() {
    const sel = document.getElementById('txtNivel');
    sel.style.display = hayIA() ? '' : 'none';
    sel.value = Estado.nivel;
}

function renderTablero() {
    const celdas = document.querySelectorAll('.celda');
    celdas.forEach((el, idx) => {
        const ficha = Estado.tablero.celdas[idx];
        const bloqueada = Estado.tablero.terminado || Estado.esperandoIA || ficha !== 0 || esIA(Estado.tablero.turno);
        el.className = `celda${bloqueada ? ' bloqueada' : ''}`;
        el.setAttribute('aria-disabled', String(bloqueada));
        el.setAttribute('tabindex', bloqueada ? '-1' : '0');
        el.setAttribute('aria-label',
            ficha === 1 ? t('casillaX', { n: idx + 1 }) :
            ficha === 2 ? t('casillaO', { n: idx + 1 }) :
            t('casillaVacia', { n: idx + 1 }));

        // Solo se reescribe si cambia: si no, la ficha reiniciaría su animación
        // de entrada en cada render.
        if (ficha === 1 && !el.querySelector('.ico-x')) {
            el.innerHTML = svgIco('i-x', 'ico-x');
        } else if (ficha === 2 && !el.querySelector('.ico-o')) {
            el.innerHTML = svgIco('i-o', 'ico-o');
        } else if (ficha === 0) {
            el.innerHTML = '';
        }
    });

    renderLineaGanadora();
}

function renderLineaGanadora() {
    const svg = document.getElementById('svgLinea');
    const linea = Estado.tablero.ganador > 0 ? Estado.tablero.lineaGanadora() : null;

    if (!linea) { svg.style.display = 'none'; return; }

    // De centro de celda extrema a borde del tablero: cada centro ya está a
    // 0.5 de su borde exterior, así que solo hay que alargar la línea otro
    // 0.5 (no 1, que la sacaba media celda fuera del tablero).
    const idx1 = linea[0], idx2 = linea[2];
    let x1 = idx1 % 3 + 0.5, y1 = Math.floor(idx1 / 3) + 0.5;
    let x2 = idx2 % 3 + 0.5, y2 = Math.floor(idx2 / 3) + 0.5;

    if (x1 < x2) { x1 -= 0.5; x2 += 0.5; }
    else if (x1 > x2) { x1 += 0.5; x2 -= 0.5; }
    if (y1 < y2) { y1 -= 0.5; y2 += 0.5; }
    else if (y1 > y2) { y1 += 0.5; y2 -= 0.5; }

    const el = document.getElementById('lineaEl');
    el.setAttribute('x1', x1.toFixed(2));
    el.setAttribute('y1', y1.toFixed(2));
    el.setAttribute('x2', x2.toFixed(2));
    el.setAttribute('y2', y2.toFixed(2));

    // Reiniciar animación CSS
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = '';

    svg.style.display = '';
}

function renderMarcador() {
    document.getElementById('marcadorX').textContent = Estado.marcador[1];
    document.getElementById('marcadorT').textContent = Estado.marcador[0];
    document.getElementById('marcadorO').textContent = Estado.marcador[2];
    if (Estado.modoTorneo)
        document.getElementById('torneoScore').textContent = `X ${Estado.marcador[1]} – ${Estado.marcador[2]} O`;
}

function renderBajoTablero() {
    document.getElementById('btnDeshacer').style.display = puedeDeshacer() ? '' : 'none';
    document.getElementById('elPensando').style.display  = Estado.esperandoIA ? '' : 'none';

    const mostrarTimer = Estado.timerActivo && !Estado.tablero.terminado && !esIA(Estado.tablero.turno) && !Estado.esperandoIA;
    const timerEl = document.getElementById('elTimer');
    timerEl.style.display = mostrarTimer ? '' : 'none';
    if (mostrarTimer) {
        document.getElementById('timerNum').textContent = Estado.tiempoRestante;
        timerEl.className = `timer-display${Estado.tiempoRestante <= 5 ? ' timer-urgente' : ''}`;
    }
}

function renderExtras() {
    document.getElementById('btnTimer').className  = `extra-btn${Estado.timerActivo ? ' on' : ''}`;
    document.getElementById('btnTorneo').className = `extra-btn${Estado.modoTorneo ? ' on' : ''}`;

    const showConfig = Estado.timerActivo || Estado.modoTorneo;
    document.getElementById('configRow').style.display    = showConfig ? 'flex' : 'none';
    document.getElementById('configTimer').style.display  = Estado.timerActivo ? '' : 'none';
    document.getElementById('configTorneo').style.display = Estado.modoTorneo ? '' : 'none';
}

// ── Inicialización del tablero DOM ─────────────────────
function crearCeldasDOM() {
    const grid = document.getElementById('tableroGrid');
    grid.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const celda = document.createElement('div');
        celda.className = 'celda';
        celda.setAttribute('role', 'button');
        celda.setAttribute('tabindex', '0');
        celda.setAttribute('aria-label', t('casillaVacia', { n: i + 1 }));
        celda.addEventListener('click', () => onCeldaClick(i));
        celda.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCeldaClick(i);
                return;
            }
            const paso = PASO_FLECHA[e.key];
            if (paso === undefined) return;
            e.preventDefault();
            moverFocoCelda(i, paso);
        });
        grid.appendChild(celda);
    }
}

const PASO_FLECHA = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };

// Desplaza el foco por el tablero con las flechas. Izquierda y derecha no
// saltan de fila; las celdas bloqueadas (tabindex -1) siguen siendo
// enfocables por programa, para poder atravesarlas.
function moverFocoCelda(desde, paso) {
    const destino = desde + paso;
    if (destino < 0 || destino > 8) return;
    if (Math.abs(paso) === 1 && Math.floor(destino / 3) !== Math.floor(desde / 3)) return;
    document.querySelectorAll('.celda')[destino].focus();
}

// ── Lógica del juego ───────────────────────────────────
async function iniciarJuego() {
    cancelarTimer();
    Estado.generacion++;
    Estado.tablero.reset(Estado.turnoInicial);
    Estado.historial = [];
    Estado.esperandoIA = false;
    renderTodo();

    if (!Estado.tablero.terminado && esIA(Estado.tablero.turno))
        await jugadaIA();
    else if (Estado.timerActivo && !Estado.tablero.terminado)
        iniciarTimer();
}

async function nuevoJuego() {
    Estado.turnoInicial = Estado.turnoInicial === 1 ? 2 : 1;
    await iniciarJuego();
}

async function onCeldaClick(celda) {
    if (Estado.tablero.terminado || Estado.esperandoIA || Estado.tablero.celdas[celda] !== 0 || esIA(Estado.tablero.turno))
        return;

    const gen = Estado.generacion;
    cancelarTimer();
    guardarHistorial();
    Estado.tablero.hacerJugada(celda);
    playSound('colocar');
    renderTablero();
    renderJugadores();
    renderBajoTablero();

    await refrescarEstado();
    if (gen !== Estado.generacion) return;

    if (!Estado.tablero.terminado && esIA(Estado.tablero.turno))
        await jugadaIA();
    else if (!Estado.tablero.terminado && Estado.timerActivo)
        iniciarTimer();
}

async function jugadaIA() {
    const gen = Estado.generacion;
    Estado.esperandoIA = true;
    renderBajoTablero();
    renderJugadores();

    await delay(380);
    // La partida se reinició mientras la IA "pensaba" (cambio de nivel, de tipo
    // de jugador, torneo...). Esta jugada era para un tablero que ya no existe;
    // colocarla ahora pondría una ficha fantasma en la partida nueva.
    // iniciarJuego() ya ha dejado esperandoIA en false, así que basta con salir.
    if (gen !== Estado.generacion) return;

    const soloNoPerdedoras = Estado.nivel !== NIVEL_FACIL;
    const celda = Juego.jugada(Estado.tablero, PROFUNDIDAD_IA, Estado.nivel / 100, soloNoPerdedoras);
    if (celda >= 0) {
        guardarHistorial();
        Estado.tablero.hacerJugada(celda);
    }

    Estado.esperandoIA = false;
    playSound('colocar');
    renderTablero();
    renderJugadores();
    renderBajoTablero();

    await refrescarEstado();
    if (gen !== Estado.generacion) return;

    if (!Estado.tablero.terminado && esIA(Estado.tablero.turno))
        await jugadaIA();
    else if (!Estado.tablero.terminado && Estado.timerActivo)
        iniciarTimer();
}

async function refrescarEstado() {
    if (!Estado.tablero.terminado) return;

    const gen = Estado.generacion;
    cancelarTimer();
    if (Estado.tablero.ganador === 1)      { Estado.marcador[1]++; Estado.estadisticas.victoriasX++; }
    else if (Estado.tablero.ganador === 2) { Estado.marcador[2]++; Estado.estadisticas.victoriasO++; }
    else                                    { Estado.marcador[0]++; Estado.estadisticas.tablas++; }
    Estado.estadisticas.jugadas++;
    guardarPref('Estadisticas', JSON.stringify(Estado.estadisticas));

    renderMarcador();
    renderLineaGanadora();
    playSound(Estado.tablero.ganador > 0 ? 'victoria' : 'empate');

    await delay(1600);
    // Si durante la pausa se empezó otra partida (nivel, jugadores, torneo),
    // el modal de resultado abriría sobre un tablero nuevo. El marcador y las
    // estadísticas ya se contaron arriba, que es lo correcto: la partida sí
    // terminó.
    if (gen !== Estado.generacion) return;

    // Cada 2 partidas terminadas toca interstitial, pero se muestra al aceptar
    // el modal (ver aceptarModal/aceptarModalTorneo): lanzarlo aquí, justo
    // después de abrir el modal de resultado, lo tapaba.
    Estado.partidasJugadas++;
    Estado.interstitialPendiente = Estado.partidasJugadas % 2 === 0;

    if (Estado.modoTorneo && (Estado.marcador[1] >= metaTorneo() || Estado.marcador[2] >= metaTorneo())) {
        Estado.ganadorTorneo = Estado.marcador[1] >= metaTorneo() ? 1 : 2;
        abrirModalTorneo();
    } else {
        abrirModalPartida();
    }
}

// ── Modales ────────────────────────────────────────────
function abrirModalPartida() {
    let html;
    if (Estado.tablero.ganador === -1) {
        html = `<div class="modal-resultado"><b>${t('tablas')}</b>
            ${svgIco('i-tablas', 'ico-grande ico-tablas')}</div>`;
    } else {
        const ficha = Estado.tablero.ganador === 1
            ? svgIco('i-x', 'ico-grande ico-x')
            : svgIco('i-o', 'ico-grande ico-o');
        html = `<div class="modal-resultado"><b>${t('ganador')}</b>${ficha}</div>`;
    }
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalBackdrop').style.display = '';
    document.getElementById('modalPartida').style.display  = '';
    alAbrirModal('modalPartida');
}

function abrirModalTorneo() {
    document.getElementById('iconoCampeon').innerHTML = Estado.ganadorTorneo === 1
        ? svgIco('i-x', 'ico-grande ico-x')
        : svgIco('i-o', 'ico-grande ico-o');
    document.getElementById('marcadorTorneo').textContent = `${Estado.marcador[1]} – ${Estado.marcador[2]}`;
    document.getElementById('modalTorneoBackdrop').style.display = '';
    document.getElementById('modalTorneo').style.display         = '';
    alAbrirModal('modalTorneo');
}

// Se dispara al aceptar el modal (partida o torneo) en vez de justo al abrirlo,
// para no tapar el resultado con el anuncio.
async function mostrarInterstitialPendiente() {
    if (!Estado.interstitialPendiente) return;
    Estado.interstitialPendiente = false;
    await mostrarInterstitial();
}

async function aceptarModal() {
    document.getElementById('modalBackdrop').style.display = 'none';
    document.getElementById('modalPartida').style.display  = 'none';
    alCerrarModal();
    await mostrarInterstitialPendiente();
    await delay(600);
    await nuevoJuego();
}

async function aceptarModalTorneo() {
    document.getElementById('modalTorneoBackdrop').style.display = 'none';
    document.getElementById('modalTorneo').style.display         = 'none';
    alCerrarModal();
    Estado.marcador = [0, 0, 0];
    Estado.turnoInicial = 1;
    await mostrarInterstitialPendiente();
    await delay(600);
    await iniciarJuego();
}

// ── Controles UI ───────────────────────────────────────
function toggleTema() {
    Estado.tema = Estado.tema === 'claro' ? 'oscuro' : 'claro';
    document.documentElement.setAttribute('data-tema', Estado.tema);
    guardarPref('Tema', Estado.tema);
    renderTema();
}

function toggleIdioma() {
    Estado.idioma = Estado.idioma === 'es' ? 'en' : 'es';
    guardarPref('Idioma', Estado.idioma);
    renderTodo();
}

function toggleMute() {
    Estado.silenciado = !Estado.silenciado;
    setSoundMuted(Estado.silenciado);
    guardarPref('Silenciado', Estado.silenciado);
    renderVolumen();
}

function onVolumenInput(val) {
    Estado.volumen = parseInt(val);
    if (Estado.silenciado && Estado.volumen > 0) Estado.silenciado = false;
    setSoundVolume(Estado.volumen / 100);
    setSoundMuted(Estado.silenciado);
    guardarPref('Volumen', Estado.volumen);
    guardarPref('Silenciado', Estado.silenciado);
    renderVolumen();
}

async function toggleTipo(idx) {
    if (Estado.tipoJugador[idx] === 0 && Estado.tipoJugador[1 - idx] === 1) return; // mínimo 1 humano
    Estado.tipoJugador[idx] = 1 - Estado.tipoJugador[idx];
    Estado.marcador = [0, 0, 0];
    Estado.modoTorneo = false;
    guardarPref('Jugadores', JSON.stringify(Estado.tipoJugador));
    Estado.turnoInicial = 1;
    renderMarcador();
    renderExtras();
    await iniciarJuego();
}

async function onNivelChange(val) {
    Estado.nivel = parseInt(val);
    guardarPref('Nivel', Estado.nivel);
    Estado.marcador = [0, 0, 0];
    Estado.modoTorneo = false;
    Estado.turnoInicial = 1;
    renderMarcador();
    renderExtras();
    await iniciarJuego();
}

function resetMarcador() {
    Estado.marcador = [0, 0, 0];
    renderMarcador();
}

// Contra la IA, un tablero de historial de cada dos corresponde a "antes de
// que la IA mueva" (con turno de IA); esos se saltan para que un solo
// Deshacer retire la jugada humana y la respuesta de la IA a la vez y deje
// el turno en manos de un humano.
async function deshacerJugada() {
    if (!puedeDeshacer()) return;
    cancelarTimer();
    while (Estado.historial.length > 0) {
        Estado.tablero = Estado.historial.pop();
        if (!esIA(Estado.tablero.turno)) break;
    }
    renderTodo();
    if (Estado.timerActivo) iniciarTimer();
}

// ── Timer ──────────────────────────────────────────────
// reanudar=true continua desde Estado.tiempoRestante en vez de volver al limite.
function iniciarTimer(reanudar) {
    cancelarTimer();
    if (!Estado.timerActivo || Estado.tablero.terminado || esIA(Estado.tablero.turno) || Estado.esperandoIA) return;
    if (!reanudar) Estado.tiempoRestante = Estado.tiempoLimite;
    Estado.timerPausado = false;
    renderBajoTablero();

    Estado.timerInterval = setInterval(async () => {
        Estado.tiempoRestante--;
        renderBajoTablero();
        if (Estado.tiempoRestante <= 0) {
            cancelarTimer();
            await tiempoAgotado();
        }
    }, 1000);
}

function cancelarTimer() {
    if (Estado.timerInterval) { clearInterval(Estado.timerInterval); Estado.timerInterval = null; }
}

// ── Pausa del temporizador (modales y segundo plano) ──
// Sin esto el reloj sigue corriendo mientras el usuario lee la ayuda o tiene
// la app en segundo plano, y pierde el turno por una jugada aleatoria.
// Orden de prioridad al cerrar: primero los modales ligeros (ayuda y
// estadisticas); los de resultado ejecutan su accion de aceptar, que encadena
// una partida nueva.
const MODALES = [
    { id: 'modalAyuda',   cerrar: () => cerrarAyuda() },
    { id: 'modalStats',   cerrar: () => cerrarEstadisticas() },
    { id: 'modalPartida', cerrar: () => aceptarModal() },
    { id: 'modalTorneo',  cerrar: () => aceptarModalTorneo() }
];

function modalAbierto() {
    return MODALES.find(m => document.getElementById(m.id).style.display !== 'none') || null;
}

function hayModalAbierto() {
    return modalAbierto() !== null;
}

function pausarTimer() {
    if (!Estado.timerInterval) return;
    cancelarTimer();
    Estado.timerPausado = true;
}

function reanudarTimer() {
    if (!Estado.timerPausado) return;
    if (Estado.appEnPausa || hayModalAbierto()) return;
    iniciarTimer(true);
}

async function tiempoAgotado() {
    if (Estado.tablero.terminado || esIA(Estado.tablero.turno)) return;
    const libres = Estado.tablero.celdasLibres();
    if (libres.length === 0) return;
    const gen = Estado.generacion;
    guardarHistorial();
    Estado.tablero.hacerJugada(libres[Math.floor(Math.random() * libres.length)]);
    playSound('colocar');
    renderTablero();
    renderJugadores();
    await refrescarEstado();
    if (gen !== Estado.generacion) return;
    if (!Estado.tablero.terminado && esIA(Estado.tablero.turno)) await jugadaIA();
    else if (!Estado.tablero.terminado && Estado.timerActivo) iniciarTimer();
}

async function toggleTimer() {
    Estado.timerActivo = !Estado.timerActivo;
    renderExtras();
    if (Estado.timerActivo && !Estado.tablero.terminado && !esIA(Estado.tablero.turno) && !Estado.esperandoIA)
        iniciarTimer();
    else {
        cancelarTimer();
        renderBajoTablero();
    }
}

function onTiempoLimiteChange(val) {
    Estado.tiempoLimite = parseInt(val);
    if (Estado.timerActivo && !Estado.tablero.terminado && !esIA(Estado.tablero.turno) && !Estado.esperandoIA) {
        cancelarTimer();
        iniciarTimer();
    }
}

// ── Torneo ─────────────────────────────────────────────
async function toggleTorneo() {
    Estado.modoTorneo = !Estado.modoTorneo;
    if (Estado.modoTorneo) { Estado.marcador = [0, 0, 0]; Estado.turnoInicial = 1; renderMarcador(); }
    renderExtras();
    if (Estado.modoTorneo) await iniciarJuego();
}

function onBestOfChange(val) {
    Estado.bestOf = parseInt(val);
    if (Estado.modoTorneo && (Estado.marcador[1] >= metaTorneo() || Estado.marcador[2] >= metaTorneo())) {
        Estado.marcador = [0, 0, 0];
        Estado.turnoInicial = 1;
        iniciarJuego();
    }
}

// ── Estadísticas ───────────────────────────────────────
function renderEstadisticas() {
    const j = Estado.estadisticas.jugadas;
    const pct = (n) => j === 0 ? '0%' : `${Math.round(n / j * 100)}%`;
    document.getElementById('statsBody').innerHTML = `
        <div class="stats-total">${t('partidasJugadas')}: <b>${j}</b></div>
        <div class="stats-linea">${svgIco('i-x', 'ayuda-x')} ${t('victoriasX')}: <b>${Estado.estadisticas.victoriasX}</b> (${pct(Estado.estadisticas.victoriasX)})</div>
        <div class="stats-linea">${svgIco('i-o', 'ayuda-o')} ${t('victoriasO')}: <b>${Estado.estadisticas.victoriasO}</b> (${pct(Estado.estadisticas.victoriasO)})</div>
        <div class="stats-linea">${t('tablasStats')}: <b>${Estado.estadisticas.tablas}</b> (${pct(Estado.estadisticas.tablas)})</div>`;
}

function mostrarEstadisticas() {
    pausarTimer();
    renderEstadisticas();
    document.getElementById('statsBackdrop').style.display = '';
    document.getElementById('modalStats').style.display    = '';
    alAbrirModal('modalStats');
}

function cerrarEstadisticas() {
    document.getElementById('statsBackdrop').style.display = 'none';
    document.getElementById('modalStats').style.display    = 'none';
    alCerrarModal();
    reanudarTimer();
}

function resetEstadisticas() {
    Estado.estadisticas = { jugadas: 0, victoriasX: 0, victoriasO: 0, tablas: 0 };
    guardarPref('Estadisticas', JSON.stringify(Estado.estadisticas));
    renderEstadisticas();
}

// ── Ayuda ──────────────────────────────────────────────
function mostrarAyuda() {
    pausarTimer();
    document.getElementById('ayudaBackdrop').style.display = '';
    document.getElementById('modalAyuda').style.display    = '';
    alAbrirModal('modalAyuda');
}
function cerrarAyuda() {
    document.getElementById('ayudaBackdrop').style.display = 'none';
    document.getElementById('modalAyuda').style.display    = 'none';
    alCerrarModal();
    reanudarTimer();
}

// ── Foco en modales ────────────────────────────────────
// Un modal debe recibir el foco al abrirse, retenerlo mientras esta abierto
// (si no, el tabulador se va al contenido de detras) y devolverlo al elemento
// que lo abrio al cerrarse.
let focoPrevio = null;

const SELECTOR_ENFOCABLES =
    'button:not([disabled]), input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

function enfocablesDe(idModal) {
    return Array.from(document.getElementById(idModal).querySelectorAll(SELECTOR_ENFOCABLES))
        .filter(el => el.getClientRects().length > 0);
}

function alAbrirModal(idModal) {
    focoPrevio = document.activeElement;
    const enfocables = enfocablesDe(idModal);
    // El boton principal (Aceptar / Cerrar) es el ultimo del pie.
    if (enfocables.length) enfocables[enfocables.length - 1].focus();
}

function alCerrarModal() {
    if (focoPrevio && document.contains(focoPrevio)) focoPrevio.focus();
    focoPrevio = null;
}

function onKeyDownGlobal(e) {
    const m = modalAbierto();
    if (!m) return;

    if (e.key === 'Escape') {
        e.preventDefault();
        m.cerrar();
        return;
    }
    if (e.key !== 'Tab') return;

    const enfocables = enfocablesDe(m.id);
    if (!enfocables.length) return;

    const primero = enfocables[0];
    const ultimo  = enfocables[enfocables.length - 1];
    const dentro  = document.getElementById(m.id).contains(document.activeElement);

    if (!dentro)                                        { e.preventDefault(); primero.focus(); }
    else if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
}

// ── Toast ──────────────────────────────────────────────
let toastTimeout = null;

function mostrarToast(mensaje, ms) {
    const el = document.getElementById('toast');
    el.textContent = mensaje;
    el.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.classList.remove('visible'), ms || 2000);
}

// ── Ciclo de vida Android ──────────────────────────────
// Sin manejar "backbutton", Cordova cierra la app al pulsar atras, incluso con
// un modal abierto. Sin "pause"/"resume" el temporizador sigue contando con la
// app en segundo plano (KeepRunning es true por defecto).
function cerrarModalAbierto() {
    const m = modalAbierto();
    if (!m) return false;
    m.cerrar();
    return true;
}

function onBackButton() {
    if (cerrarModalAbierto()) return;

    // Doble pulsacion para salir, para no perder la partida por un roce.
    if (Estado.salidaPendiente) {
        if (navigator.app && navigator.app.exitApp) navigator.app.exitApp();
        return;
    }
    Estado.salidaPendiente = true;
    mostrarToast(t('pulsaAtrasSalir'));
    setTimeout(() => { Estado.salidaPendiente = false; }, 2000);
}

function onAppPause() {
    Estado.appEnPausa = true;
    pausarTimer();
}

function onAppResume() {
    Estado.appEnPausa = false;
    reanudarTimer();
}

// ── Vincular eventos ───────────────────────────────────
function bindEvents() {
    document.getElementById('btnTema').addEventListener('click', toggleTema);
    document.getElementById('btnIdioma').addEventListener('click', toggleIdioma);
    document.getElementById('btnAyuda').addEventListener('click', mostrarAyuda);
    document.getElementById('btnCerrarAyuda').addEventListener('click', cerrarAyuda);
    document.getElementById('ayudaBackdrop').addEventListener('click', cerrarAyuda);

    document.getElementById('btnVolumen').addEventListener('click', toggleMute);
    document.getElementById('volSlider').addEventListener('input', e => onVolumenInput(e.target.value));

    document.getElementById('btnResetMarcador').addEventListener('click', resetMarcador);

    document.getElementById('jug1').addEventListener('click', () => toggleTipo(0));
    document.getElementById('jug2').addEventListener('click', () => toggleTipo(1));

    document.getElementById('txtNivel').addEventListener('change', e => onNivelChange(e.target.value));
    document.getElementById('btnDeshacer').addEventListener('click', deshacerJugada);

    document.getElementById('btnAceptarModal').addEventListener('click', aceptarModal);
    document.getElementById('btnNuevoTorneo').addEventListener('click', aceptarModalTorneo);

    document.getElementById('btnTimer').addEventListener('click', toggleTimer);
    document.getElementById('btnTorneo').addEventListener('click', toggleTorneo);
    document.getElementById('btnStats').addEventListener('click', mostrarEstadisticas);
    document.getElementById('btnCerrarStats').addEventListener('click', cerrarEstadisticas);
    document.getElementById('statsBackdrop').addEventListener('click', cerrarEstadisticas);
    document.getElementById('btnResetStats').addEventListener('click', resetEstadisticas);
    document.getElementById('selTiempoLimite').addEventListener('change', e => onTiempoLimiteChange(e.target.value));
    document.getElementById('selBestOf').addEventListener('change', e => onBestOfChange(e.target.value));

    // Escape para cerrar y tabulador atrapado dentro del modal abierto.
    document.addEventListener('keydown', onKeyDownGlobal);

    // Ciclo de vida. "backbutton", "pause" y "resume" solo los emite Cordova
    // (en el navegador nunca disparan), pero se registran aqui para que ambos
    // arranques compartan el mismo cableado. "visibilitychange" cubre el caso
    // equivalente en navegador.
    document.addEventListener('backbutton', onBackButton, false);
    document.addEventListener('pause', onAppPause, false);
    document.addEventListener('resume', onAppResume, false);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) onAppPause();
        else                 onAppResume();
    });
}

// ── Arranque ───────────────────────────────────────────
// La traducción no depende de Cordova: se aplica ya en DOMContentLoaded,
// mucho antes que 'deviceready'/'load', para evitar el parpadeo en
// español en dispositivos con el idioma en inglés.
document.addEventListener('DOMContentLoaded', () => {
    cargarPrefs();
    aplicarIdioma();
});

document.addEventListener('deviceready', async () => {
    cargarPrefs();
    crearCeldasDOM();
    bindEvents();
    await iniciarJuego();
    initAdMob();
}, false);

// Fallback para pruebas en navegador de escritorio
if (!window.cordova) {
    window.addEventListener('load', async () => {
        cargarPrefs();
        crearCeldasDOM();
        bindEvents();
        await iniciarJuego();
    });
}
