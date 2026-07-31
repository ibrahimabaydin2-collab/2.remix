// Complete rebuild stamp for GitHub Actions: 2026-07-23 v1.0.2
import { BACKUP_TOKEN } from './tokenBackup';
import { Capacitor, CapacitorCookies } from '@capacitor/core';
import { turkishLower, capitalizeFirstLetterTurkish } from './turkish';
import { COMMON_TURKISH_WORDS } from '../data/wordlist';

const DEPLOYED_APP_URL = "https://kelime-sava.onrender.com";
const DEV_APP_URL = "https://kelime-sava.onrender.com";

export async function syncCapacitorCookies(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    let token = new URLSearchParams(window.location.search).get('___aistudio_auth_token');
    if (!token) {
      token = window.sessionStorage.getItem('aistudio_auth_token') || window.localStorage.getItem('aistudio_auth_token');
    }
    if (!token) {
      token = BACKUP_TOKEN;
    }

    if (token) {
      const urls = [DEV_APP_URL, DEPLOYED_APP_URL];
      for (const url of urls) {
        await CapacitorCookies.setCookie({
          url,
          key: '__SECURE-aistudio_auth_token',
          value: token,
          path: '/',
        });
        await CapacitorCookies.setCookie({
          url,
          key: 'aistudio_auth_token',
          value: token,
          path: '/',
        });
      }
      console.log('[Capacitor] Synchronized auth tokens in native cookies.');
    }
  } catch (e) {
    console.warn('[Capacitor] Failed to synchronize cookies:', e);
  }
}

// Auto-patch fetch on mobile devices to append Cookie headers natively via CapacitorHttp
if (typeof window !== 'undefined') {
  try {
    const isCapacitor = !!(window as any).Capacitor;
    const ua = navigator.userAgent || '';
    const isAndroid = /android/i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isMobile = isAndroid || isIOS || isCapacitor;

    if (isMobile) {
      const originalFetch = window.fetch;
      const customFetch = async function (this: any, input: any, init: any) {
        let url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : (input as any).url);
        
        // Auto-resolve relative /api/ URLs on mobile native APKs to full backend URL
        if (url && url.startsWith('/api/')) {
          url = getApiUrl(url);
          if (typeof input === 'string') {
            input = url;
          } else if (input instanceof URL) {
            input = new URL(url);
          } else if (input instanceof Request) {
            input = new Request(url, input);
          } else {
            input = url;
          }
        }

        if (url && (url.includes('run.app') || url.includes('onrender.com') || url.startsWith('/api/'))) {
          init = init || {};
          const headers = new Headers(init.headers || {});
          
          let token = new URLSearchParams(window.location.search).get('___aistudio_auth_token');
          if (!token) {
            token = window.sessionStorage.getItem('aistudio_auth_token') || window.localStorage.getItem('aistudio_auth_token');
          }
          if (!token) {
            token = BACKUP_TOKEN;
          }
          
          if (token) {
            try {
              headers.set('Cookie', `__SECURE-aistudio_auth_token=${token}; aistudio_auth_token=${token}`);
            } catch (err) {
              // Silently ignore browser restrictions on modifying forbidden headers like Cookie
            }
            headers.set('X-AI-Studio-Auth', token);
          }
          init.headers = headers;
        }
        return originalFetch.call(this || window, input, init);
      };

      try {
        Object.defineProperty(window, 'fetch', {
          value: customFetch,
          writable: true,
          configurable: true,
          enumerable: true
        });
      } catch (definePropertyError) {
        console.warn('[Capacitor] Object.defineProperty failed for window.fetch, falling back to direct assignment:', definePropertyError);
        try {
          (window as any).fetch = customFetch;
        } catch (directAssignError) {
          console.error('[Capacitor] Failed to install fetch interceptor entirely:', directAssignError);
        }
      }
      
      // Perform initial sync
      syncCapacitorCookies();
    }
  } catch (e) {
    console.error('Failed to install fetch interceptor:', e);
  }
}

