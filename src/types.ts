export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  winDistribution: number[]; // Index 0 to 5 corresponds to solve in 1 to 6 attempts
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  iconName: string;
  unlockedAt?: string;
}

export interface DailyMission {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  completed: boolean;
  type: 'play' | 'win' | 'streak' | 'fast_solve' | 'perfect' | 'solve_3' | 'solve_4' | 'solve_5' | 'solve_6' | 'solve_7' | 'solve_8';
}

export interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string; // Base64 or Preset image URL
  stats: UserStats;
  badges: Badge[];
  missions: DailyMission[];
  dailyScore: number;
  lastUpdated: string;
  nameSet?: boolean;
  deviceId?: string;
  friends?: string[];
  wordLengthStats?: { [key: string]: number };
  gold?: number;
  lastDailyLoginClaim?: string;
}

export interface GameAttempt {
  word: string;
  feedback: ('green' | 'orange' | 'grey')[];
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  fromName: string;
  toName: string;
  fromAvatarUrl?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
  updatedAt: number;
}

export interface NetworkLogEntry {
  timestamp: string;
  type: 'info' | 'error' | 'success' | 'sent' | 'received';
  message: string;
}

export function isImageUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.startsWith('data:image/') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:');
}
