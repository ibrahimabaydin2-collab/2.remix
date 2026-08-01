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
  REWARDED_AD_ID: 'ca-app-pub-1284515268865249/8945496387',
  
  // Ödül Miktarı (10 Altın)
  REWARD_GOLD_AMOUNT: 10,
};

// Global state variables for managing AdMob callbacks & async flow
let isAdMobInitialized = false;
let activeRewardCallback: (() => Promise<void> | void) | null = null;
let activeStartCallback: (() => void) | null = null;
let activeFailedCallback: ((reason: string) => void) | null = null;
let adLoadingSafetyTimer: any = null;
let historyPopListenerAttached = false;

/**
 * Clean up active ad flags, CSS overlay, safety timers, and history guard
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

  document.body.classList.remove('ad-active');

  const loadingOverlay = document.getElementById('admob-loading-overlay');
  if (loadingOverlay && loadingOverlay.parentNode) {
    loadingOverlay.parentNode.removeChild(loadingOverlay);
  }

  const webSimOverlay = document.getElementById('web-ad-simulator-overlay');
  if (webSimOverlay && webSimOverlay.parentNode) {
    webSimOverlay.parentNode.removeChild(webSimOverlay);
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

  // 1. Rewarded Ad Earned Callback
  (window as any).onAndroidAdRewarded = async () => {
    console.log('[AdMob] Native event: onAndroidAdRewarded');
    const callback = activeRewardCallback;
    activeRewardCallback = null;
    cleanupAdState();

    if (callback) {
      try {
        await callback();
      } catch (err) {
        console.error('[AdMob] Error in reward callback:', err);
      }
    }
  };

  // 2. Rewarded / Interstitial Ad Dismissed / Closed Callback
  (window as any).onAndroidAdDismissed = () => {
    console.log('[AdMob] Native event: onAndroidAdDismissed');
    activeRewardCallback = null;
    cleanupAdState();
  };

  // 3. Ad Failed to Show (Runtime display error)
  (window as any).onAndroidAdFailedToShow = (err: string) => {
    console.error('[AdMob] Native event: onAndroidAdFailedToShow:', err);
    const failCallback = activeFailedCallback;
    activeRewardCallback = null;
    activeFailedCallback = null;
    cleanupAdState();

    if (failCallback) failCallback(err || 'Reklam gösterilemedi');
  };

  // 4. Ad Failed to Load (Network / No Fill error)
  (window as any).onAndroidAdFailedToLoad = (err: string) => {
    console.error('[AdMob] Native event: onAndroidAdFailedToLoad:', err);
    const failCallback = activeFailedCallback;
    activeRewardCallback = null;
    activeFailedCallback = null;
    cleanupAdState();

    if (failCallback) failCallback(err || 'Reklam yüklenemedi');
  };

  // 5. Ad Loaded Callback (Async flow requirement: ONLY show when loaded!)
  (window as any).onAndroidAdLoaded = () => {
    console.log('[AdMob] Native event: onAndroidAdLoaded');

    const hasExplicitRequest =
      (window as any).userExplicitAdRequested === true ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('user_explicit_ad_requested') === 'true');

    if (!hasExplicitRequest) {
      console.log('[AdMob] Ad loaded in background. No explicit request active.');
      return;
    }

    // Now that the ad is 100% loaded, trigger showRewardedAd safely!
    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.showRewardedAd === 'function') {
      try {
        (window as any).isWatchingAd = true;
        document.body.classList.add('ad-active');
        if (activeStartCallback) activeStartCallback();
        bridge.showRewardedAd();
      } catch (e) {
        console.error('[AdMob] Exception showing ad after onAndroidAdLoaded:', e);
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

  // Attach Hardware Back Button Guard for active ad playback
  if (!historyPopListenerAttached) {
    historyPopListenerAttached = true;
    window.addEventListener('popstate', () => {
      if ((window as any).isWatchingAd || (window as any).isAdLoading) {
        console.log('[AdMob] Back button pressed during ad playback. Cleaning up ad state.');
        cleanupAdState();
      }
    });
  }
};

/**
 * Synchronize AdMob Ad Unit IDs with Native AndroidBridge if present
 */
export const syncAdMobWithNativeBridge = () => {
  if (typeof window === 'undefined') return;

  initGlobalAdMobListeners();

  // Store in global window state
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
        // Preload rewarded ad asynchronously
        if (typeof bridge.loadRewardedAd === 'function') {
          bridge.loadRewardedAd();
        }
        // Load banner ads if bridge methods exist
        if (typeof bridge.loadBannerAd === 'function') {
          bridge.loadBannerAd('top');
          bridge.loadBannerAd('bottom');
        }
      } catch (e) {
        console.warn('Failed to sync AdMob IDs with AndroidBridge:', e);
      }
    }
  };

  // Immediate sync
  attemptSync();

  // Retries in case bridge is attached late by WebView
  setTimeout(attemptSync, 500);
  setTimeout(attemptSync, 1500);
  setTimeout(attemptSync, 3000);
};

/**
 * Helper to trigger Rewarded Ad (İzle Kazan) with Async Safety & Strict Load Validation
 */
