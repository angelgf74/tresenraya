// ── Estado global ──────────────────────────────────────
const Estado = {
    tablero: new Tablero(),
    marcador: [0, 0, 0], // [tablas, X, O]
    nivel: 3,
    turnoInicial: 1,
    esperandoIA: false,
    tipoJugador: [0, 1], // 0=humano, 1=IA
    tableroAnterior: null,
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

    // Estadísticas históricas (persisten entre reinicios de la app)
    estadisticas: { jugadas: 0, victoriasX: 0, victoriasO: 0, tablas: 0 }
};

// ── Helpers ────────────────────────────────────────────
const hayIA       = () => Estado.tipoJugador[0] === 1 || Estado.tipoJugador[1] === 1;
const esIA        = (jug) => Estado.tipoJugador[jug - 1] === 1;
const puedeDeshacer = () => !hayIA() && Estado.tableroAnterior !== null && !Estado.tablero.terminado;
const metaTorneo  = () => Math.ceil(Estado.bestOf / 2);
const delay       = (ms) => new Promise(r => setTimeout(r, ms));

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
        if (idi === 'es' || idi === 'en') Estado.idioma = idi;

        const n = parseInt(localStorage.getItem('Nivel'));
        if (!isNaN(n)) Estado.nivel = n;

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
    admob.banner.prepare();

    // Espacio para que el banner no tape el contenido
    document.querySelector('.game-container').style.paddingBottom = 'calc(2rem + 60px)';

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
    admob.interstitial.prepare();
}

