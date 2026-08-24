// ── Tablero ──────────────────────────────────────────
const LINEAS = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
];

class Tablero {
    constructor() {
        this.celdas = new Array(9).fill(0);
        this.turno = 1;
        this.ganador = 0;
    }

    get terminado() { return this.ganador !== 0; }

    hacerJugada(celda) {
        if (this.terminado || celda < 0 || celda > 8 || this.celdas[celda] !== 0)
            return false;
        this.celdas[celda] = this.turno;
        this._evaluar();
        if (!this.terminado)
            this.turno = this.turno === 1 ? 2 : 1;
        return true;
    }

    _evaluar() {
        for (const l of LINEAS) {
            if (this.celdas[l[0]] !== 0 &&
                this.celdas[l[0]] === this.celdas[l[1]] &&
                this.celdas[l[1]] === this.celdas[l[2]]) {
                this.ganador = this.celdas[l[0]];
                return;
            }
        }
        if (this.celdas.every(c => c !== 0))
            this.ganador = -1;
    }

    lineaGanadora() {
        for (const l of LINEAS) {
            if (this.celdas[l[0]] !== 0 &&
                this.celdas[l[0]] === this.celdas[l[1]] &&
                this.celdas[l[1]] === this.celdas[l[2]])
                return l;
        }
        return null;
    }

    celdasLibres() {
        const libres = [];
        for (let i = 0; i < 9; i++) {
            if (this.celdas[i] === 0) libres.push(i);
        }
        return libres;
    }

    clonar() {
        const c = new Tablero();
        c.celdas = [...this.celdas];
        c.turno = this.turno;
        c.ganador = this.ganador;
        return c;
    }

    reset(turnoInicial) {
        this.celdas = new Array(9).fill(0);
        this.turno = turnoInicial || 1;
        this.ganador = 0;
    }
}

// ── Juego (minimax) ──────────────────────────────────
const Juego = {
    // Por debajo de este valor, la jugada es una derrota forzada (el
    // heurístico solo baja de -1e8 cuando una línea rival ya está completa
    // en el tablero terminal alcanzado con juego óptimo). Sirve para que
    // jugada() pueda excluir esas jugadas al elegir al azar.
    UMBRAL_PERDEDORA: -1e8,

    mejorJugada(tablero, profundidad) {
        const evals = this._evaluarJugadas(tablero, profundidad);
        if (evals.length === 0) return -1;

        const mejorH = Math.max(...evals.map(e => e.h));
        const candidatas = evals.filter(e => e.h === mejorH).map(e => e.celda);
        return candidatas[Math.floor(Math.random() * candidatas.length)];
    },

    // Nivel de dificultad: la búsqueda siempre llega a profundidad completa
    // (juego perfecto); lo que cambia entre niveles es `probabilidadAzar`,
    // la probabilidad de ignorar la mejor jugada y elegir una al azar.
    // `soloNoPerdedoras` limita ese azar a jugadas que no sean una derrota
    // forzada (Medio/Difícil); en Fácil el azar es total, puede regalar la
    // partida.
    jugada(tablero, profundidad, probabilidadAzar, soloNoPerdedoras) {
        const evals = this._evaluarJugadas(tablero, profundidad);
        if (evals.length === 0) return -1;

        if (probabilidadAzar > 0 && Math.random() < probabilidadAzar) {
            const pool = soloNoPerdedoras
                ? evals.filter(e => e.h > this.UMBRAL_PERDEDORA)
                : evals;
            const celdasAzar = (pool.length > 0 ? pool : evals).map(e => e.celda);
            return celdasAzar[Math.floor(Math.random() * celdasAzar.length)];
        }

        const mejorH = Math.max(...evals.map(e => e.h));
        const candidatas = evals.filter(e => e.h === mejorH).map(e => e.celda);
        return candidatas[Math.floor(Math.random() * candidatas.length)];
    },

    // Ventana completa (-Infinity, Infinity) en cada rama: así el valor que
    // devuelve _minimax es siempre exacto y las jugadas empatadas (o las no
    // perdedoras) se detectan bien. Compartir alpha entre hermanas podaba
    // alguna a un valor que solo es una cota, no el valor real, y eso rompía
    // esas comparaciones.
    _evaluarJugadas(tablero, profundidad) {
        const libres = tablero.celdasLibres();
        if (libres.length === 0) return [];

        const aiPlayer = tablero.turno;
        return libres.map(celda => {
            const clon = tablero.clonar();
            clon.hacerJugada(celda);
            const h = this._minimax(clon, profundidad - 1, false, aiPlayer, -Infinity, Infinity);
            return { celda, h };
        });
    },

    _minimax(tablero, profundidad, esMax, aiPlayer, alpha, beta) {
        if (profundidad === 0 || tablero.terminado)
            return this._euristico(tablero, aiPlayer);

        let val = esMax ? -Infinity : Infinity;

        for (const celda of tablero.celdasLibres()) {
            const clon = tablero.clonar();
            clon.hacerJugada(celda);
            const h = this._minimax(clon, profundidad - 1, !esMax, aiPlayer, alpha, beta);
            if (esMax) {
                if (h > val) val = h;
                if (val > alpha) alpha = val;
            } else {
                if (h < val) val = h;
                if (val < beta) beta = val;
            }
            if (alpha >= beta) break;
        }
        return val;
    },

    _euristico(tablero, aiPlayer) {
        let res = 0;
        for (let i = 0; i < 3; i++) {
            res += this._valorLinea(tablero, i, 0, 1, aiPlayer);
            res += this._valorLinea(tablero, i, 1, 0, aiPlayer);
        }
        res += this._valorLinea(tablero, 0, 1, 1, aiPlayer);
        res += this._valorLinea(tablero, 2, 1, -1, aiPlayer);
        return res;
    },

    _valorLinea(tablero, idx, dir1, dir2, aiPlayer) {
        const aux = [0, 0, 0];
        const f0 = dir1 === 0 ? idx : 0;
        const c0 = dir2 === -1 ? 2 : (dir2 === 0 ? idx : 0);

        for (let j = 0; j < 3; j++) {
            const pos = (f0 + dir1 * j) * 3 + (c0 + dir2 * j);
            aux[tablero.celdas[pos]]++;
        }

        const op = 3 - aiPlayer;
        const caso = aux[aiPlayer] * 10 + aux[op];

        if (caso === 10 || caso === 20) return 1;
        if (caso === 1  || caso === 2)  return -1;
        if (caso === 30) return 1e9;
        if (caso === 3)  return -1e9;
        return 0;
    }
};
