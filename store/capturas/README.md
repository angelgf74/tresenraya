# Capturas para la ficha de Google Play

Tomadas del dispositivo real (1220×2712) con el rediseño minimalista de R2-P7 y los
iconos propios de R3-P1, y recortadas a **1220×2440**.

## Por qué ese tamaño

Play exige que el lado largo no pase del doble del corto. La captura en crudo del
móvil es 1220×2712 (2,22:1) y **se rechazaría**. Quitando la barra de estado (122 px)
y la de navegación (150 px) queda 2:1 exacto — y Play además recomienda no incluir
las barras del sistema.

El recorte lo hace `store/recorta-png.js` (Node puro, sin dependencias):

```
node recorta-png.js entrada.png salida.png 0 122 1220 2440
```

## Las capturas

| Fichero | Qué muestra |
|---|---|
| `es-1-victoria.png` | Tablero con la línea ganadora. Es la mejor primera: se entiende el juego de un vistazo |
| `es-2-estadisticas.png` | Estadísticas persistentes con porcentajes |
| `es-3-ayuda.png` | Ayuda en español |
| `es-4-vs-ia.png` | Humano contra IA en nivel Imposible, con Deshacer disponible |
| `es-5-tema-oscuro.png` | El mismo juego en tema oscuro |
| `es-6-torneo.png` | Modo torneo, al mejor de 3, con su marcador |

Play pide un mínimo de 2 y admite hasta 8 por idioma. El orden del listado es el
orden sugerido: la primera es la que más se ve.

## Set en inglés (`en-US`)

Las mismas pantallas con el idioma cambiado desde el botón de la app. Play pide un
mínimo de 2 por idioma, así que con estas dos ya se puede publicar la ficha en
inglés; si no se suben, Play reutiliza las españolas.

| Fichero | Qué muestra |
|---|---|
| `en-1-victoria.png` | Tablero con la línea ganadora |
| `en-2-estadisticas.png` | Estadísticas, con el desglose contra la IA (`0W · 2L · 0D`) |

Faltan los equivalentes de ayuda, humano contra IA, tema oscuro y torneo.

## Cómo se repite el proceso

1. `adb -s <serie> shell cmd notification set_dnd priority` — **importante**: sin
   esto una notificación entrante se cuela en la captura. Ya pasó una vez.
2. Llevar la app al estado que se quiere retratar.
3. `adb -s <serie> exec-out screencap -p > crudo.png`
4. `node store/recorta-png.js crudo.png store/capturas/salida.png 0 122 1220 2440`
5. Al terminar: `adb -s <serie> shell cmd notification set_dnd off`

Las coordenadas de los botones cambian según lo que esté visible (el selector de
nivel se oculta en humano contra humano, la fila de configuración aparece con el
torneo). Sacarlas con `uiautomator dump` en vez de a ojo.
