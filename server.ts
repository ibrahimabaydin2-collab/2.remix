// Complete rebuild stamp for GitHub Actions: 2026-07-23 v1.0.2
import express from 'express';
import path from 'path';
import http from 'http';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { doc, getDoc, setDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from './src/lib/firebase';
import { getRandomWord, getRandomLiveWord, isWordInCuratedList, getDailyWordAndLength, words_3, words_4, words_5, words_6, words_7, words_8, LIVE_MODE_WORD_POOLS } from './src/data/wordlist';
import { turkishUpper, turkishLower, capitalizeFirstLetterTurkish } from './src/utils/turkish';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Custom CORS middleware to fully unblock Android WebViews, emulators, and local origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Auto-backup AI Studio auth token to keep mobile APK/AAB connection persistent
app.use((req, res, next) => {
  let token = req.query.___aistudio_auth_token;
  
  // Extract token from cookies if not present in query string
  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    for (const cookie of cookies) {
      const [name, val] = cookie.trim().split('=');
      if (name === '__SECURE-aistudio_auth_token' || name === 'aistudio_auth_token') {
        token = decodeURIComponent(val);
        break;
      }
    }
  }

  if (token && typeof token === 'string') {
    try {
      const filePath = path.join(process.cwd(), 'src', 'utils', 'tokenBackup.ts');
      let currentContent = '';
      if (fs.existsSync(filePath)) {
        currentContent = fs.readFileSync(filePath, 'utf8');
      }
      const expectedContent = `export const BACKUP_TOKEN = ${JSON.stringify(token)};\n`;
      if (currentContent !== expectedContent) {
        fs.writeFileSync(filePath, expectedContent, 'utf8');
        console.log('Automatically backed up auth token to tokenBackup.ts');
      }
    } catch (e) {
      console.error('Failed to back up auth token:', e);
    }
  }
  next();
});

// Global deck and recent history to guarantee varied room creation (3, 4, 5, 6, 7, 8)
// and prevent 3 consecutive identical letter lengths.
let serverMatchLengthDeck: number[] = [];
let serverRecentMatchLengthsHistory: number[] = [];

function getRandomMatchLength(): number {
  const allLengths = [3, 4, 5, 6, 7, 8];
  
  if (serverMatchLengthDeck.length === 0) {
    // Refill and shuffle deck
    serverMatchLengthDeck = [...allLengths].sort(() => Math.random() - 0.5);
  }

  // Pick next candidate from deck
  let chosenIndex = serverMatchLengthDeck.length - 1;
  let chosen = serverMatchLengthDeck[chosenIndex];

  // Check history: if last two were identical to 'chosen', pick a different candidate
  const historyLen = serverRecentMatchLengthsHistory.length;
  if (historyLen >= 2 && 
      serverRecentMatchLengthsHistory[historyLen - 1] === chosen && 
      serverRecentMatchLengthsHistory[historyLen - 2] === chosen) {
    // Find index of first item in deck that is different from 'chosen'
    const altIndex = serverMatchLengthDeck.findIndex(len => len !== chosen);
    if (altIndex !== -1) {
      chosenIndex = altIndex;
      chosen = serverMatchLengthDeck[chosenIndex];
    } else {
      // Fallback: pick any from allLengths except 'chosen'
      const alternatives = allLengths.filter(len => len !== chosen);
      chosen = alternatives[Math.floor(Math.random() * alternatives.length)];
    }
  }

  // Remove chosen item from deck if it was drawn from deck
  if (chosenIndex >= 0 && chosenIndex < serverMatchLengthDeck.length && serverMatchLengthDeck[chosenIndex] === chosen) {
    serverMatchLengthDeck.splice(chosenIndex, 1);
  }

  // Update history (keep max 10)
  serverRecentMatchLengthsHistory.push(chosen);
  if (serverRecentMatchLengthsHistory.length > 10) {
    serverRecentMatchLengthsHistory.shift();
  }

  console.log(`[LIVE MATCH] SEÇİLEN RASTGELE HARF SAYISI: ${chosen} (Kalan deste: [${serverMatchLengthDeck.join(', ')}], Geçmiş: [${serverRecentMatchLengthsHistory.slice(-5).join(', ')}])`);
  return chosen;
}

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Cache for validated words to avoid redundant API calls
const wordCache: { [key: string]: { valid: boolean; definition: string } } = {};
let geminiCooldownUntil = 0;

// Heuristic linguistic validation to prevent keyboard smashing or repeated consonants (like "rrrrr")
function validateTurkishLinguistics(word: string, length: number): { valid: boolean; reason: string } {
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



// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Endpoint to generate a target word across multi-list pools (words_3..words_8)
app.post('/api/random-word', (req, res) => {
  const { length } = req.body || {};
  const wordLength = (length && Number(length) >= 3 && Number(length) <= 8) ? Number(length) : getRandomMatchLength();
  const word = getRandomWord(wordLength);
  res.json({ word, length: wordLength });
});

// Endpoint to inspect live mode multi-list word pool counts
app.get('/api/live-word-pools', (req, res) => {
  res.json({
    words_3: words_3.length,
    words_4: words_4.length,
    words_5: words_5.length,
    words_6: words_6.length,
    words_7: words_7.length,
    words_8: words_8.length,
    total: words_3.length + words_4.length + words_5.length + words_6.length + words_7.length + words_8.length
  });
});

// GET Daily Puzzle Status
app.get('/api/daily-puzzle', async (req, res) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const { dateStr } = getDailyWordAndLength();
    const rawIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ip = String(rawIp).replace(/[^a-zA-Z0-9]/g, '_');

    // Look up device-based document
    const deviceDocRef = doc(db, 'daily_puzzles', `${dateStr}_${deviceId}`);
    const deviceDocSnap = await getDoc(deviceDocRef);

    if (deviceDocSnap.exists()) {
      return res.json(deviceDocSnap.data());
    }

    // Fallback: look up IP-based document
    if (ip) {
      const ipDocRef = doc(db, 'daily_puzzles', `${dateStr}_${ip}`);
      const ipDocSnap = await getDoc(ipDocRef);
      if (ipDocSnap.exists()) {
        return res.json(ipDocSnap.data());
      }
    }

    // No existing attempts found, return clean initial state
    return res.json({
      dateStr,
      attempts: [],
      solved: false,
      failed: false
    });
  } catch (error) {
    console.error('Error fetching daily puzzle:', error);
    res.status(500).json({ error: 'Günlük bulmaca verisi alınamadı.' });
  }
});

// POST Save Daily Puzzle Progress
app.post('/api/daily-puzzle', async (req, res) => {
  try {
    const { deviceId, attempts, solved, failed } = req.body;
    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const { dateStr } = getDailyWordAndLength();
    const rawIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ip = String(rawIp).replace(/[^a-zA-Z0-9]/g, '_');

    const deviceDocRef = doc(db, 'daily_puzzles', `${dateStr}_${deviceId}`);
    
    // Check if a completed document already exists to prevent resets / replay hacks
    const existingSnap = await getDoc(deviceDocRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      if (existingData.solved || existingData.failed || (existingData.attempts && existingData.attempts.length >= 6)) {
        return res.status(403).json({ error: 'Oyun tamamlandı, tekrar deneme yapılamaz.', dailyState: existingData });
      }
    }

    const dailyState = {
      dateStr,
      deviceId,
      ipAddress: String(rawIp),
      attempts: attempts || [],
      solved: !!solved,
      failed: !!failed,
      updatedAt: new Date().toISOString()
    };

    // Save to deviceId doc
    await setDoc(deviceDocRef, dailyState);

    // Save to IP doc for cheat/exploit protection
    if (ip) {
      const ipDocRef = doc(db, 'daily_puzzles', `${dateStr}_${ip}`);
      await setDoc(ipDocRef, dailyState);
    }

    res.json({ success: true, dailyState });
  } catch (error) {
    console.error('Error saving daily puzzle progress:', error);
    res.status(500).json({ error: 'Günlük bulmaca ilerlemesi kaydedilemedi.' });
  }
});

