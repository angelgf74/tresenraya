// Configuración de ESLint (formato plano, ESLint 9+).
//
// El código de www/js no usa módulos: los ficheros se cargan con <script> y se
// comunican por globales. Por eso cada uno declara aquí lo que exporta y lo que
// consume, y así `no-undef` puede detectar de verdad una referencia a algo que
// no existe —el tipo de fallo que este proyecto no podría cazar de otro modo—.

const globalesNavegador = {
    document: 'readonly',
    window: 'readonly',
    navigator: 'readonly',
    localStorage: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    setInterval: 'readonly',
    clearInterval: 'readonly',
    console: 'readonly',
    KeyboardEvent: 'readonly',
    Event: 'readonly'
};

module.exports = [
    {
        // Nada que analizar en dependencias ni en lo que genera Cordova
        ignores: ['node_modules/**', 'platforms/**', 'plugins/**']
    },

    {
        // Código de la app (navegador, sin módulos)
        files: ['www/js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globalesNavegador,

                // Definidas por el propio proyecto, cada una en su fichero
                Tablero: 'readonly',        // game.js
                Juego: 'readonly',          // game.js
                LINEAS: 'readonly',         // game.js
                playSound: 'readonly',      // sounds.js
                setSoundVolume: 'readonly', // sounds.js
                setSoundMuted: 'readonly',  // sounds.js
                t: 'readonly',              // i18n.js
                aplicarIdioma: 'readonly',  // i18n.js
                TRADUCCIONES: 'readonly',   // i18n.js
                Estado: 'readonly',         // app.js

                // Del entorno Cordova / plugins
                cordova: 'readonly',
                webkitAudioContext: 'readonly',
                AudioContext: 'readonly'
            }
        },
        rules: {
            'no-undef': 'error',

            // Las globales del proyecto se declaran arriba para que no-undef
            // funcione en quien las consume, pero el fichero que las define las
            // declara de verdad: sin desactivar builtinGlobals, cada definición
            // se reportaría como redeclaración de sí misma. La regla sigue
            // detectando redeclaraciones reales dentro de un mismo fichero.
            'no-redeclare': ['error', { builtinGlobals: false }],

            // Por el mismo motivo, una global declarada aquí y consumida desde
            // otro fichero parece "sin usar" en el suyo.
            'no-unused-vars': ['warn', {
                args: 'none',
                caughtErrors: 'none',
                varsIgnorePattern: '^(Tablero|Juego|LINEAS|TRADUCCIONES|Estado|t|aplicarIdioma)$'
            }],
            'no-dupe-keys': 'error',
            'no-dupe-args': 'error',
            'no-duplicate-case': 'error',
            'no-unreachable': 'error',
            'no-fallthrough': 'error',
            'no-self-compare': 'error',
            'no-constant-condition': 'error',
            'valid-typeof': 'error',
            eqeqeq: ['warn', 'smart']
        }
    },

    {
        // Hooks de build y configuración: Node, con CommonJS
        files: ['hooks/**/*.js', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { require: 'readonly', module: 'writable', __dirname: 'readonly', console: 'readonly' }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': 'warn'
        }
    },

    {
        // Tests: Node, con el runner integrado
        files: ['test/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly', module: 'writable', __dirname: 'readonly', console: 'readonly',
                // Los tests de flujo esperan a los delay() de la app
                setTimeout: 'readonly', clearTimeout: 'readonly', process: 'readonly'
            }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': 'warn'
        }
    }
];
