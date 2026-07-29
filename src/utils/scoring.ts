/**
 * Dynamically calculates the score based on the attempt count.
 * 
 * - Kelimeyi 1. denemede bilirse: 5 Puan
 * - Kelimeyi 2. denemede bilirse: 4 Puan
 * - Kelimeyi 3. denemede bilirse: 3 Puan
 * - Kelimeyi 4. denemede bilirse: 2 Puan
 * - Kelimeyi 5. veya 6. denemede bilirse: 1 Puan
 * - Bir kelimeden alınabilecek maksimum puan 5 olmalıdır.
 * 
 * @param wordLength The length of the secret word (unused in new system)
 * @param secondsLeft The remaining time in seconds (unused in new system)
 * @param attemptCount The number of attempts used (1 to 6)
 * @param isDaily Whether the game is in Daily Puzzle mode (always returns 5 points)
 * @returns The calculated score (1 to 5 points)
 */
export function calculateDynamicScore(
  wordLength: number,
  secondsLeft: number,
  attemptCount: number,
  isDaily: boolean = false
): number {
  if (isDaily) {
    return 5;
  }

  let score = 1;
  switch (attemptCount) {
    case 1:
      score = 5;
      break;
    case 2:
      score = 4;
      break;
    case 3:
      score = 3;
      break;
    case 4:
      score = 2;
      break;
    case 5:
    case 6:
      score = 1;
      break;
    default:
      score = 1;
      break;
  }
  return Math.min(Math.max(score, 1), 5);
}

/**
 * Verification function to ensure the scoring calculation conforms to expected ranges
 * and guards against any mathematical edge cases.
 */
export function verifyScoringAccuracy(score: number): boolean {
  if (isNaN(score) || !isFinite(score)) return false;
  // Score must be between 1 and 5 in the new system
  return score >= 1 && score <= 5;
}

/**
 * Calculates the cumulative XP (score) required to reach a specific level.
 * Handles level up to 500 with a progressive, quadratic/exponential scale.
 * 
 * Levels 1 to 5 require exactly:
 * - Level 1: 0 P
 * - Level 2: 25 P
 * - Level 3: 75 P
 * - Level 4: 150 P
 * - Level 5: 300 P
 * 
 * After Level 5, the XP requirement increases algorithmically up to Level 500.
 */
export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return 25;
  if (level === 3) return 75;
  if (level === 4) return 150;
  if (level === 5) return 300;

  let totalXP = 300;
  for (let l = 5; l < level; l++) {
    // Progressive linear growth of the interval: 150, 200, 250, 300...
    const increment = 50 * l;
    totalXP += increment;
  }
  return totalXP;
}

/**
 * Calculates the current level based on total accumulated score (XP).
 * Limit capped at 500.
 */
export function getLevelForScore(score: number): number {
  if (score < 25) return 1;
  if (score < 75) return 2;
  if (score < 150) return 3;
  if (score < 300) return 4;

  let level = 5;
  while (level < 500) {
    if (score < getXPForLevel(level + 1)) {
      break;
    }
    level++;
  }
  return level;
}


