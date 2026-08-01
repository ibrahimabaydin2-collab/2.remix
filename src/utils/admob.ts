// AdMob Integration Configuration & Helpers
// Configured according to production AdMob Ad Units

export const ADMOB_CONFIG = {
  // AdMob Application ID
  APP_ID: 'ca-app-pub-1284515268865249~3880684614',

  // Alt Banner (Banner Format)
  BOTTOM_BANNER_ID: 'ca-app-pub-1284515268865249/9525629040',
  
  // Üst Banner (Banner Format)
  TOP_BANNER_ID: 'ca-app-pub-1284515268865249/7823986409',
  
  // İzle Kazan (Ödüllü / Rewarded Ad Format)
  REWARDED_AD_ID: 'ca-app-pub-1284515268865249/8781794522',
  
  // Ödül Miktarı (10 Altın)
  REWARD_GOLD_AMOUNT: 10,
};

// Global state variables for managing AdMob callbacks & async flow
let isAdMobInitialized = false;
let activeRewardCallback: (() => Promise<void> | void) | null = null;
let activeStartCallback: (() => void) | null = null;
let activeFailedCallback: ((reason: string) => void) | null = null;
let adLoadingSafetyTimer: any = null;

// Flags for strict OnUserEarnedRewardListener & FullScreenContentCallback synchronization
let hasEarnedReward = false;
let rewardGranted = false;

/**
 * Clean up active ad flags, CSS overlay, and safety timers
 */
export const cleanupAdState = () => {
  if (typeof window === 'undefined') return;

  if (adLoadingSafetyTimer) {
    clearTimeout(adLoadingSafetyTimer);
    adLoadingSafetyTimer = null;
  }

  (window as any).userExplicitAdRequested = false;
  (window as any).isWatchingAd = false;
  (window as any).isAdLoading = false;

  try {
    sessionStorage.removeItem('user_explicit_ad_requested');
  } catch (e) {}

  const loadingOverlay = document.getElementById('admob-loading-overlay');
  if (loadingOverlay && loadingOverlay.parentNode) {
    loadingOverlay.parentNode.removeChild(loadingOverlay);
  }

  try {
    (window as any).AndroidBridge?.preventAdLayoutLoops?.();
  } catch (e) {}
};

/**
 * Initialize global window listeners for native AdMob callbacks.
 * MUST run early and persist across screen navigation (unmount-safe).
 */
