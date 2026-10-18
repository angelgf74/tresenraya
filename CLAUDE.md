# CLAUDE.md

Tres en Raya (`agf.tresenraya`): tres en raya con IA minimax para Android, con Cordova.
La app está en `www/`, la misma que `deploy-web.ps1` publica como versión web.
`hooks/copy-android-config.js` copia `android-config/` a `platforms/android` antes de
cada build. Tests: `npm test`; lint: `npm run lint`. El trabajo pendiente está en `ROADMAP.md`.

## Publicar en Google Play

Igual en todos los proyectos Android, con `gplay` (skill `google-play`), desde la raíz:

    gplay version --parche        # o --menor, --mayor, x.y.z
    gplay compilar                # AAB firmado y verificado en release/
    gplay subir --canal internal  # ensayo; con --publicar, de verdad

La firma la hace `gplay compilar`. El keystore está en `~/.google-play/keystores/` y su
contraseña en el Administrador de credenciales de Windows. En el proyecto no hay
contraseñas ni scripts de firma. La configuración está en `playstore/gplay.json`, las notas
en `playstore/listing/<idioma>/changelogs/<versionCode>.txt`, la ficha en
`playstore/listing/` (`gplay ficha descargar` / `publicar`) y su material de trabajo
(capturas, gráficos, política de privacidad) en `playstore/fuentes/`.

Para probar en el móvil: `gplay compilar --apk` y después `.\install-usb.ps1`, que instala
el APK más reciente de `release/` y abre la app.
