/**
 * Robust Turkish uppercase and lowercase conversions
 * to handle dotted/dotless I, circumflexes, and other Turkish special characters
 * consistently across both browser and server-side Node.js environments.
 */

const UPPER_MAP: { [key: string]: string } = {
  'a': 'A', 'b': 'B', 'c': 'C', 'ç': 'Ç', 'd': 'D', 'e': 'E', 'f': 'F', 'g': 'G', 'ğ': 'Ğ',
  'h': 'H', 'ı': 'I', 'i': 'İ', 'j': 'J', 'k': 'K', 'l': 'L', 'm': 'M', 'n': 'N', 'o': 'O',
  'ö': 'Ö', 'p': 'P', 'r': 'R', 's': 'S', 'ş': 'Ş', 't': 'T', 'u': 'U', 'ü': 'Ü', 'v': 'V',
  'y': 'Y', 'z': 'Z',
  'â': 'A', 'î': 'I', 'û': 'U',
  'Â': 'A', 'Î': 'I', 'Û': 'U'
};

const LOWER_MAP: { [key: string]: string } = {
  'A': 'a', 'B': 'b', 'C': 'c', 'Ç': 'ç', 'D': 'd', 'E': 'e', 'F': 'f', 'G': 'g', 'Ğ': 'ğ',
  'H': 'h', 'I': 'ı', 'İ': 'i', 'J': 'j', 'K': 'k', 'L': 'l', 'M': 'm', 'N': 'n', 'O': 'o',
  'Ö': 'ö', 'P': 'p', 'R': 'r', 'S': 's', 'Ş': 'ş', 'T': 't', 'U': 'u', 'Ü': 'ü', 'V': 'v',
  'Y': 'y', 'Z': 'z',
  'â': 'a', 'î': 'ı', 'û': 'u',
  'Â': 'a', 'Î': 'ı', 'Û': 'u'
};

export function turkishUpper(str: string): string {
  if (!str) return '';
  // Normalize string to NFC composed form and remove any combining dot above character (u0307)
  const normalized = str.normalize('NFC').replace(/\u0307/g, '');
  return normalized
    .split('')
    .map((char) => UPPER_MAP[char] || char.toUpperCase())
    .join('');
}

export function turkishLower(str: string): string {
  if (!str) return '';
  // Normalize string to NFC composed form and remove any combining dot above character (u0307)
  const normalized = str.normalize('NFC').replace(/\u0307/g, '');
  return normalized
    .split('')
    .map((char) => LOWER_MAP[char] || char.toLowerCase())
    .join('');
}

