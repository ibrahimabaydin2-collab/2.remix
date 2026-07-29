package com.kelimesavasi.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebChromeClient;
import android.widget.FrameLayout;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.MobileAds;
import androidx.annotation.NonNull;

public class MainActivity extends BridgeActivity {
    private AdView mAdViewTop;
    private AdView mAdViewBottom;
    private WebView mWebView;
    private boolean mAdsInitialized = false;
    private final Handler mHandler = new Handler(Looper.getMainLooper());
    private com.google.android.gms.ads.rewarded.RewardedAd mRewardedAd;
    private boolean mIsAdLoading = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable full screen sticky immersive mode immediately
        ImmersiveModeHelper.enableImmersiveMode(this);

        // Set our custom layout
        setContentView(R.layout.activity_main);

        // Find the custom webview container we defined in XML
        FrameLayout webviewContainer = findViewById(R.id.webview_container);

        // Retrieve Capacitor's WebView instance
        mWebView = getBridge().getWebView();

        // Enable persistent WebView storage / database cache settings & JS support
        if (mWebView != null) {
            mWebView.setKeepScreenOn(true);
            WebSettings webSettings = mWebView.getSettings();
            if (webSettings != null) {
                webSettings.setJavaScriptEnabled(true);
                webSettings.setDomStorageEnabled(true);
                webSettings.setDatabaseEnabled(true);
                webSettings.setAllowFileAccess(true);
                webSettings.setAllowContentAccess(true);
                webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
                // Optimize rendering speed and graphics performance
                webSettings.setRenderPriority(WebSettings.RenderPriority.HIGH);
            }
            
            // Forces hardware accelerated rendering context to relieve graphics memory and prevent white screens or flickering
            mWebView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);

