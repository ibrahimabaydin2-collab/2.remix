// AdMob Integration Configuration & Helpers
// Configured according to production AdMob Ad Units

import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

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

/**
 * Log AdMob status and ad events to Firestore database for remote diagnostics
 */
export const logAdMobEventToFirebase = async (eventName: string, details: any = {}) => {
  try {
    const time = Date.now();
    const userId = auth.currentUser?.uid || 'guest_device';
    const logId = `admob_${time}_${Math.random().toString(36).substring(2, 6)}`;
    await setDoc(doc(db, 'admob_logs', logId), {
      eventName,
      userId,
      appId: ADMOB_CONFIG.APP_ID,
      rewardedAdUnitId: ADMOB_CONFIG.REWARDED_AD_ID,
      topBannerUnitId: ADMOB_CONFIG.TOP_BANNER_ID,
      bottomBannerUnitId: ADMOB_CONFIG.BOTTOM_BANNER_ID,
      publisherId: 'pub-1284515268865249',
      details,
      timestamp: new Date().toISOString()
    }, { merge: true });
    console.log(`[AdMob Firebase Log] ${eventName}:`, details);
  } catch (err) {
    console.warn('[AdMob Firebase Log Warning]:', err);
  }
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
 * Remove visual loading overlay DOM element
 */
export const hideLoadingOverlay = () => {
  if (typeof document === 'undefined') return;
  const overlay = document.getElementById('admob-loading-overlay');
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
};

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

  hideLoadingOverlay();

  try {
    (window as any).AndroidBridge?.preventAdLayoutLoops?.();
  } catch (e) {}
};

/**
 * Helper callers for AndroidBridge native methods (handles both 0 and 1 parameter variations safely)
 */
export const callShowRewardedAd = (bridge: any) => {
  if (!bridge) return;
  if (typeof bridge.showRewardedAd === 'function') {
    try {
      bridge.showRewardedAd(ADMOB_CONFIG.REWARDED_AD_ID);
    } catch (e) {
      try {
        bridge.showRewardedAd();
      } catch (e2) {
        console.error('[AdMob] Error calling showRewardedAd on AndroidBridge:', e2);
      }
    }
  }
};

export const callLoadRewardedAd = (bridge: any) => {
  if (!bridge) return;
  if (typeof bridge.loadRewardedAd === 'function') {
    try {
      bridge.loadRewardedAd(ADMOB_CONFIG.REWARDED_AD_ID);
    } catch (e) {
      try {
        bridge.loadRewardedAd();
      } catch (e2) {
        console.error('[AdMob] Error calling loadRewardedAd on AndroidBridge:', e2);
      }
    }
  }
};

export const callLoadBannerAd = (bridge: any, position: 'top' | 'bottom') => {
  if (!bridge) return;
  if (typeof bridge.loadBannerAd === 'function') {
    const unitId = position === 'top' ? ADMOB_CONFIG.TOP_BANNER_ID : ADMOB_CONFIG.BOTTOM_BANNER_ID;
    try {
      bridge.loadBannerAd(position, unitId);
    } catch (e) {
      try {
        bridge.loadBannerAd(position);
      } catch (e2) {
        console.warn(`[AdMob] Error calling loadBannerAd(${position}) on AndroidBridge:`, e2);
      }
    }
  }
};

/**
 * Initialize global window listeners for native AdMob callbacks.
 * Multi-alias listener mapping ensures compatibility with any native Kotlin bridge naming.
 */
