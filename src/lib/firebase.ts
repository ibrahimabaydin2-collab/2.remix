// Complete rebuild stamp for GitHub Actions: 2026-07-23 v1.0.2
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously as firebaseSignInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  linkWithCredential,
  EmailAuthProvider,
  sendEmailVerification as firebaseSendEmailVerification,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  linkWithPopup,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDoc, 
  setDoc,
  deleteDoc,
  serverTimestamp,
  getDocFromCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  limit,
  getDocFromServer,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  deleteField,
  setLogLevel,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { 
  getStorage, 
  ref as storageRef, 
  uploadString, 
  getDownloadURL, 
  uploadBytes 
} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, FriendRequest } from '../types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);

/**
 * Uploads a profile avatar image (File, Blob, base64 Data URL, or local path) to Firebase Storage
 * and returns the public HTTPS download URL.
 */
export async function uploadAvatarToStorage(userId: string, imageSource: File | Blob | string): Promise<string> {
  if (!userId || !imageSource) return typeof imageSource === 'string' ? imageSource : '';

  // If it's already a standard public HTTP/HTTPS URL, no re-upload needed
  if (typeof imageSource === 'string' && (imageSource.startsWith('http://') || imageSource.startsWith('https://')) && !imageSource.includes('data:image')) {
    return imageSource;
  }

  // If it's an emoji or short preset string (e.g. '🧠'), return as is
  if (typeof imageSource === 'string' && imageSource.length <= 8 && !imageSource.includes('/') && !imageSource.includes('.')) {
    return imageSource;
  }

  try {
    const time = Date.now();
    const avatarPath = storageRef(storage, `avatars/${userId}_${time}.jpg`);

    if (imageSource instanceof File || imageSource instanceof Blob) {
      const snap = await uploadBytes(avatarPath, imageSource, { contentType: 'image/jpeg' });
      const downloadUrl = await getDownloadURL(snap.ref);
      console.log('Avatar file successfully uploaded to Firebase Storage:', downloadUrl);
      return downloadUrl;
    } else if (typeof imageSource === 'string' && imageSource.startsWith('data:image')) {
      const snap = await uploadString(avatarPath, imageSource, 'data_url');
      const downloadUrl = await getDownloadURL(snap.ref);
      console.log('Avatar dataUrl successfully uploaded to Firebase Storage:', downloadUrl);
      return downloadUrl;
    }
  } catch (err) {
    console.warn('Firebase Storage upload failed or unconfigured, returning source as fallback:', err);
  }

  if (typeof imageSource === 'string' && imageSource.startsWith('data:image')) {
    return imageSource;
  }
  return typeof imageSource === 'string' ? imageSource : '';
}

// Use the custom firestore database ID from firebase-applet-config.json if specified
const dbId = firebaseConfig.firestoreDatabaseId || '(default)';

// Check if localStorage is supported and accessible
let usePersistentCache = false;
try {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    window.localStorage.setItem('__fs_test_key', 'test');
    window.localStorage.removeItem('__fs_test_key');
    usePersistentCache = true;
  }
} catch (e) {
  usePersistentCache = false;
}

// Silence harmless gRPC idle stream warnings in WebViews / APKs
try {
  setLogLevel('error');
} catch (e) {
  // ignore
}

// Helper to safely initialize Firestore across physical mobile APKs, WebViews, and Web
function createSafeFirestore() {
  const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
  const isMobileOrHybrid = typeof window !== 'undefined' && (
    /android/i.test(ua) ||
    /iphone|ipad|ipod/i.test(ua) ||
    !!(window as any).Capacitor ||
    !!(window as any).AndroidBridge ||
    window.location.protocol === 'file:' ||
    window.location.protocol.startsWith('capacitor') ||
    window.location.protocol.startsWith('ionic')
  );

  let cacheConfig;
  try {
    // Only use persistent multi-tab cache on standard desktop browsers.
    // On physical Android APKs and WebViews, IndexedDB / WebLocks can cause SecurityError / DOMException or hang connection.
    if (usePersistentCache && !isMobileOrHybrid) {
      cacheConfig = persistentLocalCache({ tabManager: persistentMultipleTabManager() });
    } else {
      cacheConfig = memoryLocalCache();
    }
  } catch (e) {
    console.warn('[Firebase] Fallback to memoryLocalCache due to cache init warning:', e);
    cacheConfig = memoryLocalCache();
  }

  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      localCache: cacheConfig
    }, dbId);
  } catch (err) {
    console.warn('[Firebase] initializeFirestore already initialized or failed, retrieving existing db instance:', err);
    try {
      return getFirestore(app, dbId);
    } catch (e2) {
      return getFirestore(app);
    }
  }
}

export const db = createSafeFirestore();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore on startup as required by the Firebase Integration skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Successfully checked Cloud Firestore connection.');
  } catch (error: any) {
    if (error && (error.code === 'unavailable' || error.message?.includes('offline') || error.message?.includes('could not be completed'))) {
      console.warn("Firestore operating in offline/cached mode:", error.message || error);
    } else {
      console.warn("Firestore connection check notice:", error);
    }
  }
}
testConnection();

/**
 * Signs in anonymously (Guest Mode)
 */
export async function signInAsGuest(): Promise<User> {
  const result = await firebaseSignInAnonymously(auth);
  return result.user;
}

/**
 * Registers a new user with Email and Password
 */
export async function registerWithEmailAndPassword(email: string, password: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  // Send email verification automatically
  await firebaseSendEmailVerification(result.user);
  return result.user;
}

/**
 * Logs in with Email and Password
 */
export async function loginWithEmailAndPassword(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

/**
 * Links an anonymous guest account to an Email & Password
 */
export async function linkGuestToEmailAndPassword(email: string, password: string): Promise<User> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Giriş yapmış aktif bir misafir oturumu bulunamadı.');
  }
  const credential = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(currentUser, credential);
  // Send verification email automatically
  await firebaseSendEmailVerification(result.user);
  return result.user;
}

/**
 * Sends a verification email to the current user
 */
export async function sendVerificationEmail(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Giriş yapmış aktif bir kullanıcı bulunamadı.');
  }
  await firebaseSendEmailVerification(currentUser);
}

/**
 * Signs out the current user
 */
export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Utility to merge user profiles safely without losing gold, dailyScore, stats, badges, or missions.
 * Takes the maximum / union of progress from all provided profile objects.
 */
