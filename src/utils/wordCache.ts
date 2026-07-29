/**
 * Persistent Client-Side Dictionary Cache for Kelime Savaşı
 * Caches validated words (both valid and invalid statuses, including definitions)
 * to localStorage for 0ms sub-millisecond instant validation response.
 */

interface CachedWord {
  valid: boolean;
  definition: string;
}

const CACHE_PREFIX = 'kelimesavasi_word_cache_v2_';

export function getCachedWord(word: string, length: number): CachedWord | null {
  try {
    const key = `${CACHE_PREFIX}${word.toUpperCase()}_${length}`;
    const item = localStorage.getItem(key);
    if (item) {
      return JSON.parse(item);
    }
  } catch (e) {
    console.error('Error reading from local dictionary cache:', e);
  }
  return null;
}

export function setCachedWord(word: string, length: number, data: CachedWord): void {
  try {
    const key = `${CACHE_PREFIX}${word.toUpperCase()}_${length}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Error writing to local dictionary cache:', e);
  }
}
