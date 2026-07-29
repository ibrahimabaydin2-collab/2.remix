package com.kelimesavasi.app;

import android.content.Intent;
import android.os.Bundle;
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
import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.AuthResult;
import com.google.firebase.auth.EmailAuthProvider;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthUserCollisionException;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.TimeZone;

public class EmailLoginActivity extends AppCompatActivity {

    private static final String TAG = "EmailLoginActivity";
    private EditText etEmail;
    private EditText etPassword;
    private Button btnSignIn;
    private Button btnSignUp;
    private TextView tvBack;
    private FirebaseAuth auth;
    private FirebaseFirestore db;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ImmersiveModeHelper.enableImmersiveMode(this);
        setContentView(R.layout.activity_email_login);

        // Safe dynamic Firebase initializer
        initializeFirebaseSafely();

        auth = FirebaseAuth.getInstance();
        // Use the exact custom database ID matching the web app config to prevent hanging / silent failures
        db = FirebaseFirestore.getInstance(FirebaseApp.getInstance(), "ai-studio-kelimesava-50aadbd1-03ed-4d0c-9769-866981f84d1c");

        etEmail = findViewById(R.id.et_email);
        etPassword = findViewById(R.id.et_password);
        btnSignIn = findViewById(R.id.btn_email_sign_in);
        btnSignUp = findViewById(R.id.btn_email_sign_up);
        tvBack = findViewById(R.id.tv_email_back);