export function createOrMergeProfile(
  primary?: Partial<UserProfile> | null,
  ...fallbackProfiles: Array<Partial<UserProfile> | null | undefined>
): UserProfile {
  const DEFAULT_STATS = {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    winDistribution: [0, 0, 0, 0, 0, 0]
  };

  const DEFAULT_WORD_LENGTH_STATS = {
    "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0
  };

  const allProfiles = [primary, ...fallbackProfiles].filter(Boolean) as Array<Partial<UserProfile>>;

  let mergedId = primary?.id || fallbackProfiles.find(p => p?.id)?.id || `user_${Math.random().toString(36).substring(2, 11)}`;
  let mergedName = '';
  let mergedAvatarUrl = '🧠';
  let mergedGold: number | null = null;
  let mergedDailyScore = 0;
  let mergedNameSet = false;
  let mergedDeviceId = '';
  let mergedLastDailyLoginClaim = '';
  
  // 1. Check if local storage has a stored gold value
  let localGold: number | null = null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const gStr = window.localStorage.getItem('kelimesavasi_gold');
      if (gStr !== null && !isNaN(parseInt(gStr, 10))) {
        localGold = parseInt(gStr, 10);
      }
    }
  } catch (e) {}

  // 2. Select gold from profile with the most recent lastUpdated timestamp
  let newestTimestamp = -1;
  let newestGold: number | null = null;

  for (const p of allProfiles) {
    if (typeof p.gold === 'number' && !isNaN(p.gold)) {
      const ts = p.lastUpdated ? new Date(p.lastUpdated).getTime() : 0;
      if (ts > newestTimestamp || newestGold === null) {
        newestTimestamp = ts;
        newestGold = p.gold;
      }
    }
  }

  // Prioritize localGold or newest timestamp over default 20
  if (localGold !== null) {
    const primaryTs = primary?.lastUpdated ? new Date(primary.lastUpdated).getTime() : 0;
    if (primary && typeof primary.gold === 'number' && primaryTs > newestTimestamp) {
      mergedGold = primary.gold;
    } else {
      mergedGold = localGold;
    }
  } else if (newestGold !== null) {
    mergedGold = newestGold;
  } else {
    mergedGold = 20; // Default starting gold for brand new profiles
  }
  
  const mergedStats = { ...DEFAULT_STATS };
  const mergedWordLengthStats = { ...DEFAULT_WORD_LENGTH_STATS };
  const badgeMap = new Map<string, any>();
  const missionMap = new Map<string, any>();
  const friendSet = new Set<string>();

  const isGenericName = (n?: string) => !n || n === 'Oyuncu' || n === 'Kelime Oyuncusu' || n === 'Google Oyuncusu' || n.startsWith('Savaşçı_');

  // Process profiles from oldest/lowest priority to primary so primary overrides strings/metadata, but numerical progress takes max()
  for (const p of [...allProfiles].reverse()) {
    if (p.id) mergedId = p.id;
    if (p.name && (!mergedName || isGenericName(mergedName))) {
      mergedName = p.name;
    }
    if (p.avatarUrl) mergedAvatarUrl = p.avatarUrl;
    if (p.nameSet !== undefined) mergedNameSet = mergedNameSet || p.nameSet;
    if (p.deviceId) mergedDeviceId = p.deviceId;
    if (p.lastDailyLoginClaim) mergedLastDailyLoginClaim = p.lastDailyLoginClaim;

    if (typeof p.dailyScore === 'number') {
      mergedDailyScore = Math.max(mergedDailyScore, p.dailyScore);
    }

    if (p.stats) {
      mergedStats.gamesPlayed = Math.max(mergedStats.gamesPlayed, p.stats.gamesPlayed || 0);
      mergedStats.gamesWon = Math.max(mergedStats.gamesWon, p.stats.gamesWon || 0);
      mergedStats.currentStreak = Math.max(mergedStats.currentStreak, p.stats.currentStreak || 0);
      mergedStats.maxStreak = Math.max(mergedStats.maxStreak, p.stats.maxStreak || 0);
      
      if (Array.isArray(p.stats.winDistribution)) {
        p.stats.winDistribution.forEach((val, idx) => {
          if (idx < 6) {
            mergedStats.winDistribution[idx] = Math.max(mergedStats.winDistribution[idx] || 0, val || 0);
          }
        });
      }
    }

    if (p.wordLengthStats) {
      Object.keys(DEFAULT_WORD_LENGTH_STATS).forEach((key) => {
        const count = p.wordLengthStats?.[key] || 0;
        mergedWordLengthStats[key as keyof typeof DEFAULT_WORD_LENGTH_STATS] = Math.max(
          mergedWordLengthStats[key as keyof typeof DEFAULT_WORD_LENGTH_STATS] || 0,
          count
        );
      });
    }

    if (Array.isArray(p.badges)) {
      p.badges.forEach(badge => {
        const existing = badgeMap.get(badge.id);
        if (!existing || (!existing.unlockedAt && badge.unlockedAt)) {
          badgeMap.set(badge.id, badge);
        }
      });
    }

    if (Array.isArray(p.missions)) {
      p.missions.forEach(mission => {
        const existing = missionMap.get(mission.id);
        if (!existing) {
          missionMap.set(mission.id, mission);
        } else {
          missionMap.set(mission.id, {
            ...existing,
            current: Math.max(existing.current || 0, mission.current || 0),
            completed: existing.completed || mission.completed
          });
        }
      });
    }

    if (Array.isArray(p.friends)) {
      p.friends.forEach(f => friendSet.add(f));
    }
  }

  // Ensure primary profile's friends list takes strict precedence if explicitly defined
  // so deleted friends aren't resurrected from stale local storage or fallback caches
  let finalFriends = Array.from(friendSet);
  if (primary && Array.isArray(primary.friends)) {
    finalFriends = primary.friends;
  }

  if (primary?.name && !isGenericName(primary.name)) {
    mergedName = primary.name;
  }
  if (primary?.avatarUrl) {
    mergedAvatarUrl = primary.avatarUrl;
  }

  return {
    id: mergedId,
    name: mergedName || 'Kelime Oyuncusu',
    avatarUrl: mergedAvatarUrl,
    gold: mergedGold,
    dailyScore: mergedDailyScore,
    stats: mergedStats,
    wordLengthStats: mergedWordLengthStats,
    badges: Array.from(badgeMap.values()),
    missions: Array.from(missionMap.values()),
    friends: finalFriends,
    nameSet: mergedNameSet || !!mergedName,
    deviceId: mergedDeviceId,
    lastDailyLoginClaim: mergedLastDailyLoginClaim,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Subscribes to real-time changes of a user profile in Firestore,
 * combining main profile document and the stats subcollection.
 */
export function subscribeToUserProfile(
  uid: string,
  onUpdate: (profile: UserProfile) => void,
  onError?: (error: any) => void
): () => void {
  if (!uid) return () => {};
  const userDocRef = doc(db, 'users', uid);
  const statsDocRef = doc(db, 'users', uid, 'stats', 'summary');

  let userData: UserProfile | null = null;
  let statsData: any = null;

  const notify = () => {
    if (!userData) return;
    const combinedProfile = createOrMergeProfile(userData, {
      id: uid,
      dailyScore: typeof statsData?.dailyScore === 'number' ? statsData.dailyScore : userData.dailyScore,
      score: typeof statsData?.score === 'number' ? statsData.score : (userData as any).score,
      stats: statsData?.stats ? { ...userData.stats, ...statsData.stats } : userData.stats,
      wordLengthStats: statsData?.wordLengthStats ? { ...userData.wordLengthStats, ...statsData.wordLengthStats } : userData.wordLengthStats,
      ...(statsData?.solvedWords ? { solvedWords: statsData.solvedWords } : {}),
      ...(statsData?.knownWords ? { knownWords: statsData.knownWords } : {})
    });
    onUpdate(combinedProfile);
  };

  const unsubUser = onSnapshot(
    userDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        userData = snapshot.data() as UserProfile;
        notify();
      }
    },
    (err) => {
      console.warn(`Realtime profile listener warning for ${uid}:`, err);
      if (onError) onError(err);
    }
  );

  const unsubStats = onSnapshot(
    statsDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        statsData = snapshot.data();
        notify();
      }
    },
    () => {}
  );

  return () => {
    unsubUser();
    unsubStats();
  };
}

