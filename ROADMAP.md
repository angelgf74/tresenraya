# Roadmap de mejoras

Lista de mejoras identificadas, priorizada por impacto/esfuerzo. Marcar `[x]` al implementar.

---

# Ronda 1 — revisión inicial (13/14 completados)

## P0 — Seguridad (hacer primero)
- [x] `config.xml`: `<access origin="*" />` y `allow-intent href="http://*/*"` demasiado abiertos — restringido a orígenes reales (jsdelivr, cdnjs, fontawesome, gstatic) + solo `https` en allow-intent
- [x] Separación IDs AdMob test/producción — `hooks/inject-build-config.js` (before_compile) genera `js/build-config.js` con `APP_DEBUG` según `--release`; `app.js` usa `isTesting: !!window.APP_DEBUG`

## P1 — Alto impacto, bajo esfuerzo
- [x] `localStorage` sin try/catch general en `cargarPrefs()` — envuelto en try/catch, más `guardarPref()` que protege también los `setItem`
- [x] `LINEAS` duplicado en `Tablero._evaluar()` y `Tablero.lineaGanadora()` — sacado a constante de módulo en `game.js`
- [x] Accesibilidad: celdas ahora `role="button"`, `tabindex`, `aria-label` dinámico (vacía/X/O), `aria-disabled`, soporte Enter/Espacio
- [x] Botón de reinicio de marcador manual (`btnResetMarcador`) junto al marcador, sin togglear jugador

## P2 — Valor medio, más esfuerzo
- [x] Estadísticas persistentes — `Estado.estadisticas` `{jugadas, victoriasX, victoriasO, tablas}` guardado en `localStorage('Estadisticas')`, nuevo botón/modal `btnStats` con % victorias y botón de borrado
- [ ] Automatizar chequeo de versionCode contra track Play antes de compilar — pospuesto (necesita cuenta de servicio de Play Developer API; decisión pendiente del usuario)
- [x] Estado global disperso en `app.js` — migrado a objeto único `const Estado = {...}`, todas las referencias actualizadas y probadas

## P3 — Bajo impacto / oportunista
- [x] `game.js`: poda alpha-beta añadida en `Juego.mejorJugada`/`_minimax` — verificado con autojuego (perfecta vs perfecta 20/20 tablas, perfecta nunca pierde) que el resultado no cambia, solo menos nodos
- [x] Tuning de dificultad — se encontró que "Medio" (profundidad 4) perdía más partidas (4/9 aperturas) que "Fácil" (profundidad 2, 2/9) contra rival perfecto, bug preexistente no introducido por la poda. Cambiado Medio a profundidad 3 (empata tasa de derrota con Fácil, ya no es peor) en `index.html` (select + texto ayuda) y `app.js` (`Estado.nivel` por defecto)
- [x] i18n — nuevo `js/i18n.js` con diccionario es/en y `t()`/`aplicarIdioma()`; atributos `data-i18n`/`data-i18n-title`/`data-i18n-aria` en `index.html`; strings dinámicos de `app.js` (aria-label de celdas, modal de resultado, estadísticas) migrados a `t()`; botón `btnIdioma` en extras-row, persistido en `localStorage('Idioma')`. Probado en navegador: cambio ES↔EN, ayuda completa, partida y stats en inglés, persiste tras recargar
- [x] `deploy-release.ps1` / build: `hooks/copy-android-config.js` ahora también fuerza `org.gradle.caching=true` y `org.gradle.parallel=true` en `gradle.properties` (que Cordova regenera en cada `platform add/rm`); el caché de Gradle vive en `~/.gradle/caches`, fuera de `platforms/`, así que sobrevive y acelera builds sucesivos. La detección de JDK/Gradle/SDK en sí ya era rápida (unos `Test-Path`), no hacía falta cachearla

---

# Ronda 2 — revisión ampliada

Segunda pasada sobre zonas no cubiertas en la ronda 1 (`sounds.js`, `index.js`, CSS completo,
`package.json`, `.gitignore`, `android-config/`, ciclo de vida Cordova). Los ítems marcados
**[verificado]** se comprobaron ejecutando la app en el navegador, no solo leyendo el código.

