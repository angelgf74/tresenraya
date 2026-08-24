#!/usr/bin/env pwsh
# Genera APK firmado (instalacion USB) o AAB firmado (Play Store)
# Uso:
#   .\deploy-release.ps1          → APK + instala por USB
#   .\deploy-release.ps1 -Modo aab → AAB para subir al Play Store

param(
    [ValidateSet('apk', 'aab')]
    [string]$Modo = 'apk'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$PROJECT_ROOT = $PSScriptRoot
$BUILD_JSON   = Join-Path $PROJECT_ROOT 'build.json'
$APK_PATH     = Join-Path $PROJECT_ROOT 'platforms\android\app\build\outputs\apk\release\app-release.apk'
$AAB_PATH     = Join-Path $PROJECT_ROOT 'platforms\android\app\build\outputs\bundle\release\app-release.aab'

# ── 0. Entorno de build ───────────────────────────────────────────────────────
# Estas variables se fijan SOLO para este proceso; no se toca el entorno global.
#
#  - JAVA_HOME: Gradle 8.14.2 no soporta Java 25 (el JDK del PATH es Temurin 25),
#               asi que se usa un JDK 17-24. El JBR de Android Studio es JDK 21.
#  - PATH:      Cordova exige un ejecutable "gradle" en el PATH (check_reqs.js
#               hace un simple `which gradle`) para regenerar el wrapper.
#  - ANDROID_HOME: sin esto Cordova deduce el SDK del PATH y acaba en
#               C:\Android, que solo tiene platform-tools.

$JAVA_CANDIDATOS = @(
    $env:CORDOVA_JAVA_HOME,
    'C:\Program Files\Android\Android Studio\jbr',
    'C:\Program Files\Eclipse Adoptium\jdk-21.0.9.10-hotspot'
)
$javaHome = $JAVA_CANDIDATOS | Where-Object { $_ -and (Test-Path (Join-Path $_ 'bin\java.exe')) } | Select-Object -First 1
if (-not $javaHome) {
    Write-Host "ERROR: No se encontro un JDK compatible (17-24)." -ForegroundColor Red
    Write-Host "Instala Android Studio o define CORDOVA_JAVA_HOME apuntando a un JDK 21." -ForegroundColor Yellow
    exit 1
}

$GRADLE_CANDIDATOS = @('C:\Desarrollo\gradle-8.14.2', 'C:\Gradle\gradle-8.14.2')
$gradleHome = $GRADLE_CANDIDATOS | Where-Object { Test-Path (Join-Path $_ 'bin\gradle.bat') } | Select-Object -First 1
if (-not $gradleHome) {
    # Fallback: usar la distribucion que el wrapper haya cacheado.
    $gradleHome = Get-ChildItem 'C:\Users\Angel\.gradle\wrapper\dists' -Directory -Recurse -Filter 'gradle-*' -Depth 2 -ErrorAction SilentlyContinue |
                  Where-Object { Test-Path (Join-Path $_.FullName 'bin\gradle.bat') } |
                  Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $gradleHome) {
    Write-Host "ERROR: No se encontro ninguna instalacion de Gradle." -ForegroundColor Red
    Write-Host "Copia una distribucion a C:\Desarrollo\gradle-8.14.2 o instala Gradle." -ForegroundColor Yellow
    exit 1
}

$ANDROID_SDK = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
if (-not (Test-Path $ANDROID_SDK)) {
    Write-Host "ERROR: No se encontro el Android SDK en $ANDROID_SDK" -ForegroundColor Red
    exit 1
}

$env:JAVA_HOME   = $javaHome
$env:ANDROID_HOME = $ANDROID_SDK
$env:PATH        = (Join-Path $gradleHome 'bin') + ';' + (Join-Path $javaHome 'bin') + ';' + $env:PATH

Write-Host "JDK    : $javaHome"    -ForegroundColor DarkGray
Write-Host "Gradle : $gradleHome"  -ForegroundColor DarkGray
Write-Host "SDK    : $ANDROID_SDK" -ForegroundColor DarkGray

# ── 1. Verificar build.json ───────────────────────────────────────────────────
if (-not (Test-Path $BUILD_JSON)) {
    Write-Host "ERROR: No existe build.json en el directorio del proyecto." -ForegroundColor Red
    Write-Host @'
Crea build.json con:
{
    "android": {
        "release": {
            "keystore": "C:/ruta/keystore.jks",
            "storePassword": "PASSWORD",
            "alias": "ALIAS",
            "password": "PASSWORD",
            "keystoreType": "jks"
        }
    }
}
'@ -ForegroundColor Cyan
    exit 1
}

# ── 2. Build ──────────────────────────────────────────────────────────────────
# El dispositivo se comprueba DESPUES de compilar: compilar no lo necesita, y
# antes bastaba con que el cable se soltara para tirar el build entero.
$pasos = if ($Modo -eq 'apk') { '1/2' } else { '1/2' }
Write-Host "`n[$pasos] Compilando $($Modo.ToUpper()) de release firmado..." -ForegroundColor Cyan
Set-Location $PROJECT_ROOT

$buildArgs = if ($Modo -eq 'apk') { @('build', 'android', '--release', "--buildConfig=$BUILD_JSON", '--', '--packageType=apk') } `
             else                  { @('build', 'android', '--release', "--buildConfig=$BUILD_JSON") }

$prev = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& cordova @buildArgs
$buildExit = $LASTEXITCODE
$ErrorActionPreference = $prev

if ($buildExit -ne 0) {
    Write-Host "`nERROR: Build fallido (exit code $buildExit)." -ForegroundColor Red
    exit 1
}