/**
 * Fetches the user profile from Firestore matching a specific Device ID
 */
export async function fetchUserProfileByDeviceId(deviceId: string): Promise<UserProfile | null> {
  if (!deviceId) return null;
  try {
    const usersCollection = collection(db, 'users');
    const q = query(usersCollection, where('deviceId', '==', deviceId), limit(5));
    const querySnapshot = await Promise.race([
      getDocs(q),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Firestore Fetch Timeout')), 4000))
    ]) as any;

    if (querySnapshot && !querySnapshot.empty) {
      const profiles = querySnapshot.docs.map((docSnap: any) => docSnap.data() as UserProfile);
      if (profiles.length === 1) return profiles[0];
      // Merge matching profiles so highest progress/stats is returned
      let bestProfile: UserProfile = profiles[0];
      for (let i = 1; i < profiles.length; i++) {
        bestProfile = createOrMergeProfile(bestProfile, profiles[i]);
      }
      return bestProfile;
    }
  } catch (error) {
    console.warn('Failed to fetch user profile by deviceId:', error);
    if (error instanceof Error && (error.message.includes('permission') || error.message.includes('Permission'))) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
  }
  return null;
}

/**
 * Deletes a user profile document from Firestore
 */
export async function deleteUserProfile(uid: string, force = false): Promise<void> {
  try {
    if (!force && auth.currentUser && uid !== auth.currentUser.uid) {
      console.warn(`Skipping deleteUserProfile for ${uid} because it does not match current authenticated user ID ${auth.currentUser.uid}`);
      return;
    }
    const userDocRef = doc(db, 'users', uid);
    await deleteDoc(userDocRef);
  } catch (error) {
    console.warn('Failed to delete old user profile (expected/non-fatal):', error);
  }
}

/**
 * Cleans up duplicate / ghost user profile documents for the same deviceId in Firestore
 */
export async function cleanupGhostUserProfiles(deviceId: string, currentUid: string): Promise<void> {
  // Safe no-op: Do not delete documents from Firestore automatically to preserve user profiles
  return;
}

/**
 * Fetches the user profile from Firestore, including subcollection statistics
 */
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const userDocRef = doc(db, 'users', uid);
  const statsDocRef = doc(db, 'users', uid, 'stats', 'summary');

  try {
    const [userSnap, statsSnap] = await Promise.all([
      Promise.race([
        getDoc(userDocRef),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Firestore Fetch Timeout')), 4000))
      ]) as any,
      getDoc(statsDocRef).catch(() => null)
    ]);
    
    if (userSnap && userSnap.exists()) {
      const data = userSnap.data() as UserProfile;
      const statsData = (statsSnap && statsSnap.exists()) ? statsSnap.data() : {};

      return createOrMergeProfile(data, {
        id: data.id || userSnap.id,
        dailyScore: typeof statsData.dailyScore === 'number' ? statsData.dailyScore : data.dailyScore,
        score: typeof statsData.score === 'number' ? statsData.score : (data as any).score,
        stats: statsData.stats ? { ...data.stats, ...statsData.stats } : data.stats,
        wordLengthStats: statsData.wordLengthStats ? { ...data.wordLengthStats, ...statsData.wordLengthStats } : data.wordLengthStats,
        ...(statsData.solvedWords ? { solvedWords: statsData.solvedWords } : {}),
        ...(statsData.knownWords ? { knownWords: statsData.knownWords } : {})
      });
    }
  } catch (error) {
    console.warn('Failed to fetch user profile from server, trying offline cache:', error);
    if (error instanceof Error && (error.message.includes('permission') || error.message.includes('Permission'))) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }
    try {
      // 2. Try to fetch from local Firestore cache
      const userSnap = await getDocFromCache(userDocRef);
      if (userSnap && userSnap.exists()) {
        console.log('Successfully fetched user profile from Firestore offline cache.');
        const data = userSnap.data() as UserProfile;
        return { ...data, id: data.id || userSnap.id };
      }
    } catch (cacheError) {
      console.warn('Failed to fetch from Firestore offline cache:', cacheError);
    }
  }
  
  // 3. Fallback to localStorage if Firestore is completely unreachable and cache is empty
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const localSaved = window.localStorage.getItem('kelimesavasi_profile');
      const savedUsername = window.localStorage.getItem('saved_username');
      if (localSaved) {
        const parsed = JSON.parse(localSaved);
        if (parsed && (parsed.id === uid || parsed.uid === uid || parsed.id)) {
          console.log('Restored user profile from localStorage fallback.');
          if ((!parsed.name || parsed.name === 'Oyuncu' || parsed.name === 'Kelime Oyuncusu') && savedUsername) {
            parsed.name = savedUsername;
          }
          return parsed as UserProfile;
        }
      }
    }
  } catch (localError) {
    console.warn('Failed to restore from localStorage:', localError);
  }

  return null;
}

/**
 * Normalizes Turkish letters to English counterparts for fuzzy case-insensitive matching
 */
export function turkishToEnglishFriendly(str: string): string {
  if (!str) return '';
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .toLowerCase();
}

/**
 * Checks if a username matches a search term in any case/Turkish-locale variation
 */
export function matchesSearchTerm(userName: string, searchTerm: string): boolean {
  if (!userName || !searchTerm) return false;
  const term = searchTerm.trim().toLowerCase();
  if (!term) return false;

  const uName = userName.trim().toLowerCase();
  const uNameTr = userName.trim().toLocaleLowerCase('tr-TR');
  const termTr = searchTerm.trim().toLocaleLowerCase('tr-TR');
  const uNameClean = turkishToEnglishFriendly(userName);
  const termClean = turkishToEnglishFriendly(searchTerm);

  return (
    uName.includes(term) ||
    uNameTr.includes(termTr) ||
    uNameClean.includes(termClean)
  );
}

/**
 * Synchronizes a user's updated username and avatar across all Firestore collections
 * (friend_requests, challenges, matches, rooms, matchmaking queues) using Batch Writes.
 * Ensures strict UID-based identity integrity.
 */