## R2-P0 — Bugs de comportamiento (usuario los sufre hoy)

- [x] **Indicador de turno invertido** — `renderJugadores()` resaltaba al jugador que NO tenía el
      turno (`turno === (idx === 0 ? 2 : 1)`). Corregido a `turno === idx + 1` y ajustadas las
      clases iniciales `conturno`/`sinturno` de `jug1`/`jug2` en `index.html`, que arrastraban la
      misma inversión. Verificado en navegador en tres turnos consecutivos
- [x] **El temporizador sigue corriendo con un modal abierto** — `iniciarTimer(reanudar)` admite
      ahora continuar desde `tiempoRestante` en vez de reiniciar; nuevas `pausarTimer()` /
      `reanudarTimer()` / `hayModalAbierto()`, enganchadas en `mostrarAyuda`/`cerrarAyuda` y
      `mostrarEstadisticas`/`cerrarEstadisticas`. Verificado: congela en 14 s durante 2,5 s con el
      modal abierto y reanuda desde 14 al cerrar
- [x] **Botón atrás de Android sin manejar** — nuevo `onBackButton()`: cierra el modal abierto si
      lo hay (ayuda y estadísticas se cierran; los de resultado y torneo ejecutan su acción de
      aceptar), y si no hay ninguno pide confirmación con doble pulsación mostrando un toast
      (nuevo `#toast` + estilos + cadena `pulsaAtrasSalir` en es/en). Verificado los cinco casos
- [x] **Sin `pause`/`resume`, con `KeepRunning` por defecto (true)** — nuevos `onAppPause()` /
      `onAppResume()` sobre los eventos `pause`/`resume` de Cordova, más `visibilitychange` para
      el navegador. Verificado: no descuenta en segundo plano y reanuda al volver; en el caso
      combinado (segundo plano con modal abierto) sigue congelado al volver y solo reanuda al
      cerrar el modal

Los tres listeners se registran en `bindEvents()`, no dentro del arranque de `deviceready`, para
que los dos caminos de arranque (Cordova y navegador) compartan el mismo cableado.

## R2-P1 — Accesibilidad (completar lo que la ronda 1 dejó a medias) ✔

