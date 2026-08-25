// DOM de mentira, lo justo para que app.js se ejecute entero fuera del
// navegador y se puedan probar sus flujos (jugada, respuesta de la IA,
// deshacer, fin de partida), no solo las funciones sueltas sin pantalla.
//
// Es deliberadamente tosco: no parsea HTML ni entiende CSS. `querySelector`
// dentro de un elemento se resuelve mirando su innerHTML como texto, que es
// todo lo que app.js necesita ("¿tiene ya una ficha esta celda?").
//
// Lo que sí es fiel: los ids salen del index.html de verdad, y pedir uno que
// no exista revienta. Así, si app.js pasa a buscar un elemento que nadie ha
// puesto en el HTML, los tests lo cazan — un fallo que el linter no ve.

const fs = require('node:fs');
const path = require('node:path');

const RUTA_HTML = path.join(__dirname, '..', '..', 'www', 'index.html');

function idsDelHtml() {
    const html = fs.readFileSync(RUTA_HTML, 'utf8');
    return [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
}

function crearNodo(doc, etiqueta) {
    const nodo = {
        tagName: (etiqueta || 'div').toUpperCase(),
        id: '',
        className: '',
        innerHTML: '',
        textContent: '',
        value: '',
        title: '',
        style: {},
        atributos: {},
        oyentes: {},
        hijos: [],
        _use: null,

        setAttribute(k, v) { this.atributos[k] = String(v); },
        getAttribute(k) { return k in this.atributos ? this.atributos[k] : null; },
        removeAttribute(k) { delete this.atributos[k]; },
        addEventListener(tipo, fn) { (this.oyentes[tipo] = this.oyentes[tipo] || []).push(fn); },
        appendChild(hijo) { this.hijos.push(hijo); return hijo; },
        focus() { doc.activeElement = this; },
        contains(otro) { return otro === this || this.hijos.includes(otro); },
        getClientRects() { return [{}]; },
        classList: {
            add() {}, remove() {}, contains() { return false; }
        },

        // Dispara los listeners registrados, que es como los tests simulan un
        // toque en una celda o un clic en un botón.
        disparar(tipo, evento) {
            (this.oyentes[tipo] || []).forEach(fn => fn(evento || { preventDefault() {} }));
        },

        // Suficiente para las dos preguntas que hace app.js: si la celda ya
        // tiene ficha (busca .ico-x / .ico-o) y el <use> de un icono.
        querySelector(sel) {
            if (sel === 'use') {
                if (!this._use) this._use = crearNodo(doc, 'use');
                return this._use;
            }
            const clase = sel.replace(/^\./, '');
            return this.innerHTML.includes(clase) ? crearNodo(doc, 'span') : null;
        },
        querySelectorAll() { return []; }
    };
    return nodo;
}

function crearDocumentoFalso() {
    const doc = {
        porId: new Map(),
        celdas: [],
        oyentes: {},
        activeElement: null,
        hidden: false,
        title: '',

        getElementById(id) {
            const el = this.porId.get(id);
            if (!el) throw new Error(
                `app.js busca el elemento "${id}", que no existe en www/index.html`);
            return el;
        },
        createElement(etiqueta) { return crearNodo(this, etiqueta); },
        addEventListener(tipo, fn) { (this.oyentes[tipo] = this.oyentes[tipo] || []).push(fn); },
        contains() { return true; },
        querySelector(sel) {
            if (sel.startsWith('#')) {
                const id = sel.slice(1).split(' ')[0];
                return this.porId.get(id) || null;
            }
            return crearNodo(this, 'div');
        },
        querySelectorAll(sel) {
            if (sel === '.celda') return this.celdas;
            return [];   // los [data-i18n] no hacen falta para probar la lógica
        },
        disparar(tipo, evento) {
            (this.oyentes[tipo] || []).forEach(fn => fn(evento || {}));
        }
    };

    doc.documentElement = crearNodo(doc, 'html');
    for (const id of idsDelHtml()) {
        const nodo = crearNodo(doc, 'div');
        nodo.id = id;
        doc.porId.set(id, nodo);
    }

    // El tablero lo llena crearCeldasDOM() con appendChild; se recogen ahí
    // para que querySelectorAll('.celda') las devuelva.
    const grid = doc.porId.get('tableroGrid');
    grid.appendChild = (hijo) => { doc.celdas.push(hijo); return hijo; };
    grid.innerHTML = '';

    return doc;
}

module.exports = { crearDocumentoFalso };