export async function syncUserProfileAcrossFirestore(
  uid: string,
  newName: string,
  newAvatarUrl?: string
): Promise<void> {
  if (!uid || !newName) return;
  const cleanName = newName.trim();
  if (!cleanName) return;

  try {
    const batch = writeBatch(db);
    let operationCount = 0;

    // 1. Friend Requests (fromUid == uid)
    const qFriendReqFrom = query(collection(db, 'friend_requests'), where('fromUid', '==', uid));
    const snapFriendReqFrom = await getDocs(qFriendReqFrom).catch(() => null);
    if (snapFriendReqFrom) {
      snapFriendReqFrom.forEach(docSnap => {
        const updateData: any = { fromName: cleanName };
        if (newAvatarUrl) updateData.fromAvatarUrl = newAvatarUrl;
        batch.update(docSnap.ref, updateData);
        operationCount++;
      });
    }

    // 2. Friend Requests (toUid == uid)
    const qFriendReqTo = query(collection(db, 'friend_requests'), where('toUid', '==', uid));
    const snapFriendReqTo = await getDocs(qFriendReqTo).catch(() => null);
    if (snapFriendReqTo) {
      snapFriendReqTo.forEach(docSnap => {
        batch.update(docSnap.ref, { toName: cleanName });
        operationCount++;
      });
    }

    // 3. Challenges (challengerId == uid)
    const qChallengesFrom = query(collection(db, 'challenges'), where('challengerId', '==', uid));
    const snapChallengesFrom = await getDocs(qChallengesFrom).catch(() => null);
    if (snapChallengesFrom) {
      snapChallengesFrom.forEach(docSnap => {
        const updateData: any = { challengerName: cleanName };
        if (newAvatarUrl) updateData.challengerAvatar = newAvatarUrl;
        batch.update(docSnap.ref, updateData);
        operationCount++;
      });
    }

    // 4. Challenges (challengedId == uid)
    const qChallengesTo = query(collection(db, 'challenges'), where('challengedId', '==', uid));
    const snapChallengesTo = await getDocs(qChallengesTo).catch(() => null);
    if (snapChallengesTo) {
      snapChallengesTo.forEach(docSnap => {
        batch.update(docSnap.ref, { challengedName: cleanName });
        operationCount++;
      });
    }

    // 5. Matches (player1.id == uid)
    const qMatchesP1 = query(collection(db, 'matches'), where('player1.id', '==', uid));
    const snapMatchesP1 = await getDocs(qMatchesP1).catch(() => null);
    if (snapMatchesP1) {
      snapMatchesP1.forEach(docSnap => {
        const updateData: any = {
          'player1.name': cleanName,
          [`players.${uid}.name`]: cleanName
        };
        if (newAvatarUrl) {
          updateData['player1.avatarUrl'] = newAvatarUrl;
          updateData[`players.${uid}.avatarUrl`] = newAvatarUrl;
        }
        batch.update(docSnap.ref, updateData);
        operationCount++;
      });
    }

    // 6. Matches (player2.id == uid)
    const qMatchesP2 = query(collection(db, 'matches'), where('player2.id', '==', uid));
    const snapMatchesP2 = await getDocs(qMatchesP2).catch(() => null);
    if (snapMatchesP2) {
      snapMatchesP2.forEach(docSnap => {
        const updateData: any = {
          'player2.name': cleanName,
          [`players.${uid}.name`]: cleanName
        };
        if (newAvatarUrl) {
          updateData['player2.avatarUrl'] = newAvatarUrl;
          updateData[`players.${uid}.avatarUrl`] = newAvatarUrl;
        }
        batch.update(docSnap.ref, updateData);
        operationCount++;
      });
    }

    // 7. Rooms (player1.id == uid)
    const qRoomsP1 = query(collection(db, 'rooms'), where('player1.id', '==', uid));
    const snapRoomsP1 = await getDocs(qRoomsP1).catch(() => null);
    if (snapRoomsP1) {
      snapRoomsP1.forEach(docSnap => {
        const updateData: any = {
          'player1.name': cleanName,
          [`players.${uid}.name`]: cleanName
        };
        if (newAvatarUrl) {
          updateData['player1.avatarUrl'] = newAvatarUrl;
          updateData[`players.${uid}.avatarUrl`] = newAvatarUrl;
        }
        batch.update(docSnap.ref, updateData);
        operationCount++;
      });
    }

    // 8. Rooms (player2.id == uid)
    const qRoomsP2 = query(collection(db, 'rooms'), where('player2.id', '==', uid));
    const snapRoomsP2 = await getDocs(qRoomsP2).catch(() => null);
    if (snapRoomsP2) {
      snapRoomsP2.forEach(docSnap => {
        const updateData: any = {
          'player2.name': cleanName,
          [`players.${uid}.name`]: cleanName
        };
        if (newAvatarUrl) {
          updateData['player2.avatarUrl'] = newAvatarUrl;
          updateData[`players.${uid}.avatarUrl`] = newAvatarUrl;
        }
        batch.update(docSnap.ref, updateData);
        operationCount++;
      });
    }

    // 9. Matchmaking Queues
    const queueNames = ['matchmaking_queue', ...[3, 4, 5, 6, 7, 8, 9, 10].map(l => `matchmaking_queue_${l}`)];
    for (const qName of queueNames) {
      const queueDocRef = doc(db, qName, uid);
      const queueSnap = await getDoc(queueDocRef).catch(() => null);
      if (queueSnap && queueSnap.exists()) {
        const updateData: any = { name: cleanName };
        if (newAvatarUrl) updateData.avatarUrl = newAvatarUrl;
        batch.update(queueDocRef, updateData);
        operationCount++;
      }
    }

    // Execute batch write if operations are queued
    if (operationCount > 0) {
      await batch.commit();
      console.log(`Synced username "${cleanName}" across ${operationCount} Firestore documents for UID ${uid}.`);
    }
  } catch (error) {
    console.warn('Failed to sync username across Firestore collections:', error);
  }
}

/**
 * Updates atomic statistics in the subcollection users/{uid}/stats/summary
 * using increment() for numerical fields and arrayUnion() for solved words.
 * Also cleans up heavy stats fields from the main profile document to prevent bloating.
 */
export async function updateUserStatsInFirestore(
  uid: string,
  updates: {
    scoreDelta?: number;
    dailyScoreDelta?: number;
    gamesPlayedDelta?: number;
    gamesWonDelta?: number;
    currentStreak?: number;
    maxStreak?: number;
    goldDelta?: number;
    wordLength?: number | string;
    solvedWord?: string;
    winDistributionIndex?: number;
  }
): Promise<void> {
  if (!uid) return;

  try {
    const statsDocRef = doc(db, 'users', uid, 'stats', 'summary');
    const statsPayload: any = {
      lastUpdated: new Date().toISOString(),
      updatedAt: serverTimestamp()
    };

    if (updates.scoreDelta && updates.scoreDelta > 0) {
      statsPayload.score = increment(updates.scoreDelta);
    }
    if (updates.dailyScoreDelta && updates.dailyScoreDelta > 0) {
      statsPayload.dailyScore = increment(updates.dailyScoreDelta);
    }
    if (updates.gamesPlayedDelta && updates.gamesPlayedDelta > 0) {
      statsPayload['stats.gamesPlayed'] = increment(updates.gamesPlayedDelta);
    }
    if (updates.gamesWonDelta && updates.gamesWonDelta > 0) {
      statsPayload['stats.gamesWon'] = increment(updates.gamesWonDelta);
    }
    if (updates.goldDelta) {
      statsPayload.gold = increment(updates.goldDelta);
    }
    if (updates.wordLength) {
      statsPayload[`wordLengthStats.${updates.wordLength}`] = increment(1);
    }
    if (updates.winDistributionIndex !== undefined && updates.winDistributionIndex >= 0 && updates.winDistributionIndex < 6) {
      statsPayload[`stats.winDistribution.${updates.winDistributionIndex}`] = increment(1);
    }
    if (updates.currentStreak !== undefined) {
      statsPayload['stats.currentStreak'] = updates.currentStreak;
    }
    if (updates.maxStreak !== undefined) {
      statsPayload['stats.maxStreak'] = updates.maxStreak;
    }

    // Requirement 2: Use arrayUnion when adding solved words to prevent duplicate entries
    if (updates.solvedWord) {
      const cleanWord = updates.solvedWord.trim().toUpperCase();
      if (cleanWord) {
        statsPayload.solvedWords = arrayUnion(cleanWord);
        statsPayload.knownWords = arrayUnion(cleanWord);
      }
    }

    await setDoc(statsDocRef, statsPayload, { merge: true });

    // Requirement 3: Clean up heavy stats fields from main user profile document to prevent bloating
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, {
      solvedWords: deleteField(),
      knownWords: deleteField()
    }).catch(() => {});
  } catch (err) {
    console.warn('Failed to update user stats in subcollection:', err);
  }
}

