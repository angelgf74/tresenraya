#!/usr/bin/env node
/**
 * Hook before_build de Cordova.
 *
 * Copia la configuracion de optimizacion (R8) desde android-config/ al
 * proyecto Android generado. Cordova regenera platforms/android en cada
 * "platform add", de modo que estos ficheros se perderian si vivieran solo
 * dentro de platforms/.
 *
 *   android-config/build-extras.gradle  -> platforms/android/app/build-extras.gradle
 *   android-config/proguard-rules.pro   -> platforms/android/app/proguard-rules.pro
 *   android-config/keep.xml             -> platforms/android/app/src/main/res/raw/keep.xml
 *
 * Ademas garantiza que gradle.properties declare android.enableR8.fullMode=true.
 */

const fs = require('fs');
const path = require('path');

module.exports = function (context) {
    const projectRoot = context.opts.projectRoot;
    const androidRoot = path.join(projectRoot, 'platforms', 'android');

    if (!fs.existsSync(androidRoot)) {
        console.log('[optimizacion] platforms/android no existe todavia, se omite.');
        return;
    }

    const srcDir = path.join(projectRoot, 'android-config');
    const appDir = path.join(androidRoot, 'app');

    const copias = [
        ['build-extras.gradle', path.join(appDir, 'build-extras.gradle')],
        ['proguard-rules.pro', path.join(appDir, 'proguard-rules.pro')],
        ['keep.xml', path.join(appDir, 'src', 'main', 'res', 'raw', 'keep.xml')]
    ];

    copias.forEach(function ([nombre, destino]) {
        const origen = path.join(srcDir, nombre);
        if (!fs.existsSync(origen)) {
            throw new Error('[optimizacion] Falta el fichero ' + origen);
        }
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.copyFileSync(origen, destino);
        console.log('[optimizacion] ' + nombre + ' -> ' + path.relative(projectRoot, destino));
    });

    // R8 en modo completo (por defecto en AGP 8, se declara de forma explicita
    // para que no dependa del valor por defecto de la version de AGP).
    //
    // org.gradle.caching / org.gradle.parallel: "cordova platform add/rm android"
    // regenera gradle.properties y pierde cualquier flag puesto a mano, por eso
    // se fuerzan aqui igual que enableR8.fullMode. El cache de Gradle vive en
    // ~/.gradle/caches (fuera de platforms/), asi que sobrevive a esa regeneracion
    // y acelera builds de release sucesivos reutilizando salidas de tareas ya
    // ejecutadas antes.
    const propsPath = path.join(androidRoot, 'gradle.properties');
    const flags = [
        'android.enableR8.fullMode=true',
        'org.gradle.caching=true',
        'org.gradle.parallel=true'
    ];
    let props = fs.existsSync(propsPath) ? fs.readFileSync(propsPath, 'utf8') : '';

    flags.forEach(function (flag) {
        const clave = flag.split('=')[0];
        const patron = new RegExp('^' + clave.replace(/\./g, '\\.') + '\\s*=', 'm');
        if (!patron.test(props)) {
            if (props.length && !props.endsWith('\n')) props += '\n';
            props += flag + '\n';
            fs.writeFileSync(propsPath, props, 'utf8');
            console.log('[optimizacion] gradle.properties -> ' + flag);
        }
    });
};
