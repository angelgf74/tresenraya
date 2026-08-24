#!/usr/bin/env pwsh
# Instala en el movil, por USB, el APK ya compilado. No compila nada: para eso
# esta deploy-release.ps1. Sirve para reinstalar rapido, o cuando el movil se
# desconecto a mitad y solo falta el paso de instalar.
#
# Uso:
#   .\install-usb.ps1                → espera al movil, instala y abre la app
#   .\install-usb.ps1 -NoLanzar      → instala pero no la abre
#   .\install-usb.ps1 -Espera 0      → no espera: falla ya si no hay movil
#   .\install-usb.ps1 -Serie ABC123  → elige un movil concreto (si hay varios)

param(
    [switch]$NoLanzar,
    [int]$Espera = 60,
    [string]$Serie = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RAIZ     = $PSScriptRoot
$APK      = Join-Path $RAIZ 'platforms\android\app\build\outputs\apk\release\app-release.apk'
$PAQUETE  = 'agf.tresenraya'
$ACTIVITY = "$PAQUETE/$PAQUETE.MainActivity"

# ── 1. El APK ────────────────────────────────────────────────────────────────
if (-not (Test-Path $APK)) {
    Write-Host "ERROR: no hay ningun APK compilado en:" -ForegroundColor Red
    Write-Host "  $APK"
    Write-Host "Compilalo primero con: .\deploy-release.ps1" -ForegroundColor Yellow
    exit 1
}

$apkInfo = Get-Item $APK
$tam = [math]::Round($apkInfo.Length / 1MB, 2)
Write-Host "APK    : $($apkInfo.Name) ($tam MB, $($apkInfo.LastWriteTime.ToString('dd/MM HH:mm')))" -ForegroundColor DarkGray

# Aviso de APK viejo: si se ha tocado el codigo despues de compilar, lo que se
# instale no llevara esos cambios. Es el fallo mas facil de cometer aqui.
$fuentes = @('www', 'config.xml', 'android-config', 'hooks') |
    ForEach-Object { Join-Path $RAIZ $_ } |
    Where-Object { Test-Path $_ } |
    ForEach-Object { Get-ChildItem $_ -Recurse -File -ErrorAction SilentlyContinue }

$masNuevo = $fuentes | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($masNuevo -and $masNuevo.LastWriteTime -gt $apkInfo.LastWriteTime) {
    $rel = $masNuevo.FullName.Replace("$RAIZ\", '')
    Write-Host ""
    Write-Host "AVISO: hay codigo mas nuevo que el APK." -ForegroundColor Yellow
    Write-Host "  $rel se toco el $($masNuevo.LastWriteTime.ToString('dd/MM HH:mm'))" -ForegroundColor Yellow
    Write-Host "  Se instalara el APK anterior, sin esos cambios." -ForegroundColor Yellow
    Write-Host "  Para incluirlos: .\deploy-release.ps1" -ForegroundColor Yellow
    Write-Host ""
}

# ── 2. El movil ──────────────────────────────────────────────────────────────
function Get-Dispositivos {
    # "adb devices" saca una cabecera y luego "<serie>	<estado>"; solo valen
    # los que estan en "device" (no "unauthorized" ni "offline").
    $salida = & adb devices 2>&1 | Select-Object -Skip 1
    $salida | ForEach-Object {
        $p = "$_" -split '\s+'
        if ($p.Count -ge 2 -and $p[1] -eq 'device') { $p[0] }
    }
}

$limite = (Get-Date).AddSeconds($Espera)
$dispositivos = @(Get-Dispositivos)

if ($dispositivos.Count -eq 0 -and $Espera -gt 0) {
    Write-Host "Esperando al movil (hasta $Espera s). Conectalo por USB..." -ForegroundColor Cyan
    while ($dispositivos.Count -eq 0 -and (Get-Date) -lt $limite) {
        Start-Sleep -Seconds 2
        $dispositivos = @(Get-Dispositivos)
    }
}

if ($dispositivos.Count -eq 0) {
    Write-Host "ERROR: no hay ningun movil conectado y autorizado." -ForegroundColor Red
    Write-Host "Comprueba el cable, que la depuracion USB este activada y que" -ForegroundColor Yellow
    Write-Host "hayas aceptado en el movil el aviso de 'Permitir depuracion USB'." -ForegroundColor Yellow
    & adb devices
    exit 1
}

if ($Serie) {
    if ($dispositivos -notcontains $Serie) {
        Write-Host "ERROR: el movil '$Serie' no esta entre los conectados:" -ForegroundColor Red
        $dispositivos | ForEach-Object { Write-Host "  $_" }
        exit 1
    }
    $movil = $Serie
} elseif ($dispositivos.Count -gt 1) {
    Write-Host "Hay varios moviles conectados:" -ForegroundColor Yellow
    $dispositivos | ForEach-Object { Write-Host "  $_" }
    Write-Host "Elige uno con: .\install-usb.ps1 -Serie <serie>" -ForegroundColor Yellow
    exit 1
} else {
    $movil = $dispositivos[0]
}

$modelo = (& adb -s $movil shell getprop ro.product.model 2>$null | Out-String).Trim()
Write-Host "Movil  : $movil $(if ($modelo) { "($modelo)" })" -ForegroundColor DarkGray

# ── 3. Instalar ──────────────────────────────────────────────────────────────
Write-Host "`nInstalando..." -ForegroundColor Cyan
$prev = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$salida = & adb -s $movil install -r $APK 2>&1 | Out-String
$ErrorActionPreference = $prev

if ($salida -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE') {
    Write-Host "ERROR: ya hay una version instalada firmada con otra clave." -ForegroundColor Red
    Write-Host "Android no deja actualizar por encima. Hay que desinstalarla:" -ForegroundColor Yellow
    Write-Host "  adb -s $movil uninstall $PAQUETE" -ForegroundColor Yellow
    Write-Host "OJO: eso borra los datos locales de la app (estadisticas y ajustes)." -ForegroundColor Yellow
    exit 1
}

if ($salida -notmatch 'Success') {
    Write-Host "ERROR: la instalacion fallo." -ForegroundColor Red
    Write-Host $salida.Trim()
    exit 1
}

Write-Host "Instalado correctamente." -ForegroundColor Green

# ── 4. Abrir ─────────────────────────────────────────────────────────────────
if (-not $NoLanzar) {
    & adb -s $movil shell am force-stop $PAQUETE | Out-Null
    & adb -s $movil shell am start -n $ACTIVITY | Out-Null
    Write-Host "App abierta en el movil." -ForegroundColor Green
}
