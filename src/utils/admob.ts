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

/**
 * Synchronize AdMob Ad Unit IDs with Native AndroidBridge if present
 */
export const syncAdMobWithNativeBridge = () => {
  if (typeof window === 'undefined') return;

  // Store in global window state
  (window as any).ADMOB_CONFIG = ADMOB_CONFIG;

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
    } catch (e) {
      console.warn('Failed to sync AdMob IDs with AndroidBridge:', e);
    }
  }
};

/**
 * Helper to trigger Rewarded Ad (İzle Kazan)
 */
export const triggerRewardedAdWatch = async (
  onSuccessReward: () => Promise<void> | void,
  onAdStart?: () => void,
  onAdFailed?: (reason: string) => void
): Promise<void> => {
  if (typeof window === 'undefined') return;

  const bridge = (window as any).AndroidBridge;

  if (bridge && typeof bridge.showRewardedAd === 'function') {
    if (onAdStart) onAdStart();
    try {
      // Set explicit ad request flag
      (window as any).userExplicitAdRequested = true;
      try {
        sessionStorage.setItem('user_explicit_ad_requested', 'true');
      } catch (e) {}

      if (typeof bridge.isRewardedAdLoaded === 'function' && bridge.isRewardedAdLoaded()) {
        bridge.showRewardedAd();
      } else if (typeof bridge.loadRewardedAd === 'function') {
        bridge.loadRewardedAd();
        // Fallback check after 2 seconds
        setTimeout(() => {
          if ((window as any).userExplicitAdRequested && bridge.showRewardedAd) {
            bridge.showRewardedAd();
          }
        }, 2000);
      } else {
        bridge.showRewardedAd();
      }
    } catch (err) {
      console.error('Error launching native rewarded ad:', err);
      if (onAdFailed) onAdFailed('Native reklam başlatılamadı');
    }
  } else {
    // Fallback or Web Simulation Mode
    if (onAdStart) onAdStart();
    // Simulate watching a 5-second rewarded ad
    let countdown = 5;
    const toastElem = document.createElement('div');
    toastElem.id = 'web-ad-simulator-overlay';
    toastElem.className = 'fixed inset-0 z-[999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-white text-center animate-fadeIn';
    
    toastElem.innerHTML = `
      <div class="bg-[#161D2B] border border-amber-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 mx-auto flex items-center justify-center text-amber-400 text-2xl font-bold animate-pulse">
          📺
        </div>
        <div>
          <span class="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full font-mono">
            ÖDÜLLÜ REKLAM • ID: ${ADMOB_CONFIG.REWARDED_AD_ID}
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

    document.body.appendChild(toastElem);

    const interval = setInterval(() => {
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
        const overlay = document.getElementById('web-ad-simulator-overlay');
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        onSuccessReward();
      }
    }, 1000);
  }
};