/**
 * Saves or updates the user profile in Firestore
 */
export async function saveUserProfileToFirestore(profile: UserProfile): Promise<void> {
  try {
    let effectiveProfile = { ...profile };

    // Normalize profile ID to auth.currentUser.uid if logged in
    if (auth.currentUser && auth.currentUser.uid) {
      if (effectiveProfile.id !== auth.currentUser.uid) {
        console.log(`Normalizing profile ID from ${effectiveProfile.id} to authenticated UID ${auth.currentUser.uid}`);
        effectiveProfile.id = auth.currentUser.uid;
      }
    }

    if (!effectiveProfile.id) {
      console.warn('Cannot save profile without an ID');
      return;
    }

    // Automatically upload base64/dataUrl/local avatar image to Firebase Storage if needed
    if (effectiveProfile.avatarUrl && (effectiveProfile.avatarUrl.startsWith('data:image') || effectiveProfile.avatarUrl.startsWith('blob:') || effectiveProfile.avatarUrl.startsWith('file:'))) {
      try {
        const publicUrl = await uploadAvatarToStorage(effectiveProfile.id, effectiveProfile.avatarUrl);
        if (publicUrl && publicUrl.startsWith('http')) {
          effectiveProfile.avatarUrl = publicUrl;
        }
      } catch (upErr) {
        console.warn('Auto avatar upload error in saveUserProfileToFirestore:', upErr);
      }
    }

    // Update browser local storage immediately FIRST so client-side state is always perfectly synchronized
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('kelimesavasi_profile', JSON.stringify(effectiveProfile));
        if (typeof effectiveProfile.gold === 'number' && !isNaN(effectiveProfile.gold)) {
          window.localStorage.setItem('kelimesavasi_gold', effectiveProfile.gold.toString());
        }
        const resolvedName = effectiveProfile.name || (effectiveProfile as any).username || (effectiveProfile as any).displayName;
        if (resolvedName) {
          window.localStorage.setItem('saved_username', resolvedName.trim());
        }
      }
    } catch (lsErr) {
      console.warn('LocalStorage save error in saveUserProfileToFirestore:', lsErr);
    }

    const userDocRef = doc(db, 'users', effectiveProfile.id);
    
    const cleanName = (effectiveProfile.name || (effectiveProfile as any).username || (effectiveProfile as any).displayName || '').trim();
    const termLower = cleanName.toLowerCase();
    const termLowerTr = cleanName.toLocaleLowerCase('tr-TR');
    const termClean = turkishToEnglishFriendly(cleanName);

    // Extract stats & word arrays to store them in subcollection users/{uid}/stats/summary
    const solvedWordsArray = Array.isArray((effectiveProfile as any).solvedWords) ? (effectiveProfile as any).solvedWords : [];
    const knownWordsArray = Array.isArray((effectiveProfile as any).knownWords) ? (effectiveProfile as any).knownWords : [];

    // Main user profile data without heavy word arrays to avoid swelling root document
    const dataToSave: any = {
      ...effectiveProfile,
      friends: Array.isArray(effectiveProfile.friends) ? effectiveProfile.friends : [],
      name: cleanName,
      username: (effectiveProfile as any).username || cleanName,
      displayName: (effectiveProfile as any).displayName || cleanName,
      name_lowercase: termLower,
      name_lowercase_tr: termLowerTr,
      name_clean: termClean,
      isOnline: true,
      lastSeen: Date.now(),
      lastActive: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      updatedAt: serverTimestamp(),
      solvedWords: deleteField(),
      knownWords: deleteField()
    };

    // We await setDoc so we are 100% sure the write is committed to local cache/network
    await setDoc(userDocRef, dataToSave, { merge: true });
    console.log(`Successfully saved user profile to Firestore for UID ${effectiveProfile.id} (${cleanName})`);

    // Requirement 3: Save stats data into dedicated subcollection users/{uid}/stats/summary
    const statsDocRef = doc(db, 'users', effectiveProfile.id, 'stats', 'summary');
    const statsPayload: any = {
      dailyScore: effectiveProfile.dailyScore || 0,
      score: (effectiveProfile as any).score || effectiveProfile.dailyScore || 0,
      stats: effectiveProfile.stats || { gamesPlayed: 0, gamesWon: 0, currentStreak: 0, maxStreak: 0, winDistribution: [0, 0, 0, 0, 0, 0] },
      wordLengthStats: effectiveProfile.wordLengthStats || { "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0 },
      lastUpdated: new Date().toISOString(),
      updatedAt: serverTimestamp()
    };

    // Requirement 2: Use arrayUnion for solved words
    if (solvedWordsArray.length > 0) {
      statsPayload.solvedWords = arrayUnion(...solvedWordsArray);
    }
    if (knownWordsArray.length > 0) {
      statsPayload.knownWords = arrayUnion(...knownWordsArray);
    }

    await setDoc(statsDocRef, statsPayload, { merge: true }).catch((statsErr) => {
      console.warn('Non-blocking subcollection stats write warning:', statsErr);
    });

    // Synchronize updated username & avatar across all secondary Firestore collections
    syncUserProfileAcrossFirestore(effectiveProfile.id, cleanName, effectiveProfile.avatarUrl).catch((err) => {
      console.warn('Non-blocking syncUserProfileAcrossFirestore error:', err);
    });

    // Clean up any old obsolete ghost documents belonging to the same deviceId
    if (effectiveProfile.deviceId) {
      cleanupGhostUserProfiles(effectiveProfile.deviceId, effectiveProfile.id).catch(() => {});
    }
  } catch (error) {
    console.error('Failed to save user profile:', error);
    handleFirestoreError(error, OperationType.WRITE, `users/${profile.id}`);
  }
}

/**
 * Updates user presence / online status in Firestore
 */
export async function updateUserPresence(uid: string, isOnline: boolean = true): Promise<void> {
  if (!uid) return;
  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, {
      isOnline,
      lastSeen: Date.now(),
      lastActive: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to update user presence in Firestore:', err);
  }
}

/**
 * Resets/Clears user matchmaking and room statuses in Firestore cleanly
 */
