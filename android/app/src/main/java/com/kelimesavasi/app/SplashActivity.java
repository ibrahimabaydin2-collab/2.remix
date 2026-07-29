package com.kelimesavasi.app;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;

public class SplashActivity extends AppCompatActivity {

    private static final String TAG = "SplashActivity";
    private TextView tvLoadingStatus;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ImmersiveModeHelper.enableImmersiveMode(this);
        setContentView(R.layout.activity_splash);

        tvLoadingStatus = findViewById(R.id.splash_loading_text);
        if (tvLoadingStatus != null) {
            tvLoadingStatus.setText("Sistem hazırlanıyor...");
        }

        // Safely initialize Firebase so that the app never crashes on startup,
        // even if google-services.json is missing or not processed.
        initializeFirebaseSafely();

        // Sleek 1.5-second splash screen transition delay to show branding and perform check
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                checkUserSession();
            }
        }, 1500);
    }

    private void initializeFirebaseSafely() {
        try {
            if (tvLoadingStatus != null) {
                tvLoadingStatus.setText("Oturum servisleri bağlanıyor...");
            }
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseOptions options = new FirebaseOptions.Builder()
                    .setProjectId("premium-realm-47c1c")
                    .setApplicationId("1:115209512617:web:741bd44e0dd493abb02bb8")
                    .setApiKey("AIzaSyDvabWvC2Qt5oky_l2hitSLpfd3x5NViEc")
                    .build();
                FirebaseApp.initializeApp(this, options);
                Log.d(TAG, "Firebase manually initialized successfully!");
            } else {
                Log.d(TAG, "Firebase already initialized.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error initializing Firebase: " + e.getMessage(), e);
        }
    }

    private void checkUserSession() {
        try {
            if (tvLoadingStatus != null) {
                tvLoadingStatus.setText("Oyun yükleniyor...");
            }
            Intent intent = new Intent(this, MainActivity.class);
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to launch MainActivity, directing as fallback", e);
            Intent intent = new Intent(this, MainActivity.class);
            startActivity(intent);
        }
        finish();
    }

    @Override
    protected void onResume() {
        super.onResume();
        ImmersiveModeHelper.enableImmersiveMode(this);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            ImmersiveModeHelper.enableImmersiveMode(this);
        }
    }
}