// Core hybrid validation function
async function validateWordHybrid(word: string, skipLocalCheck = false): Promise<{ valid: boolean; definition: string }> {
  try {
    // 1. Türkçe kurallarına göre küçük ve ilk harfi büyük hallerini oluştur (örn. 'insan' -> 'İnsan', 'ışık' -> 'Işık')
    const lowerWord = turkishLower(word).trim();
    const capitalizedWord = capitalizeFirstLetterTurkish(word);
    console.log(`[Hybrid Validation] Validating word: "${word}" (lower: "${lowerWord}", capitalized: "${capitalizedWord}")`);

    // 2. İlk olarak bu kelimeyi bizim yerel kelime listemizde ara. Eğer yerel listede varsa doğrudan geçerli say ve internete hiç sorma.
    if (!skipLocalCheck) {
      const inCurated = isWordInCuratedList(lowerWord, lowerWord.length);
      if (inCurated) {
        console.log(`[Hybrid Validation Result] Word "${lowerWord}" found in local list. Directly VALID.`);
        return {
          valid: true,
          definition: 'Yerel kelime listesinde kayıtlı geçerli bir Türkçe sözcüktür.'
        };
      }
    }

    // 3. Türkçe Vikipedi API Sorgusu (tr.wikipedia.org)
    // action=query&titles=... uç noktası üzerinden 'pages' objesinde '-1' ID'si olmadığını ve geçerli sayfa varlığını kontrol et
    const wikiUrl = `https://tr.wikipedia.org/w/api.php?action=query&format=json&redirects=1&titles=${encodeURIComponent(capitalizedWord)}|${encodeURIComponent(lowerWord)}`;
    console.log(`[Wikipedia Query] Requesting: "${capitalizedWord}" / "${lowerWord}"`);

    try {
      const wikiRes = await axios.get(wikiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 4000
      });

      const wikiData = wikiRes.data;
      if (wikiData && wikiData.query && wikiData.query.pages) {
        const pages = wikiData.query.pages;
        // Dönen 'pages' objesinde id'-1' (missing) olmayan, ns:0 (ana alan) geçerli bir sayfa var mı?
        const validWikiPage = Object.values(pages).find((p: any) => {
          return p && String(p.pageid || '') !== '-1' && p.pageid > 0 && p.missing === undefined && p.ns === 0;
        });

        if (validWikiPage) {
          const matchedTitle = (validWikiPage as any).title || capitalizedWord;
          console.log(`[Wikipedia Result] Word "${lowerWord}" ("${matchedTitle}") is VALID on Wikipedia! Page ID: ${(validWikiPage as any).pageid}`);
          return {
            valid: true,
            definition: 'Türkçe Vikipedi\'de kayıtlı geçerli bir sözcük/kavramdır.'
          };
        }
      }
    } catch (wikiErr: any) {
      console.warn(`[Wikipedia Query Warning] Failed for "${word}":`, wikiErr?.message || wikiErr);
    }

    // 4. Türkçe Wikisözlük API Sorgusu (tr.wiktionary.org) - İkinci Doğrulama Katmanı
    const wiktionaryUrl = `https://tr.wiktionary.org/w/api.php?action=query&prop=revisions&rvprop=content&format=json&redirects=1&titles=${encodeURIComponent(lowerWord)}|${encodeURIComponent(capitalizedWord)}`;
    console.log(`[Wiktionary Query] Requesting: "${lowerWord}" / "${capitalizedWord}"`);

    const response = await axios.get(wiktionaryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 4000
    });

    const data = response.data;
    if (data && data.query && data.query.pages) {
      const pages = data.query.pages;
      const validWiktionaryPage = Object.values(pages).find((p: any) => {
        if (!p || String(p.pageid || '') === '-1' || p.missing !== undefined) return false;
        if (!p.revisions || !Array.isArray(p.revisions) || p.revisions.length === 0) return false;
        const content = p.revisions[0]['*'] || '';
        return content.includes('dil|tr') || content.includes('Türkçe') || /==\s*Türkçe\s*==/.test(content);
      });

      if (validWiktionaryPage) {
        console.log(`[Wiktionary Result] Word "${lowerWord}" is VALID on Wiktionary!`);
        return {
          valid: true,
          definition: 'Wikisözlük\'te kayıtlı geçerli bir Türkçe sözcüktür.'
        };
      }
    }

    console.log(`[Validation Result] Word "${lowerWord}" is INVALID (Not found on Wikipedia or Wiktionary)`);
    return {
      valid: false,
      definition: 'Kelime Türkçe Vikipedi veya Wikisözlük\'te bulunamadı.'
    };

  } catch (err: any) {
    console.error(`[Hybrid Validation Error] Failed for "${word}":`, err?.message || err);
    return {
      valid: false,
      definition: 'Sözlük doğrulama servisine şu anda erişilemiyor.'
    };
  }
}

// Endpoint to validate if a word is valid
app.post('/api/validate-word', async (req, res) => {
  try {
    const { word, length } = req.body;
    if (!word || typeof word !== 'string') {
      return res.status(400).json({ error: 'Word is required' });
    }

    // 1. Türkçe kurallarına göre küçük harfe çevir
    const lowerWord = word.trim().toLocaleLowerCase('tr-TR');
    const normalized = turkishUpper(word.trim());
    const wordLength = Number(length) || normalized.length;

    if (normalized.length !== wordLength) {
      return res.json({ valid: false, reason: 'Harf sayısı uyuşmuyor' });
    }

    // 1.1 Heuristic linguistic validation (blocks keyboard smash, repetitive letters like rrrrr before cache or API calls)
    const linguisticCheck = validateTurkishLinguistics(normalized, wordLength);
    if (!linguisticCheck.valid) {
      return res.json({
        valid: false,
        definition: linguisticCheck.reason
      });
    }

    // 2. İlk olarak bu kelimeyi bizim yerel kelime listemizde ara. Eğer yerel listede varsa doğrudan geçerli say ve internete hiç sorma.
    const inCurated = isWordInCuratedList(lowerWord, wordLength);
    if (inCurated) {
      console.log(`[Hybrid Validation - Route] Word "${lowerWord}" found in local list. Directly VALID.`);
      return res.json({
        valid: true,
        definition: 'Yerel kelime listesinde kayıtlı geçerli bir Türkçe sözcüktür.'
      });
    }

    // 3. Eğer yerel listede yoksa, Wikisözlük öncesi Cache / Firestore kontrol et
    const cacheKey = `${normalized}_${wordLength}`;
    if (wordCache[cacheKey]) {
      return res.json(wordCache[cacheKey]);
    }

    // Check Firestore Database
    try {
      const wordDocRef = doc(db, 'dictionary', normalized);
      const wordSnap = await Promise.race([
        getDoc(wordDocRef),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Firestore read timeout')), 2000))
      ]);
      if (wordSnap && wordSnap.exists()) {
        const dbData = wordSnap.data();
        const dbResult = {
          valid: dbData.valid,
          definition: dbData.definition || ''
        };
        wordCache[cacheKey] = dbResult;
        console.log(`[Database Hit] Word "${normalized}" found in database:`, dbResult);
        return res.json(dbResult);
      }
    } catch (dbErr) {
      console.warn('Firestore database read failed/timed out:', dbErr);
    }

    // 4. Wikisözlük (Wiktionary) sorgusu
    const validationResult = await validateWordHybrid(normalized);
    wordCache[cacheKey] = validationResult;

    // Automatically save to database (non-blocking in background)
    try {
      const wordDocRef = doc(db, 'dictionary', normalized);
      setDoc(wordDocRef, {
        word: normalized,
        valid: validationResult.valid,
        definition: validationResult.definition,
        createdAt: new Date().toISOString()
      }, { merge: true }).catch(saveErr => {
        console.error('Failed to save word to Firestore in background:', saveErr);
      });
      console.log(`[Database Save] Queued word "${normalized}" (valid: ${validationResult.valid}) to save in background.`);
    } catch (saveErr) {
      console.error('Failed to save word to Firestore:', saveErr);
    }

    return res.json(validationResult);
  } catch (error: any) {
    console.error('[Word Validation ERROR]:', error?.message || error);
    res.json({
      valid: false,
      definition: 'Sözlük doğrulanamadı ve kelime listenizde bulunamadı!'
    });
  }
});



// Endpoint for AI chat/assistant proxy using Gemini
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Call the user's live Render server instead of local Gemini API
    const response = await fetch('https://kelime-sava.onrender.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      throw new Error(`Render canlı sunucu bağlantısı başarısız oldu: ${response.status}`);
    }

    const data = (await response.json()) as { response?: string; error?: string };
    
    if (data.error) {
      return res.status(500).json({ error: data.error });
    }

    res.json({ response: data.response || '' });
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// Endpoint for secure user support messages / contact form (Google Play Compliance)
app.post('/api/support', async (req, res) => {
  try {
    const { email, category, message, username, userId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mesaj alanı zorunludur.' });
    }

    const ticketId = 'ticket_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const docRef = doc(db, 'support_messages', ticketId);

    const supportPayload = {
      id: ticketId,
      email: email || 'anonymous',
      category: category || 'general',
      message: message,
      username: username || 'Guest',
      userId: userId || 'unknown',
      createdAt: new Date().toISOString(),
      status: 'new'
    };

    await setDoc(docRef, supportPayload);
    console.log(`[Support Message Saved] ID: ${ticketId}, Category: ${category}, Email: ${email}`);

    res.json({ success: true, ticketId });
  } catch (error: any) {
    console.error('Support API Error:', error);
    res.status(500).json({ error: 'Mesaj iletilemedi. Sunucu hatası oluştu.' });
  }
});

// Save FCM Token Endpoint
app.post('/api/save-fcm-token', async (req, res) => {
  try {
    const { userId, fcmToken } = req.body || {};
    if (userId && fcmToken) {
      await setDoc(doc(db, 'users', userId), { fcmToken, fcmTokenUpdatedAt: new Date().toISOString() }, { merge: true });
      console.log(`[FCM API] Saved device token for user ${userId}`);
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[FCM API] Error saving token:', error);
    res.status(500).json({ error: error?.message });
  }
});

// Trigger FCM High-Priority Match End Push Notification Endpoint
app.post('/api/trigger-match-end-push', async (req, res) => {
  try {
    const { matchId, winnerId, loserId, winnerName, loserName, winReason, correctWord } = req.body || {};
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });

    void sendFcmHighPriorityMatchEndNotification({
      matchId,
      winnerId: winnerId || '',
      loserId,
      winnerName,
      loserName,
      winReason,
      correctWord
    }).catch(() => {});

    res.json({ success: true, message: 'FCM High Priority Push triggered successfully' });
  } catch (error: any) {
    console.error('[FCM API] Error triggering match end push:', error);
    res.status(500).json({ error: error?.message });
  }
});