- [x] **Controles de icono inalcanzables por teclado** — `btnTema`, `btnAyuda`, `btnVolumen`,
      `jug1` y `jug2` pasan de `<i>` con `onclick` a `<button>` con el icono dentro
      (`aria-hidden`) y nueva clase `.btn-icono` que les quita la apariencia nativa. Los render
      correspondientes apuntan ahora al `<i>` interior. `aria-label` dinámico y traducido en
      volumen (Silenciar/Activar sonido) y jugadores ("Jugador 1: humano. Pulsa para cambiar a
      IA"). Añadido también `aria-label` a `btnTimer`, `btnTorneo`, `btnStats` y `btnIdioma`, que
      solo tenían `title`, y `aria-hidden` a los 34 iconos decorativos (HTML y generados por JS)
- [x] **Sin estilo de foco visible** — regla `:focus-visible` global (ámbar sobre el fondo
      turquesa) más una variante turquesa con `outline-offset` negativo para las celdas, que son
      claras u oscuras según el tema. Eliminados los dos `outline: none` de `#txtNivel` y
      `.config-select` que anulaban el anillo (WCAG 2.4.7)
- [x] **Estructura ARIA del tablero inválida** — `#tableroGrid` pasa de `role="grid"` a
      `role="group"`, coherente con hijos `role="button"`. Además navegación con flechas entre
      celdas: izquierda/derecha no saltan de fila y los cuatro bordes no se salen del tablero
- [x] **Slider de volumen sin nombre accesible** — `aria-label` traducido vía `data-i18n-aria`
- [x] **Modales sin gestión de foco** — nuevos `alAbrirModal()`, `alCerrarModal()` y
      `onKeyDownGlobal()`: el foco entra al abrir (botón principal), queda atrapado con Tab y
      Shift+Tab, Escape cierra, y al cerrar vuelve al elemento que lo abrió. `hayModalAbierto()` y
      `cerrarModalAbierto()` se reescriben sobre una tabla `MODALES` común. El cuerpo de la ayuda,
      que tiene scroll propio, recibe `tabindex="0"` para poder recorrerlo con el teclado
- [x] **Sin `prefers-reduced-motion`** — media query que desactiva animación por animación en vez
      de con una regla global: un `animation: none` indiscriminado dejaría los puntos de
      "Pensando" en su fotograma final (`opacity: 0`), invisibles

## R2-P2 — Infraestructura del proyecto

- [x] **El proyecto no está bajo control de versiones** — `git init` + commit base con 51
      ficheros. Antes de comitear se comprobó que `build.json` y `release-signing.properties`
      (contraseñas de firma en claro) quedan fuera por `.gitignore`, que `upload_certificate.pem`
      es un `BEGIN CERTIFICATE` sin clave privada, y que la única coincidencia de "password" en el
      contenido es el texto de ejemplo de la ayuda de `deploy-release.ps1`. Se añadió `.idea/` al
      `.gitignore` (caché autogenerada de Android Studio). Cada bloque de trabajo va en su rama y
      se fusiona a `master`
- [x] **Sin tests** — 18 tests con el runner integrado de Node (`node:test`), **cero dependencias
      nuevas**, en `test/`: 10 de `Tablero` (turnos, jugadas inválidas, las 8 líneas ganadoras para
      ambos jugadores, tablas, `lineaGanadora`, copia profunda de `clonar`, `reset`) y 8 de la IA
      (remate, bloqueo, perfecta contra perfecta siempre en tablas, la perfecta no pierde nunca
      desde ninguna apertura). `npm test` ya funciona.
      Incluye la **regresión del bug de dificultad de la ronda 1**: comprueba que ningún nivel
      pierde más partidas que el inferior contra juego perfecto. Validado que el test falla si se
      devuelve "Medio" a profundidad 4 (4 derrotas/9 frente a las 2/9 de "Fácil").
      `test/helpers/cargar-juego.js` carga `game.js` con `new Function` y no con `vm`: un contexto
      de VM es otro realm y los arrays tendrían otro `Array.prototype`, con lo que
      `deepStrictEqual` fallaría con contenidos idénticos
- [x] **Sin linter** — ESLint 10 con configuración plana en `eslint.config.js` y script
      `npm run lint`. Declara qué global aporta cada fichero (`Tablero`/`Juego`/`LINEAS` de
      `game.js`, `t`/`aplicarIdioma` de `i18n.js`, `Estado` de `app.js`, `playSound` de
      `sounds.js`, `APP_DEBUG` del hook) para que `no-undef` detecte referencias inexistentes;
      `no-redeclare` con `builtinGlobals: false` para que el fichero que define una global no se
      denuncie a sí mismo. Bloques aparte para hooks y tests (CommonJS). Sale limpio, y
      comprobado que caza el fallo que motivó la regla: dos nombres de función mal escritos se
      reportan como `no-undef`. La instalación se hizo tras un `--dry-run` que confirmó que solo
      añadía paquetes; verificado después que `plugins/` y `platforms/` quedaron intactos

## R2-P3 — Limpieza y robustez ✔

- [x] **Restos de la plantilla Cordova empaquetados en el APK** — confirmado por `grep` que nada
      los referenciaba y borrados `www/js/index.js`, `www/css/index.css` y `www/img/logo.png`
      (carpeta `img/` eliminada al quedar vacía)
- [x] **Metadatos de `package.json` sin personalizar** — `description` y `author` actualizados,
      `version` sincronizada con `config.xml` (`1.0.24`), quitado `"main": "index.js"` (apuntaba al
      fichero muerto de arriba; nada hacía `require()` del paquete)
- [x] **`admob.interstitial.show()` sin comprobación ni captura de errores** — `mostrarInterstitial()`
      ahora es `async`, comprueba `isReady()` antes de `show()` y captura errores de ambas
      llamadas; `precargarInterstitial()` también captura el `prepare()`. Verificado con un mock de
      `admob`: `isReady()=false` no llama a `show()`, `show()` rechazada no rompe la cadena, y cero
      `unhandledrejection` en los tres casos
- [x] **Hueco del banner aunque el banner no cargue** — el `paddingBottom` ya no se aplica al
      llamar a `prepare()`, sino en el evento `admob.banner.events.LOAD`; `LOAD_FAIL` lo retira.
      Verificado con el mock: sin evento `LOAD` no hay hueco, y `LOAD_FAIL` posterior a un `LOAD` lo
      limpia
- [x] **Interstitial encima del modal de resultado** — ya no se dispara a los 400 ms de abrir el
      modal; `refrescarEstado()` solo marca `Estado.interstitialPendiente`, y
      `aceptarModal()`/`aceptarModalTorneo()` lo consumen al aceptar, antes de la partida nueva.
      Verificado: el modal de resultado permanece visible sin interstitial encima, y el anuncio se
      dispara justo al pulsar Aceptar

## R2-P4 — Remates de i18n (derivados de la ronda 1)

- [x] **Destello en español antes de traducir** — `aplicarIdioma()` ya no espera a `load`/
      `deviceready`: nuevo listener `DOMContentLoaded` en `app.js` llama a `cargarPrefs()` +
      `aplicarIdioma()` en cuanto el DOM está listo, sin depender del puente de Cordova (que
      `crearCeldasDOM`/`bindEvents`/`iniciarJuego`/`initAdMob` sí necesitan y siguen esperando)
- [x] **Ese script inline lee `localStorage` sin `try/catch`** — envuelto en try/catch igual que
      `cargarPrefs()`; si `localStorage` lanza, se sigue con el tema por defecto
- [x] **Sin detección del idioma del dispositivo** — `cargarPrefs()` usa `navigator.language`
      (prefijo `en`) como idioma inicial cuando no hay `Idioma` guardado en `localStorage`
- [x] **Ficha de Play y `<name>` de `config.xml` solo en español** — textos ES/EN (nombre,
      descripción breve y completa, dentro de los límites de Play Console) en
      `store/play-store-listing.md`, listos para pegar en la ficha. Capturas quedan pendientes
      (necesitan la app corriendo en dispositivo/emulador); `<name>` de `config.xml` se deja en
      español, coincide con el nombre de la ficha ES y es solo la etiqueta del icono

## R2-P5 — Jugabilidad ✔

- [x] **La IA es completamente determinista** — `mejorJugada()` ahora reúne todas las celdas que
      empatan a la puntuación máxima y elige una al azar. Para que el empate se detecte bien, cada
      rama del nivel raíz se evalúa con ventana completa (`-Infinity, Infinity`) en vez de
      compartir `alpha` entre hermanas: podar con una cota compartida devolvía a veces un valor que
      solo es una cota (no el valor real minimax), y comparar cotas con `===` habría fallado. Test
      nuevo: desde el tablero vacío (las 9 aperturas empatan a valor 0 contra rival perfecto),
      50 llamadas a `mejorJugada` no devuelven siempre la misma celda. La fuerza del motor no
      cambia — sigue sin perder nunca y las 9 aperturas siguen en tablas contra rival perfecto
- [x] **Deshacer de un solo nivel y solo humano vs humano** — `Estado.tableroAnterior` (una sola
      posición) pasa a `Estado.historial` (pila), con `guardarHistorial()` antes de cada jugada
      (humana, de la IA y por timeout). `deshacerJugada()` ahora también funciona contra la IA:
      hace `pop()` en bucle mientras el tablero recuperado tenga turno de una IA, así una sola
      pulsación retira la jugada humana y la respuesta de la IA a la vez y deja el turno en manos
      de un humano; en humano vs humano cada pulsación retira un nivel, y se puede repetir tantas
      veces como jugadas haya en la pila. Deshabilitado solo cuando no hay ningún jugador humano
      (`hayHumano()`) o mientras la IA está "pensando" (`Estado.esperandoIA`)

## R2-P6 — Nueva estrategia de dificultad ✔

- [x] **La dificultad dejó de basarse en la profundidad de búsqueda** — antes cada nivel recortaba
      el árbol de minimax (2/3/6/9 jugadas por delante), lo que podía dar lugar a errores tácticos
      "raros" en niveles bajos. Ahora `Juego.jugada()` busca siempre a profundidad completa (juego
      perfecto) y el nivel solo decide `probabilidadAzar`, la probabilidad de ignorar la mejor
      jugada y elegir una al azar: Fácil 50 %, Medio 25 %, Difícil 10 %, Imposible 0 %
      (`NIVEL_FACIL`/`NIVEL_MEDIO`/`NIVEL_DIFICIL`/`NIVEL_IMPOSIBLE` en `app.js`). `mejorJugada()`
      se mantiene intacta (la usan los tests de fuerza bruta) y ahora comparte con `jugada()` el
      cálculo por celda vía `Juego._evaluarJugadas()`
- [x] **El azar por nivel no es igual de "torpe" en todos** — en Fácil se elige entre cualquier
      celda libre (puede regalar la partida); en Medio/Difícil se excluyen las jugadas que sean una
      derrota forzada (`h <= Juego.UMBRAL_PERDEDORA`, `-1e8`), así que esos niveles varían la
      jugada sin cometer errores catastróficos. `localStorage('Nivel')` con un valor de la época de
      profundidades (2/3/6/9) se ignora y cae al nivel por defecto, en vez de leerse como un
      porcentaje de azar sin sentido
- [x] Tests reescritos con un PRNG determinista (`mulberry32`) que sustituye `Math.random`
      temporalmente, para que las pruebas de dificultad (300 partidas por nivel contra un rival
      perfecto) sean reproducibles y no intermitentes. Verificado: Fácil pierde más que Medio, que
      pierde más que Difícil, que pierde más que Imposible (0 derrotas); y que `soloNoPerdedoras`
      realmente excluye jugadas perdedoras cuando está activo

## R2-P7 — Rediseño visual ✔

- [x] **Título solapado con los botones de tema/ayuda** — `.titulo-row` pasa de botones
      `position:absolute` sobre un `h1` a ancho completo a un layout flex: los botones reservan su
      hueco real y el título usa como máximo el ancho que sobra entre ambos
- [x] **Scroll vertical no deseado** — menos padding arriba/abajo en `.game-container`, quitado el
      padding-top que la media query de "pantallas grandes" añadía de más en la mayoría de móviles,
      y clamp de fuente del título reducido para que quepa en una línea con el hueco de los botones
      ya reservado. Verificado: capturas antes/después de un swipe salen idénticas (nada que
      desplazar)
- [x] **Rediseño minimalista editorial** — explorado antes como maqueta en un canvas de diseño (3
      direcciones: minimalista, lúdico arcade, oscuro premium); elegida la minimalista. Sustituye
      el gradiente turquesa/glossy original por papel cálido (oscuro: negro cálido), un acento por
      ficha (terracota X, verde azulado O) en vez del ámbar de marca, Bitter (serif) para títulos y
      marcador, Work Sans para el resto, tarjetas de borde fino en vez de sombras pesadas. Aplicado
      también a la pantalla de carga, la barra de estado de Android (estática — sin
      `cordova-plugin-statusbar` no puede seguir el toggle claro/oscuro en tiempo real) y las
      cabeceras de los cuatro modales (resultado, torneo, estadísticas, ayuda)
- [x] **Línea de la jugada ganadora se salía del tablero** — `renderLineaGanadora()` la alargaba 1
      unidad completa más allá del centro de cada celda extrema (el centro ya está a 0.5 de su
      borde, así que sobraba media celda por lado, muy visible en diagonales). Alargada 0.5 en su
      lugar; verificado en dispositivo que ahora termina justo en el borde del tablero

---

# Ronda 3 — auditoría completa

Repaso a fondo de toda la aplicación (lógica de `app.js`, red, empaquetado, cumplimiento de Play,
accesibilidad) tras cerrar la ronda 2. Los dos primeros se reprodujeron en dispositivo antes de
arreglarlos.

## R3-P0 — Bugs de estado reproducidos en dispositivo ✔

- [x] **Deshacer congelaba la partida** — con la IA como jugador 1 (X, mueve primera), la primera
      posición del historial tiene turno de IA. `puedeDeshacer()` solo comprobaba que el historial
      no estuviese vacío, así que una sola pulsación dejaba el tablero esperando una jugada de IA
      que ya nadie dispara: celdas bloqueadas, botón oculto, sin salida salvo cambiar de nivel o de
      jugador. Reproducido en dispositivo. La condición pasa a exigir que quede en la pila alguna
      posición con turno humano (`Estado.historial.some(t => !esIA(t.turno))`), que es a la que
      `deshacerJugada()` sabe volver; `hayHumano()` desaparece porque la nueva condición lo
      subsume. Con test de regresión (`test/deshacer.test.js`), verificado que falla con la
      condición antigua
- [x] **Ficha fantasma por reentrancia de la IA** — durante los 380 ms de "Pensando", cualquier
      acción que reinicie la partida (cambiar nivel o tipo de jugador, torneo) hacía que la jugada
      en vuelo cayese sobre el tablero ya reseteado: aparecía una ficha que no había puesto nadie.
      Reproducido en dispositivo. Nuevo `Estado.generacion`, que `iniciarJuego()` incrementa;
      `jugadaIA()`, `refrescarEstado()`, `onCeldaClick()` y `tiempoAgotado()` capturan su valor y
      se abortan tras cada `await` si ha cambiado. De paso arregla que el modal de resultado se
      abriese sobre una partida nueva si se reiniciaba durante su pausa de 1600 ms

## R3-P1 — La app no funciona sin conexión ✔

- [x] **Ni una fuente ni un CSS de terceros iba dentro del APK** — Font Awesome, Bootstrap y Google
      Fonts se descargaban de tres CDNs en cada arranque en frío. En una instalación nueva sin
      cobertura **las X y las O no se dibujaban** (eran glifos de Font Awesome), ni los avatares ni
      los botones de extras: el juego quedaba inservible, y la ficha de Play afirma justo lo
      contrario. Ahora no queda ninguna referencia externa en `www/` salvo `ssl.gstatic.com` en la
      CSP, que es del SDK de anuncios y no pinta interfaz
- [x] **Iconos propios en SVG** — sprite de 19 símbolos en `index.html`, dibujados a trazo sobre
      una rejilla de 24 con el mismo grosor y remates, en lugar de los ~15 glifos de Font Awesome.
      Se referencian con `<svg class="ico"><use href="#i-...">`, y `.ico` mide 1,15em, así que el
      tamaño lo sigue mandando el `font-size` que ya tenía cada control (1em se quedaba corto: un
      glifo llena su caja más que un dibujo sobre rejilla). Desde JS se cambian reapuntando el
      `<use>` (`ponIcono()`) o se generan con `svgIco()`. El icono de tablas colorea círculo y aspa
      con las variables de tema mediante un `style` propio, porque los selectores CSS externos no
      alcanzan el contenido clonado por `<use>` pero las variables sí se heredan
- [x] **Botones propios en vez de Bootstrap** — `.btn`, `.btn-primary` y `.btn-outline-danger`
      escritos a mano (unas 30 líneas) sustituyen a la hoja entera de ~230 KB, que solo se cargaba
      por 4 clases. De paso pasan a 48 px de alto mínimo, el objetivo táctil recomendado
- [x] **Fuentes locales** — Bitter y Work Sans en `www/fonts` (88 KB en total: son variables, un
      fichero por familia cubre todo el rango de pesos, subconjunto latino con acentos, eñe y
      signos de apertura). El APK pasa de 2,89 a 2,97 MB y deja de descargar ~415 KB en el primer
      arranque
- [x] **CSP y whitelist al mínimo** — fuera `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`,
      `ka-f.fontawesome.com`, `fonts.googleapis.com` y `fonts.gstatic.com`, tanto de la CSP como de
      los `<access origin>` de `config.xml`. Aprovechando el repaso caen también `'unsafe-eval'`
      (solo hacía falta para Bootstrap) y `media-src *` (el sonido es WebAudio sintetizado), dos de
      los puntos que R3-P3 dejaba pendientes

## R3-P2 — Play y cumplimiento

- [x] **Fuera los anuncios** — la app servía anuncios sin pedir consentimiento, y AdMob exige un
      CMP certificado para el EEE desde enero de 2024, con el público de la app mayoritariamente
      español. Las tres salidas eran: añadir solo el consentimiento, migrar de plugin, o quitar
      los anuncios.
      Al mirar las opciones de cerca, migrar a `admob-plus-cordova` no era el refugio que parecía:
      **no tiene ninguna versión estable** (el `latest` de npm es `2.0.0-alpha.19`), su última
      publicación es de noviembre de 2024 y el último push al repositorio de abril de 2025, con 96
      issues abiertas. Sí se descubrió que `cordova-plugin-consent` solo depende de
      `com.google.android.ump:user-messaging-platform`, así que el consentimiento se podría haber
      añadido sin tocar el plugin de anuncios — pero también es alpha.
      Como los anuncios no generaban ingresos apreciables, se optó por quitarlos: es la única
      opción que **reduce** el proyecto en vez de añadirle deuda. Con ellos se van el CMP
      pendiente, el permiso `AD_ID`, la declaración de datos de Play, el plugin muerto de 2018, el
      `resolutionStrategy` que hacía falta para que compilara, las reglas de ProGuard del SDK y
      todo el mecanismo `APP_DEBUG` (`hooks/inject-build-config.js` y `www/js/build-config.js`),
      que existía solo para el `isTesting` de los anuncios.
      La app deja de hacer una sola petición de red: la CSP pasa a `connect-src 'none'` y no queda
      ningún `<access origin>`
- [ ] **Ficha de Play** — enlazar política de privacidad y **rehacer la declaración de datos**,
      que ya no debe declarar identificador de publicidad. Textos actualizados en
      `store/play-store-listing.md` ("Gratis, sin anuncios y sin registro"). Capturas rehechas:
      seis en español y dos en inglés en `store/capturas/`, del dispositivo real y recortadas a
      1220×2440 (2:1, el máximo que admite Play; la captura en crudo es 2,22:1 y se rechazaría).
      Play pide un mínimo de dos por idioma, así que la ficha en inglés ya se puede publicar;
      faltan sus equivalentes de ayuda, humano contra IA, tema oscuro y torneo, y el
      procedimiento para repetirlas está en `store/capturas/README.md`
- [x] **Con el modo torneo o el temporizador activos, el contenido desbordaba la pantalla** — la
      fila de configuración que aparece bajo los extras no cabía y quedaba cortada por el borde
      inferior, dejando a medias el selector de "al mejor de N" y el marcador del torneo.
      Detectado al preparar las capturas de Play. Medido en el navegador con el ancho y la
      densidad reales del dispositivo de pruebas (388 px CSS, 777 px de alto útil): el contenido
      pedía 784 px, desbordaba por 7. Recortado el aire sobrante en seis puntos del ritmo vertical
      (contenedor, fila de turnos, tablero, tarjetas de jugador, franja bajo el tablero y fila de
      extras) hasta 768 px, con 9 de holgura; y el tablero pasa a `min(320px, 92vw, 44vh)` para
      que en pantallas más cortas ceda él antes que amontonar los controles. Verificado en el
      dispositivo con torneo y temporizador activos a la vez, que es el peor caso

## R3-P3 — Accesibilidad, limpieza y producto

- [x] **Contraste** — `--ink-suave` pasa de `#7A7364` (4,40:1, por debajo del 4,5 de WCAG AA) a
      `#736C5E` (4,87:1); afectaba a Deshacer, temporizador y etiquetas de configuración. El
      jugador sin turno sube de 1,77:1 a 3,18:1 en claro (`#968A72`) y de 2,26:1 a 3,38:1 en
      oscuro (alfa .3 → .4): sigue claramente atenuado frente al jugador activo, que es su
      función, pero ya se distingue. Texto principal y fichas iban sobrados (14,8:1 y ~5-6:1)
- [x] **Objetivos táctiles pequeños** — el control de volumen pasa de 7 a 24 px de alto (gratis:
      el alto de la fila lo marca el botón del altavoz) y reiniciar marcador de 32 a 44 px
      (también gratis, cabe dentro del marcador). La fila de extras sube de 32 a 40 px y no a los
      48 recomendados a propósito: cada píxel ahí sale de la holgura vertical que acaba de
      recuperar el arreglo del desbordamiento, y encoger el tablero —el corazón del juego— por
      unos botones secundarios no compensa. Las celdas siguen en 109 dp
- [x] **Código muerto** — fuera `window.setTema` de `sounds.js` (y su global en la config de
      ESLint), las variables CSS `--nivel-focus` y `--wash`, y las preferencias
      `SplashScreenDelay` / `AutoHideSplashScreen` de `config.xml`, cuyo plugin no está instalado
- [x] **CSP más estricta** — hecho junto con R3-P1: fuera `'unsafe-eval'`, `media-src *` y todos
      los orígenes de CDN, en la CSP y en los `<access origin>`
- [x] **`app.js` sin cobertura real** — tenía un único test, porque cada paso llama a
      `getElementById`. En vez de partir en dos las mil líneas de producción —refactor grande, sin
      red y con la app en Play— se resolvió por el otro lado: `test/helpers/dom-falso.js`, un DOM
      de mentira de unas 130 líneas que basta para ejecutar `app.js` entero fuera del navegador.
      Se prueba así el código real, no una versión reescrita para poder probarla.
      Es tosco a propósito (no parsea HTML ni entiende CSS: `querySelector` dentro de un elemento
      mira su `innerHTML` como texto, que es todo lo que app.js pregunta), pero **los ids salen
      del `index.html` de verdad y pedir uno inexistente revienta**: si app.js pasa a buscar un
      elemento que nadie puso en el HTML, lo cazan los tests, y eso el linter no lo ve.
      Cinco tests nuevos (`test/flujo.test.js`) recorren jugada, respuesta de la IA, deshacer y
      fin de partida. Comprobado que dos de ellos fallan si se quitan los guardas de
      `Estado.generacion`: son regresiones de verdad de los bugs de R3-P0, no decorado
- [x] **La partida en curso no sobrevivía al cierre de la app** — solo persistían preferencias y
      estadísticas: cerrar a media partida la perdía, junto con el marcador y los modos de torneo
      y temporizador, que tampoco se guardaban. Nueva clave `Sesion` en `localStorage` con
      tablero, historial de deshacer, turno inicial, marcador y esos modos, versionada para que un
      cambio de formato futuro se descarte en vez de reventar el arranque. Se guarda tras cada
      jugada y en `pause` (no solo en `pause`: un cierre forzado no siempre lo dispara), y
      `arrancar()` reanuda si había partida a medias. Todo lo que se lee se valida pieza a pieza:
      una sesión corrupta, incompleta o de otra versión cae a partida limpia. Si al reanudar le
      toca a la IA, mueve ella; si el reloj estaba activo, arranca.
      Cinco tests nuevos (`test/sesion.test.js`), incluido que el historial recuperado sean
      tableros de verdad y no objetos planos —que reventarían al deshacer— y que una partida ya
      terminada no se reanude pero sí conserve marcador y modos. Verificado además en el navegador
      comparando el estado antes de cerrar y al volver a abrir: idéntico, con Deshacer disponible
- [x] **Estadísticas poco informativas** — contaban por símbolo (X/O), sin distinguir si ganó el
      humano o la IA ni en qué nivel. Se conserva ese bloque global (es lo que hay acumulado) y se
      añade `estadisticas.vsIA`, con una cuenta por nivel vista **desde el lado del humano**: da
      igual que juegue con X o con O, "ganadas" son las suyas. Las partidas entre dos humanos no
      entran ahí, que no dicen nada de la IA. El modal muestra una sección "Contra la IA" con una
      línea por nivel jugado (`0G · 2P · 0T`), y omite los niveles sin partidas para no llenar
      medio modal de ceros. El conteo se extrajo a `anotarEstadisticas()`, sin DOM, y tiene seis
      tests: entre ellos que con el humano de O una victoria de X cuente como derrota suya —el
      signo depende de quién es el humano, no del símbolo— y que unas estadísticas guardadas antes
      de este cambio se conserven en vez de tirarse
- [ ] **Torneo: bajar el "mejor de" con el torneo ya ganado** lo reinicia en silencio, sin declarar
      campeón (`onBestOfChange`)

Medido y descartado como problema: la IA a profundidad completa tarda 6,9 ms en el peor caso
(tablero vacío) en escritorio, así que la ventana de 380 ms de "Pensando" sobra en móvil.