export const initGlobalAdMobListeners = () => {
  if (typeof window === 'undefined' || isAdMobInitialized) return;
  isAdMobInitialized = true;

  // 1. Native OnUserEarnedRewardListener event
  const handleRewarded = () => {
    console.log('[AdMob] Native event: Rewarded -> User earned reward!');
    hasEarnedReward = true;
    logAdMobEventToFirebase('on_ad_rewarded', { status: 'reward_earned' });
  };

  (window as any).onAndroidAdRewarded = handleRewarded;
  (window as any).onRewardedAdReward = handleRewarded;
  (window as any).onRewardedAdRewarded = handleRewarded;
  (window as any).onAdRewarded = handleRewarded;
  (window as any).onUserEarnedReward = handleRewarded;

  // 2. Native FullScreenContentCallback onAdDismissedFullScreenContent event
  const handleDismissed = async () => {
    console.log('[AdMob] Native event: Dismissed. hasEarnedReward:', hasEarnedReward);

    const cb = activeRewardCallback;
    const isEarned = hasEarnedReward;
    const alreadyGranted = rewardGranted;

    activeRewardCallback = null;
    hasEarnedReward = false;

    cleanupAdState();
    logAdMobEventToFirebase('on_ad_dismissed', { isEarned, alreadyGranted });

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

  (window as any).onAndroidAdDismissed = handleDismissed;
  (window as any).onRewardedAdDismissed = handleDismissed;
  (window as any).onAdDismissed = handleDismissed;
  (window as any).onAdClosed = handleDismissed;
  (window as any).onRewardedAdClosed = handleDismissed;

  // 3. Native FullScreenContentCallback onAdFailedToShowFullScreenContent event
  const handleFailedToShow = (err: string) => {
    console.error('[AdMob] Native event: FailedToShow:', err);
    const failCallback = activeFailedCallback;
    hasEarnedReward = false;
    rewardGranted = false;
    activeRewardCallback = null;
    activeFailedCallback = null;
    cleanupAdState();
    logAdMobEventToFirebase('on_ad_failed_to_show', { error: String(err) });

    if (failCallback) failCallback(err || 'Reklam gösterilemedi');
  };

  (window as any).onAndroidAdFailedToShow = handleFailedToShow;
  (window as any).onRewardedAdFailedToShow = handleFailedToShow;
  (window as any).onAdFailedToShow = handleFailedToShow;

  // 4. Native onAdFailedToLoad event
  const handleFailedToLoad = (err: string) => {
    console.error('[AdMob] Native event: FailedToLoad:', err);
    const failCallback = activeFailedCallback;
    hasEarnedReward = false;
    rewardGranted = false;
    activeRewardCallback = null;
    activeFailedCallback = null;
    cleanupAdState();
    logAdMobEventToFirebase('on_ad_failed_to_load', { error: String(err) });

    if (failCallback) failCallback(err || 'Reklam yüklenemedi');
  };

  (window as any).onAndroidAdFailedToLoad = handleFailedToLoad;
  (window as any).onRewardedAdFailedToLoad = handleFailedToLoad;
  (window as any).onAdFailedToLoad = handleFailedToLoad;

  // 5. Native onAdLoaded event (Ad finished buffering)
  const handleLoaded = () => {
    console.log('[AdMob] Native event: AdLoaded');
    logAdMobEventToFirebase('on_ad_loaded', { explicitRequest: Boolean((window as any).userExplicitAdRequested) });

    const hasExplicitRequest =
      (window as any).userExplicitAdRequested === true ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('user_explicit_ad_requested') === 'true');

    if (!hasExplicitRequest) {
      console.log('[AdMob] Ad loaded in background.');
      return;
    }

    const bridge = (window as any).AndroidBridge;
    if (bridge) {
      try {
        hasEarnedReward = false;
        rewardGranted = false;
        (window as any).isWatchingAd = true;
        (window as any).isAdLoading = false;

        if (activeStartCallback) activeStartCallback();

        hideLoadingOverlay();
        if (adLoadingSafetyTimer) {
          clearTimeout(adLoadingSafetyTimer);
          adLoadingSafetyTimer = null;
        }

        setTimeout(() => {
          callShowRewardedAd(bridge);
        }, 30);
      } catch (e) {
        console.error('[AdMob] Exception during handleLoaded:', e);
        cleanupAdState();
      }
    } else {
      cleanupAdState();
    }
  };

  (window as any).onAndroidAdLoaded = handleLoaded;
  (window as any).onRewardedAdLoaded = handleLoaded;
  (window as any).onAdLoaded = handleLoaded;

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
  logAdMobEventToFirebase('init_sync', { hasBridge: !!(window as any).AndroidBridge });

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

        callLoadRewardedAd(bridge);
        callLoadBannerAd(bridge, 'top');
        callLoadBannerAd(bridge, 'bottom');
      } catch (e) {
        console.warn('Failed to sync AdMob IDs with AndroidBridge:', e);
      }
    }
  };

  attemptSync();
  setTimeout(attemptSync, 300);
  setTimeout(attemptSync, 1000);
  setTimeout(attemptSync, 2500);
};

/**
 * Helper to trigger Rewarded Ad (İzle Kazan) with Strict Native AdMob Execution.
 * Fully integrates with AdMob's OnUserEarnedRewardListener (onAndroidAdRewarded)
 * and FullScreenContentCallback (onAndroidAdDismissed / onAndroidAdFailedToShow).
 */
export const triggerRewardedAdWatch = async (
  onSuccessReward: () => Promise<void> | void,
  onAdStart?: () => void,
  onAdFailed?: (reason: string) => void
): Promise<void> => {
  if (typeof window === 'undefined') return;

  initGlobalAdMobListeners();

  hasEarnedReward = false;
  rewardGranted = false;

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

    let isLoaded = false;
    if (typeof bridge.isRewardedAdLoaded === 'function') {
      try {
        isLoaded = bridge.isRewardedAdLoaded();
      } catch (e) {
        console.warn('[AdMob] Error checking isRewardedAdLoaded:', e);
      }
    }

    if (isLoaded) {
      console.log('[AdMob] Pre-loaded ad available. Launching native fullscreen ad presentation...');
      (window as any).isWatchingAd = true;
      if (onAdStart) onAdStart();

      setTimeout(() => {
        callShowRewardedAd(bridge);
      }, 30);
    } else {
      console.log('[AdMob] Ad not pre-loaded. Initiating loadRewardedAd request...');
      (window as any).isAdLoading = true;
      showLoadingOverlay();

      setTimeout(() => {
        callLoadRewardedAd(bridge);
      }, 30);

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
    // Web Preview mode (Browser testing)
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