export const triggerRewardedAdWatch = async (
  onSuccessReward: () => Promise<void> | void,
  onAdStart?: () => void,
  onAdFailed?: (reason: string) => void
): Promise<void> => {
  if (typeof window === 'undefined') return;

  initGlobalAdMobListeners();

  // Prevent double triggers
  if ((window as any).isWatchingAd || (window as any).isAdLoading) {
    console.warn('[AdMob] Ad trigger ignored: Ad is already loading or watching.');
    return;
  }

  activeRewardCallback = onSuccessReward;
  activeStartCallback = onAdStart || null;
  activeFailedCallback = onAdFailed || null;

  const bridge = (window as any).AndroidBridge;

  if (bridge && (typeof bridge.showRewardedAd === 'function' || typeof bridge.loadRewardedAd === 'function')) {
    (window as any).userExplicitAdRequested = true;
    try {
      sessionStorage.setItem('user_explicit_ad_requested', 'true');
    } catch (e) {}

    // Push temporary history state for back-button safety
    try {
      window.history.pushState({ admobWatch: true }, '');
    } catch (e) {}

    // 1. Check if the ad is ALREADY fully loaded
    const isLoaded = typeof bridge.isRewardedAdLoaded === 'function' && bridge.isRewardedAdLoaded();

    if (isLoaded) {
      console.log('[AdMob] Ad is already loaded. Showing immediately.');
      (window as any).isWatchingAd = true;
      document.body.classList.add('ad-active');
      if (onAdStart) onAdStart();
      try {
        bridge.showRewardedAd();
      } catch (err) {
        console.error('[AdMob] Error showing loaded ad:', err);
        cleanupAdState();
        if (onAdFailed) onAdFailed('Reklam başlatılamadı');
      }
    } else {
      // 2. Ad is NOT loaded yet. Trigger async load and show loading UI!
      console.log('[AdMob] Ad not loaded. Triggering loadRewardedAd with async loading state.');
      (window as any).isAdLoading = true;

      // Show clean visual loading indicator
      showLoadingOverlay();

      // Trigger native load
      if (typeof bridge.loadRewardedAd === 'function') {
        bridge.loadRewardedAd();
      }

      // Safety timeout (10 seconds max): If ad fails to load within 10s, cancel gracefully
      adLoadingSafetyTimer = setTimeout(() => {
        if ((window as any).isAdLoading) {
          console.warn('[AdMob] Ad load safety timeout reached (10s). Canceling loading.');
          cleanupAdState();
          if (onAdFailed) {
            onAdFailed('Reklam yüklenirken zaman aşımına uğradı. Lütfen tekrar deneyin.');
          } else {
            alert('Reklam yüklenirken zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.');
          }
        }
      }, 10000);
    }
  } else {
    // 3. Web / Dev Fallback Simulator Mode
    if (onAdStart) onAdStart();
    runWebAdSimulator(onSuccessReward);
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
    'fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-white text-center animate-fadeIn';
  overlay.innerHTML = `
    <div class="bg-[#161D2B] border border-amber-500/40 rounded-3xl p-6 max-w-xs w-full shadow-2xl flex flex-col items-center space-y-4">
      <div class="w-12 h-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin"></div>
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

/**
 * Web Simulator Mode for local dev & web preview testing
 */
const runWebAdSimulator = (onSuccessReward: () => Promise<void> | void) => {
  (window as any).isWatchingAd = true;
  document.body.classList.add('ad-active');

  let countdown = 5;
  const overlay = document.createElement('div');
  overlay.id = 'web-ad-simulator-overlay';
  overlay.className =
    'fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-white text-center animate-fadeIn';

  overlay.innerHTML = `
    <div class="bg-[#161D2B] border border-amber-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 relative">
      <div class="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 mx-auto flex items-center justify-center text-amber-400 text-2xl font-bold animate-pulse">
        📺
      </div>
      <div>
        <span class="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full font-mono">
          ÖDÜLLÜ REKLAM (WEB TEST)
        </span>
        <h3 class="text-base font-black text-white mt-2">
          Reklam İzleniyor...
        </h3>
        <p class="text-xs text-slate-300 mt-1">
          Tamamlandığında <span class="text-amber-400 font-bold">+${ADMOB_CONFIG.REWARD_GOLD_AMOUNT} Altın</span> kazanacaksınız!
        </p>
      </div>
      <div class="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
        <div id="web-ad-progress-bar" class="bg-gradient-to-r from-amber-400 to-yellow-500 h-full transition-all duration-1000 ease-linear" style="width: 0%"></div>
      </div>
      <div id="web-ad-timer-text" class="text-sm font-mono font-black text-amber-300">
        Kalan Süre: 5s
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const interval = setInterval(async () => {
    countdown -= 1;
    const progressBar = document.getElementById('web-ad-progress-bar');
    const timerText = document.getElementById('web-ad-timer-text');

    if (progressBar) {
      progressBar.style.width = `${((5 - countdown) / 5) * 100}%`;
    }
    if (timerText) {
      timerText.innerText = `Kalan Süre: ${countdown}s`;
    }

    if (countdown <= 0) {
      clearInterval(interval);
      const simOverlay = document.getElementById('web-ad-simulator-overlay');
      if (simOverlay && simOverlay.parentNode) {
        simOverlay.parentNode.removeChild(simOverlay);
      }
      cleanupAdState();
      try {
        await onSuccessReward();
      } catch (e) {
        console.error('Error executing reward callback:', e);
      }
    }
  }, 1000);
};

