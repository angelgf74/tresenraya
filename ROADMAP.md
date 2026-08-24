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
