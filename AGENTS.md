# Project Rules and Guidelines

## Server & Connection Protection Rules
To ensure the multiplayer functionality and internet settings are never broken, subsequent developers and agents must adhere to these rules:

1. **Keep the Live Render Server URLs**: 
   - `DEPLOYED_APP_URL` and `DEV_APP_URL` inside `src/utils/api.ts` must always point to the production server: `https://kelime-sava.onrender.com`.
   - Never replace these with standard run.app URLs or other development URLs unless explicitly requested by the user.

2. **Allow onrender.com Cookies & Fetch Interception**:
   - The fetch interceptor inside `src/utils/api.ts` must allow matching `onrender.com` URLs to ensure token synchronization and session storage persist across native and web environments:
     ```typescript
     if (url && (url.includes('run.app') || url.includes('onrender.com') || url.startsWith('/api/'))) {
       // Must set the custom authorization headers and cookies
     }
     ```

3. **Gemini API Live Proxy**:
   - In `server.ts`, the chat/Gemini API calls should proxy requests directly to the Render server: `https://kelime-sava.onrender.com/api/chat`.

## WebView & Native Interface Layout Rules
1. **AdMob Banner Alignment**:
   - In hybrid mobile mode, the WebView adds the `.android-hybrid` class to the layout wrapper.
   - When running inside the Android App, the `#top-ad-placeholder` and `#bottom-ad-placeholder` containers must be set to `display: none !important`.
   - No margins or padding should separate the webview container from the native AdViews in `activity_main.xml`. The `layout_marginTop`, `layout_marginBottom`, `paddingTop`, and `paddingBottom` parameters of the `webview_container` and `AdView` containers must be kept exactly at `0dp` to provide razor-sharp alignment.

2. **Countdown Timer Sync & Stability**:
   - In Solo game modes, whenever a round completes (either won or lost/expired), all active `setInterval` loops or timers MUST be immediately cleared synchronously (`clearInterval(timerRef.current)`) and set to `null` to prevent background UI ticks, flickering, or overlay re-renders.
   - When transitioning between game states, restarting, or executing a `softResetGame()`, all old timer states must be thoroughly cleared before spawning a fresh clock loop.

3. **Kotlin Backend & JS Bridge (`AndroidBridge`) Compatibility**:
   - Never break or refactor the existing native communication bridge (`AndroidBridge`) functions such as `redirectToResultActivity`, `onSoloGameReset`, `preventAdLayoutLoops`, or `loadAdBackground`.
   - These bridge calls synchronize essential gaming cycles and state changes with the native Kotlin layer.