        btnSignIn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                handleEmailSignIn();
            }
        });

        btnSignUp.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                handleEmailSignUp();
            }
        });

        tvBack.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
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

    private void handleEmailSignIn() {
        String email = etEmail.getText().toString().trim();
        String password = etPassword.getText().toString().trim();

        if (email.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "E-posta ve şifre alanları boş bırakılamaz!", Toast.LENGTH_SHORT).show();
            return;
        }

        setButtonsEnabled(false);
        Toast.makeText(this, "Giriş yapılıyor, lütfen bekleyin...", Toast.LENGTH_SHORT).show();

        auth.signInWithEmailAndPassword(email, password)
            .addOnCompleteListener(this, new OnCompleteListener<AuthResult>() {
                @Override
                public void onComplete(@NonNull Task<AuthResult> task) {
                    if (task.isSuccessful()) {
                        FirebaseUser user = auth.getCurrentUser();
                        if (user != null) {
                            checkAndSaveUserProfile(user);
                        }
                    } else {
                        setButtonsEnabled(true);
                        String errorMsg = task.getException() != null ? task.getException().getLocalizedMessage() : "Giriş başarısız.";
                        Toast.makeText(EmailLoginActivity.this, "Hata: " + errorMsg, Toast.LENGTH_LONG).show();
                    }
                }
            });
    }

    private void handleEmailSignUp() {
        final String email = etEmail.getText().toString().trim();
        final String password = etPassword.getText().toString().trim();

        if (email.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "E-posta ve şifre alanları boş bırakılamaz!", Toast.LENGTH_SHORT).show();
            return;
        }

        if (password.length() < 6) {
            etPassword.setError("Şifre en az 6 karakter olmalıdır!");
            return;
        }

        setButtonsEnabled(false);
        
        final FirebaseUser currentUser = auth.getCurrentUser();
        if (currentUser != null && currentUser.isAnonymous()) {
            // HESAP BAĞLAMA (ACCOUNT LINKING) ALTYAPISI
            Toast.makeText(this, "Misafir hesabı e-posta ile korunuyor...", Toast.LENGTH_SHORT).show();
            AuthCredential credential = EmailAuthProvider.getCredential(email, password);
            
            currentUser.linkWithCredential(credential)
                .addOnCompleteListener(this, new OnCompleteListener<AuthResult>() {
                    @Override
                    public void onComplete(@NonNull Task<AuthResult> task) {
                        if (task.isSuccessful()) {
                            FirebaseUser user = auth.getCurrentUser();
                            if (user != null) {
                                // Linking succeeded, update user profile on Firestore
                                checkAndSaveUserProfile(user);
                            }
                        } else {
                            // CREDENTIAL_ALREADY_IN_USE (ZATEN KULLANIMDA) KONTROLÜ
                            if (task.getException() instanceof FirebaseAuthUserCollisionException) {
                                Log.w(TAG, "Email already in use, falling back to direct login.");
                                Toast.makeText(EmailLoginActivity.this, "Bu e-posta zaten kullanımda. Mevcut hesaba giriş yapılıyor...", Toast.LENGTH_LONG).show();
                                directEmailSignIn(email, password);
                            } else {
                                setButtonsEnabled(true);
                                String errorMsg = getReadableErrorMessage(task.getException(), "Hesap bağlama başarısız.");
                                Toast.makeText(EmailLoginActivity.this, "Hata: " + errorMsg, Toast.LENGTH_LONG).show();
                            }
                        }
                    }
                });
        } else {
            // Normal sign up
            Toast.makeText(this, "Hesap oluşturuluyor, lütfen bekleyin...", Toast.LENGTH_SHORT).show();
            auth.createUserWithEmailAndPassword(email, password)
                .addOnCompleteListener(this, new OnCompleteListener<AuthResult>() {
                    @Override
                    public void onComplete(@NonNull Task<AuthResult> task) {
                        if (task.isSuccessful()) {
                            FirebaseUser user = auth.getCurrentUser();
                            if (user != null) {
                                checkAndSaveUserProfile(user);
                            }
                        } else {
                            setButtonsEnabled(true);
                            String errorMsg = getReadableErrorMessage(task.getException(), "Kayıt başarısız.");
                            Toast.makeText(EmailLoginActivity.this, "Kayıt Hatası: " + errorMsg, Toast.LENGTH_LONG).show();
                        }
                    }
                });
        }
    }

    private void directEmailSignIn(String email, String password) {
        auth.signInWithEmailAndPassword(email, password)
            .addOnCompleteListener(this, new OnCompleteListener<AuthResult>() {
                @Override
                public void onComplete(@NonNull Task<AuthResult> task) {
                    if (task.isSuccessful()) {
                        FirebaseUser user = auth.getCurrentUser();
                        if (user != null) {
                            checkAndSaveUserProfile(user);
                        }
                    } else {
                        setButtonsEnabled(true);
                        String errorMsg = getReadableErrorMessage(task.getException(), "Giriş başarısız.");
                        Toast.makeText(EmailLoginActivity.this, "Giriş Hatası: " + errorMsg, Toast.LENGTH_LONG).show();
                    }
                }
            });
    }

    private String getReadableErrorMessage(Exception exception, String defaultMsg) {
        if (exception == null) return defaultMsg;
        
        boolean isOpNotAllowed = false;
        if (exception instanceof com.google.firebase.auth.FirebaseAuthException) {
            com.google.firebase.auth.FirebaseAuthException e = (com.google.firebase.auth.FirebaseAuthException) exception;
            String errorCode = e.getErrorCode();
            if ("ERROR_OPERATION_NOT_ALLOWED".equals(errorCode) || (errorCode != null && errorCode.toLowerCase().contains("not_allowed"))) {
                isOpNotAllowed = true;
            }
        }
        String msg = exception.getMessage();
        if (msg != null && (msg.contains("operation-not-allowed") || msg.contains("auth/operation-not-allowed") || msg.contains("OPERATION_NOT_ALLOWED") || msg.contains("not allowed"))) {
            isOpNotAllowed = true;
        }
        
        if (isOpNotAllowed) {
            return "E-posta/Şifre girişi veya hesap bağlama aktif değil. Lütfen Firebase Console > Authentication > Sign-in method kısmından 'Email/Password' seçeneğini etkinleştirin veya geliştirici ayarlarını kontrol edin.";
        }
        
        return exception.getLocalizedMessage() != null ? exception.getLocalizedMessage() : defaultMsg;
    }

    private void setButtonsEnabled(boolean enabled) {
        btnSignIn.setEnabled(enabled);
        btnSignUp.setEnabled(enabled);
    }

    private void checkAndSaveUserProfile(final FirebaseUser user) {
        final String uid = user.getUid();
        final DocumentReference userRef = db.collection("users").document(uid);

        userRef.get().addOnCompleteListener(new OnCompleteListener<DocumentSnapshot>() {
            @Override
            public void onComplete(@NonNull Task<DocumentSnapshot> task) {
                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
                sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
                final String isoNow = sdf.format(new Date());

                if (task.isSuccessful() && task.getResult().exists()) {
                    // Profile already exists, just update last login times to preserve scores
                    HashMap<String, Object> updates = new HashMap<>();
                    updates.put("updatedAt", Timestamp.now());
                    updates.put("lastUpdated", isoNow);

                    userRef.update(updates)
                        .addOnCompleteListener(new OnCompleteListener<Void>() {
                            @Override
                            public void onComplete(@NonNull Task<Void> t) {
                                navigateToMainActivity();
                            }
                        });
                } else {
                    // Create brand new user profile
                    String emailPrefix = "Savaşçı";
                    if (user.getEmail() != null) {
                        String[] parts = user.getEmail().split("@");
                        if (parts.length > 0 && !parts[0].isEmpty()) {
                            emailPrefix = parts[0];
                        }
                    }

                    HashMap<String, Object> userData = new HashMap<>();
                    userData.put("uid", uid);
                    userData.put("id", uid);
                    userData.put("name", emailPrefix);
                    userData.put("isAnonymous", false);
                    userData.put("nameSet", true);
                    userData.put("createdAt", Timestamp.now());
                    userData.put("updatedAt", Timestamp.now());
                    userData.put("lastUpdated", isoNow);
                    userData.put("dailyScore", 0);

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
                                navigateToMainActivity();
                            }
                        })
                        .addOnFailureListener(new OnFailureListener() {
                            @Override
                            public void onFailure(@NonNull Exception e) {
                                setButtonsEnabled(true);
                                Toast.makeText(
                                    EmailLoginActivity.this,
                                    "Kullanıcı verisi kaydedilemedi: " + e.getLocalizedMessage(),
                                    Toast.LENGTH_LONG
                                ).show();
                            }
                        });
                }
            }
        });
    }

    private void navigateToMainActivity() {
        Toast.makeText(EmailLoginActivity.this, "Oturum Başarıyla Açıldı!", Toast.LENGTH_SHORT).show();
        Intent intent = new Intent(EmailLoginActivity.this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
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
