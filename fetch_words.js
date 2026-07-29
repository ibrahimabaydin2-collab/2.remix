import fs from 'fs';
import https from 'https';

const url = 'https://gist.githubusercontent.com/laltin/f6b68debe831f7562472d69ffed909c7/raw';

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      console.log('Status code for', url, 'is', res.statusCode);
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log('Redirecting to:', res.headers.location);
        return downloadFile(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Clean and categorize words
const turkishLowerMap = {
  'A': 'a', 'B': 'b', 'C': 'c', 'Ç': 'ç', 'D': 'd', 'E': 'e', 'F': 'f', 'G': 'g', 'Ğ': 'ğ',
  'H': 'h', 'I': 'ı', 'İ': 'i', 'J': 'j', 'K': 'k', 'L': 'l', 'M': 'm', 'N': 'n', 'O': 'o',
  'Ö': 'ö', 'P': 'p', 'R': 'r', 'S': 's', 'Ş': 'ş', 'T': 't', 'U': 'u', 'Ü': 'ü', 'V': 'v',
  'Y': 'y', 'Z': 'z', 'Â': 'â', 'Î': 'î', 'Û': 'û'
};

const turkishUpperMap = {
  'a': 'A', 'b': 'B', 'c': 'C', 'ç': 'Ç', 'd': 'D', 'e': 'E', 'f': 'F', 'g': 'G', 'ğ': 'Ğ',
  'h': 'H', 'ı': 'I', 'i': 'İ', 'j': 'J', 'k': 'K', 'l': 'L', 'm': 'M', 'n': 'N', 'o': 'O',
  'ö': 'Ö', 'p': 'P', 'r': 'R', 's': 'S', 'ş': 'Ş', 't': 'T', 'u': 'U', 'ü': 'Ü', 'v': 'V',
  'y': 'Y', 'z': 'Z', 'â': 'Â', 'î': 'Î', 'û': 'Û'
};

function turkishLower(str) {
  return str.split('').map(c => turkishLowerMap[c] || c.toLowerCase()).join('');
}

async function run() {
  try {
    console.log('Downloading word list from Gist...');
    const data = await downloadFile(url);
    
    let words;
    try {
      const startIdx = data.indexOf('[');
      const endIdx = data.lastIndexOf(']') + 1;
      const cleanData = data.substring(startIdx, endIdx);
      words = eval(cleanData);
    } catch (e) {
      console.log('Eval failed, trying JSON.parse after cleanup');
      const startIdx = data.indexOf('[');
      const endIdx = data.lastIndexOf(']') + 1;
      const cleanData = data.substring(startIdx, endIdx);
      words = JSON.parse(cleanData);
    }

    console.log(`Loaded ${words.length} raw words.`);

    const wordsByLen = {
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
      8: []
    };

    const validChars = /^[a-zçğıöşüâîûA-ZÇĞİÖŞÜÂÎÛ]+$/;

    for (const rawWord of words) {
      const word = rawWord.replace(/\r/g, '').replace(/\n/g, '').trim();
      if (!word) continue;
      
      // Clean word as per requirement:
      // "Ekteki dosyadan sadece 3, 4, 5, 6, 7 ve 8 harfli Türkçe kelimeleri sistemimize ekle."
      // "İçinde boşluk, bölme işareti (/) veya özel karakter olan hatalı satırları tamamen temizle."
      if (!validChars.test(word)) {
        continue;
      }

      const len = word.length;
      if (len >= 3 && len <= 8) {
        const lower = turkishLower(word);
        if (!wordsByLen[len].includes(lower)) {
          wordsByLen[len].push(lower);
        }
      }
    }

    // Sort words
    for (let l = 3; l <= 8; l++) {
      wordsByLen[l].sort((a, b) => a.localeCompare(b, 'tr'));
      console.log(`${l} letters: ${wordsByLen[l].length} words.`);
    }

    // Generate src/data/wordlist.ts
    const output = `import { turkishUpper, turkishLower } from '../utils/turkish';

export const COMMON_TURKISH_WORDS: { [key: number]: string[] } = {
  3: ${JSON.stringify(wordsByLen[3])},
  4: ${JSON.stringify(wordsByLen[4])},
  5: ${JSON.stringify(wordsByLen[5])},
  6: ${JSON.stringify(wordsByLen[6])},
  7: ${JSON.stringify(wordsByLen[7])},
  8: ${JSON.stringify(wordsByLen[8])}
};

// Dynamically categorize all words in COMMON_TURKISH_WORDS by their actual length to correct any misplacements!
const CLEANED_TURKISH_WORDS: { [key: number]: string[] } = {};

Object.values(COMMON_TURKISH_WORDS).forEach((list) => {
  list.forEach((word) => {
    const trimmed = word.replace(/\r/g, '').replace(/\n/g, '').trim();
    const len = trimmed.length;
    if (len >= 3 && len <= 8) {
      if (!CLEANED_TURKISH_WORDS[len]) {
        CLEANED_TURKISH_WORDS[len] = [];
      }
      const lower = turkishLower(trimmed);
      if (!CLEANED_TURKISH_WORDS[len].includes(lower)) {
        CLEANED_TURKISH_WORDS[len].push(lower);
      }
    }
  });
});

// Returns a random word from the curated list of specified length
export function getRandomWord(length: number): string {
  const words = CLEANED_TURKISH_WORDS[length] || CLEANED_TURKISH_WORDS[5];
  if (!words || words.length === 0) {
    const fallbackWords: { [key: number]: string[] } = {
      3: ['ana', 'arı', 'ara', 'bal', 'çay', 'dağ', 'iyi', 'kar', 'koç', 'şef', 'tek', 'tuz', 'yaz', 'yol', 'zor'],
      4: ['açık', 'adım', 'alan', 'altı'],
      5: ['kalem', 'kitap', 'büyük', 'yeşil'],
      6: ['adalet', 'akıllı', 'bardak', 'başarı'],
      7: ['arkadaş', 'belediye', 'hastane', 'merhaba'],
      8: ['bilgisay', 'güzellik', 'telefon', 'temizlik']
    };
    const list = fallbackWords[length] || fallbackWords[5];
    return turkishUpper(list[Math.floor(Math.random() * list.length)]);
  }
  const word = words[Math.floor(Math.random() * words.length)];
  return turkishUpper(word);
}

// Checks if a word exists in our curated list
export function isWordInCuratedList(word: string, length: number): boolean {
  const normalized = turkishLower(word);
  const list = CLEANED_TURKISH_WORDS[length] || [];
  return list.includes(normalized);
}

// Determines the daily word and length deterministically based on date
export function getDailyWordAndLength(): { word: string; length: number; dateStr: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = \`\${year}-\${month}-\${day}\`; // e.g. "2026-07-13"

  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash += dateStr.charCodeAt(i) * (i + 1);
  }

  // Length cycle: 3, 4, 5, 6 based on hash
  // Using modulo 4 gives values 0..3, so adding 3 gives 3, 4, 5, 6
  const length = 3 + (hash % 4);

  // Get words of this length
  const list = CLEANED_TURKISH_WORDS[length] || [];
  let word = 'SAVAŞ';
  if (list.length > 0) {
    const wordIndex = hash % list.length;
    word = list[wordIndex].toUpperCase();
  }
  
  return { word: turkishUpper(word), length, dateStr };
}
`;

    fs.writeFileSync('src/data/wordlist.ts', output);
    console.log('Successfully generated src/data/wordlist.ts');
  } catch (error) {
    console.error('Error running script:', error);
  }
}

run();