            // Register a custom Javascript interface to support safe, completely asynchronous AdMob refresh calls
            mWebView.addJavascriptInterface(new Object() {
                @android.webkit.JavascriptInterface
                public void loadAdBackground() {
                    mHandler.postDelayed(() -> {
                        loadBannersAsync();
                    }, 120); // Safe delay to let active UI transition completely finalize
                }

                @android.webkit.JavascriptInterface
                public void preventAdLayoutLoops() {
                    mHandler.post(() -> {
                        try {
                            android.util.Log.d("MainActivity", "Solo game over/reset: Stabilizing AdViews and disabling layout listeners to prevent flickering");
                            if (mAdViewTop != null) {
                                mAdViewTop.clearFocus();
                                mAdViewTop.clearAnimation();
                                
                                // Lock layout height strictly to 50dp in pixels ONLY if it differs from the current height
                                ViewGroup.LayoutParams params = mAdViewTop.getLayoutParams();
                                if (params != null) {
                                    int heightPx = (int) (50 * MainActivity.this.getResources().getDisplayMetrics().density);
                                    if (params.height != heightPx) {
                                        params.height = heightPx;
                                        mAdViewTop.setLayoutParams(params);
                                    }
                                }
                            }
                            if (mAdViewBottom != null) {
                                mAdViewBottom.clearFocus();
                                mAdViewBottom.clearAnimation();
                                
                                ViewGroup.LayoutParams params = mAdViewBottom.getLayoutParams();
                                if (params != null) {
                                    int heightPx = (int) (50 * MainActivity.this.getResources().getDisplayMetrics().density);
                                    if (params.height != heightPx) {
                                        params.height = heightPx;
                                        mAdViewBottom.setLayoutParams(params);
                                    }
                                }
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    });
                }

                @android.webkit.JavascriptInterface
                public void onSoloGameReset() {
                    mHandler.post(() -> {
                        try {
                            android.util.Log.d("MainActivity", "Solo game reset triggered: pausing AdViews to reduce UI Thread load");
                            if (mAdViewTop != null) {
                                mAdViewTop.pause();
                            }
                            if (mAdViewBottom != null) {
                                mAdViewBottom.pause();
                            }

                            // Small delay to let the WebView UI stabilize, then resume drawing engine
                            mHandler.postDelayed(() -> {
                                try {
                                    if (mAdViewTop != null) {
                                        mAdViewTop.resume();
                                    }
                                    if (mAdViewBottom != null) {
                                        mAdViewBottom.resume();
                                    }
                                    android.util.Log.d("MainActivity", "Resumed AdViews after game reset stabilization");
                                } catch (Exception e) {
                                    e.printStackTrace();
                                }
                            }, 150);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    });
                }

                @android.webkit.JavascriptInterface
                public void saveDailyPuzzleStatus(String dateStr, boolean completed) {
                    mHandler.post(() -> {
                        try {
                            android.content.SharedPreferences prefs = MainActivity.this.getSharedPreferences("DailyPuzzlePrefs", android.content.Context.MODE_PRIVATE);
                            android.content.SharedPreferences.Editor editor = prefs.edit();
                            editor.putString("last_played_date", dateStr);
                            editor.putBoolean("is_daily_completed", completed);
                            editor.apply();
                            android.util.Log.d("MainActivity", "Saved daily puzzle status to SharedPreferences: " + dateStr + ", completed: " + completed);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    });
                }

                @android.webkit.JavascriptInterface
                public String getDailyPuzzleLastPlayedDate() {
                    try {
                        android.content.SharedPreferences prefs = MainActivity.this.getSharedPreferences("DailyPuzzlePrefs", android.content.Context.MODE_PRIVATE);
                        return prefs.getString("last_played_date", "");
                    } catch (Exception e) {
                        e.printStackTrace();
                        return "";
                    }
                }

                @android.webkit.JavascriptInterface
                public boolean getDailyPuzzleIsCompleted() {
                    try {
                        android.content.SharedPreferences prefs = MainActivity.this.getSharedPreferences("DailyPuzzlePrefs", android.content.Context.MODE_PRIVATE);
                        return prefs.getBoolean("is_daily_completed", false);
                    } catch (Exception e) {
                        e.printStackTrace();
                        return false;
                    }
                }

                @android.webkit.JavascriptInterface
                public void redirectToResultActivity(String winnerId, String winnerName, int winnerScore, String loserId, String loserName, int loserScore, String word, boolean isWinner) {
                    mHandler.post(() -> {
                        try {
                            android.content.Intent intent = new android.content.Intent(MainActivity.this, ResultActivity.class);
                            intent.putExtra("WINNER_ID", winnerId);
                            intent.putExtra("WINNER_NAME", winnerName);
                            intent.putExtra("WINNER_SCORE", winnerScore);
                            intent.putExtra("LOSER_ID", loserId);
                            intent.putExtra("LOSER_NAME", loserName);
                            intent.putExtra("LOSER_SCORE", loserScore);
                            intent.putExtra("TARGET_WORD", word);
                            intent.putExtra("IS_WINNER", isWinner);
                            MainActivity.this.startActivity(intent);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    });
                }

                @android.webkit.JavascriptInterface
                public void showRewardedAd() {
                    MainActivity.this.showRewardedAd();
                }

                @android.webkit.JavascriptInterface
                public void loadRewardedAd() {
                    MainActivity.this.loadRewardedAd();
                }

                @android.webkit.JavascriptInterface
                public boolean isRewardedAdLoaded() {
                    return MainActivity.this.mRewardedAd != null;
                }
            }, "AndroidBridge");
        }

        // Safe check and reparent the webview to our container
        if (mWebView != null) {
            if (mWebView.getParent() != null) {
                ((ViewGroup) mWebView.getParent()).removeView(mWebView);
            }
            webviewContainer.addView(mWebView);
        }

        mAdViewTop = findViewById(R.id.ust_banner);
        mAdViewBottom = findViewById(R.id.alt_banner);

        // Defer AdMob initialization to a background handler to ensure the main UI rendering thread is completely untouched and free of latency
        mHandler.postDelayed(() -> {
            try {
                // Initialize Google Mobile Ads SDK asynchronously
                MobileAds.initialize(MainActivity.this, initializationStatus -> {
                    mAdsInitialized = true;
                    loadBanners();
                    loadRewardedAd();
                });
            } catch (Exception e) {
                e.printStackTrace();
            }
        }, 600); // 600ms delay gives WebView enough time to render completely and prevents layout flickering or white flashes
    }

    private void loadBanners() {
        loadBannersAsync();
    }

    private void loadBannersAsync() {
        if (mAdViewTop == null && mAdViewBottom == null) return;
        
        // Dispatches the loading task entirely as an asynchronous post message on the Main Looper
        // This ensures the main UI thread continues rendering current frames at 60/120Hz without hitching
        mHandler.post(() -> {
            try {
                if (mAdsInitialized) {
                    AdRequest adRequest = new AdRequest.Builder().build();
                    if (mAdViewTop != null) {
                        mAdViewTop.loadAd(adRequest);
                    }
                    if (mAdViewBottom != null) {
                        mAdViewBottom.loadAd(adRequest);
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    @Override
    public void onPause() {
        if (mAdViewTop != null) {
            mAdViewTop.pause();
        }
        if (mAdViewBottom != null) {
            mAdViewBottom.pause();
        }
        
        // Remove all callbacks from our activity's handler to release CPU and Render Thread completely
        mHandler.removeCallbacksAndMessages(null);
        
        // Pause WebView JS execution, CSS transitions, and Web Audio context
        if (mWebView != null) {
            try {
                mWebView.onPause();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        super.onPause();
    }

    @Override
    public void onStop() {
        mHandler.removeCallbacksAndMessages(null);
        // Ensure web view is paused when the activity is stopped
        if (mWebView != null) {
            try {
                mWebView.onPause();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        super.onStop();
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        ImmersiveModeHelper.enableImmersiveMode(this);
        if (mAdViewTop != null) {
            mAdViewTop.resume();
        }
        if (mAdViewBottom != null) {
            mAdViewBottom.resume();
        }
        // Resume WebView JS execution, CSS transitions, and Web Audio context
        if (mWebView != null) {
            try {
                mWebView.onResume();
                mWebView.resumeTimers();
            } catch (Exception e) {
                e.printStackTrace();
            }

            // Check if we need to reset the game state to welcome/menu screen
            android.content.Intent intent = getIntent();
            if (intent != null && intent.getBooleanExtra("RESET_TO_MENU", false)) {
                intent.removeExtra("RESET_TO_MENU");
                setIntent(intent); // Persist the removal of RESET_TO_MENU extra so it does not trigger on future resumes
                mWebView.post(() -> {
                    mWebView.evaluateJavascript("javascript:if(window.anaMenuyeDon){window.anaMenuyeDon();}", null);
                });
            }
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            ImmersiveModeHelper.enableImmersiveMode(this);
        }
    }

    public void loadRewardedAd() {
        if (mRewardedAd != null || mIsAdLoading) {
            return;
        }
        mIsAdLoading = true;
        mHandler.post(() -> {
            try {
                AdRequest adRequest = new AdRequest.Builder().build();
                com.google.android.gms.ads.rewarded.RewardedAd.load(
                    MainActivity.this, 
                    "ca-app-pub-3940256099942544/5224354917",
                    adRequest, 
                    new com.google.android.gms.ads.rewarded.RewardedAdLoadCallback() {
                        @Override
                        public void onAdLoaded(@NonNull com.google.android.gms.ads.rewarded.RewardedAd rewardedAd) {
                            mRewardedAd = rewardedAd;
                            mIsAdLoading = false;
                            
                            mRewardedAd.setFullScreenContentCallback(new com.google.android.gms.ads.FullScreenContentCallback() {
                                @Override
                                public void onAdShowedFullScreenContent() {
                                    mHandler.post(() -> {
                                        if (mWebView != null) {
                                            mWebView.evaluateJavascript("if (window.onAndroidAdShowed) { window.onAndroidAdShowed(); }", null);
                                        }
                                    });
                                }

                                @Override
                                public void onAdDismissedFullScreenContent() {
                                    mRewardedAd = null;
                                    loadRewardedAd();
                                    mHandler.post(() -> {
                                        if (mWebView != null) {
                                            mWebView.evaluateJavascript("if (window.onAndroidAdDismissed) { window.onAndroidAdDismissed(); }", null);
                                        }
                                    });
                                }

                                @Override
                                public void onAdFailedToShowFullScreenContent(com.google.android.gms.ads.AdError adError) {
                                    mRewardedAd = null;
                                    loadRewardedAd();
                                    mHandler.post(() -> {
                                        if (mWebView != null) {
                                            mWebView.evaluateJavascript("if (window.onAndroidAdFailedToShow) { window.onAndroidAdFailedToShow('" + adError.getMessage().replace("'", "\\'") + "'); }", null);
                                        }
                                    });
                                }
                            });

                            mHandler.post(() -> {
                                if (mWebView != null) {
                                    mWebView.evaluateJavascript("if (window.onAndroidAdLoaded) { window.onAndroidAdLoaded(); }", null);
                                }
                            });
                        }

                        @Override
                        public void onAdFailedToLoad(@NonNull com.google.android.gms.ads.LoadAdError loadAdError) {
                            mRewardedAd = null;
                            mIsAdLoading = false;
                            mHandler.post(() -> {
                                if (mWebView != null) {
                                    mWebView.evaluateJavascript("if (window.onAndroidAdFailedToLoad) { window.onAndroidAdFailedToLoad('" + loadAdError.getMessage().replace("'", "\\'") + "'); }", null);
                                }
                            });
                        }
                    }
                );
            } catch (Exception e) {
                e.printStackTrace();
                mIsAdLoading = false;
            }
        });
    }

    public void showRewardedAd() {
        mHandler.post(() -> {
            if (mRewardedAd != null) {
                mRewardedAd.show(MainActivity.this, rewardItem -> {
                    mHandler.post(() -> {
                        if (mWebView != null) {
                            mWebView.evaluateJavascript("if (window.onAndroidAdRewarded) { window.onAndroidAdRewarded(); }", null);
                        }
                    });
                });
            } else {
                loadRewardedAd();
                mHandler.post(() -> {
                    if (mWebView != null) {
                        mWebView.evaluateJavascript("if (window.onAndroidAdFailedToShow) { window.onAndroidAdFailedToShow('Ad not loaded yet. Loading started, please try again.'); }", null);
                    }
                });
            }
        });
    }

    @Override
    public void onDestroy() {
        mHandler.removeCallbacksAndMessages(null);
        if (mAdViewTop != null) {
            try {
                mAdViewTop.destroy();
            } catch (Exception e) {
                e.printStackTrace();
            }
            mAdViewTop = null;
        }
        if (mAdViewBottom != null) {
            try {
                mAdViewBottom.destroy();
            } catch (Exception e) {
                e.printStackTrace();
            }
            mAdViewBottom = null;
        }
        
        // Deep release of WebView & Hardware accelerated layers to free up graphics processor and memory leaks
        if (mWebView != null) {
            try {
                mWebView.setWebChromeClient(null);
                mWebView.setWebViewClient(null);
                mWebView.removeJavascriptInterface("AndroidBridge");
                mWebView.clearHistory();
                mWebView.clearCache(true);
                mWebView.loadUrl("about:blank");
                mWebView.freeMemory();
                mWebView.destroy();
            } catch (Exception e) {
                e.printStackTrace();
            }
            mWebView = null;
        }
        super.onDestroy();
    }
}
