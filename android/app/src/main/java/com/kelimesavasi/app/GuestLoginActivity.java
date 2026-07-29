package com.kelimesavasi.app;

import android.content.Intent;
import android.os.Bundle;
import android.text.InputFilter;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.Timestamp;
import com.google.firebase.auth.AuthResult;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.FirebaseFirestore;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.TimeZone;

public class GuestLoginActivity extends AppCompatActivity {

    private static final String TAG = "GuestLoginActivity";
    private EditText etNickname;
    private Button btnContinue;
    private TextView tvBack;
    private FirebaseAuth auth;
    private FirebaseFirestore db;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ImmersiveModeHelper.enableImmersiveMode(this);
        setContentView(R.layout.activity_guest_login);

        // Safe dynamic Firebase initializer
        initializeFirebaseSafely();

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance(FirebaseApp.getInstance(), "ai-studio-kelimesava-50aadbd1-03ed-4d0c-9769-866981f84d1c");

        etNickname = findViewById(R.id.et_guest_nickname);
        btnContinue = findViewById(R.id.btn_guest_continue);
        tvBack = findViewById(R.id.tv_guest_back);

        // Set maximum length to 27 characters and restrict characters to letters, digits, underscores, and periods
        InputFilter characterFilter = new InputFilter() {
            @Override
            public CharSequence filter(CharSequence source, int start, int end, android.text.Spanned dest, int dstart, int dend) {
                StringBuilder sb = new StringBuilder();
                for (int i = start; i < end; i++) {
                    char c = source.charAt(i);
                    if (Character.isLetterOrDigit(c) || c == '_' || c == '.') {
                        sb.append(c);
                    }
                }
                if (sb.length() == (end - start)) {
                    return null; // keep original input
                }
                return sb.toString();
            }
        };

        etNickname.setFilters(new InputFilter[]{
            new InputFilter.LengthFilter(27),
            characterFilter
        });

        btnContinue.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                handleGuestLogin();
            }
        });

        tvBack.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish(); // Finish current activity to return to the parent LoginActivity menu
            }
        });
    }

    private void initializeFirebaseSafely() {
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseOptions options = new FirebaseOptions.Builder()
                    .setProjectId("premium-realm-47c1c")
                    .setApplicationId("1:115209512617:web:741bd44e0dd493abb02bb8")
                    .setApiKey("AIzaSyDvabWvC2Qt5oky_l2hitSLpfd3x5NViEc")
                    .build();
                FirebaseApp.initializeApp(this, options);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error initializing Firebase: " + e.getMessage(), e);
        }
    }

    private void handleGuestLogin() {
        String rawNickname = etNickname.getText().toString();
        final String cleanNickname = rawNickname.trim();

        // 1. Validation
        if (cleanNickname.isEmpty()) {
            etNickname.setError("Kullanıcı adı boş bırakılamaz!");
            Toast.makeText(this, "Lütfen bir kullanıcı adı girin.", Toast.LENGTH_SHORT).show();
            return;
        }

        if (cleanNickname.length() < 5) {
            etNickname.setError("En az 5 karakter olmalıdır!");
            Toast.makeText(this, "Girdiğiniz kullanıcı adı çok kısa!", Toast.LENGTH_SHORT).show();
            return;
        }

        if (cleanNickname.length() > 27) {
            etNickname.setError("En fazla 27 karakter olmalıdır!");
            Toast.makeText(this, "Girdiğiniz kullanıcı adı çok uzun!", Toast.LENGTH_SHORT).show();
            return;
        }

        // Regex validation: letters (including Turkish chars), digits, underscore, period
        String nicknameRegex = "^[a-zA-Z0-9_\\.çğıöşüÇĞİÖŞÜ]+$";
        if (!cleanNickname.matches(nicknameRegex)) {
            etNickname.setError("Kullanıcı adı sadece harf, sayı, alt tire (_) ve nokta (.) içerebilir!");
            Toast.makeText(this, "Kullanıcı adı geçersiz karakterler içeriyor!", Toast.LENGTH_SHORT).show();
            return;
        }

        // 2. Perform Firebase Anonymous Sign-In
        btnContinue.setEnabled(false);
        Toast.makeText(this, "Misafir girişi yapılıyor, lütfen bekleyin...", Toast.LENGTH_SHORT).show();

        auth.signInAnonymously()
            .addOnCompleteListener(this, new OnCompleteListener<AuthResult>() {
                @Override
                public void onComplete(@NonNull Task<AuthResult> task) {
                    if (task.isSuccessful()) {
                        FirebaseUser firebaseUser = auth.getCurrentUser();
                        if (firebaseUser != null) {
                            saveGuestProfileToFirestore(firebaseUser.getUid(), cleanNickname);
                        } else {
                            btnContinue.setEnabled(true);
                            Toast.makeText(GuestLoginActivity.this, "Giriş başarısız oldu. Lütfen tekrar deneyin.", Toast.LENGTH_LONG).show();
                        }
                    } else {
                        btnContinue.setEnabled(true);
                        String errorMessage = task.getException() != null ? task.getException().getLocalizedMessage() : "Bilinmeyen bir hata oluştu.";
                        Toast.makeText(GuestLoginActivity.this, "Bağlantı Hatası: " + errorMessage, Toast.LENGTH_LONG).show();
                    }
                }
            });
    }

    private void saveGuestProfileToFirestore(final String uid, final String nickname) {
        DocumentReference userRef = db.collection("users").document(uid);
        
        // Generate ISO date format for perfect compatibility with React app
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        String isoNow = sdf.format(new Date());

        HashMap<String, Object> userData = new HashMap<>();
        userData.put("uid", uid);
        userData.put("id", uid); // Bind 'id' for full Javascript web compatibility
        userData.put("name", nickname);
        userData.put("isAnonymous", true);
        userData.put("nameSet", true);
        userData.put("createdAt", Timestamp.now());
        userData.put("updatedAt", Timestamp.now());
        userData.put("lastUpdated", isoNow);
        userData.put("dailyScore", 0);

        // Pre-populate core stats mapping to prevent JS parsing errors on fresh logins
        HashMap<String, Object> stats = new HashMap<>();
        stats.put("gamesPlayed", 0);
        stats.put("gamesWon", 0);
        stats.put("currentStreak", 0);
        stats.put("maxStreak", 0);
        
        ArrayList<Integer> winDistribution = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            winDistribution.add(0);
        }
        stats.put("winDistribution", winDistribution);
        userData.put("stats", stats);

        userRef.set(userData)
            .addOnSuccessListener(new OnSuccessListener<Void>() {
                @Override
                public void onSuccess(Void aVoid) {
                    Toast.makeText(GuestLoginActivity.this, "Oturum Başarıyla Açıldı!", Toast.LENGTH_SHORT).show();
                    
                    // Clear back stack and open MainActivity
                    Intent intent = new Intent(GuestLoginActivity.this, MainActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    startActivity(intent);
                    finish();
                }
            })
            .addOnFailureListener(new OnFailureListener() {
                @Override
                public void onFailure(@NonNull Exception e) {
                    btnContinue.setEnabled(true);
                    Toast.makeText(
                        GuestLoginActivity.this,
                        "Kullanıcı verisi kaydedilemedi: " + e.getLocalizedMessage(),
                        Toast.LENGTH_LONG
                    ).show();
                }
            });
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
