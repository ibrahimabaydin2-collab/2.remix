package com.kelimesavasi.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Zararsız ve Güvenli İzin Entegrasyon Yardımcısı (PermissionHelper)
 * 
 * Bu sınıf, Kelime Savaşı projesinde mevcut kodları ve akışları bozmadan;
 * Galeri, Kamera, Mikrofon ve Bildirim izinlerini yönetmek için tasarlanmıştır.
 * modern registerForActivityResult API'sini ve Android 13/14+ (Build.VERSION.SDK_INT) kontrollerini kullanır.
 */
public class PermissionHelper {

    public interface PermissionCallback {
        /**
         * İzin isteme işlemi tamamlandığında tetiklenir.
         * @param results İzin adı ve kabul edilip edilmediği (true/false) eşleşmesi.
         */
        void onPermissionsResult(Map<String, Boolean> results);
    }

    private final ActivityResultLauncher<String[]> permissionLauncher;

    /**
     * PermissionHelper Constructor.
     * UYARI: Bu constructor Activity'nin onCreate() aşamasında veya Activity başlatılmadan önce çağrılmalıdır.
     * 
     * @param activity İlgili ComponentActivity (veya AppCompatActivity)
     * @param callback İzinlerin durumunu dinleyen callback arayüzü
     */
    public PermissionHelper(ComponentActivity activity, final PermissionCallback callback) {
        this.permissionLauncher = activity.registerForActivityResult(
            new ActivityResultContracts.RequestMultiplePermissions(),
            results -> {
                if (callback != null) {
                    callback.onPermissionsResult(results);
                }
            }
        );
    }

    /**
     * Belirtilen izin grubunu veya tekil izni kullanıcıdan güvenli bir şekilde talep eder.
     * 
     * @param permissions Talep edilecek izin listesi (Örn: Manifest.permission.CAMERA)
     */
    public void launch(String[] permissions) {
        if (permissions != null && permissions.length > 0) {
            permissionLauncher.launch(permissions);
        }
    }

    // ==========================================
    // Statik İzin Kontrol Fonksiyonları (Sorgulama)
    // ==========================================

    /**
     * Kamera izninin verilip verilmediğini kontrol eder.
     */
    public static boolean hasCameraPermission(Context context) {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Mikrofon (Ses Kaydetme) izninin verilip verilmediğini kontrol eder.
     */
    public static boolean hasMicrophonePermission(Context context) {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Galeri (Fotoğraf Erişimi) izninin verilip verilmediğini kontrol eder.
     * Android 13 (API 33) ve üzeri için READ_MEDIA_IMAGES, daha eski sürümler için READ_EXTERNAL_STORAGE kontrol eder.
     */
    public static boolean hasGalleryPermission(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) { // Android 13+
            return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED;
        } else {
            return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
        }
    }

    /**
     * Bildirim (POST_NOTIFICATIONS) izninin verilip verilmediğini kontrol eder.
     * Android 13 (API 33) öncesinde bildirimler varsayılan olarak açık olduğu için her zaman true döner.
     */
    public static boolean hasNotificationPermission(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) { // Android 13+
            return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    // ==========================================
    // Dinamik İzin Dizisi Hazırlama (İstek için)
    // ==========================================

    /**
     * Kamera izni istemek için gerekli izin dizisini döner.
     */
    public static String[] getCameraPermissions() {
        return new String[]{ Manifest.permission.CAMERA };
    }

    /**
     * Mikrofon izni istemek için gerekli izin dizisini döner.
     */
    public static String[] getMicrophonePermissions() {
        return new String[]{ Manifest.permission.RECORD_AUDIO };
    }

    /**
     * Galeri izni istemek için gerekli izin dizisini döner (Sürüm kontrollü).
     */
    public static String[] getGalleryPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return new String[]{ Manifest.permission.READ_MEDIA_IMAGES };
        } else {
            return new String[]{ Manifest.permission.READ_EXTERNAL_STORAGE };
        }
    }

    /**
     * Bildirim izni istemek için gerekli izin dizisini döner (Sürüm kontrollü).
     */
    public static String[] getNotificationPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return new String[]{ Manifest.permission.POST_NOTIFICATIONS };
        }
        return new String[0];
    }

    /**
     * Tüm izinleri (Kamera, Mikrofon, Galeri, Bildirim) bir kerede istemek için sürüm duyarlı toplu dizi hazırlar.
     */
    public static String[] getAllPermissions() {
        List<String> list = new ArrayList<>();
        list.add(Manifest.permission.CAMERA);
        list.add(Manifest.permission.RECORD_AUDIO);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            list.add(Manifest.permission.READ_MEDIA_IMAGES);
            list.add(Manifest.permission.POST_NOTIFICATIONS);
        } else {
            list.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }
        return list.toArray(new String[0]);
    }
}