export async function clearMatchmakingState(uid: string): Promise<void> {
  if (!uid) return;
  const deletePromises: Promise<any>[] = [
    deleteDoc(doc(db, 'matchmaking_queue', uid)).catch(() => {})
  ];
  [3, 4, 5, 6, 7, 8, 9, 10].forEach((len) => {
    deletePromises.push(deleteDoc(doc(db, `matchmaking_queue_${len}`, uid)).catch(() => {}));
  });
  await Promise.all(deletePromises);

  const userDocRef = doc(db, 'users', uid);
  try {
    await updateDoc(userDocRef, {
      roomId: null,
      activeRoomId: null,
      isPlaying: false,
      isInRoom: false,
      isSearching: false,
      matchmakingStatus: 'idle',
      lastUpdated: new Date().toISOString()
    });
    console.log('Successfully cleared matchmaking state in Firestore for:', uid);
  } catch (error) {
    console.warn('Failed to clear matchmaking state in Firestore via updateDoc, trying merge:', error);
    try {
      await setDoc(userDocRef, {
        roomId: null,
        activeRoomId: null,
        isPlaying: false,
        isInRoom: false,
        isSearching: false,
        matchmakingStatus: 'idle',
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      console.log('Successfully cleared matchmaking state in Firestore via setDoc merge for:', uid);
    } catch (fallbackError) {
      console.error('Fallback clear matchmaking state failed:', fallbackError);
    }
  }
}

/**
 * Google Auth Provider Instance
 */
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

/**
 * Signs in with Google
 */
export async function signInWithGoogle(): Promise<{ user: User; credential?: any }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user };
  } catch (error: any) {
    if (error.code === 'auth/account-exists-with-different-credential') {
      const credential = GoogleAuthProvider.credentialFromError(error);
      return { user: null as any, credential };
    }
    throw error;
  }
}

/**
 * Links current guest account to Google
 */
export async function linkGuestWithGoogle(): Promise<User> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Aktif bir oturum bulunamadı.');
  const result = await linkWithPopup(currentUser, googleProvider);
  return result.user;
}

/**
 * Fetches user profiles of users who have added the current user to their friends list
 */
export async function fetchUsersWhoAddedMe(uid: string): Promise<UserProfile[]> {
  try {
    const usersCollection = collection(db, 'users');
    const q = query(usersCollection, where('friends', 'array-contains', uid));
    const querySnapshot = await getDocs(q);
    const results: UserProfile[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as UserProfile;
      results.push({ ...data, id: data.id || docSnap.id });
    });
    return results;
  } catch (error) {
    console.error('Failed to fetch users who added me:', error);
    return [];
  }
}

/**
 * Fetches user profiles for a list of UIDs
 */
export async function fetchProfilesByIds(uids: string[]): Promise<UserProfile[]> {
  if (!uids || uids.length === 0) return [];
  try {
    const uniqueIds = Array.from(new Set(uids)).filter(Boolean);
    const promises = uniqueIds.map(async (uid) => {
      try {
        const userDocRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const data = userSnap.data() as UserProfile;
          return { ...data, id: data.id || userSnap.id };
        }
      } catch (e) {
        console.warn(`Failed to fetch profile for friend ID ${uid}:`, e);
      }
      return null;
    });
    const results = await Promise.all(promises);
    return results.filter((p): p is UserProfile => p !== null);
  } catch (error) {
    console.error('Failed to fetch profiles by ids:', error);
    return [];
  }
}

/**
 * Sends a friend request to a target user in Firestore and updates sender's friends array
 */
export async function sendFriendRequestInFirestore(
  fromUser: UserProfile,
  toUserId: string,
  toName?: string
): Promise<void> {
  if (!fromUser?.id || !toUserId || fromUser.id === toUserId) return;
  try {
    const reqId = `${fromUser.id}_${toUserId}`;
    const reqRef = doc(db, 'friend_requests', reqId);

    // Check if reverse request exists (toUserId sent request to fromUser)
    const reverseReqId = `${toUserId}_${fromUser.id}`;
    const reverseSnap = await getDoc(doc(db, 'friend_requests', reverseReqId));
    if (reverseSnap.exists()) {
      const revData = reverseSnap.data() as FriendRequest;
      if (revData.status === 'pending') {
        // Mutual request -> auto accept!
        await acceptFriendRequestInFirestore(fromUser.id, toUserId);
        return;
      }
    }

    const now = Date.now();
    const reqData: FriendRequest = {
      id: reqId,
      fromUid: fromUser.id,
      toUid: toUserId,
      fromName: fromUser.name || 'Oyuncu',
      toName: toName || 'Oyuncu',
      fromAvatarUrl: fromUser.avatarUrl || '🧠',
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };

    await setDoc(reqRef, reqData, { merge: true });
  } catch (error) {
    console.error('Failed to send friend request in Firestore:', error);
    throw error;
  }
}

/**
 * Accepts a friend request in Firestore and synchronizes friends array on both user documents
 */
export async function acceptFriendRequestInFirestore(
  currentUserId: string,
  targetUserId: string
): Promise<void> {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;
  try {
    const reqId1 = `${targetUserId}_${currentUserId}`;
    const reqId2 = `${currentUserId}_${targetUserId}`;
    const ref1 = doc(db, 'friend_requests', reqId1);
    const ref2 = doc(db, 'friend_requests', reqId2);

    const [snap1, snap2] = await Promise.all([getDoc(ref1), getDoc(ref2)]);
    const now = Date.now();

    if (snap1.exists()) {
      await updateDoc(ref1, { status: 'accepted', updatedAt: now });
    } else if (snap2.exists()) {
      await updateDoc(ref2, { status: 'accepted', updatedAt: now });
    } else {
      await setDoc(ref1, {
        id: reqId1,
        fromUid: targetUserId,
        toUid: currentUserId,
        fromName: 'Oyuncu',
        toName: 'Oyuncu',
        status: 'accepted',
        createdAt: now,
        updatedAt: now
      }, { merge: true });
    }

    // Add each other to friends array on both user docs in Firestore
    const user1Ref = doc(db, 'users', currentUserId);
    const user2Ref = doc(db, 'users', targetUserId);

    await Promise.all([
      updateDoc(user1Ref, { friends: arrayUnion(targetUserId) }).catch(async () => {
        await setDoc(user1Ref, { friends: [targetUserId] }, { merge: true });
      }),
      updateDoc(user2Ref, { friends: arrayUnion(currentUserId) }).catch(async () => {
        await setDoc(user2Ref, { friends: [currentUserId] }, { merge: true });
      })
    ]);
  } catch (error) {
    console.error('Failed to accept friend request in Firestore:', error);
    throw error;
  }
}

/**
 * Removes a friend or rejects a request in Firestore
 */
export async function removeFriendInFirestore(
  currentUserId: string,
  targetUserId: string
): Promise<void> {
  if (!currentUserId || !targetUserId) return;
  try {
    const reqId1 = `${targetUserId}_${currentUserId}`;
    const reqId2 = `${currentUserId}_${targetUserId}`;
    const ref1 = doc(db, 'friend_requests', reqId1);
    const ref2 = doc(db, 'friend_requests', reqId2);
    const now = Date.now();

    const writePromises: Promise<any>[] = [];

    // Guarantee that both directions are recorded as 'rejected' in friend_requests
    writePromises.push(setDoc(ref1, {
      id: reqId1,
      fromUid: targetUserId,
      toUid: currentUserId,
      status: 'rejected',
      updatedAt: now
    }, { merge: true }));

    writePromises.push(setDoc(ref2, {
      id: reqId2,
      fromUid: currentUserId,
      toUid: targetUserId,
      status: 'rejected',
      updatedAt: now
    }, { merge: true }));

    // Remove from both users' friends array in Firestore
    const user1Ref = doc(db, 'users', currentUserId);
    const user2Ref = doc(db, 'users', targetUserId);

    writePromises.push(
      updateDoc(user1Ref, { friends: arrayRemove(targetUserId) }).catch(async () => {
        // Fallback catch
      })
    );
    writePromises.push(
      updateDoc(user2Ref, { friends: arrayRemove(currentUserId) }).catch(async () => {
        // Fallback catch
      })
    );

    await Promise.all(writePromises);
  } catch (error) {
    console.error('Failed to remove friend in Firestore:', error);
    handleFirestoreError(error, OperationType.DELETE, `users/${currentUserId}/friends/${targetUserId}`);
  }
}