function mostrarInterstitial() {
    if (typeof admob === 'undefined') return;
    admob.interstitial.show();
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

// Los controles de icono son <button> con un <i> dentro: la clase del icono va
// en el <i>, y la del estado (conturno/sinturno) en el propio boton.
function renderTema() {
    const icono = document.querySelector('#btnTema i');
    icono.className = Estado.tema === 'claro' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
}

function renderVolumen() {
    document.getElementById('volSlider').value = Estado.volumen;
    const btn   = document.getElementById('btnVolumen');
    const icono = btn.querySelector('i');
    const mudo  = Estado.silenciado || Estado.volumen === 0;

    if (mudo)                      icono.className = 'fa-solid fa-volume-xmark';
    else if (Estado.volumen <= 50) icono.className = 'fa-solid fa-volume-low';
    else                           icono.className = 'fa-solid fa-volume-high';

    btn.setAttribute('aria-label', t(mudo ? 'activarSonido' : 'silenciar'));
}

function renderJugadores() {
    for (let idx = 0; idx < 2; idx++) {
        const btn = document.getElementById(`jug${idx + 1}`);
        const esIa = Estado.tipoJugador[idx] === 1;
        // jug1(idx=0) es el jugador 1 (X) y jug2(idx=1) el jugador 2 (O),
        // asi que tiene el turno el que coincide con tablero.turno (idx + 1).
        const conTurno = Estado.tablero.turno === idx + 1 && !Estado.tablero.terminado;

        btn.querySelector('i').className = esIa ? 'fa-brands fa-android' : 'fa-solid fa-user';
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

        if (ficha === 1 && !el.querySelector('.fa-times')) {
            el.innerHTML = '<i class="fa-solid fa-times" aria-hidden="true"></i>';
        } else if (ficha === 2 && !el.querySelector('.fa-circle')) {
            el.innerHTML = '<i class="fa-regular fa-circle" aria-hidden="true"></i>';
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

    const idx1 = linea[0], idx2 = linea[2];
    let x1 = idx1 % 3 + 0.5, y1 = Math.floor(idx1 / 3) + 0.5;
    let x2 = idx2 % 3 + 0.5, y2 = Math.floor(idx2 / 3) + 0.5;

    if (x1 < x2) { x1 -= 1; x2 += 1; }
    else if (x1 > x2) { x1 += 1; x2 -= 1; }
    if (y1 < y2) { y1 -= 1; y2 += 1; }
    else if (y1 > y2) { y1 += 1; y2 -= 1; }

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
    Estado.tablero.reset(Estado.turnoInicial);
    Estado.tableroAnterior = null;
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

    cancelarTimer();
    Estado.tableroAnterior = Estado.tablero.clonar();
    Estado.tablero.hacerJugada(celda);
    playSound('colocar');
    renderTablero();
    renderJugadores();
    renderBajoTablero();

    await refrescarEstado();

    if (!Estado.tablero.terminado && esIA(Estado.tablero.turno))
        await jugadaIA();
    else if (!Estado.tablero.terminado && Estado.timerActivo)
        iniciarTimer();
}

async function jugadaIA() {
    Estado.esperandoIA = true;
    renderBajoTablero();
    renderJugadores();

    await delay(380);

    const celda = Juego.mejorJugada(Estado.tablero, Estado.nivel);
    if (celda >= 0) Estado.tablero.hacerJugada(celda);

    Estado.esperandoIA = false;
    playSound('colocar');
    renderTablero();
    renderJugadores();
    renderBajoTablero();

    await refrescarEstado();

    if (!Estado.tablero.terminado && esIA(Estado.tablero.turno))
        await jugadaIA();
    else if (!Estado.tablero.terminado && Estado.timerActivo)
        iniciarTimer();
}

async function refrescarEstado() {
    if (!Estado.tablero.terminado) return;

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

    if (Estado.modoTorneo && (Estado.marcador[1] >= metaTorneo() || Estado.marcador[2] >= metaTorneo())) {
        Estado.ganadorTorneo = Estado.marcador[1] >= metaTorneo() ? 1 : 2;
        abrirModalTorneo();
    } else {
        abrirModalPartida();
    }

    // Interstitial cada 2 partidas terminadas
    Estado.partidasJugadas++;
    if (Estado.partidasJugadas % 2 === 0) {
        await delay(400);
        await mostrarInterstitial();
    }
}

// ── Modales ────────────────────────────────────────────
function abrirModalPartida() {
    let html;
    if (Estado.tablero.ganador === -1) {
        html = `<div class="modal-resultado"><b>${t('tablas')}</b>
            <span class="fa-stack fa-2x">
                <i class="far fa-circle fa-stack-2x" aria-hidden="true"></i>
                <i class="fas fa-times fa-stack-1x" aria-hidden="true"></i>
            </span></div>`;
    } else {
        const ficha = Estado.tablero.ganador === 1
            ? `<i class="fas fa-times fa-3x" aria-hidden="true"></i>`
            : `<i class="far fa-circle fa-3x" aria-hidden="true"></i>`;
        html = `<div class="modal-resultado"><b>${t('ganador')}</b>${ficha}</div>`;
    }
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalBackdrop').style.display = '';
    document.getElementById('modalPartida').style.display  = '';
    alAbrirModal('modalPartida');
}

function abrirModalTorneo() {
    document.getElementById('iconoCampeon').innerHTML = Estado.ganadorTorneo === 1
        ? `<i class="fas fa-times fa-3x" aria-hidden="true"></i>`
        : `<i class="far fa-circle fa-3x" aria-hidden="true"></i>`;
    document.getElementById('marcadorTorneo').textContent = `${Estado.marcador[1]} – ${Estado.marcador[2]}`;
    document.getElementById('modalTorneoBackdrop').style.display = '';
    document.getElementById('modalTorneo').style.display         = '';
    alAbrirModal('modalTorneo');
}

async function aceptarModal() {
    document.getElementById('modalBackdrop').style.display = 'none';
    document.getElementById('modalPartida').style.display  = 'none';
    alCerrarModal();
    await delay(600);
    await nuevoJuego();
}

async function aceptarModalTorneo() {
    document.getElementById('modalTorneoBackdrop').style.display = 'none';
    document.getElementById('modalTorneo').style.display         = 'none';
    alCerrarModal();
    Estado.marcador = [0, 0, 0];
    Estado.turnoInicial = 1;
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

async function deshacerJugada() {
    if (!puedeDeshacer()) return;
    cancelarTimer();
    Estado.tablero = Estado.tableroAnterior;
    Estado.tableroAnterior = null;
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
    Estado.tableroAnterior = Estado.tablero.clonar();
    Estado.tablero.hacerJugada(libres[Math.floor(Math.random() * libres.length)]);
    playSound('colocar');
    renderTablero();
    renderJugadores();
    await refrescarEstado();
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
        <div class="stats-linea"><i class="fas fa-times ayuda-x" aria-hidden="true"></i> ${t('victoriasX')}: <b>${Estado.estadisticas.victoriasX}</b> (${pct(Estado.estadisticas.victoriasX)})</div>
        <div class="stats-linea"><i class="far fa-circle ayuda-o" aria-hidden="true"></i> ${t('victoriasO')}: <b>${Estado.estadisticas.victoriasO}</b> (${pct(Estado.estadisticas.victoriasO)})</div>
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