// Trigger FCM Challenge Push Notification Endpoint
app.post('/api/send-challenge-notification', async (req, res) => {
  try {
    const { challengedId, challengerName, wordLength, challengeId, isOffline } = req.body || {};
    if (!challengedId || !challengeId) {
      return res.status(400).json({ error: 'challengedId and challengeId are required' });
    }

    void sendFcmChallengeNotification({
      challengedId,
      challengerName: challengerName || 'Bir arkadaşın',
      wordLength: (wordLength && Number(wordLength) >= 3 && Number(wordLength) <= 8) ? Number(wordLength) : getRandomMatchLength(),
      challengeId,
      isOffline: Boolean(isOffline)
    }).catch(() => {});

    res.json({ success: true, message: 'Challenge notification triggered successfully' });
  } catch (error: any) {
    console.error('[FCM API] Error triggering challenge notification:', error);
    res.status(500).json({ error: error?.message });
  }
});

// FCM Challenge Push Notification Helper
async function sendFcmChallengeNotification(opts: {
  challengedId: string;
  challengerName: string;
  wordLength: number;
  challengeId: string;
  isOffline?: boolean;
}) {
  const { challengedId, challengerName, wordLength, challengeId, isOffline } = opts;
  try {
    // Save in-app notification to Firestore user subcollection as well
    try {
      await setDoc(doc(db, 'users', challengedId, 'notifications', challengeId), {
        id: challengeId,
        type: 'challenge',
        challengerName,
        wordLength,
        status: 'pending',
        read: false,
        createdAt: new Date().toISOString()
      }, { merge: true });
    } catch (dbErr) {
      console.warn('[Notification Doc Save Error]:', dbErr);
    }

    const userSnap = await getDoc(doc(db, 'users', challengedId));
    if (!userSnap.exists()) return;
    const uData = userSnap.data();
    if (!uData?.fcmToken) return;

    let fcmApiKey = process.env.FIREBASE_API_KEY || '';
    if (!fcmApiKey) {
      try {
        const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          fcmApiKey = parsed.apiKey || '';
        }
      } catch (e) {}
    }

    const notificationTitle = isOffline ? '🔔 Oyunda Olmayan Birinden Meydan Okuma!' : '⚔️ Yeni Meydan Okuma!';
    const notificationBody = `${challengerName} sana ${wordLength} harfli kelime yarışında meydan okudu! Oyuna girip düelloya katıl.`;

    const payload = {
      to: uData.fcmToken,
      priority: 'high',
      content_available: true,
      data: {
        type: 'challenge_received',
        challengeId,
        challengerName,
        wordLength: String(wordLength),
        isOffline: String(!!isOffline),
        timestamp: String(Date.now()),
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      notification: {
        title: notificationTitle,
        body: notificationBody,
        sound: 'default',
        priority: 'high'
      }
    };

    await axios.post('https://fcm.googleapis.com/fcm/send', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${fcmApiKey}`
      },
      timeout: 4000
    });
    console.log(`[FCM Challenge Push] Sent to user ${challengedId} (isOffline: ${!!isOffline})`);
  } catch (err) {
    console.warn('[FCM Challenge Push Error]:', err);
  }
}

// FCM High Priority Push Notification Helper for Match End Events
async function sendFcmHighPriorityMatchEndNotification(opts: {
  matchId: string;
  winnerId: string;
  loserId?: string;
  winnerName?: string;
  loserName?: string;
  winReason?: string;
  correctWord?: string;
}) {
  const { matchId, winnerId, loserId, winnerName, loserName, winReason = 'correct_word', correctWord = '' } = opts;
  console.log(`[FCM High Priority Push] Dispatching match_end notification for match: ${matchId}`);

  try {
    const targetUserIds = [winnerId, loserId].filter(Boolean) as string[];
    const fcmTokens: string[] = [];

    for (const uId of targetUserIds) {
      if (!uId || uId === 'draw') continue;
      try {
        const userSnap = await getDoc(doc(db, 'users', uId));
        if (userSnap.exists()) {
          const uData = userSnap.data();
          if (uData?.fcmToken) {
            fcmTokens.push(uData.fcmToken);
          }
        }
      } catch (err) {
        console.warn(`[FCM Push] Failed to fetch token for user ${uId}:`, err);
      }
    }

    if (fcmTokens.length === 0) {
      console.log(`[FCM Push] No registered FCM device tokens found for match ${matchId}.`);
      return;
    }

    let fcmApiKey = process.env.FIREBASE_API_KEY || '';
    if (!fcmApiKey) {
      try {
        const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          fcmApiKey = parsed.apiKey || '';
        }
      } catch (e) {}
    }

    for (const token of fcmTokens) {
      const payload = {
        to: token,
        priority: 'high',
        content_available: true,
        data: {
          type: 'match_end',
          matchId,
          winner: winnerId,
          winnerId,
          loser: loserId || '',
          winnerName: winnerName || '',
          loserName: loserName || '',
          winReason,
          correctWord,
          timestamp: String(Date.now()),
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        notification: {
          title: 'Düello Bitti! ⚡',
          body: winnerId ? 'Düello sonucu belirlendi!' : 'Canlı düello sona erdi.',
          sound: 'default',
          priority: 'high'
        }
      };

      try {
        await axios.post('https://fcm.googleapis.com/fcm/send', payload, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${fcmApiKey}`
          },
          timeout: 4000
        });
        console.log(`[FCM Push] High Priority FCM message sent successfully to token ${token.substring(0, 15)}...`);
      } catch (fcmErr: any) {
        console.warn(`[FCM Push] FCM legacy dispatch result for token ${token.substring(0, 15)}...:`, fcmErr?.message || fcmErr);
      }
    }
  } catch (globalFcmErr) {
    console.error('[FCM Push] Unexpected error during FCM push trigger:', globalFcmErr);
  }
}

// Dedicated helper for Wordle guess evaluation in Turkish
function evaluateTurkishGuess(guessWord: string, targetWord: string): Array<'correct' | 'present' | 'absent'> {
  const guess = turkishUpper(guessWord).trim().split('');
  const target = turkishUpper(targetWord).trim().split('');
  const result: Array<'correct' | 'present' | 'absent'> = new Array(guess.length).fill('absent');
  const targetUsed = new Array(target.length).fill(false);

  // 1st pass: exact matches
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === target[i]) {
      result[i] = 'correct';
      targetUsed[i] = true;
    }
  }

  // 2nd pass: present matches
  for (let i = 0; i < guess.length; i++) {
    if (result[i] === 'correct') continue;
    for (let j = 0; j < target.length; j++) {
      if (!targetUsed[j] && guess[i] === target[j]) {
        result[i] = 'present';
        targetUsed[j] = true;
        break;
      }
    }
  }

  return result;
}

