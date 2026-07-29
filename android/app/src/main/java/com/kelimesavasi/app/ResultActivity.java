package com.kelimesavasi.app;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.FirebaseFirestore;
import java.util.HashMap;

public class ResultActivity extends AppCompatActivity {

    private TextView tvTargetWord;
    private TextView tvStatusBanner;
    private TextView tvWinnerName;
    private TextView tvWinnerScore;
    private TextView tvLoserName;
    private TextView tvLoserScore;
    private Button btnBackToMenu;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ImmersiveModeHelper.enableImmersiveMode(this);
        setContentView(R.layout.activity_result);

        tvTargetWord = findViewById(R.id.tv_result_target_word);
        tvStatusBanner = findViewById(R.id.tv_result_status_banner);
        tvWinnerName = findViewById(R.id.tv_result_winner_name);
        tvWinnerScore = findViewById(R.id.tv_result_winner_score);
        tvLoserName = findViewById(R.id.tv_result_loser_name);
        tvLoserScore = findViewById(R.id.tv_result_loser_score);
        btnBackToMenu = findViewById(R.id.btn_result_back_to_menu);

        // Extract result data from the incoming intent
        Intent intent = getIntent();
        if (intent != null) {
            String targetWord = intent.getStringExtra("TARGET_WORD");
            String winnerName = intent.getStringExtra("WINNER_NAME");
            int winnerScore = intent.getIntExtra("WINNER_SCORE", 0);
            String loserName = intent.getStringExtra("LOSER_NAME");
            int loserScore = intent.getIntExtra("LOSER_SCORE", 0);
            boolean isWinner = intent.getBooleanExtra("IS_WINNER", false);

            if (targetWord != null) {
                tvTargetWord.setText("HEDEF KELİME: " + targetWord.toUpperCase());
            }

            if (isWinner) {
                tvStatusBanner.setText("Kazandınız, Tebrikler!");
                tvStatusBanner.setTextColor(0xFF10B981); // Emerald Green
            } else {
                tvStatusBanner.setText("Maçı Kaybettiniz.");
                tvStatusBanner.setTextColor(0xFFF43F5E); // Rose Red
            }

            if (winnerName != null) {
                tvWinnerName.setText(winnerName);
            }
            tvWinnerScore.setText(winnerScore + " Puan");
            
            if (loserName != null) {
                tvLoserName.setText(loserName);
            }
            tvLoserScore.setText(loserScore + " Puan");
        }

        btnBackToMenu.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                // Clear the old room/match ID and player's matchmaking/playing state in the database and locally
                try {
                    FirebaseAuth auth = FirebaseAuth.getInstance();
                    FirebaseUser currentUser = auth.getCurrentUser();
                    if (currentUser != null) {
                        FirebaseFirestore db = FirebaseFirestore.getInstance(FirebaseApp.getInstance(), "ai-studio-kelimesava-50aadbd1-03ed-4d0c-9769-866981f84d1c");
                        DocumentReference userRef = db.collection("users").document(currentUser.getUid());
                        HashMap<String, Object> updates = new HashMap<>();
                        updates.put("roomId", null);
                        updates.put("activeRoomId", null);
                        updates.put("isPlaying", false);
                        updates.put("isInRoom", false);
                        updates.put("isSearching", false);
                        updates.put("matchmakingStatus", "idle");
                        userRef.update(updates);
                    }
                } catch (Exception e) {
                    android.util.Log.e("ResultActivity", "Failed to clear room status in Firestore: " + e.getMessage());
                }

                // Return to MainActivity cleanly and reset game state in WebView
                Intent intent = new Intent(ResultActivity.this, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                intent.putExtra("RESET_TO_MENU", true);
                startActivity(intent);
                finish();
            }
        });
    }

    @Override
    public void onBackPressed() {
        // Clear the old room/match ID and player's matchmaking/playing state in the database and locally on back pressed
        try {
            FirebaseAuth auth = FirebaseAuth.getInstance();
            FirebaseUser currentUser = auth.getCurrentUser();
            if (currentUser != null) {
                FirebaseFirestore db = FirebaseFirestore.getInstance(FirebaseApp.getInstance(), "ai-studio-kelimesava-50aadbd1-03ed-4d0c-9769-866981f84d1c");
                DocumentReference userRef = db.collection("users").document(currentUser.getUid());
                HashMap<String, Object> updates = new HashMap<>();
                updates.put("roomId", null);
                updates.put("activeRoomId", null);
                updates.put("isPlaying", false);
                updates.put("isInRoom", false);
                updates.put("isSearching", false);
                updates.put("matchmakingStatus", "idle");
                userRef.update(updates);
            }
        } catch (Exception e) {
            android.util.Log.e("ResultActivity", "Failed to clear room status on back press in Firestore: " + e.getMessage());
        }

        // Go back to main activity on system back press and reset game state in WebView
        Intent intent = new Intent(ResultActivity.this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra("RESET_TO_MENU", true);
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