/**
 * Fetches friend requests, syncs accepted friends and returns confirmed & incoming profiles
 */
export async function fetchFriendRequestsAndSync(currentProfile: UserProfile): Promise<{
  confirmedFriends: UserProfile[];
  incomingRequests: UserProfile[];
  updatedFriendsArray: string[];
}> {
  const myUid = currentProfile?.id;
  if (!myUid) {
    return { confirmedFriends: [], incomingRequests: [], updatedFriendsArray: [] };
  }

  try {
    const requestsColl = collection(db, 'friend_requests');
    const qIncoming = query(requestsColl, where('toUid', '==', myUid));
    const qOutgoing = query(requestsColl, where('fromUid', '==', myUid));

    const [snapIncoming, snapOutgoing, usersWhoAddedMe] = await Promise.all([
      getDocs(qIncoming),
      getDocs(qOutgoing),
      fetchUsersWhoAddedMe(myUid)
    ]);

    const incomingDocs: FriendRequest[] = [];
    snapIncoming.forEach(d => incomingDocs.push(d.data() as FriendRequest));

    const outgoingDocs: FriendRequest[] = [];
    snapOutgoing.forEach(d => outgoingDocs.push(d.data() as FriendRequest));

    const acceptedFriendUids = new Set<string>(currentProfile.friends || []);
    const pendingIncomingUids = new Set<string>();
    const rejectedUids = new Set<string>();

    incomingDocs.forEach(req => {
      if (req.status === 'accepted') {
        acceptedFriendUids.add(req.fromUid);
      } else if (req.status === 'pending') {
        if (!acceptedFriendUids.has(req.fromUid)) {
          pendingIncomingUids.add(req.fromUid);
        }
      } else if (req.status === 'rejected') {
        rejectedUids.add(req.fromUid);
      }
    });

    outgoingDocs.forEach(req => {
      if (req.status === 'accepted') {
        acceptedFriendUids.add(req.toUid);
      } else if (req.status === 'rejected') {
        rejectedUids.add(req.toUid);
      }
    });

    usersWhoAddedMe.forEach(u => {
      if ((currentProfile.friends || []).includes(u.id)) {
        acceptedFriendUids.add(u.id);
      } else {
        if (!rejectedUids.has(u.id) && !acceptedFriendUids.has(u.id)) {
          pendingIncomingUids.add(u.id);
        }
      }
    });

    // Ensure rejected or removed friends are purged from acceptedFriendUids
    rejectedUids.forEach(uid => acceptedFriendUids.delete(uid));

    pendingIncomingUids.delete(myUid);
    acceptedFriendUids.delete(myUid);

    acceptedFriendUids.forEach(uid => pendingIncomingUids.delete(uid));

    const allUidsToFetch = Array.from(new Set([...acceptedFriendUids, ...pendingIncomingUids]));
    const fetchedProfiles = await fetchProfilesByIds(allUidsToFetch);
    const profileMap = new Map<string, UserProfile>();
    fetchedProfiles.forEach(p => { if (p && p.id) profileMap.set(p.id, p); });

    const confirmedFriends: UserProfile[] = Array.from(acceptedFriendUids)
      .map(id => profileMap.get(id))
      .filter((p): p is UserProfile => p !== undefined);

    const incomingRequests: UserProfile[] = Array.from(pendingIncomingUids)
      .map(id => profileMap.get(id))
      .filter((p): p is UserProfile => p !== undefined);

    const updatedFriendsArray = Array.from(acceptedFriendUids);

    const currentFriendsSet = new Set(currentProfile.friends || []);
    let needsSave = updatedFriendsArray.length !== currentFriendsSet.size;
    if (!needsSave) {
      updatedFriendsArray.forEach(id => {
        if (!currentFriendsSet.has(id)) needsSave = true;
      });
    }

    if (needsSave) {
      const userRef = doc(db, 'users', myUid);
      await updateDoc(userRef, { friends: updatedFriendsArray }).catch(() => {});
    }

    return {
      confirmedFriends,
      incomingRequests,
      updatedFriendsArray
    };
  } catch (error) {
    console.error('Error in fetchFriendRequestsAndSync:', error);
    const myFriendsIds = currentProfile.friends || [];
    const myFriendsProfiles = await fetchProfilesByIds(myFriendsIds);
    return {
      confirmedFriends: myFriendsProfiles,
      incomingRequests: [],
      updatedFriendsArray: myFriendsIds
    };
  }
}

/**
 * Searches for user profiles matching a specific username exactly or by prefix (case-insensitive and Turkish-aware)
 */
