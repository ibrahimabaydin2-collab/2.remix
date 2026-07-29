package com.kelimesavasi.app;

import android.app.Activity;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;

public class ImmersiveModeHelper {
    public static void enableImmersiveMode(final Activity activity) {
        if (activity == null || activity.isFinishing()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
            if (activity.isDestroyed()) return;
        }

        try {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (activity.isFinishing()) return;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
                            if (activity.isDestroyed()) return;
                        }

                        Window window = activity.getWindow();
                        if (window == null) return;

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            WindowInsetsController controller = window.getInsetsController();
                            if (controller != null) {
                                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                            } else {
                                View decorView = window.getDecorView();
                                if (decorView != null) {
                                    int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
                                    decorView.setSystemUiVisibility(flags);
                                }
                            }
                        } else {
                            View decorView = window.getDecorView();
                            if (decorView != null) {
                                int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
                                decorView.setSystemUiVisibility(flags);
                            }
                        }
                    } catch (Throwable t) {
                        android.util.Log.e("ImmersiveModeHelper", "Safe immersive UI thread action failed: " + t.getMessage());
                    }
                }
            });
        } catch (Throwable t) {
            android.util.Log.e("ImmersiveModeHelper", "Failed to schedule immersive mode safely: " + t.getMessage());
        }
    }
}