export const initGlobalAdMobListeners = () => {
  if (typeof window === 'undefined' || isAdMobInitialized) return;
  isAdMobInitialized = true;

  // 1. Native OnUserEarnedRewardListener event
  // Triggered BY NATIVE code ONLY when user completely finishes watching video!
  (window as any).onAndroidAdRewarded = () => {
    console.log('[AdMob] Native event: onAndroidAdRewarded -> User earned reward!');
    hasEarnedReward = true;
  };

  // 2. Native FullScreenContentCallback onAdDismissedFullScreenContent event
  // Triggered when fullscreen ad activity closes (after reward or when closed prematurely via back button/X)
  (window as any).onAndroidAdDismissed = async () => {
    console.log('[AdMob] Native event: onAndroidAdDismissed. hasEarnedReward:', hasEarnedReward);

    const cb = activeRewardCallback;
    const isEarned = hasEarnedReward;
    const alreadyGranted = rewardGranted;

    // Reset callbacks and state immediately
    activeRewardCallback = null;
    hasEarnedReward = false;

    cleanupAdState();

    if (isEarned && !alreadyGranted && cb) {
      rewardGranted = true;
      console.log('[AdMob] Awarding gold reward to user!');
      try {
        await cb();
      } catch (err) {
        console.error('[AdMob] Error in reward callback:', err);
      }
    } else {
      console.log('[AdMob] Ad dismissed without completing reward or reward already processed.');
    }
  };

  // 3. Native FullScreenContentCallback onAdFailedToShowFullScreenContent event
  (window as any).onAndroidAdFailedToShow = (err: string) => {
    console.error('[AdMob] Native event: onAndroidAdFailedToShow:', err);
    const failCallback = activeFailedCallback;
    hasEarnedReward = false;
    rewardGranted = false;
    activeRewardCallback = null;
    activeFailedCallback = null;
    cleanupAdState();

    if (failCallback) failCallback(err || 'Reklam gösterilemedi');
  };

  // 4. Native onAdFailedToLoad event
  (window as any).onAndroidAdFailedToLoad = (err: string) => {
    console.error('[AdMob] Native event: onAndroidAdFailedToLoad:', err);
    const failCallback = activeFailedCallback;
    hasEarnedReward = false;
    rewardGranted = false;
    activeRewardCallback = null;
    activeFailedCallback = null;
    cleanupAdState();

    if (failCallback) failCallback(err || 'Reklam yüklenemedi');
  };

  // 5. Native onAdLoaded event (Ad finished buffering)
  (window as any).onAndroidAdLoaded = () => {
    console.log('[AdMob] Native event: onAndroidAdLoaded');

    const hasExplicitRequest =
      (window as any).userExplicitAdRequested === true ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('user_explicit_ad_requested') === 'true');

    if (!hasExplicitRequest) {
      console.log('[AdMob] Ad loaded in background.');
      return;
    }

    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.showRewardedAd === 'function') {
      try {
        hasEarnedReward = false;
        rewardGranted = false;
        (window as any).isWatchingAd = true;

        if (activeStartCallback) activeStartCallback();

        // Hide loading overlay before launching native activity
        cleanupAdState();

        setTimeout(() => {
          try {
            bridge.showRewardedAd();
          } catch (e) {
            console.error('[AdMob] Exception showing ad after onAndroidAdLoaded:', e);
            cleanupAdState();
          }
        }, 50);
      } catch (e) {
        console.error('[AdMob] Exception setup showRewardedAd:', e);
        cleanupAdState();
      }
    } else {
      cleanupAdState();
    }
  };

  // 6. Banner Load / Failure Listeners
  (window as any).onAndroidBannerLoaded = (type: string) => {
    console.log(`[AdMob] Banner loaded: ${type}`);
  };

  (window as any).onAndroidBannerFailedToLoad = (type: string, err: string) => {
    console.warn(`[AdMob] Banner failed to load (${type}):`, err);
  };
};

/**
 * Synchronize AdMob Ad Unit IDs with Native AndroidBridge if present
 */
export const syncAdMobWithNativeBridge = () => {
  if (typeof window === 'undefined') return;

  initGlobalAdMobListeners();

  (window as any).ADMOB_CONFIG = ADMOB_CONFIG;

  const attemptSync = () => {
    const bridge = (window as any).AndroidBridge;
    if (bridge) {
      try {
        if (typeof bridge.setAdUnitIds === 'function') {
          bridge.setAdUnitIds(
            ADMOB_CONFIG.TOP_BANNER_ID,
            ADMOB_CONFIG.BOTTOM_BANNER_ID,
            ADMOB_CONFIG.REWARDED_AD_ID
          );
        }
        if (typeof bridge.setRewardedAdUnitId === 'function') {
          bridge.setRewardedAdUnitId(ADMOB_CONFIG.REWARDED_AD_ID);
        }
        if (typeof bridge.loadRewardedAd === 'function') {
          bridge.loadRewardedAd();
        }
        if (typeof bridge.loadBannerAd === 'function') {
          bridge.loadBannerAd('top');
          bridge.loadBannerAd('bottom');
        }
      } catch (e) {
        console.warn('Failed to sync AdMob IDs with AndroidBridge:', e);
      }
    }
  };

  attemptSync();
  setTimeout(attemptSync, 500);
  setTimeout(attemptSync, 1500);
  setTimeout(attemptSync, 3000);
};

/**
 * Helper to trigger Rewarded Ad (İzle Kazan) with Strict Native AdMob Execution.
 * Fully integrates with AdMob's OnUserEarnedRewardListener (onAndroidAdRewarded)
 * and FullScreenContentCallback (onAndroidAdDismissed / onAndroidAdFailedToShow).
 *
 * Rules strictly enforced:
 * 1. Reward is granted ONLY if native code triggers onAndroidAdRewarded (OnUserEarnedRewardListener).
 * 2. If user closes ad early or presses back button (onAndroidAdDismissed without onAndroidAdRewarded), NO reward is given.
 * 3. FullScreen presentation is completely handled by native AdMob SDK.
 */