export async function searchUserByName(name: string): Promise<UserProfile[]> {
  try {
    const term = name.trim();
    if (!term) return [];

    const usersCollection = collection(db, 'users');
    const termLower = term.toLowerCase();
    const termLowerTr = term.toLocaleLowerCase('tr-TR');
    const termClean = turkishToEnglishFriendly(term);

    // Query 1: Case-insensitive prefix search using name_lowercase
    const q1 = query(
      usersCollection,
      where('name_lowercase', '>=', termLower),
      where('name_lowercase', '<=', termLower + '\uf8ff'),
      limit(50)
    );

    // Query 2: Case-insensitive prefix search using name_lowercase_tr
    const q2 = query(
      usersCollection,
      where('name_lowercase_tr', '>=', termLowerTr),
      where('name_lowercase_tr', '<=', termLowerTr + '\uf8ff'),
      limit(50)
    );

    // Query 3: English friendly prefix search using name_clean
    const q3 = query(
      usersCollection,
      where('name_clean', '>=', termClean),
      where('name_clean', '<=', termClean + '\uf8ff'),
      limit(50)
    );

    // Query 4: Direct prefix on name, username, displayName
    const qNamePrefix = query(
      usersCollection,
      where('name', '>=', term),
      where('name', '<=', term + '\uf8ff'),
      limit(50)
    );

    const qUsernamePrefix = query(
      usersCollection,
      where('username', '>=', term),
      where('username', '<=', term + '\uf8ff'),
      limit(50)
    );

    const qDisplayNamePrefix = query(
      usersCollection,
      where('displayName', '>=', term),
      where('displayName', '<=', term + '\uf8ff'),
      limit(50)
    );

    // Query 5: Case-sensitive exact matches
    const qExact1 = query(
      usersCollection,
      where('name', '==', term),
      limit(20)
    );

    const qExact2 = query(
      usersCollection,
      where('name_lowercase', '==', termLower),
      limit(20)
    );

    const qExactUsername = query(
      usersCollection,
      where('username', '==', term),
      limit(20)
    );

    const qExactDisplayName = query(
      usersCollection,
      where('displayName', '==', term),
      limit(20)
    );

    // Query 6: Robust fallback querying recent 300 users for perfect client-side search
    const qFallback = query(
      usersCollection,
      limit(300)
    );

    const snapshots = await Promise.all([
      getDocs(q1).catch((err) => { console.warn('q1 search error:', err); return null; }),
      getDocs(q2).catch((err) => { console.warn('q2 search error:', err); return null; }),
      getDocs(q3).catch((err) => { console.warn('q3 search error:', err); return null; }),
      getDocs(qNamePrefix).catch((err) => { console.warn('qNamePrefix search error:', err); return null; }),
      getDocs(qUsernamePrefix).catch((err) => { console.warn('qUsernamePrefix search error:', err); return null; }),
      getDocs(qDisplayNamePrefix).catch((err) => { console.warn('qDisplayNamePrefix search error:', err); return null; }),
      getDocs(qExact1).catch((err) => { console.warn('qExact1 search error:', err); return null; }),
      getDocs(qExact2).catch((err) => { console.warn('qExact2 search error:', err); return null; }),
      getDocs(qExactUsername).catch((err) => { console.warn('qExactUsername search error:', err); return null; }),
      getDocs(qExactDisplayName).catch((err) => { console.warn('qExactDisplayName search error:', err); return null; }),
      getDocs(qFallback).catch((err) => { console.warn('qFallback search error:', err); return null; })
    ]);

    const resultMap = new Map<string, UserProfile>();

    const processSnap = (snap: any) => {
      if (snap && !snap.empty) {
        snap.forEach((docSnap: any) => {
          const data = docSnap.data() as any;
          if (data) {
            const userId = data.id || docSnap.id;
            const resolvedName = (data.name || data.username || data.displayName || '').trim();
            if (userId && resolvedName) {
              resultMap.set(userId, {
                ...data,
                id: userId,
                name: resolvedName,
                username: data.username || resolvedName,
                displayName: data.displayName || resolvedName
              });
            }
          }
        });
      }
    };

    snapshots.forEach(processSnap);

    // Also check direct document lookup by exact term (e.g. if searching by User ID)
    try {
      const directDocRef = doc(db, 'users', term);
      const directSnap = await getDoc(directDocRef);
      if (directSnap && directSnap.exists()) {
        const dData = directSnap.data();
        if (dData) {
          const uId = directSnap.id;
          const rName = (dData.name || dData.username || dData.displayName || '').trim();
          if (uId) {
            resultMap.set(uId, {
              ...dData,
              id: uId,
              name: rName || 'Oyuncu',
              username: dData.username || rName,
              displayName: dData.displayName || rName
            } as UserProfile);
          }
        }
      }
    } catch (e) {
      // Ignore direct ID fetch errors
    }

    const allUsers = Array.from(resultMap.values());

    // Filter client-side: case-insensitive/Turkish-aware match across name, username, displayName, or email
    const filtered = allUsers.filter(user => {
      const uName = (user.name || '').trim();
      const uUsername = ((user as any).username || '').trim();
      const uDisplayName = ((user as any).displayName || '').trim();
      const uEmail = ((user as any).email || '').trim();
      const uId = (user.id || '').trim();

      return (
        matchesSearchTerm(uName, term) ||
        matchesSearchTerm(uUsername, term) ||
        matchesSearchTerm(uDisplayName, term) ||
        matchesSearchTerm(uEmail, term) ||
        uId === term
      );
    });

    // Sort: exact match first, then starts with, then locale compare
    filtered.sort((a, b) => {
      const aName = (a.name || (a as any).username || (a as any).displayName || '').trim();
      const bName = (b.name || (b as any).username || (b as any).displayName || '').trim();
      
      const aLower = aName.toLowerCase();
      const bLower = bName.toLowerCase();
      const aLowerTr = aName.toLocaleLowerCase('tr-TR');
      const bLowerTr = bName.toLocaleLowerCase('tr-TR');
      const aClean = turkishToEnglishFriendly(aName);
      
      const isExactA = aLower === termLower || aLowerTr === termLowerTr || aClean === termClean;
      const isExactB = bLower === termLower || bLowerTr === termLowerTr || turkishToEnglishFriendly(bName) === termClean;
      
      if (isExactA && !isExactB) return -1;
      if (!isExactA && isExactB) return 1;
      
      const startsA = aLower.startsWith(termLower) || aLowerTr.startsWith(termLowerTr) || aClean.startsWith(termClean);
      const startsB = bLower.startsWith(termLower) || bLowerTr.startsWith(termLowerTr) || turkishToEnglishFriendly(bName).startsWith(termClean);
      
      if (startsA && !startsB) return -1;
      if (!startsA && startsB) return 1;
      
      return aName.localeCompare(bName, 'tr');
    });

    return filtered.slice(0, 30);
  } catch (error) {
    console.error('Failed to search user by name:', error);
    return [];
  }
}

/**
 * Checks if a username is already taken by another user in the database (case-insensitive and Turkish-aware)
 */
export async function checkUsernameExists(username: string, currentUserId?: string): Promise<boolean> {
  try {
    const term = username.trim();
    if (!term) return false;
    
    const termLower = term.toLowerCase();
    const termLowerTr = term.toLocaleLowerCase('tr-TR');
    const termClean = turkishToEnglishFriendly(term);
    const usersCollection = collection(db, 'users');

    const queries = [
      query(usersCollection, where('name_lowercase', '==', termLower)),
      query(usersCollection, where('name_lowercase_tr', '==', termLowerTr)),
      query(usersCollection, where('name_clean', '==', termClean)),
      query(usersCollection, where('name', '==', term))
    ];

    const snapshots = await Promise.all(
      queries.map(q => getDocs(q).catch(err => {
        console.warn('Username check query failed:', err);
        return null;
      }))
    );

    let isTaken = false;
    for (const snap of snapshots) {
      if (snap && !snap.empty) {
        snap.forEach(docSnap => {
          if (!currentUserId || docSnap.id !== currentUserId) {
            isTaken = true;
          }
        });
        if (isTaken) return true;
      }
    }

    // Secondary fallback scan for older or custom documents that might not have normalized fields
    if (!isTaken) {
      try {
        const fallbackSnap = await getDocs(query(usersCollection, limit(200)));
        if (fallbackSnap && !fallbackSnap.empty) {
          fallbackSnap.forEach(docSnap => {
            if (currentUserId && docSnap.id === currentUserId) return;
            const docData = docSnap.data();
            const docName = docData.name ? String(docData.name).trim() : '';
            if (!docName) return;
            const docLower = docName.toLowerCase();
            const docLowerTr = docName.toLocaleLowerCase('tr-TR');
            const docClean = turkishToEnglishFriendly(docName);

            if (
              docName === term ||
              docLower === termLower ||
              docLowerTr === termLowerTr ||
              docClean === termClean
            ) {
              isTaken = true;
            }
          });
        }
      } catch (fErr) {
        console.warn('Fallback username check failed:', fErr);
      }
    }

    return isTaken;
  } catch (error) {
    console.error('Failed to check if username exists:', error);
    return false;
  }
}

export { onAuthStateChanged, signInWithCredential, GoogleAuthProvider, linkWithCredential, PhoneAuthProvider, RecaptchaVerifier, signInWithPhoneNumber };
