#!/usr/bin/env node
/**
 * Hook before_compile de Cordova.
 *
 * Sobrescribe platforms/android/.../www/js/build-config.js con el valor
 * real de release/debug, para que app.js sepa si debe pedir anuncios de
 * AdMob en modo test (isTesting) o produccion. Se registra en
 * before_compile (no before_build) porque para entonces "prepare" ya ha
 * copiado www/ al platform y no lo volvera a pisar.
 */

const fs = require('fs');
const path = require('path');

module.exports = function (context) {
    const projectRoot = context.opts.projectRoot;
    const destino = path.join(
        projectRoot, 'platforms', 'android', 'app', 'src', 'main', 'assets', 'www', 'js', 'build-config.js'
    );

    if (!fs.existsSync(path.dirname(destino))) {
        console.log('[build-config] destino no existe todavia, se omite.');
        return;
    }

    const esRelease = !!(context.opts.options && context.opts.options.release);
    const contenido = `// Generado por hooks/inject-build-config.js en el build. No editar a mano.\nwindow.APP_DEBUG = ${!esRelease};\n`;

    fs.writeFileSync(destino, contenido, 'utf8');
    console.log('[build-config] APP_DEBUG=' + !esRelease + ' (release=' + esRelease + ')');
};
