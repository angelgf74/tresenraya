#!/usr/bin/env pwsh
# Despliega la version WEB de Tres en Raya (carpeta www/) al servidor,
# sustituyendo la app Blazor que vivia antes en /apps/tresenraya.
# El HTML/CSS/JS es el mismo que corre dentro del APK: se parchea solo
# lo que distingue el entorno web (se quita cordova.js, se abre el CSP
# para la analitica y se inyecta el script de analitica y la politica
# de privacidad).
#
# Uso: .\deploy-web.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$PROJECT_ROOT = $PSScriptRoot
$WWW_SRC      = Join-Path $PROJECT_ROOT 'www'
$PRIVACY_SRC  = Join-Path $PROJECT_ROOT 'store\privacy-policy.html'
$STAGING      = Join-Path $env:TEMP 'tresenraya-web-deploy'
$REMOTE_HOST  = 'agfserver-angel'
$REMOTE_DIR   = '/apps/tresenraya'
$ANALYTICS_TAG = '    <script src="https://angelgf.com.es/webanalyticsapi/tracker.js?site=46bc500e-d78e-4697-a2a6-3552387ba772"></script>'

if (-not (Test-Path $WWW_SRC)) {
    Write-Host "ERROR: No existe la carpeta www/ en $WWW_SRC" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $PRIVACY_SRC)) {
    Write-Host "ERROR: No existe store\privacy-policy.html" -ForegroundColor Red
    exit 1
}

# ── 1. Copiar www/ a un directorio de staging limpio ──────────────────────────
Write-Host "[1/4] Preparando staging..." -ForegroundColor Cyan
if (Test-Path $STAGING) { Remove-Item $STAGING -Recurse -Force }
Copy-Item $WWW_SRC $STAGING -Recurse

# ── 2. Parchear index.html para el entorno web ─────────────────────────────────
Write-Host "[2/4] Adaptando index.html (quitar cordova.js, CSP, analitica)..." -ForegroundColor Cyan
$indexPath = Join-Path $STAGING 'index.html'
$html = Get-Content $indexPath -Raw -Encoding UTF8

if ($html -notmatch [regex]::Escape('<script src="cordova.js"></script>')) {
    Write-Host "ERROR: No se encontro <script src=`"cordova.js`"></script> en index.html (cambio el formato?)" -ForegroundColor Red
    exit 1
}
$html = [regex]::Replace($html, '\r?\n\s*<script src="cordova\.js"></script>', '')

if ($html -notmatch [regex]::Escape("script-src 'self' 'unsafe-inline';")) {
    Write-Host "ERROR: No se encontro la directiva script-src esperada en el CSP (cambio el formato?)" -ForegroundColor Red
    exit 1
}
$html = $html.Replace("script-src 'self' 'unsafe-inline';", "script-src 'self' 'unsafe-inline' https://angelgf.com.es;")
$html = $html.Replace("connect-src 'none';", "connect-src https://angelgf.com.es;")

# El comentario de arriba del CSP explica el 'none' de la app Android; en la
# web hay una peticion (la analitica), asi que ya no aplica tal cual.
# Patron sin acentos en el propio .ps1 (Windows PowerShell 5.1 lee el script
# con la codificacion del sistema si no hay BOM; un literal acentuado en el
# .ps1 no coincidiria con el UTF-8 real del index.html).
$patronComentarioCsp = '(?s)<!-- Todo va dentro del APK.*?puente de Cordova\. -->\r?\n'
if ($html -notmatch $patronComentarioCsp) {
    Write-Host "ERROR: No se encontro el comentario del CSP esperado en index.html (cambio el formato?)" -ForegroundColor Red
    exit 1
}
$html = [regex]::Replace($html, $patronComentarioCsp,
    "    <!-- Version web: mismo HTML/CSS/JS que el APK. connect-src solo permite`r`n         la analitica (angelgf.com.es); sin ella seria 'none' como en Android. -->`r`n"
)

if ($html -notmatch [regex]::Escape('</body>')) {
    Write-Host "ERROR: No se encontro </body> en index.html" -ForegroundColor Red
    exit 1
}
$html = $html.Replace('</body>', "$ANALYTICS_TAG`n</body>")

Set-Content $indexPath -Value $html -NoNewline -Encoding UTF8

# ── 3. Copiar la politica de privacidad ────────────────────────────────────────
Copy-Item $PRIVACY_SRC (Join-Path $STAGING 'privacy-policy.html') -Force

# ── 4. Subir: limpia el remoto (era la app Blazor) y copia el staging completo ─
Write-Host "[3/4] Limpiando y subiendo a ${REMOTE_HOST}:${REMOTE_DIR} ..." -ForegroundColor Cyan
& ssh $REMOTE_HOST "rm -rf '$REMOTE_DIR' && mkdir -p '$REMOTE_DIR'"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: fallo al limpiar el directorio remoto." -ForegroundColor Red; exit 1 }

& scp -r "$STAGING\." "${REMOTE_HOST}:${REMOTE_DIR}/"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: fallo la subida por scp." -ForegroundColor Red; exit 1 }

# scp/mkdir remoto crea con umask restrictivo (0700) -> nginx no puede leer
& ssh $REMOTE_HOST "chmod 755 '$REMOTE_DIR' && find '$REMOTE_DIR' -type d -exec chmod 755 {} \; && find '$REMOTE_DIR' -type f -exec chmod 644 {} \;"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: fallo al ajustar permisos remotos." -ForegroundColor Red; exit 1 }

# ── 5. Verificacion basica ─────────────────────────────────────────────────────
Write-Host "[4/4] Verificando..." -ForegroundColor Cyan
$code = & curl.exe -s -o NUL -w '%{http_code}' 'https://tresenraya.angelgf.com.es/'
Write-Host "https://tresenraya.angelgf.com.es/ -> HTTP $code" -ForegroundColor $(if ($code -eq '200') { 'Green' } else { 'Yellow' })

Write-Host "`nDesplegado." -ForegroundColor Green
