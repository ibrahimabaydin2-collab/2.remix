package com.kelimesavasi.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.Timestamp;
import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.AuthResult;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthUserCollisionException;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.TimeZone;

public class LoginActivity extends AppCompatActivity {

    private static final String TAG = "LoginActivity";
    private static final int RC_SIGN_IN = 9001;

    private Button btnGuestLogin;
    private Button btnSocialLogin;
    private Button btnEmailLogin;
    
    private FirebaseAuth auth;
    private FirebaseFirestore db;
    private GoogleSignInClient googleSignInClient;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ImmersiveModeHelper.enableImmersiveMode(this);
        
        // Safe dynamic Firebase initialization
        initializeFirebaseSafely();

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance(FirebaseApp.getInstance(), "ai-studio-kelimesava-50aadbd1-03ed-4d0c-9769-866981f84d1c");

        // 1. SESSION CHECK (Oturum Kontrolü): If already logged in, bypass login screen immediately
        if (auth.getCurrentUser() != null) {
            Log.d(TAG, "Active user session found. Redirecting to MainActivity.");
            Intent intent = new Intent(LoginActivity.this, MainActivity.class);
            startActivity(intent);
            finish();
            return;
        }

        setContentView(R.layout.activity_login);

        btnGuestLogin = findViewById(R.id.btn_guest_login);
        btnSocialLogin = findViewById(R.id.btn_social_login);
        btnEmailLogin = findViewById(R.id.btn_email_login);

        // Configure Google Sign-In options using the oAuthClientId from Firebase Config
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken("115209512617-156fu52vr6l6cpi5evfi883vb8j8e8n7.apps.googleusercontent.com")
                .requestEmail()
                .build();
        googleSignInClient = GoogleSignIn.getClient(this, gso);

        // Click handler for Guest login page redirect
        btnGuestLogin.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(LoginActivity.this, GuestLoginActivity.class);
                startActivity(intent);
            }
        });

        // Click handler for Google Login
        btnSocialLogin.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                handleSocialMediaLogin();
            }
        });

        // Click handler for Email authentication
        btnEmailLogin.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                handleEmailAuth();
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

    /**
     * Real Google Sign-In login initialization
     */
    private void handleSocialMediaLogin() {
        Log.d(TAG, "Starting Google Sign-In...");
        setButtonsEnabled(false);
        Toast.makeText(this, "Google Girişi başlatılıyor...", Toast.LENGTH_SHORT).show();
        
        Intent signInIntent = googleSignInClient.getSignInIntent();
        startActivityForResult(signInIntent, RC_SIGN_IN);
    }

    /**
     * Open the dedicated EmailLoginActivity for registration and login
     */
    private void handleEmailAuth() {
        Log.d(TAG, "Redirecting to EmailLoginActivity.");
        Intent intent = new Intent(LoginActivity.this, EmailLoginActivity.class);
        startActivity(intent);
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        // Result returned from launching the Intent from GoogleSignInApi.getSignInIntent(...);
        if (requestCode == RC_SIGN_IN) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            try {
                // Google Sign In was successful, authenticate with Firebase
                GoogleSignInAccount account = task.getResult(ApiException.class);
                if (account != null) {
                    firebaseAuthWithGoogle(account.getIdToken());
                } else {
                    setButtonsEnabled(true);
                    Toast.makeText(this, "Google hesabı alınamadı.", Toast.LENGTH_SHORT).show();
                }
            } catch (ApiException e) {
                setButtonsEnabled(true);
                Log.w(TAG, "Google sign in failed", e);
                Toast.makeText(this, "Giriş İptal Edildi veya Hata Oluştu: " + e.getLocalizedMessage(), Toast.LENGTH_LONG).show();
            }
        }
    }

    private void firebaseAuthWithGoogle(final String idToken) {
        final AuthCredential credential = GoogleAuthProvider.getCredential(idToken, null);
        final FirebaseUser currentUser = auth.getCurrentUser();

        if (currentUser != null && currentUser.isAnonymous()) {
            // HESAP BAĞLAMA (ACCOUNT LINKING) ALTYAPISI
            Toast.makeText(this, "Misafir hesabı Google ile korunuyor...", Toast.LENGTH_SHORT).show();
            currentUser.linkWithCredential(credential)
                .addOnCompleteListener(this, new OnCompleteListener<AuthResult>() {
                    @Override
                    public void onComplete(@NonNull Task<AuthResult> task) {
                        if (task.isSuccessful()) {
                            FirebaseUser user = auth.getCurrentUser();
                            if (user != null) {
                                // Linking succeeded, save/update user profile on Firestore
                                checkAndSaveUserProfile(user);
                            }
                        } else {
                            // CREDENTIAL_ALREADY_IN_USE (ZATEN KULLANIMDA) KONTROLÜ
                            if (task.getException() instanceof FirebaseAuthUserCollisionException) {
                                Log.w(TAG, "Google credential already in use, falling back to direct sign-in.");
                                Toast.makeText(LoginActivity.this, "Bu Google hesabı zaten kullanımda. Mevcut hesaba giriş yapılıyor...", Toast.LENGTH_LONG).show();
                                directGoogleSignIn(credential);
                            } else {
                                setButtonsEnabled(true);
                                String errorMsg = task.getException() != null ? task.getException().getLocalizedMessage() : "Hesap bağlama başarısız.";
                                Toast.makeText(LoginActivity.this, "Hata: " + errorMsg, Toast.LENGTH_LONG).show();
                            }
                        }
                    }
                });
        } else {
            // Normal sign in
            directGoogleSignIn(credential);
        }
    }

    private void directGoogleSignIn(AuthCredential credential) {
        auth.signInWithCredential(credential)
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
                        String errorMsg = task.getException() != null ? task.getException().getLocalizedMessage() : "Firebase Google doğrulaması başarısız.";
                        Toast.makeText(LoginActivity.this, "Hata: " + errorMsg, Toast.LENGTH_LONG).show();
                    }
                }
            });
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
                    String displayName = user.getDisplayName();
                    if (displayName == null || displayName.trim().isEmpty()) {
                        displayName = "Savaşçı";
                    }

                    HashMap<String, Object> userData = new HashMap<>();
                    userData.put("uid", uid);
                    userData.put("id", uid);
                    userData.put("name", displayName);
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
                                    LoginActivity.this,
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
        Toast.makeText(LoginActivity.this, "Oturum Başarıyla Açıldı!", Toast.LENGTH_SHORT).show();
        Intent intent = new Intent(LoginActivity.this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }

    private void setButtonsEnabled(boolean enabled) {
        btnGuestLogin.setEnabled(enabled);
        btnSocialLogin.setEnabled(enabled);
        btnEmailLogin.setEnabled(enabled);
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