async function startServer() {
  const server = http.createServer(app);

  // Local WebSocket server on /ws path
  const wss = new WebSocketServer({ server, path: '/ws' });
  const connectedClients = new Map<WebSocket, any>();

  // GLOBAL RANDOM MATCHMAKING QUEUE (Single Pool)
  interface GlobalQueueItem {
    ws: WebSocket;
    player: { id: string; name: string; avatarUrl: string };
    joinedAt: number;
  }

  const globalMatchmakingQueue: GlobalQueueItem[] = [];

  function removeWsFromGlobalQueue(ws: WebSocket, playerId?: string) {
    for (let i = globalMatchmakingQueue.length - 1; i >= 0; i--) {
      const item = globalMatchmakingQueue[i];
      if (
        !item.ws ||
        item.ws.readyState !== WebSocket.OPEN ||
        item.ws === ws ||
        (playerId && item.player?.id === playerId)
      ) {
        globalMatchmakingQueue.splice(i, 1);
      }
    }
  }

  function removeWsFromAllChannels(ws: WebSocket, playerId?: string) {
    removeWsFromGlobalQueue(ws, playerId);
  }

  interface MatchPlayer {
    id: string;
    name: string;
    avatarUrl: string;
    ws: WebSocket;
    connected: boolean;
    attempts: Array<{ word: string; result: Array<'correct' | 'present' | 'absent'> }>;
    lastPingAt?: number;
  }

  interface ActiveDuelMatch {
    matchId: string;
    wordLength: number;
    correctWord: string;
    gameState: 'WAITING' | 'READY' | 'PLAYING' | 'FINISHED' | 'RESULT' | 'CANCELLED';
    player1: MatchPlayer;
    player2: MatchPlayer;
    winner: string | null;
    loser: string | null;
    winReason: 'correct_word' | 'opponent_left' | 'max_attempts' | 'timeout' | null;
    createdAt: number;
    startedAt?: number;
    finishedAt?: number;
    disconnectedAt?: number;
  }

  const activeDuelMatches = new Map<string, ActiveDuelMatch>();
  const socketToMatchIdMap = new Map<WebSocket, string>();
  const activeServerChallenges = new Map<string, any>();

  // GET /api/match-status for live real-time game state synchronization across physical mobile APKs
  app.get('/api/match-status', async (req, res) => {
    try {
      const matchId = String(req.query.matchId || '').trim();
      if (!matchId) return res.status(400).json({ error: 'matchId is required' });

      // 1. Check in-memory active duel match first
      const match = activeDuelMatches.get(matchId);
      if (match) {
        const isFinished = match.gameState === 'FINISHED';
        return res.json({
          id: match.matchId,
          matchId: match.matchId,
          gameState: match.gameState,
          status: isFinished ? 'finished' : 'playing',
          isGameOver: isFinished,
          gameOver: isFinished,
          winner: match.winner || null,
          winnerId: match.winner || null,
          loser: match.loser || null,
          winReason: match.winReason || null,
          correctWord: match.correctWord,
          targetWord: match.correctWord,
          player1: {
            id: match.player1.id,
            name: match.player1.name,
            avatarUrl: match.player1.avatarUrl,
            attempts: match.player1.attempts
          },
          player2: {
            id: match.player2.id,
            name: match.player2.name,
            avatarUrl: match.player2.avatarUrl,
            attempts: match.player2.attempts
          },
          players: {
            [match.player1.id]: {
              id: match.player1.id,
              name: match.player1.name,
              avatarUrl: match.player1.avatarUrl,
              attempts: match.player1.attempts,
              attemptsCount: match.player1.attempts.length,
              completed: isFinished || match.player1.attempts.length >= 6,
              won: match.winner === match.player1.id
            },
            [match.player2.id]: {
              id: match.player2.id,
              name: match.player2.name,
              avatarUrl: match.player2.avatarUrl,
              attempts: match.player2.attempts,
              attemptsCount: match.player2.attempts.length,
              completed: isFinished || match.player2.attempts.length >= 6,
              won: match.winner === match.player2.id
            }
          }
        });
      }

      // 2. Fallback to Firestore database
      const matchSnap = await getDoc(doc(db, 'matches', matchId));
      if (matchSnap.exists()) {
        return res.json(matchSnap.data());
      }
      const roomSnap = await getDoc(doc(db, 'rooms', matchId));
      if (roomSnap.exists()) {
        return res.json(roomSnap.data());
      }

      return res.status(404).json({ error: 'Match not found' });
    } catch (err) {
      console.error('Error fetching match status:', err);
      return res.status(500).json({ error: 'Failed to fetch match status' });
    }
  });

  // Dual HTTP REST guess submission endpoint for hybrid/mobile APK compatibility
  app.post('/api/submit-guess', async (req, res) => {
    try {
      const { matchId, playerId, word, guess } = req.body || {};
      const targetMatchId = String(matchId || '').trim();
      const targetPlayerId = String(playerId || '').trim();
      const guessWord = turkishUpper(String(word || guess || '').trim());

      if (!targetMatchId || !targetPlayerId || !guessWord) {
        return res.status(400).json({ error: 'matchId, playerId, and word are required' });
      }

      const match = activeDuelMatches.get(targetMatchId);
      let correctWord = match?.correctWord || '';

      if (!correctWord) {
        const matchSnap = await getDoc(doc(db, 'matches', targetMatchId));
        if (matchSnap.exists()) {
          const d = matchSnap.data();
          correctWord = d.targetWord || d.correctWord || '';
        }
      }

      if (!correctWord) {
        return res.status(404).json({ error: 'Match or target word not found' });
      }

      const feedback = evaluateTurkishGuess(guessWord, correctWord);
      const isCorrect = feedback.every(f => f === 'correct');

      if (match) {
        const isP1 = match.player1.id === targetPlayerId;
        const isP2 = match.player2.id === targetPlayerId;
        if (!isP1 && !isP2) {
          return res.status(403).json({ error: 'Player is not part of this match' });
        }
        const sender = isP1 ? match.player1 : match.player2;
        const opponent = isP1 ? match.player2 : match.player1;

        sender.attempts.push({ word: guessWord, result: feedback });

        if (isCorrect) {
          match.gameState = 'FINISHED';
          match.winner = sender.id;
          match.loser = opponent.id;
          match.winReason = 'correct_word';
          match.finishedAt = Date.now();

          const winFinishData = {
            gameOver: true,
            isGameOver: true,
            won: true,
            status: 'finished',
            gameState: 'finished',
            winner: sender.id,
            winnerId: sender.id,
            finishedBy: sender.id,
            loser: opponent.id,
            winReason: 'correct_word',
            updatedAt: new Date().toISOString()
          };
          setDoc(doc(db, 'matches', targetMatchId), winFinishData, { merge: true }).catch(() => {});
          setDoc(doc(db, 'rooms', targetMatchId), winFinishData, { merge: true }).catch(() => {});

          sendWs(sender.ws, { type: 'guess_result', matchId: targetMatchId, word: guessWord, feedback, isCorrect: true, isGameOver: true });
          const endPayload = {
            type: 'match_end',
            action: 'GAME_OVER',
            matchId: targetMatchId,
            gameState: 'FINISHED',
            winnerUserId: sender.id,
            winnerId: sender.id,
            winner: sender.id,
            loserUserId: opponent.id,
            loserId: opponent.id,
            loser: opponent.id,
            winnerName: sender.name,
            loserName: opponent.name,
            winReason: 'correct_word',
            correctWord,
            attempts: { [match.player1.id]: match.player1.attempts, [match.player2.id]: match.player2.attempts }
          };
          sendWs(match.player1.ws, endPayload);
          sendWs(match.player2.ws, endPayload);

          if (match.player1.ws) socketToMatchIdMap.delete(match.player1.ws);
          if (match.player2.ws) socketToMatchIdMap.delete(match.player2.ws);
          setTimeout(() => activeDuelMatches.delete(targetMatchId), 15000);
        } else {
          const attemptUpdate = {
            [`players.${sender.id}.attempts`]: sender.attempts,
            [`players.${sender.id}.attemptsCount`]: sender.attempts.length,
            [`players.${sender.id}.currentAttemptCount`]: sender.attempts.length,
            [`players.${sender.id}.completed`]: sender.attempts.length >= 6,
            updatedAt: new Date().toISOString()
          };
          setDoc(doc(db, 'matches', targetMatchId), attemptUpdate, { merge: true }).catch(() => {});
          setDoc(doc(db, 'rooms', targetMatchId), attemptUpdate, { merge: true }).catch(() => {});

          if (sender.attempts.length >= 6 && opponent.attempts.length >= 6) {
            match.gameState = 'FINISHED';
            match.winner = 'draw';
            match.winReason = 'max_attempts';
            match.finishedAt = Date.now();

            const drawFinishData = {
              gameOver: true,
              isGameOver: true,
              status: 'finished',
              gameState: 'finished',
              winner: 'draw',
              winnerId: 'draw',
              winnerUserId: 'draw',
              winReason: 'max_attempts',
              correctWord,
              targetWord: correctWord,
              updatedAt: new Date().toISOString()
            };
            setDoc(doc(db, 'matches', targetMatchId), drawFinishData, { merge: true }).catch(() => {});
            setDoc(doc(db, 'rooms', targetMatchId), drawFinishData, { merge: true }).catch(() => {});

            const endPayload = getMatchEndPayload(match);
            broadcastToMatch(match, endPayload);

            if (match.player1.ws) socketToMatchIdMap.delete(match.player1.ws);
            if (match.player2.ws) socketToMatchIdMap.delete(match.player2.ws);
            setTimeout(() => activeDuelMatches.delete(targetMatchId), 15000);
          } else {
            sendWs(sender.ws, { type: 'guess_result', matchId: targetMatchId, word: guessWord, feedback, isCorrect: false, isGameOver: false });
            broadcastToMatch(match, { type: 'opponent_attempt', matchId: targetMatchId, opponentId: sender.id, attemptCount: sender.attempts.length });
          }
        }
      } else {
        const attemptUpdate = {
          [`players.${targetPlayerId}.attempts`]: [{ word: guessWord, feedback }],
          updatedAt: new Date().toISOString()
        };
        if (isCorrect) {
          Object.assign(attemptUpdate, {
            gameOver: true,
            isGameOver: true,
            status: 'finished',
            gameState: 'finished',
            winner: targetPlayerId,
            winnerId: targetPlayerId,
            finishedBy: targetPlayerId,
            winReason: 'correct_word',
            [`players.${targetPlayerId}.won`]: true,
            [`players.${targetPlayerId}.completed`]: true
          });
        }
        setDoc(doc(db, 'matches', targetMatchId), attemptUpdate, { merge: true }).catch(() => {});
        setDoc(doc(db, 'rooms', targetMatchId), attemptUpdate, { merge: true }).catch(() => {});
      }

      return res.json({ success: true, feedback, isCorrect });
    } catch (err) {
      console.error('Error submitting guess via REST:', err);
      return res.status(500).json({ error: 'Failed to submit guess' });
    }
  });

  function sendWs(ws: WebSocket | null | undefined, dataObj: any) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(dataObj));
      } catch (e) {
        console.error('[WebSocket Server] Send Error:', e);
      }
    }
  }

  function getMatchEndPayload(match: ActiveDuelMatch) {
    const isP1Win = match.winner === match.player1.id;
    const isP2Win = match.winner === match.player2.id;
    const isDraw = match.winner === 'draw';

    const winnerObj = isP1Win ? match.player1 : isP2Win ? match.player2 : null;
    const loserObj = isP1Win ? match.player2 : isP2Win ? match.player1 : null;

    return {
      type: 'match_end',
      action: 'GAME_OVER',
      event: 'MATCH_ENDED',
      matchId: match.matchId,
      id: match.matchId,
      gameState: 'FINISHED',
      status: 'finished',
      isGameOver: true,
      gameOver: true,
      winnerUserId: match.winner || '',
      winnerId: match.winner || '',
      winner: match.winner || '',
      loserUserId: match.loser || '',
      loserId: match.loser || '',
      loser: match.loser || '',
      winnerName: winnerObj?.name || (isDraw ? 'Berabere' : 'Kazanan'),
      loserName: loserObj?.name || 'Rakip',
      winReason: match.winReason || 'correct_word',
      correctWord: match.correctWord,
      targetWord: match.correctWord,
      attempts: {
        [match.player1.id]: match.player1.attempts || [],
        [match.player2.id]: match.player2.attempts || []
      },
      players: {
        [match.player1.id]: {
          id: match.player1.id,
          name: match.player1.name,
          avatarUrl: match.player1.avatarUrl || '',
          attempts: match.player1.attempts || [],
          attemptsCount: (match.player1.attempts || []).length,
          won: isP1Win,
          completed: true
        },
        [match.player2.id]: {
          id: match.player2.id,
          name: match.player2.name,
          avatarUrl: match.player2.avatarUrl || '',
          attempts: match.player2.attempts || [],
          attemptsCount: (match.player2.attempts || []).length,
          won: isP2Win,
          completed: true
        }
      }
    };
  }

  function broadcastToMatch(match: ActiveDuelMatch, dataObj: any) {
    const p1Id = match.player1.id;
    const p2Id = match.player2.id;
    const matchId = match.matchId;

    const targetSockets = new Set<WebSocket>();

    if (match.player1.ws && match.player1.ws.readyState === WebSocket.OPEN) {
      targetSockets.add(match.player1.ws);
    }
    if (match.player2.ws && match.player2.ws.readyState === WebSocket.OPEN) {
      targetSockets.add(match.player2.ws);
    }

    for (const [ws, client] of connectedClients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.id === p1Id || client.id === p2Id || socketToMatchIdMap.get(ws) === matchId) {
          targetSockets.add(ws);
        }
      }
    }

    for (const ws of targetSockets) {
      sendWs(ws, dataObj);
    }
  }

  // Periodic room connection health and match timeout monitor
  setInterval(() => {
    const now = Date.now();
    for (const [matchId, match] of activeDuelMatches.entries()) {
      if (match.gameState === 'PLAYING' || match.gameState === 'READY') {
        const p1PingValid = match.player1.lastPingAt ? (now - match.player1.lastPingAt < 7000) : true;
        const p2PingValid = match.player2.lastPingAt ? (now - match.player2.lastPingAt < 7000) : true;

        const p1Connected = Boolean(match.player1.ws && match.player1.ws.readyState === WebSocket.OPEN && p1PingValid);
        const p2Connected = Boolean(match.player2.ws && match.player2.ws.readyState === WebSocket.OPEN && p2PingValid);

        const matchAge = now - (match.startedAt || match.createdAt);

        if (!p1Connected && !p2Connected) {
          if (now - match.createdAt > 15000) {
            activeDuelMatches.delete(matchId);
          }
        } else if (!p1Connected || !p2Connected) {
          if (match.disconnectedAt && (now - match.disconnectedAt > 3000)) {
            if (match.gameState === 'PLAYING' && match.startedAt) {
              match.gameState = 'FINISHED';
              const winnerPlayer = p1Connected ? match.player1 : match.player2;
              const loserPlayer = p1Connected ? match.player2 : match.player1;

              match.winner = winnerPlayer.id;
              match.loser = loserPlayer.id;
              match.winReason = 'opponent_left';
              match.finishedAt = now;

              console.log(`[Duel Server Timeout] Match ${matchId}: Opponent (${loserPlayer.name}) disconnected during active gameplay. Winner: ${winnerPlayer.name}`);

              const finishData = {
                gameOver: true,
                isGameOver: true,
                status: 'finished',
                gameState: 'finished',
                winner: winnerPlayer.id,
                winnerId: winnerPlayer.id,
                finishedBy: winnerPlayer.id,
                loser: loserPlayer.id,
                winReason: 'opponent_left',
                updatedAt: new Date().toISOString()
              };
              setDoc(doc(db, 'matches', matchId), finishData, { merge: true }).catch(() => {});
              setDoc(doc(db, 'rooms', matchId), finishData, { merge: true }).catch(() => {});

              const endPayload = getMatchEndPayload(match);
              broadcastToMatch(match, endPayload);
            } else {
              console.log(`[Duel Server Timeout] Match ${matchId} cancelled because disconnect occurred in pre-game state (${match.gameState}). NO victory or points awarded.`);
              match.gameState = 'CANCELLED';
              const cancelData = {
                gameOver: true,
                isGameOver: true,
                status: 'cancelled',
                gameState: 'cancelled',
                winner: null,
                winReason: 'cancelled_before_play',
                updatedAt: new Date().toISOString()
              };
              setDoc(doc(db, 'matches', matchId), cancelData, { merge: true }).catch(() => {});
              setDoc(doc(db, 'rooms', matchId), cancelData, { merge: true }).catch(() => {});
              const cancelPayload = { type: 'match_cancelled', matchId: match.matchId, reason: 'cancelled_before_play' };
              broadcastToMatch(match, cancelPayload);
              if (match.player1.ws) socketToMatchIdMap.delete(match.player1.ws);
              if (match.player2.ws) socketToMatchIdMap.delete(match.player2.ws);
              activeDuelMatches.delete(matchId);
            }
          } else if (!match.disconnectedAt) {
            match.disconnectedAt = now;
          }
        } else {
          match.disconnectedAt = undefined;
          if (matchAge > 120000) {
            match.gameState = 'FINISHED';
            match.winner = 'draw';
            match.winReason = 'timeout';
            match.finishedAt = now;

            console.log(`[Duel Server Timeout] Match ${matchId} reached 120s max duration limit. Forcing draw result!`);

            const finishData = {
              gameOver: true,
              isGameOver: true,
              status: 'finished',
              gameState: 'finished',
              winner: 'draw',
              winnerId: 'draw',
              winReason: 'timeout',
              updatedAt: new Date().toISOString()
            };
            setDoc(doc(db, 'matches', matchId), finishData, { merge: true }).catch(() => {});
            setDoc(doc(db, 'rooms', matchId), finishData, { merge: true }).catch(() => {});

            const endPayload = getMatchEndPayload(match);
            broadcastToMatch(match, endPayload);

            if (match.player1.ws) socketToMatchIdMap.delete(match.player1.ws);
            if (match.player2.ws) socketToMatchIdMap.delete(match.player2.ws);
            setTimeout(() => activeDuelMatches.delete(matchId), 15000);
          }
        }
      }
    }
  }, 1500);

  // Concurrent & Race-Condition Safe Background Matchmaking Worker Loop
  let isMatchmakingWorkerRunning = false;

  function processMatchmakingWorker() {
    if (isMatchmakingWorkerRunning) return;
    if (globalMatchmakingQueue.length < 2) return;

    isMatchmakingWorkerRunning = true;
    try {
      while (globalMatchmakingQueue.length >= 2) {
        const sub1 = globalMatchmakingQueue.shift();
        if (!sub1) break;

        if (!sub1.ws || sub1.ws.readyState !== WebSocket.OPEN) {
          continue;
        }

        const sub2 = globalMatchmakingQueue.shift();
        if (!sub2) {
          if (sub1.ws.readyState === WebSocket.OPEN) {
            globalMatchmakingQueue.unshift(sub1);
          }
          break;
        }

        if (!sub2.ws || sub2.ws.readyState !== WebSocket.OPEN) {
          if (sub1.ws.readyState === WebSocket.OPEN) {
            globalMatchmakingQueue.unshift(sub1);
          }
          continue;
        }

        // Check if same player
        if (sub1.player.id === sub2.player.id) {
          if (sub2.ws.readyState === WebSocket.OPEN) {
            globalMatchmakingQueue.unshift(sub2);
          }
          continue;
        }

        // Check if either player is already in an active match
        let p1Active = false;
        let p2Active = false;
        for (const mObj of activeDuelMatches.values()) {
          if (mObj.gameState === 'WAITING' || mObj.gameState === 'READY' || mObj.gameState === 'PLAYING') {
            if (mObj.player1.id === sub1.player.id || mObj.player2.id === sub1.player.id) p1Active = true;
            if (mObj.player1.id === sub2.player.id || mObj.player2.id === sub2.player.id) p2Active = true;
          }
        }
        if (p1Active || p2Active) {
          if (!p1Active && sub1.ws.readyState === WebSocket.OPEN) globalMatchmakingQueue.unshift(sub1);
          if (!p2Active && sub2.ws.readyState === WebSocket.OPEN) globalMatchmakingQueue.unshift(sub2);
          continue;
        }

        // Clean Firestore queue docs for both players
        const qCols = ['matchmaking_queue', 'matchmaking_queue_3', 'matchmaking_queue_4', 'matchmaking_queue_5', 'matchmaking_queue_6', 'matchmaking_queue_7', 'matchmaking_queue_8'];
        qCols.forEach(col => {
          deleteDoc(doc(db, col, sub1.player.id)).catch(() => {});
          deleteDoc(doc(db, col, sub2.player.id)).catch(() => {});
        });

        // 1. HARF UZUNLUĞUNU SUNUCU RASTGELE SEÇER (3 ile 8 arasında, ardışık tekrarsız)
        const matchLength = getRandomMatchLength();
        const matchId = 'match_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const correctWord = turkishUpper(getRandomWord(matchLength, true));

        const matchObj: ActiveDuelMatch = {
          matchId,
          wordLength: matchLength,
          correctWord,
          gameState: 'WAITING',
          player1: {
            id: sub1.player.id,
            name: sub1.player.name,
            avatarUrl: sub1.player.avatarUrl || '',
            ws: sub1.ws,
            connected: true,
            attempts: [],
            lastPingAt: Date.now()
          },
          player2: {
            id: sub2.player.id,
            name: sub2.player.name,
            avatarUrl: sub2.player.avatarUrl || '',
            ws: sub2.ws,
            connected: true,
            attempts: [],
            lastPingAt: Date.now()
          },
          winner: null,
          loser: null,
          winReason: null,
          createdAt: Date.now()
        };

        activeDuelMatches.set(matchId, matchObj);
        socketToMatchIdMap.set(sub1.ws, matchId);
        socketToMatchIdMap.set(sub2.ws, matchId);

        console.log(`[MATCHMAKING WORKER] MATCH CREATED: ${matchId} | Random Length: ${matchLength} (${correctWord}) | ${matchObj.player1.name} vs ${matchObj.player2.name}`);

        // Save initial match state to Firestore
        const initialFirestoreMatch = {
          id: matchId,
          matchId,
          wordLength: matchLength,
          targetWord: correctWord,
          correctWord,
          gameState: 'WAITING',
          status: 'waiting_ready',
          createdAt: new Date().toISOString(),
          player1: { id: matchObj.player1.id, name: matchObj.player1.name, avatarUrl: matchObj.player1.avatarUrl },
          player2: { id: matchObj.player2.id, name: matchObj.player2.name, avatarUrl: matchObj.player2.avatarUrl },
          players: {
            [matchObj.player1.id]: { id: matchObj.player1.id, name: matchObj.player1.name, avatarUrl: matchObj.player1.avatarUrl, attempts: [], completed: false, won: false },
            [matchObj.player2.id]: { id: matchObj.player2.id, name: matchObj.player2.name, avatarUrl: matchObj.player2.avatarUrl, attempts: [], completed: false, won: false }
          },
          isGameOver: false,
          winner: null
        };
        setDoc(doc(db, 'matches', matchId), initialFirestoreMatch, { merge: true }).catch(() => {});
        setDoc(doc(db, 'rooms', matchId), initialFirestoreMatch, { merge: true }).catch(() => {});

        // Broadcast notifications to both players
        const matchPayload = {
          type: 'match_found',
          matchId,
          gameState: 'WAITING',
          wordLength: matchLength,
          correctWord,
          targetWord: correctWord,
          player1: { id: matchObj.player1.id, name: matchObj.player1.name, avatarUrl: matchObj.player1.avatarUrl },
          player2: { id: matchObj.player2.id, name: matchObj.player2.name, avatarUrl: matchObj.player2.avatarUrl }
        };
        sendWs(matchObj.player1.ws, matchPayload);
        sendWs(matchObj.player2.ws, matchPayload);

        const joinedPayload = { ...matchPayload, type: 'match_joined' };
        sendWs(matchObj.player1.ws, joinedPayload);
        sendWs(matchObj.player2.ws, joinedPayload);

        matchObj.gameState = 'READY';
        const readyPayload = { ...matchPayload, type: 'match_ready', gameState: 'READY' };
        sendWs(matchObj.player1.ws, readyPayload);
        sendWs(matchObj.player2.ws, readyPayload);

        // Synchronized match start after countdown delay
        setTimeout(() => {
          if (matchObj.gameState === 'READY' || matchObj.gameState === 'WAITING') {
            matchObj.gameState = 'PLAYING';
            matchObj.startedAt = Date.now();
            const startPayload = { ...readyPayload, type: 'match_start', gameState: 'PLAYING' };
            sendWs(matchObj.player1.ws, startPayload);
            sendWs(matchObj.player2.ws, startPayload);
            setDoc(doc(db, 'matches', matchId), { gameState: 'PLAYING', status: 'playing' }, { merge: true }).catch(() => {});
            setDoc(doc(db, 'rooms', matchId), { gameState: 'PLAYING', status: 'playing' }, { merge: true }).catch(() => {});
            console.log(`[MATCHMAKING WORKER] Match ${matchId} is now PLAYING!`);
          }
        }, 2500);
      }
    } finally {
      isMatchmakingWorkerRunning = false;
    }
  }

  setInterval(processMatchmakingWorker, 100);

  function handlePlayerDisconnect(ws: WebSocket) {
    const client = connectedClients.get(ws);
    connectedClients.delete(ws);
    removeWsFromAllChannels(ws, client?.id);

    let matchId = socketToMatchIdMap.get(ws);
    let match = matchId ? activeDuelMatches.get(matchId) : undefined;

    if (!match) {
      for (const [mId, mObj] of activeDuelMatches.entries()) {
        if (
          mObj.player1.ws === ws || 
          mObj.player2.ws === ws || 
          (client?.id && (mObj.player1.id === client.id || mObj.player2.id === client.id))
        ) {
          matchId = mId;
          match = mObj;
          break;
        }
      }
    }

    if (!match) return;

    // RULE: Forfeit victory with opponent_left ONLY applies if the match is in active PLAYING state!
    if (match && match.gameState === 'PLAYING') {
      match.gameState = 'FINISHED';
      const isP1Left = (match.player1.ws === ws) || (client?.id && match.player1.id === client.id);
      const leftPlayer = isP1Left ? match.player1 : match.player2;
      const remainingPlayer = isP1Left ? match.player2 : match.player1;

      match.winner = remainingPlayer.id;
      match.loser = leftPlayer.id;
      match.winReason = 'opponent_left';
      match.finishedAt = Date.now();

      console.log(`[Duel Server] Match ${matchId}: Player ${leftPlayer.name} disconnected during active gameplay. Player ${remainingPlayer.name} wins by forfeit!`);

      const finishData = {
        gameOver: true,
        isGameOver: true,
        won: true,
        status: 'finished',
        gameState: 'finished',
        winner: remainingPlayer.id,
        winnerId: remainingPlayer.id,
        finishedBy: remainingPlayer.id,
        loser: leftPlayer.id,
        winReason: 'opponent_left',
        updatedAt: new Date().toISOString()
      };
      setDoc(doc(db, 'matches', match.matchId), finishData, { merge: true }).catch(err => {
        console.error('[Duel Server] Error updating Firestore match doc on disconnect:', err);
      });
      setDoc(doc(db, 'rooms', match.matchId), finishData, { merge: true }).catch(err => {
        console.error('[Duel Server] Error updating Firestore room doc on disconnect:', err);
      });

      const endPayload = getMatchEndPayload(match);
      broadcastToMatch(match, endPayload);

      void sendFcmHighPriorityMatchEndNotification({
        matchId: match.matchId,
        winnerId: remainingPlayer.id,
        loserId: leftPlayer.id,
        winnerName: remainingPlayer.name,
        loserName: leftPlayer.name,
        winReason: 'opponent_left',
        correctWord: match.correctWord
      }).catch(() => {});

      if (remainingPlayer.ws) socketToMatchIdMap.delete(remainingPlayer.ws);
      if (leftPlayer.ws) socketToMatchIdMap.delete(leftPlayer.ws);
      if (matchId) socketToMatchIdMap.delete(ws);
      setTimeout(() => activeDuelMatches.delete(matchId!), 15000);
    } else if (match) {
      console.log(`[Duel Server] Match ${matchId} cancelled in pre-game/unplayed state (${match.gameState}). No victory or opponent_left awarded.`);
      match.gameState = 'CANCELLED';
      const cancelPayload = { type: 'match_cancelled', matchId: match.matchId, reason: 'cancelled_before_play' };
      if (match.player1?.ws) sendWs(match.player1.ws, cancelPayload);
      if (match.player2?.ws) sendWs(match.player2.ws, cancelPayload);
      if (match.player1?.ws) socketToMatchIdMap.delete(match.player1.ws);
      if (match.player2?.ws) socketToMatchIdMap.delete(match.player2.ws);
      if (matchId) activeDuelMatches.delete(matchId);
    }
  }

  wss.on('connection', (ws) => {
    console.log('[WebSocket Server] New client connected');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        const now = Date.now();

        // Keep ping timestamp alive for active duel player
        const clientInfo = connectedClients.get(ws);
        const activeMatchId = data.matchId || socketToMatchIdMap.get(ws);
        if (activeMatchId) {
          const matchObj = activeDuelMatches.get(activeMatchId);
          if (matchObj) {
            if (matchObj.player1.ws === ws || (clientInfo?.id && matchObj.player1.id === clientInfo.id)) {
              matchObj.player1.lastPingAt = now;
              matchObj.player1.ws = ws;
            }
            if (matchObj.player2.ws === ws || (clientInfo?.id && matchObj.player2.id === clientInfo.id)) {
              matchObj.player2.lastPingAt = now;
              matchObj.player2.ws = ws;
            }
          }
        }
        if (data.type === 'join' || data.type === 'identify' || data.type === 'rejoin') {
          const playerId = data.id || data.userId || data.playerId || data.uid || 'guest_' + Math.random().toString(36).substring(2, 7);
          const playerName = data.name || data.username || data.displayName || 'Oyuncu';
          const clientInfo = {
            id: playerId,
            name: playerName,
            avatarUrl: data.avatarUrl || ''
          };
          connectedClients.set(ws, clientInfo);
          sendWs(ws, { type: 'lobby', players: Array.from(connectedClients.values()) });

          for (const [mId, mObj] of activeDuelMatches.entries()) {
            if (mObj.player1.id === playerId) {
              mObj.player1.ws = ws;
              mObj.player1.connected = true;
              socketToMatchIdMap.set(ws, mId);
              if (mObj.gameState === 'FINISHED') {
                sendWs(ws, getMatchEndPayload(mObj));
              }
            } else if (mObj.player2.id === playerId) {
              mObj.player2.ws = ws;
              mObj.player2.connected = true;
              socketToMatchIdMap.set(ws, mId);
              if (mObj.gameState === 'FINISHED') {
                sendWs(ws, getMatchEndPayload(mObj));
              }
            }
          }
        } else if (data.type === 'ping') {
          sendWs(ws, { type: 'pong' });
        } else if (data.type === 'subscribe_channel' || data.type === 'switch_channel') {
          const length = (data.wordLength && Number(data.wordLength) >= 3 && Number(data.wordLength) <= 8) ? Number(data.wordLength) : getRandomMatchLength();
          const existingClient = connectedClients.get(ws);
          const playerId = data.id || data.userId || data.playerId || data.uid || existingClient?.id || 'p_' + Date.now();
          const playerName = data.name || data.username || data.displayName || existingClient?.name || 'Oyuncu';
          const playerAvatar = data.avatarUrl || existingClient?.avatarUrl || '';
          const player = { id: playerId, name: playerName, avatarUrl: playerAvatar };
          connectedClients.set(ws, player);
          sendWs(ws, { type: 'channel_subscribed', wordLength: length });
        } else if (data.type === 'join_matchmaking' || data.type === 'find_match' || data.type === 'join_queue') {
          const existingClient = connectedClients.get(ws);
          const player = {
            id: data.id || data.userId || data.playerId || data.uid || existingClient?.id || 'p_' + Date.now(),
            name: data.name || data.username || data.displayName || existingClient?.name || 'Oyuncu',
            avatarUrl: data.avatarUrl || existingClient?.avatarUrl || ''
          };
          connectedClients.set(ws, player);

          // 1. Oyuncunun eski kuyruk kayıtlarını global havuzdan temizle
          removeWsFromGlobalQueue(ws, player.id);

          // 2. Eski askıda/bitmiş maç bağlantılarını temizle
          socketToMatchIdMap.delete(ws);
          for (const [mId, mObj] of activeDuelMatches.entries()) {
            if (mObj.player1?.id === player.id || mObj.player2?.id === player.id || mObj.player1?.ws === ws || mObj.player2?.ws === ws) {
              if (mObj.gameState === 'FINISHED' || mObj.gameState === 'CANCELLED') {
                activeDuelMatches.delete(mId);
              } else {
                mObj.gameState = 'CANCELLED';
                activeDuelMatches.delete(mId);
              }
            }
          }

          // 3. Doğrudan tek global havuz dizisine (global queue) ekle
          globalMatchmakingQueue.push({ ws, player, joinedAt: Date.now() });
          sendWs(ws, { type: 'queued' });
        } else if (data.type === 'leave_matchmaking') {
          const existingClient = connectedClients.get(ws);
          removeWsFromAllChannels(ws, data.id || existingClient?.id);
        } else if (data.type === 'submit_guess') {
          const matchId = data.matchId || socketToMatchIdMap.get(ws);
          if (!matchId) return;

          const match = activeDuelMatches.get(matchId);
          if (!match) return;

          // CRITICAL SERVER AUTHORITY CHECK
          if (match.gameState !== 'PLAYING') {
            sendWs(ws, { type: 'guess_rejected', reason: 'match_not_in_playing_state', gameState: match.gameState });
            return;
          }

          const isP1 = match.player1.ws === ws || match.player1.id === data.playerId;
          const isP2 = match.player2.ws === ws || match.player2.id === data.playerId;

          if (!isP1 && !isP2) {
            console.warn(`[Duel Server] Security Guard: Rejecting guess from unauthorized socket/player (${data.playerId}) for match ${matchId}`);
            sendWs(ws, { type: 'guess_rejected', reason: 'unauthorized_player' });
            return;
          }

          const sender = isP1 ? match.player1 : match.player2;
          const opponent = isP1 ? match.player2 : match.player1;

          const guessStr = turkishUpper(String(data.word || '').trim());
          const feedback = evaluateTurkishGuess(guessStr, match.correctWord);
          const isCorrect = feedback.every(f => f === 'correct');

          if (isCorrect) {
            // SINGLE THREADED ATOMIC WIN CLAIM
            if (match.gameState !== 'PLAYING') {
              // Someone else won 1ms earlier! Reject second guess!
              sendWs(ws, { type: 'guess_rejected', reason: 'match_already_finished', gameState: match.gameState });
              return;
            }

            match.gameState = 'FINISHED';
            match.winner = sender.id;
            match.loser = opponent.id;
            match.winReason = 'correct_word';
            match.finishedAt = Date.now();

            sender.attempts.push({ word: guessStr, result: feedback });

            console.log(`[Duel Server] Match ${matchId} WON by ${sender.name}! Word was ${match.correctWord}`);

            const winFinishData = {
              gameOver: true,
              isGameOver: true,
              won: true,
              status: 'finished',
              gameState: 'finished',
              winner: sender.id,
              winnerId: sender.id,
              finishedBy: sender.id,
              loser: opponent.id,
              winReason: 'correct_word',
              updatedAt: new Date().toISOString()
            };
            setDoc(doc(db, 'matches', match.matchId), winFinishData, { merge: true }).catch(err => {
              console.error('[Duel Server] Error updating Firestore match doc on win:', err);
            });
            setDoc(doc(db, 'rooms', match.matchId), winFinishData, { merge: true }).catch(err => {
              console.error('[Duel Server] Error updating Firestore room doc on win:', err);
            });

            // Send guess result to winning player
            sendWs(sender.ws, {
              type: 'guess_result',
              matchId: match.matchId,
              word: guessStr,
              feedback,
              isCorrect: true,
              isGameOver: true
            });

            // Broadcast match end event to ALL players in the room simultaneously
            const endPayload = getMatchEndPayload(match);
            broadcastToMatch(match, endPayload);

            // Trigger FCM High Priority Push Notification for background/sleeping devices
            void sendFcmHighPriorityMatchEndNotification({
              matchId: match.matchId,
              winnerId: sender.id,
              loserId: opponent.id,
              winnerName: sender.name,
              loserName: opponent.name,
              winReason: 'correct_word',
              correctWord: match.correctWord
            }).catch(() => {});

            socketToMatchIdMap.delete(match.player1.ws);
            socketToMatchIdMap.delete(match.player2.ws);
            setTimeout(() => activeDuelMatches.delete(matchId), 15000);
          } else {
            sender.attempts.push({ word: guessStr, result: feedback });

            // Persist the updated attempt list & count to Firestore immediately for real-time mobile snapshots and REST polling
            const attemptUpdate = {
              [`players.${sender.id}.attempts`]: sender.attempts,
              [`players.${sender.id}.attemptsCount`]: sender.attempts.length,
              [`players.${sender.id}.currentAttemptCount`]: sender.attempts.length,
              [`players.${sender.id}.completed`]: sender.attempts.length >= 6,
              updatedAt: new Date().toISOString()
            };
            setDoc(doc(db, 'matches', match.matchId), attemptUpdate, { merge: true }).catch(() => {});
            setDoc(doc(db, 'rooms', match.matchId), attemptUpdate, { merge: true }).catch(() => {});

            sendWs(sender.ws, {
              type: 'guess_result',
              matchId: match.matchId,
              word: guessStr,
              feedback,
              isCorrect: false,
              isGameOver: false
            });

            broadcastToMatch(match, {
              type: 'opponent_attempt',
              matchId: match.matchId,
              opponentId: sender.id,
              attemptCount: sender.attempts.length,
              attemptsCount: sender.attempts.length,
              attempts: sender.attempts
            });

            if (sender.attempts.length >= 6 && opponent.attempts.length >= 6) {
              match.gameState = 'FINISHED';
              match.winner = 'draw';
              match.winReason = 'max_attempts';
              match.finishedAt = Date.now();

              const drawFinishData = {
                gameOver: true,
                isGameOver: true,
                status: 'finished',
                gameState: 'finished',
                winner: 'draw',
                winnerId: 'draw',
                winnerUserId: 'draw',
                winReason: 'max_attempts',
                correctWord: match.correctWord,
                targetWord: match.correctWord,
                updatedAt: new Date().toISOString()
              };
              setDoc(doc(db, 'matches', match.matchId), drawFinishData, { merge: true }).catch(() => {});
              setDoc(doc(db, 'rooms', match.matchId), drawFinishData, { merge: true }).catch(() => {});

              const endPayload = getMatchEndPayload(match);
              broadcastToMatch(match, endPayload);

              // Trigger FCM High Priority Push Notification for background/sleeping devices
              void sendFcmHighPriorityMatchEndNotification({
                matchId: match.matchId,
                winnerId: 'draw',
                loserId: '',
                winReason: 'max_attempts',
                correctWord: match.correctWord
              }).catch(() => {});

              socketToMatchIdMap.delete(match.player1.ws);
              socketToMatchIdMap.delete(match.player2.ws);
              setTimeout(() => activeDuelMatches.delete(matchId), 15000);
            }
          }
        } else if (data.type === 'leave_match') {
          handlePlayerDisconnect(ws);
        } else if (data.type === 'join_room' || data.type === 'join_match') {
          const matchId = data.matchId || data.roomId;
          const matchObj = activeDuelMatches.get(matchId);
          if (matchObj) {
            console.log(`[Join Room] Player joining room ${matchId} with word length ${matchObj.wordLength}`);
          }
        } else if (data.type === 'challenge') {
          const existingClient = connectedClients.get(ws);
          const challengerId = data.challengerId || existingClient?.id;
          const challengerName = data.challengerName || existingClient?.name || 'Bir arkadaşın';
          const challengerAvatar = data.challengerAvatar || existingClient?.avatarUrl || '';
          const challengedId = data.challengedId;
          const wordLength = (data.wordLength && Number(data.wordLength) >= 3 && Number(data.wordLength) <= 8) ? Number(data.wordLength) : getRandomMatchLength();
          const challengeId = data.challengeId || ('chal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));

          const challengeObj = {
            id: challengeId,
            challengeId,
            challengerId,
            challengerName,
            challengerAvatar,
            challengedId,
            wordLength,
            createdAt: Date.now()
          };

          activeServerChallenges.set(challengeId, challengeObj);

          let isOpponentOnline = false;
          // Broadcast to target WebSocket client if connected
          for (const [clientWs, clientInfo] of connectedClients.entries()) {
            if (clientInfo && clientInfo.id === challengedId && clientWs.readyState === WebSocket.OPEN) {
              isOpponentOnline = true;
              sendWs(clientWs, {
                type: 'challenge_received',
                challenge: challengeObj
              });
              console.log(`[WebSocket Server] Broadcasted challenge_received to ${clientInfo.name} (${challengedId})`);
            }
          }

          // Trigger FCM push notification as well
          void sendFcmChallengeNotification({
            challengedId,
            challengerName,
            wordLength,
            challengeId,
            isOffline: !isOpponentOnline
          }).catch(() => {});
        } else if (data.type === 'challenge_respond') {
          const challengeId = data.challengeId;
          const accept = !!data.accept;
          const challenge = activeServerChallenges.get(challengeId) || data.challenge;

          if (accept) {
            const wordLength = (challenge?.wordLength && Number(challenge?.wordLength) >= 3 && Number(challenge?.wordLength) <= 8) ? Number(challenge.wordLength) : getRandomMatchLength();
            const matchId = 'match_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            const correctWord = turkishUpper(data.targetWord || data.correctWord || challenge?.targetWord || challenge?.correctWord || getRandomWord(wordLength, true));

            let challengerWs: WebSocket | null = null;
            let challengedWs: WebSocket | null = ws;

            const challengerId = challenge?.challengerId || data.challengerId;
            const challengerName = challenge?.challengerName || data.challengerName || 'Oyuncu 1';
            const challengerAvatar = challenge?.challengerAvatar || '';

            const existingClient = connectedClients.get(ws);
            const challengedId = existingClient?.id || challenge?.challengedId || data.challengedId;
            const challengedName = existingClient?.name || challenge?.challengedName || 'Oyuncu 2';
            const challengedAvatar = existingClient?.avatarUrl || '';

            for (const [clientWs, clientInfo] of connectedClients.entries()) {
              if (clientInfo && clientInfo.id === challengerId && clientWs.readyState === WebSocket.OPEN) {
                challengerWs = clientWs;
                break;
              }
            }

            // Completely clean up any previous match for these players to guarantee a fresh duel session
            for (const [mId, mObj] of activeDuelMatches.entries()) {
              if (
                mObj.player1.id === challengerId ||
                mObj.player2.id === challengerId ||
                mObj.player1.id === challengedId ||
                mObj.player2.id === challengedId ||
                (mObj.player1.ws && mObj.player1.ws === challengerWs) ||
                (mObj.player2.ws && mObj.player2.ws === challengerWs) ||
                (mObj.player1.ws && mObj.player1.ws === challengedWs) ||
                (mObj.player2.ws && mObj.player2.ws === challengedWs)
              ) {
                if (mObj.player1.ws) socketToMatchIdMap.delete(mObj.player1.ws);
                if (mObj.player2.ws) socketToMatchIdMap.delete(mObj.player2.ws);
                activeDuelMatches.delete(mId);
              }
            }

            const matchObj: ActiveDuelMatch = {
              matchId,
              wordLength,
              correctWord,
              gameState: 'WAITING',
              player1: {
                id: challengerId,
                name: challengerName,
                avatarUrl: challengerAvatar,
                ws: challengerWs,
                connected: true,
                attempts: [],
                lastPingAt: Date.now()
              },
              player2: {
                id: challengedId,
                name: challengedName,
                avatarUrl: challengedAvatar,
                ws: challengedWs,
                connected: true,
                attempts: [],
                lastPingAt: Date.now()
              },
              winner: null,
              loser: null,
              winReason: null,
              createdAt: Date.now()
            };

            activeDuelMatches.set(matchId, matchObj);
            if (challengerWs) socketToMatchIdMap.set(challengerWs, matchId);
            if (challengedWs) socketToMatchIdMap.set(challengedWs, matchId);

            const initialFirestoreMatch = data.matchPayload || {
              id: matchId,
              matchId,
              wordLength,
              targetWord: correctWord,
              correctWord,
              gameState: 'WAITING',
              status: 'waiting_ready',
              createdAt: new Date().toISOString(),
              player1: { id: challengerId, name: challengerName, avatarUrl: challengerAvatar },
              player2: { id: challengedId, name: challengedName, avatarUrl: challengedAvatar },
              players: {
                [challengerId]: { id: challengerId, name: challengerName, avatarUrl: challengerAvatar, attempts: [], completed: false, won: false },
                [challengedId]: { id: challengedId, name: challengedName, avatarUrl: challengedAvatar, attempts: [], completed: false, won: false }
              },
              isGameOver: false,
              winner: null
            };

            setDoc(doc(db, 'matches', matchId), initialFirestoreMatch, { merge: true }).catch(() => {});
            setDoc(doc(db, 'rooms', matchId), initialFirestoreMatch, { merge: true }).catch(() => {});
            setDoc(doc(db, 'challenges', challengeId), {
              status: 'accepted',
              matchId,
              wordLength,
              targetWord: correctWord,
              correctWord,
              matchPayload: initialFirestoreMatch
            }, { merge: true }).catch(() => {});

            const readyPayload = {
              type: 'match_ready',
              matchId,
              gameState: 'READY',
              wordLength,
              correctWord,
              targetWord: correctWord,
              player1: { id: challengerId, name: challengerName, avatarUrl: challengerAvatar },
              player2: { id: challengedId, name: challengedName, avatarUrl: challengedAvatar }
            };

            if (challengerWs && challengerWs.readyState === WebSocket.OPEN) sendWs(challengerWs, readyPayload);
            if (challengedWs && challengedWs.readyState === WebSocket.OPEN) sendWs(challengedWs, readyPayload);

            setTimeout(() => {
              if (matchObj) {
                matchObj.gameState = 'PLAYING';
              }
              const startPayload = {
                type: 'match_start',
                matchId,
                gameState: 'PLAYING',
                wordLength,
                correctWord,
                targetWord: correctWord,
                player1: { id: challengerId, name: challengerName, avatarUrl: challengerAvatar },
                player2: { id: challengedId, name: challengedName, avatarUrl: challengedAvatar }
              };

              if (challengerWs && challengerWs.readyState === WebSocket.OPEN) sendWs(challengerWs, startPayload);
              if (challengedWs && challengedWs.readyState === WebSocket.OPEN) sendWs(challengedWs, startPayload);

              setDoc(doc(db, 'matches', matchId), { gameState: 'PLAYING', status: 'playing' }, { merge: true }).catch(() => {});
              setDoc(doc(db, 'rooms', matchId), { gameState: 'PLAYING', status: 'playing' }, { merge: true }).catch(() => {});
            }, 2500);

            activeServerChallenges.delete(challengeId);
          } else {
            setDoc(doc(db, 'challenges', challengeId), { status: 'declined' }, { merge: true }).catch(() => {});
            deleteDoc(doc(db, 'challenges', challengeId)).catch(() => {});
            activeServerChallenges.delete(challengeId);
          }
        } else if (data.type === 'challenge_cancel' || data.type === 'challenge_timeout') {
          const challengeId = data.challengeId;
          if (challengeId) {
            activeServerChallenges.delete(challengeId);
            deleteDoc(doc(db, 'challenges', challengeId)).catch(() => {});
          }
        }
      } catch (e) {
        console.error('[WebSocket Server] Error parsing message:', e);
      }
    });

    ws.on('close', () => {
      handlePlayerDisconnect(ws);
    });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
