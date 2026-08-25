# ============================================================================
#  Reglas R8 para Cordova  (agf.tresenraya)
#  Fuente de verdad: android-config/proguard-rules.pro
#  Se copia a platforms/android/app/proguard-rules.pro por el hook de Cordova.
# ============================================================================

# ── Stacktraces legibles en Play Console ────────────────────────────────────
# Sin esto los ANR/crashes llegan sin numero de linea. El mapping.txt que sube
# Gradle (build/outputs/mapping/release/) permite desofuscarlos.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Framework Cordova ───────────────────────────────────────────────────────
# Los plugins se instancian por nombre (Class.forName) a partir de los <feature>
# de res/xml/config.xml, asi que R8 no puede ver esas referencias.
-keep public class * extends org.apache.cordova.CordovaPlugin
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# ── Puente JavaScript <-> Java ──────────────────────────────────────────────
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses,EnclosingMethod
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Codigo de la app ────────────────────────────────────────────────────────
-keep class agf.tresenraya.** { *; }

# ── Avisos de clases opcionales ausentes del classpath ──────────────────────
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