export const triggerRewardedAdWatch = async (
  onSuccessReward: () => Promise<void> | void,
  onAdStart?: () => void,
  onAdFailed?: (reason: string) => void
): Promise<void> => {
  if (typeof window === 'undefined') return;

  // Initialize global bridge listeners if not attached
  initGlobalAdMobListeners();

  // Strictly reset reward state flags for the new ad attempt
  hasEarnedReward = false;
  rewardGranted = false;

  // Prevent duplicate trigger if ad is currently loading or active
  if ((window as any).isWatchingAd || (window as any).isAdLoading) {
    console.warn('[AdMob] Ad trigger ignored: Ad is already loading or watching.');
    return;
  }

  // Bind active callbacks for this ad session
  activeRewardCallback = onSuccessReward;
  activeStartCallback = onAdStart || null;
  activeFailedCallback = onAdFailed || null;

  const bridge = (window as any).AndroidBridge;

  if (bridge && (typeof bridge.showRewardedAd === 'function' || typeof bridge.loadRewardedAd === 'function')) {
    (window as any).userExplicitAdRequested = true;
    try {
      sessionStorage.setItem('user_explicit_ad_requested', 'true');
    } catch (e) {}

    // Check if rewarded ad is already cached/buffered in native AdMob
    const isLoaded = typeof bridge.isRewardedAdLoaded === 'function' && bridge.isRewardedAdLoaded();

    if (isLoaded) {
      console.log('[AdMob] Pre-loaded ad available. Launching native fullscreen ad presentation...');
      (window as any).isWatchingAd = true;
      
      if (onAdStart) onAdStart();

      setTimeout(() => {
        try {
          bridge.showRewardedAd();
        } catch (err) {
          console.error('[AdMob] Exception during native showRewardedAd:', err);
          cleanupAdState();
          if (onAdFailed) onAdFailed('Reklam başlatılamadı');
        }
      }, 50);
    } else {
      console.log('[AdMob] Ad not pre-loaded. Initiating loadRewardedAd request...');
      (window as any).isAdLoading = true;
      showLoadingOverlay();

      setTimeout(() => {
        if (typeof bridge.loadRewardedAd === 'function') {
          bridge.loadRewardedAd();
        }
      }, 50);

      // Safety timeout if native load hangs
      adLoadingSafetyTimer = setTimeout(() => {
        if ((window as any).isAdLoading) {
          console.warn('[AdMob] Ad load safety timeout reached (10s).');
          cleanupAdState();
          if (onAdFailed) {
            onAdFailed('Reklam yüklenirken zaman aşımına uğradı. Lütfen tekrar deneyin.');
          }
        }
      }, 10000);
    }
  } else {
    // Browser / Dev Preview Mode fallback
    console.log('[AdMob] Web Preview mode detected (No AndroidBridge). Executing reward callback directly for testing.');
    if (onAdStart) onAdStart();
    hasEarnedReward = true;
    if (activeRewardCallback) {
      const cb = activeRewardCallback;
      activeRewardCallback = null;
      try {
        await cb();
      } catch (e) {
        console.error('[AdMob] Error executing web reward callback:', e);
      }
    }
    cleanupAdState();
  }
};

/**
 * Visual loading overlay while waiting for native AdMob ad to buffer
 */
const showLoadingOverlay = () => {
  if (typeof document === 'undefined') return;

  const existing = document.getElementById('admob-loading-overlay');
  if (existing) return;

  const overlay = document.createElement('div');
  overlay.id = 'admob-loading-overlay';
  overlay.className =
    'fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-white text-center animate-fadeIn';
  overlay.innerHTML = `
    <div class="bg-[#161D2B] border border-amber-500/40 rounded-3xl p-6 max-w-xs w-full shadow-2xl flex flex-col items-center space-y-4">
      <div class="w-10 h-10 rounded-full border-4 border-amber-400 border-t-transparent animate-spin"></div>
      <div>
        <h4 class="text-sm font-black text-white">Reklam Yükleniyor...</h4>
        <p class="text-xs text-slate-300 mt-1">Lütfen bekleyin, video hazırlanıyor.</p>
      </div>
      <button id="cancel-ad-loading-btn" class="mt-2 text-xs text-slate-400 hover:text-white underline cursor-pointer">
        İptal Et
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  const cancelBtn = document.getElementById('cancel-ad-loading-btn');
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      cleanupAdState();
    };
  }
};