export function validateTurkishLinguistics(word: string, length: number): { valid: boolean; reason: string } {
  const normalized = turkishLower(word)
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u');

  // 1. Check for valid characters: Turkish letters only (No q, w, x allowed in Turkish)
  const validCharsRegex = /^[abcdefghijklmnoprstuvyz]+$/;
  if (!validCharsRegex.test(normalized)) {
    return { valid: false, reason: 'Kelime Türkçe alfabesinde bulunmayan geçersiz karakterler barındırıyor (q, w, x vb.).' };
  }

  // 1.1 Keyboard smash detector (reject common sequences of keys adjacent on keyboards)
  const keyboardSmashes = [
    // 4+ character sequences
    'asdf', 'sdfg', 'dfgh', 'fghj', 'ghjk', 'hjkl',
    'qwer', 'wert', 'erty', 'rtyu', 'tyui', 'yuio', 'uiop',
    'zxcv', 'xcvb', 'cvbn', 'vbnm',
    'asda', 'sada', 'dasa', 'fasa', 'ghjg', 'jklj', 'qweq', 'rewr',
    'fsaf', 'dsaf', 'asdfa', 'sadas', 'fdsaf', 'dsafd', 'fdsfd', 'dfgdf',
    'ghjgh', 'hjklh', 'qwewe', 'werty', 'xcvxc', 'cvbnc', 'vbnmv',
    // Common 3-character keyboard smashes (excluding tasdik with 'asd' and dert/sert/mert/ertesi with 'ert')
    'rty', 'tyu', 'yui', 'uio', 'iop', 'dfg', 'fgh', 'ghj', 'hjk', 'jkl',
    'qwe', 'xcv', 'cvb', 'vbn', 'bnm', 'asf', 'dsf', 'sdf', 'fgj', 'ghk', 'mnb'
  ];
  for (const smash of keyboardSmashes) {
    if (normalized.includes(smash)) {
      return { valid: false, reason: 'Anlamsız klavye tuşlaması veya ardışık harf grubu tespit edildi.' };
    }
  }

  // 1.2 No consecutive duplicate consonants that never exist in Turkish
  const rawLower = turkishLower(word);
  const illegalDoubles = ['ğğ', 'jj', 'hh', 'vv', 'çç', 'şş'];
  for (const illegal of illegalDoubles) {
    if (rawLower.includes(illegal)) {
      return { valid: false, reason: 'Türkçe fonetiğine aykırı ardışık çift sessiz harf kullanımı tespit edildi.' };
    }
  }

  // 2. Must contain at least one vowel
  const vowels = /[aeiou]/g;
  const vowelMatches = normalized.match(vowels);
  if (!vowelMatches || vowelMatches.length === 0) {
    return { valid: false, reason: 'Türkçe kelimelerde en az bir sesli harf bulunmalıdır.' };
  }

  // 3. Repeating characters: No character can be repeated 3 or more times consecutively.
  for (let i = 0; i < normalized.length - 2; i++) {
    if (normalized[i] === normalized[i + 1] && normalized[i] === normalized[i + 2]) {
      return { valid: false, reason: 'Aynı harf ardışık 3 veya daha fazla kez tekrarlanamaz.' };
    }
  }

  // 3.1 Repeating 2-letter pairs: (e.g., "asasas", "dfdfdf", "fgfgfg")
  const repeatedPairsRegex = /(..)\1\1/;
  if (repeatedPairsRegex.test(normalized)) {
    return { valid: false, reason: 'Aynı harf çiftinin tekrarlanmasıyla oluşan anlamsız dizilim tespit edildi.' };
  }

  // 4. Consecutive consonants check (maximum 4 consecutive consonants in very rare whitelisted words like "ekspres", "elektrik")
  const has4Consonants = /[^aeiou]{4,}/.test(normalized);
  const consonantWhitelist4 = ['ekspres', 'elektrik'];
  if (has4Consonants && !consonantWhitelist4.includes(normalized)) {
    return { valid: false, reason: 'Türkçe hece ve telaffuz yapısına aykırı ardışık sessiz harf dizilimi.' };
  }
  // 5+ consecutive consonants is unconditionally invalid
  if (/[^aeiou]{5,}/.test(normalized)) {
    return { valid: false, reason: 'Türkçe hece yapısına tamamen aykırı aşırı sessiz harf yığılması.' };
  }

  // 4.1 Word starting with 3 consecutive consonants is invalid unless whitelisted (e.g. "stres", "strateji")
  if (/^[^aeiou]{3,}/.test(normalized)) {
    const starting3ConsonantsWhitelist = ['strateji', 'stres', 'strüktür', 'sprey', 'skleroz', 'sfenks'];
    if (!starting3ConsonantsWhitelist.includes(normalized)) {
      return { valid: false, reason: 'Türkçe kelime başlangıç kurallarına aykırı sessiz harf grubu.' };
    }
  }

  // 4.2 No 3 consecutive vowels (no Turkish word has 3 consecutive vowels like "aia", "uoa", except very rare exclamations)
  if (/[aeiou]{3,}/.test(normalized)) {
    return { valid: false, reason: 'Türkçe fonetiğine aykırı ardışık sesli harf dizilimi.' };
  }

  // 5. Letter diversity ratio checks
  const uniqueChars = new Set(normalized.split(''));
  if (length === 4 && uniqueChars.size < 2) {
    return { valid: false, reason: '4 harfli bir kelimede en az 2 farklı harf bulunmalıdır.' };
  }
  if (length === 5 && uniqueChars.size < 3) {
    return { valid: false, reason: '5 harfli bir kelimede en az 3 farklı harf bulunmalıdır.' };
  }
  if (length === 6 && uniqueChars.size < 3) {
    return { valid: false, reason: '6 harfli bir kelimede en az 3 farklı harf bulunmalıdır.' };
  }
  if (length >= 7 && uniqueChars.size < 4) {
    return { valid: false, reason: '7 veya daha fazla harfli bir kelimede en az 4 farklı harf bulunmalıdır.' };
  }

  // 6. Minimum vowel count: For words of length >= 7, there must be at least 2 vowels (e.g. "ekspres" has 2, "sürpriz" has 2).
  const vowelCount = vowelMatches.length;
  if (length >= 7 && vowelCount < 2) {
    return { valid: false, reason: 'Uzun Türkçe kelimelerde en az 2 sesli harf bulunmalıdır.' };
  }

  return { valid: true, reason: '' };
}