export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const ua = navigator.userAgent || '';
      const isAndroid = /android/i.test(ua);
      const isIOS = /iphone|ipad|ipod/i.test(ua);
      const isMobile = isAndroid || isIOS;
      
      const isWebView = ua.includes('wv') || 
                        ua.includes('WebView') || 
                        (isAndroid && !ua.includes('Chrome')) ||
                        (isIOS && !ua.includes('Safari')) ||
                        (window as any).Android || 
                        !!(window as any).AndroidBridge ||
                        ((window as any).webkit && (window as any).webkit.messageHandlers);
      
      const isCapacitor = !!(window as any).Capacitor;
      const protocol = window.location.protocol || '';
      const hostname = window.location.hostname || '';
      
      const isCloudRun = hostname.includes('run.app') || 
                         hostname === 'localhost' || 
                         hostname === '127.0.0.1';

      // 1. Browser dev/Cloud Run environment (where we serve locally and need local relative endpoint)
      if (isCloudRun) {
        return window.location.origin;
      }

      const isHybrid = protocol === 'file:' || 
                       protocol.startsWith('capacitor') || 
                       protocol.startsWith('ionic') || 
                       isWebView ||
                       isCapacitor ||
                       isMobile;

      // 2. Standalone hybrid apps (like Capacitor APK, Android WebView, mobile native app)
      // must always default to the remote production backend (unless explicitly configured to dev/custom)
      if (isHybrid) {
        const type = window.localStorage.getItem('kelimesavasi_server_type');
        if (type === 'dev') {
          return DEV_APP_URL;
        } else if (type === 'custom') {
          const customUrl = window.localStorage.getItem('kelimesavasi_custom_server_url');
          if (customUrl) return customUrl;
        }
        return DEPLOYED_APP_URL;
      }

      const type = window.localStorage.getItem('kelimesavasi_server_type');
      if (type === 'dev') {
        return DEV_APP_URL;
      } else if (type === 'pre') {
        return DEPLOYED_APP_URL;
      } else if (type === 'custom') {
        const customUrl = window.localStorage.getItem('kelimesavasi_custom_server_url');
        if (customUrl) return customUrl;
      }
      
      return DEPLOYED_APP_URL;
    } catch (e) {}
  }
  return DEPLOYED_APP_URL;
}

export function getApiUrl(endpoint: string): string {
  const base = getBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  let url = `${base}${cleanEndpoint}`;
  
  // Trigger cookie sync asynchronously
  if (typeof window !== 'undefined') {
    syncCapacitorCookies();
  }
  
  // Append ___aistudio_auth_token to bypass cookie blocking in iframes
  if (typeof window !== 'undefined') {
    let token = new URLSearchParams(window.location.search).get('___aistudio_auth_token');
    if (token) {
      try {
        window.sessionStorage.setItem('aistudio_auth_token', token);
        window.localStorage.setItem('aistudio_auth_token', token);
      } catch (e) {}
    } else {
      try {
        token = window.sessionStorage.getItem('aistudio_auth_token') || window.localStorage.getItem('aistudio_auth_token');
      } catch (e) {}
    }
    
    if (!token) {
      token = BACKUP_TOKEN;
    }
    
    if (token) {
      url = url.includes('?')
        ? `${url}&___aistudio_auth_token=${encodeURIComponent(token)}`
        : `${url}?___aistudio_auth_token=${encodeURIComponent(token)}`;
    }
  }
  
  return url;
}