# ── 4. Verificar artefacto generado ──────────────────────────────────────────
if ($Modo -eq 'apk') {
    if (-not (Test-Path $APK_PATH)) {
        Write-Host "ERROR: No se encontro el APK en: $APK_PATH" -ForegroundColor Red
        exit 1
    }
    $size = [math]::Round((Get-Item $APK_PATH).Length / 1MB, 2)
    Write-Host "APK generado: $APK_PATH ($size MB)" -ForegroundColor Green

    # ── 4. Instalar por USB ───────────────────────────────────────────────────
    # Ya con el APK a salvo: si aqui falta el movil, no se ha perdido el build
    # y basta con enchufarlo y lanzar .\install-usb.ps1
    Write-Host "`n[2/2] Instalando por USB..." -ForegroundColor Cyan
    $devices = adb devices 2>&1 | Select-String -Pattern '\bdevice\b' | Where-Object { $_ -notmatch 'List of' }
    if (-not $devices) {
        Write-Host "El APK esta compilado, pero no hay ningun movil conectado." -ForegroundColor Yellow
        Write-Host "Conectalo y ejecuta: .\install-usb.ps1" -ForegroundColor Yellow
        exit 0
    }
    $deviceId = ($devices[0].ToString() -split '\s+')[0].Trim()
    Write-Host "Dispositivo: $deviceId" -ForegroundColor DarkGray
    $result = adb -s $deviceId install -r $APK_PATH 2>&1
    Write-Host $result
    if ($result -match 'Success') {
        Write-Host "`nAPK instalado correctamente." -ForegroundColor Green
        adb -s $deviceId shell am force-stop agf.tresenraya
        adb -s $deviceId shell am start -n "agf.tresenraya/agf.tresenraya.MainActivity"
        Write-Host "App iniciada en el dispositivo." -ForegroundColor Green
    } else {
        Write-Host "ERROR: La instalacion fallo." -ForegroundColor Red
        exit 1
    }

} else {
    if (-not (Test-Path $AAB_PATH)) {
        Write-Host "ERROR: No se encontro el AAB en: $AAB_PATH" -ForegroundColor Red
        exit 1
    }
    $size = [math]::Round((Get-Item $AAB_PATH).Length / 1MB, 2)
    Write-Host "`n[2/2] AAB generado: $AAB_PATH ($size MB)" -ForegroundColor Green
    Write-Host "Sube este archivo en Google Play Console > Produccion > Crear nueva version." -ForegroundColor Cyan
}
