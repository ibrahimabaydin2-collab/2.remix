import { turkishUpper, turkishLower } from '../utils/turkish';
import { populerKelimeler } from './populer_kelimeler';

import { POPULAR_3 } from './libraries/popular3';
import { POPULAR_4 } from './libraries/popular4';
import { POPULAR_5 } from './libraries/popular5';
import { POPULAR_6 } from './libraries/popular6';
import { POPULAR_7 } from './libraries/popular7';
import { POPULAR_8 } from './libraries/popular8';

import { WORDS_3 } from './libraries/words3';
import { WORDS_4 } from './libraries/words4';
import { WORDS_5 } from './libraries/words5';
import { WORDS_6 } from './libraries/words6';
import { WORDS_7 } from './libraries/words7';
import { WORDS_8 } from './libraries/words8';

import { EASY_WORDS_LEVEL_1 } from './libraries/easy1';

export const COMMON_TURKISH_WORDS: { [key: number]: string[] } = {
  3: [...POPULAR_3],
  4: [...POPULAR_4],
  5: [...POPULAR_5],
  6: [...POPULAR_6],
  7: [...POPULAR_7],
  8: [...POPULAR_8],
};

export const CLEANED_TURKISH_WORDS: { [key: number]: string[] } = {
  3: WORDS_3.map(w => turkishLower(w)),
  4: WORDS_4.map(w => turkishLower(w)),
  5: WORDS_5.map(w => turkishLower(w)),
  6: WORDS_6.map(w => turkishLower(w)),
  7: WORDS_7.map(w => turkishLower(w)),
  8: WORDS_8.map(w => turkishLower(w)),
};

const ABSOLUTE_FALLBACK_WORDS: { [key: number]: string } = {
  3: 'ARA',
  4: 'ALAN',
  5: 'KALEM',
  6: 'BARDAK',
  7: 'ARKADAŞ',
  8: 'ÖĞRETMEN'
};

export function getRandomWord(length?: number, isLevel1?: boolean): string {
  const targetLength = (length && Number(length) >= 3 && Number(length) <= 8)
    ? Number(length)
    : (Math.floor(Math.random() * 6) + 3);

  if (isLevel1) {
    const easyList = EASY_WORDS_LEVEL_1[targetLength];
    if (easyList && easyList.length > 0) {
      const filteredEasyList = easyList.filter(word => word.trim().length === targetLength);
      if (filteredEasyList.length > 0) {
        const word = filteredEasyList[Math.floor(Math.random() * filteredEasyList.length)];
        return turkishUpper(word.trim());
      }
    }
  }

  const words = populerKelimeler[targetLength] || COMMON_TURKISH_WORDS[targetLength] || [];
  const filteredWords = words.filter(word => word.trim().length === targetLength);

  if (!filteredWords || filteredWords.length === 0) {
    return ABSOLUTE_FALLBACK_WORDS[targetLength] || 'KALEM';
  }

  const word = filteredWords[Math.floor(Math.random() * filteredWords.length)];
  const upper = turkishUpper(word.trim());

  if (upper.length !== targetLength) {
    return ABSOLUTE_FALLBACK_WORDS[targetLength] || 'KALEM';
  }

  return upper;
}

export function isWordInCuratedList(word: string, length: number): boolean {
  if (!word) return false;
  const targetLength = Number(length) || word.trim().length;
  const normalized = turkishLower(word.trim());
  
  if (normalized.length !== targetLength) return false;

  const list = CLEANED_TURKISH_WORDS[targetLength] || [];
  if (list.includes(normalized)) return true;

  const commonList = COMMON_TURKISH_WORDS[targetLength] || [];
  return commonList.some(w => turkishLower(w.trim()) === normalized);
}

export function getDailyWordAndLength(): { word: string; length: number; dateStr: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash += dateStr.charCodeAt(i) * (i + 1);
  }

  const length = 3 + (hash % 6); // 3..8

  const list = populerKelimeler[length] || COMMON_TURKISH_WORDS[length] || [];
  let selectedWord = '';

  const dictionary = COMMON_TURKISH_WORDS[length] || [];

  if (list.length > 0) {
    const startIndex = hash % list.length;
    for (let i = 0; i < list.length; i++) {
      const candidate = list[(startIndex + i) % list.length];
      const trimmedCandidate = candidate.replace(/\r/g, '').replace(/\n/g, '').trim();
      if (trimmedCandidate.length === length) {
        const lowerCandidate = turkishLower(trimmedCandidate);
        if (dictionary.some(d => turkishLower(d.trim()) === lowerCandidate)) {
          selectedWord = turkishUpper(trimmedCandidate);
          break;
        }
      }
    }
  }

  if (!selectedWord || selectedWord.length !== length) {
    selectedWord = ABSOLUTE_FALLBACK_WORDS[length] || 'KALEM';
  }

  return { word: selectedWord, length, dateStr };
}