export function getWsUrl(): string {
  let wsUrl = '';

  // Trigger cookie sync asynchronously
  if (typeof window !== 'undefined') {
    syncCapacitorCookies();
  }

  if (typeof window !== 'undefined') {
    try {
      const type = window.localStorage.getItem('kelimesavasi_server_type') || 'pre';
      if (type === 'dev') {
        const noProtocol = DEV_APP_URL.replace(/^https?:\/\//, '');
        return `wss://${noProtocol}/ws`;
      } else if (type === 'custom') {
        const customUrl = window.localStorage.getItem('kelimesavasi_custom_server_url') || '';
        if (customUrl) {
          const cleanUrl = customUrl.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
          const isSecure = customUrl.startsWith('https:') || customUrl.startsWith('wss:') || (!customUrl.includes('localhost') && !customUrl.includes('127.0.0.1') && !customUrl.includes('192.168.'));
          const protocol = isSecure ? 'wss:' : 'ws:';
          return `${protocol}//${cleanUrl}/ws`;
        }
      } else if (type === 'pre') {
        const ua = navigator.userAgent || '';
        const isAndroid = /android/i.test(ua);
        const isIOS = /iphone|ipad|ipod/i.test(ua);
        const isMobile = isAndroid || isIOS;
        const isCloudRun = window.location.hostname.includes('run.app');
        if (isMobile && !isCloudRun) {
          const noProtocol = DEPLOYED_APP_URL.replace(/^https?:\/\//, '');
          return `wss://${noProtocol}/ws`;
        }
      }
    } catch (e) {}
  }

  if (typeof window !== 'undefined' && window.location) {
    const { hostname, host, protocol } = window.location;
    const ua = navigator.userAgent || '';
    const isAndroid = /android/i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isMobile = isAndroid || isIOS;
    
    const isWebView = ua.includes('wv') || 
                      ua.includes('WebView') || 
                      (isAndroid && !ua.includes('Chrome')) ||
                      (isIOS && !ua.includes('Safari')) ||
                      (window as any).Android || 
                      ((window as any).webkit && (window as any).webkit.messageHandlers);
    
    const isCapacitor = !!(window as any).Capacitor;
    const isCloudRun = hostname.includes('run.app');
    
    const isHybrid = !isCloudRun && (
                     protocol === 'file:' || 
                     protocol.startsWith('capacitor') || 
                     protocol.startsWith('ionic') || 
                     isWebView ||
                     isCapacitor ||
                     isMobile
    );

    if (isHybrid) {
      // For mobile hybrid applications/WebViews on Android/iOS, point to the live cloud backend!
      try {
        const type = window.localStorage.getItem('kelimesavasi_server_type') || 'pre';
        if (type === 'dev') {
          const noProtocol = DEV_APP_URL.replace(/^https?:\/\//, '');
          return `wss://${noProtocol}/ws`;
        }
      } catch (e) {}
      const base = DEPLOYED_APP_URL;
      const noProtocol = base.replace(/^https?:\/\//, '');
      wsUrl = `wss://${noProtocol}/ws`;
    } else if (isCloudRun) {
      // Point directly to live Render server WebSocket endpoint to prevent local proxy ECONNRESET
      const noProtocol = DEPLOYED_APP_URL.replace(/^https?:\/\//, '');
      wsUrl = `wss://${noProtocol}/ws`;
    }
    
    if (!wsUrl && !isHybrid) {
      // Fallback relative protocol
      const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
      if (host) {
        wsUrl = `${wsProtocol}//${host}/ws`;
      }
    }
  }

  if (!wsUrl) {
    const base = getBaseUrl();
    if (!base) {
      wsUrl = `ws://localhost:3000/ws`;
    } else {
      // Convert http/https base to ws/wss
      const wsProtocol = base.startsWith('https:') ? 'wss:' : 'ws:';
      const noProtocol = base.replace(/^https?:\/\//, '');
      wsUrl = `${wsProtocol}//${noProtocol}/ws`;
    }
  }

  // Append ___aistudio_auth_token if available to bypass cookie-blocking issues in iframes
  if (typeof window !== 'undefined') {
    let token = new URLSearchParams(window.location.search).get('___aistudio_auth_token');
    if (token) {
      try {
        window.sessionStorage.setItem('aistudio_auth_token', token);
        window.localStorage.setItem('aistudio_auth_token', token);
      } catch (e) {}
    } else {
      try {
        token = window.sessionStorage.getItem('aistudio_auth_token') || window.localStorage.getItem('aistudio_auth_token');
      } catch (e) {}
    }
    
    if (!token) {
      token = BACKUP_TOKEN;
    }
    
    if (token) {
      wsUrl = wsUrl.includes('?') 
        ? `${wsUrl}&___aistudio_auth_token=${encodeURIComponent(token)}`
        : `${wsUrl}?___aistudio_auth_token=${encodeURIComponent(token)}`;
    }
  }

  return wsUrl;
}

export async function validateWordClientSide(word: string, length: number): Promise<{ valid: boolean; definition: string }> {
  try {
    // 1. Kelimeyi Türkçe küçük harfe ve ilk harfi Türkçe kurallarına uygun büyük harfe çevir (örn: 'insan' -> 'İnsan', 'ışık' -> 'Işık')
    const lowerWord = turkishLower(word).trim();
    const capitalizedWord = capitalizeFirstLetterTurkish(word);
    console.log(`[Kelime Doğrulama] İşleniyor: "${word}" -> Alt: "${lowerWord}", Baş Harf Büyük: "${capitalizedWord}"`);

    // 2. Önce projedeki yerel kelime listesinden kontrol et.
    const localList = COMMON_TURKISH_WORDS[length] || [];
    const foundInLocal = localList.some(w => turkishLower(w).trim() === lowerWord);

    if (foundInLocal) {
      console.log(`[Kelime Doğrulama] "${lowerWord}" yerel kelime listesinde bulundu.`);
      return {
        valid: true,
        definition: `${word.toUpperCase()} kelimesi yerel sözlükte bulundu.`
      };
    }

    // 3. Türkçe Vikipedi API sorgusu (tr.wikipedia.org)
    // action=query&titles=... API uç noktası ile dönen 'pages' objesinde id '-1' olmadığını kontrol et
    console.log(`[Kelime Doğrulama] "${capitalizedWord}" / "${lowerWord}" Vikipedi'de aranıyor...`);
    const wikiUrl = `https://tr.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&titles=${encodeURIComponent(capitalizedWord)}|${encodeURIComponent(lowerWord)}`;

    try {
      const wikiResponse = await fetch(wikiUrl);
      if (wikiResponse.ok) {
        const wikiData = await wikiResponse.json();
        const pages = wikiData?.query?.pages || {};
        const validWikiPage = Object.values(pages).find((p: any) => {
          return p && String(p.pageid || '') !== '-1' && p.pageid > 0 && p.missing === undefined && p.ns === 0;
        });

        if (validWikiPage) {
          const pageTitle = (validWikiPage as any).title || capitalizedWord;
          console.log(`[Kelime Doğrulama] "${lowerWord}" ("${pageTitle}") Vikipedi'de doğrulandı!`);
          return {
            valid: true,
            definition: `${pageTitle} kelimesi Türkçe Vikipedi'de doğrulandı.`
          };
        }
      }
    } catch (wikiErr) {
      console.warn('[Kelime Doğrulama] Vikipedi isteği başarısız oldu:', wikiErr);
    }

    // 4. Türkçe Wikisözlük API sorgusu (tr.wiktionary.org) - İkinci Doğrulama Katmanı
    console.log(`[Kelime Doğrulama] "${lowerWord}" Wikisözlük'te aranıyor...`);
    const wiktionaryUrl = `https://tr.wiktionary.org/w/api.php?action=query&prop=revisions&rvprop=content&format=json&origin=*&redirects=1&titles=${encodeURIComponent(lowerWord)}|${encodeURIComponent(capitalizedWord)}`;

    const response = await fetch(wiktionaryUrl);
    if (!response.ok) {
      throw new Error(`Wikisözlük sunucu yanıt hatası (HTTP ${response.status})`);
    }

    const data = await response.json();
    const pages = data?.query?.pages || {};
    const validWiktionaryPage = Object.values(pages).find((p: any) => {
      if (!p || String(p.pageid || '') === '-1' || p.missing !== undefined) return false;
      if (!p.revisions || !Array.isArray(p.revisions) || p.revisions.length === 0) return false;
      const content = p.revisions[0]['*'] || '';
      return /==\s*Türkçe\s*==/i.test(content) || content.includes('{{dil|tr}}') || content.includes('==Türkçe==');
    });

    if (validWiktionaryPage) {
      console.log(`[Kelime Doğrulama] "${lowerWord}" Wikisözlük'te doğrulandı.`);
      return {
        valid: true,
        definition: `${word.toUpperCase()} kelimesi Wikisözlük'te doğrulandı.`
      };
    }

    console.log(`[Kelime Doğrulama] "${lowerWord}" Vikipedi veya Wikisözlük'te bulunamadı.`);
    return {
      valid: false,
      definition: 'Kelime Türkçe Vikipedi veya Wikisözlük veritabanında bulunamadı.'
    };
  } catch (error: any) {
    console.error('[Kelime Doğrulama Hatası]:', error);
    return {
      valid: false,
      definition: `Hata oluştu: ${error?.message || error}`
    };
  }
}
