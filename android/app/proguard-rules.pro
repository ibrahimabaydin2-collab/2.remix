# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Preserve line numbers and source file names for cleaner crash reports (highly recommended for Google Play Console crash logging)
-keepattributes SourceFile,LineNumberTable,Signature,InnerClasses,EnclosingMethod,Annotation,JavascriptInterface

# Keep JavascriptInterfaces for web-to-native bridges (critical for WebView/Capacitor apps)
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep MainActivity and all inner classes/bridges
-keep class com.kelimesavasi.app.MainActivity** { *; }
-keepclassmembers class com.kelimesavasi.app.MainActivity** { *; }
-keep class com.kelimesavasi.app.** { *; }
-keepclassmembers class com.kelimesavasi.app.** { *; }

# Keep all Capacitor core and plugin classes
-keep class com.getcapacitor.** { *; }
-keepclassmembers class com.getcapacitor.** { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin { *; }

# Keep WebView and JavaScript bridge engine
-keep class android.webkit.** { *; }
-keepclassmembers class android.webkit.** { *; }

# Suppress warnings for legacy or missing references in gRPC, OkHttp, and Google dependencies (fixes R8 minifyRelease failure)
-dontwarn io.grpc.**
-dontwarn com.squareup.okhttp.**
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.checkerframework.**
-dontwarn javax.annotation.**
-dontwarn com.google.errorprone.annotations.**
-dontwarn org.codehaus.mojo.animal_sniffer.**

# Keep Firebase Auth, Firestore, and gRPC/WebChannel classes intact
-keep class com.google.firebase.** { *; }
-keepclassmembers class com.google.firebase.** { *; }
-keep class io.grpc.** { *; }

# Keep OkHttp, WebSockets, and Net networking classes
-keep class com.squareup.okhttp3.** { *; }
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keep class java.net.** { *; }

# Keep Play Services and AdMob classes
-keep class com.google.android.gms.** { *; }
-keep class com.google.android.gms.ads.** { *; }



