import React, { useState, useEffect, useRef } from 'react';
import { 
  Swords, Play, Globe, ShieldAlert, Sparkles, 
  Trophy, Users, HelpCircle, ChevronDown, ChevronUp, 
  Copy, Check, Flame, Zap, Target, Edit2, User, Award, CheckCircle2, TrendingUp,
  Sun, Moon, Sliders, BarChart2, X, ArrowLeft, UserPlus, UserMinus, Clock, Puzzle,
  Bot, Camera, Image as ImageIcon
} from 'lucide-react';
import { UserProfile, isImageUrl } from '../types';
import { getBaseUrl } from '../utils/api';
import { validateUsername } from '../utils/usernameValidation';
import { getDailyWordAndLength, getTodayDateStr } from '../data/wordlist';
import UserAvatar from './UserAvatar';
import { getXPForLevel, getLevelForScore } from '../utils/scoring';
import { 
  fetchUsersWhoAddedMe, 
  fetchProfilesByIds, 
  searchUserByName, 
  checkUsernameExists,
  sendFriendRequestInFirestore,
  acceptFriendRequestInFirestore,
  removeFriendInFirestore,
  fetchFriendRequestsAndSync,
  uploadAvatarToStorage
} from '../lib/firebase';
import { suspendAudioContext, resumeAudioContext } from '../utils/soundEffects';
import { initGlobalAdMobListeners, triggerRewardedAdWatch } from '../utils/admob';
import GoldWallet from './GoldWallet';
import FriendsModal from './FriendsModal';

interface WelcomeScreenProps {
  profile: UserProfile | null;
  onUpdateProfile: (name: string, avatarUrl?: string) => void;
  dictionaryMode: 'tdk_online' | 'no_validation';
  onChangeDictionaryMode: (mode: 'tdk_online' | 'no_validation') => void;
  gameMode: 'timed' | 'untimed';
  onChangeGameMode: (mode: 'timed' | 'untimed') => void;
  wordLength: number;
  onChangeWordLength: (length: number) => void;
  onStartSoloGame: () => void;
  onOpenSettings: () => void;
  onOpenMissions?: () => void;
  isOnline: boolean;
  lobbyPlayers?: { id: string; name: string; avatarUrl?: string }[];
  showToast?: (message: string, type?: 'info' | 'error' | 'success') => void;
  
  // New Header integration props
  onOpenStats?: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  
  // Dynamic Integrated Dashboard Props
  onReconnect?: () => void;
  onStartDailyPuzzle?: () => void;
  isDailyPuzzleCompletedToday?: boolean;
  onUpdateFriends?: (friends: string[]) => void;
  onAddGold?: (amount: number) => Promise<void>;
  onDeductGold?: (amount: number) => Promise<boolean>;
  onClaimDailyReward?: () => Promise<void>;
  onWatchRewardedAdReward?: () => Promise<void>;
  onStartMatchmaking?: () => void;
  onChallengePlayer?: (player: { id: string; name: string }, wordLength?: number) => void;
  isChallengePending?: boolean;
  matchmakingStatus?: 'idle' | 'queued';
}

export default function WelcomeScreen({
  profile,
  onUpdateProfile,
  dictionaryMode,
  onChangeDictionaryMode,
  gameMode,
  onChangeGameMode,
  wordLength,
  onChangeWordLength,
  onStartSoloGame,
  onOpenSettings,
  onOpenMissions,
  isOnline,
  lobbyPlayers = [],
  showToast,
  onReconnect,
  onOpenStats,
  darkMode,
  onToggleDarkMode,
  onStartDailyPuzzle,
  isDailyPuzzleCompletedToday = false,
  onUpdateFriends,
  onAddGold,
  onDeductGold,
  onClaimDailyReward,
  onWatchRewardedAdReward,
  onStartMatchmaking,
  onChallengePlayer,
  isChallengePending = false,
  matchmakingStatus = 'idle'
}: WelcomeScreenProps) {
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [showMissions, setShowMissions] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showFriendsModal, setShowFriendsModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Purge legacy duel length cache on load
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('kelimesavasi_duel_word_length');
      }
    } catch (e) {}
  }, []);

  const todayStr = getTodayDateStr();
  const isDailyClaimed = profile?.lastDailyLoginClaim === todayStr;
  
  // Game setup states
  const [showGameSetup, setShowGameSetup] = useState<boolean>(false);
  const [selectedGameModeTab, setSelectedGameModeTab] = useState<'solo' | 'duel'>('solo');

  // Real-time bidirectional friends and requests from Firestore
  const [confirmedFriends, setConfirmedFriends] = useState<{ id: string; name: string; avatarUrl?: string; isOnline?: boolean; lastSeen?: number }[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<{ id: string; name: string; avatarUrl?: string; isOnline?: boolean; lastSeen?: number }[]>([]);
  const [loadingFriends, setLoadingFriends] = useState<boolean>(false);

  // Search states for "Oyuncu Bul"
  const [searchedPlayers, setSearchedPlayers] = useState<{ id: string; name: string; avatarUrl?: string }[]>([]);
  const [searchHasRun, setSearchHasRun] = useState<boolean>(false);
  const [searching, setSearching] = useState<boolean>(false);

  const [friendsTab, setFriendsTab] = useState<'friends' | 'find'>('friends');
  const [friendsSearchTerm, setFriendsSearchTerm] = useState<string>('');
  
  // Rewarded Ad and Daily Claim States
  const adRequestActiveRef = useRef<boolean>(false);
  const [isWatchingAd, setIsWatchingAd] = useState<boolean>(false);
  const [showAdSuccess, setShowAdSuccess] = useState<boolean>(false);
  const [isAdLoading, setIsAdLoading] = useState<boolean>(false);
  const [adProgress, setAdProgress] = useState<number>(0);

  useEffect(() => {
    let interval: any = null;
    if (isWatchingAd) {
      setAdProgress(0);
      const startTime = Date.now();
      const estimatedDuration = 15000;
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(100, Math.floor((elapsed / estimatedDuration) * 100));
        setAdProgress(pct);
        if (pct >= 100) {
          clearInterval(interval);
        }
      }, 100);
    } else if (isAdLoading) {
      setAdProgress(35);
    } else {
      setAdProgress(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isWatchingAd, isAdLoading]);
  
  // Daily Puzzle reset countdown timer state
  const [timeLeftToReset, setTimeLeftToReset] = useState<string>('');
  
  // Live Clock and Turkish Date states for the mock status bar
  const [liveTime, setLiveTime] = useState<string>('');
  const [liveDate, setLiveDate] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setLiveTime(`${hh}:${mm}`);

      const day = now.getDate();
      const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
      const weekDayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      
      const monStr = monthNames[now.getMonth()];
      const dayStr = weekDayNames[now.getDay()];
      setLiveDate(`${day} ${monStr} ${dayStr}`);
    };
    updateClock();
    const intervalId = setInterval(updateClock, 10000); // update every 10 seconds
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 0, 0); // Next midnight
      const diffMs = nextMidnight.getTime() - now.getTime();
      
      const hours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
      const minutes = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
      const seconds = Math.max(0, Math.floor((diffMs % (1000 * 60)) / 1000));
      
      const pad = (num: number) => String(num).padStart(2, '0');
      setTimeLeftToReset(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    calculateTimeLeft();
    const timerId = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timerId);
  }, []);

  const isFriend = (playerId: string) => (profile.friends || []).includes(playerId);

  const addFriend = async (playerOrId: any) => {
    const targetId = typeof playerOrId === 'string' ? playerOrId : playerOrId?.id;
    if (!profile?.id || !targetId || profile.id === targetId) return;

    const isIncoming = incomingRequests.some(r => r.id === targetId);

    try {
      if (isIncoming) {
        // Accept incoming request
        await acceptFriendRequestInFirestore(profile.id, targetId);
        const currentFriends = profile.friends || [];
        const updatedFriends = Array.from(new Set([...currentFriends, targetId]));
        if (onUpdateFriends) {
          onUpdateFriends(updatedFriends);
        }
      } else {
        // Send new friend request
        const targetName = typeof playerOrId === 'object' ? playerOrId.name : undefined;
        await sendFriendRequestInFirestore(profile, targetId, targetName);
      }
      await refreshFriendsList();
    } catch (err) {
      console.error('Error in addFriend:', err);
    }
  };

  const removeFriend = async (targetId: string) => {
    if (!profile?.id || !targetId) return;
    try {
      await removeFriendInFirestore(profile.id, targetId);
      const currentFriends = profile.friends || [];
      const updatedFriends = currentFriends.filter(id => id !== targetId);
      if (onUpdateFriends) {
        onUpdateFriends(updatedFriends);
      }
      const updatedProfile: UserProfile = {
        ...profile,
        friends: updatedFriends
      };
      await refreshFriendsList(updatedProfile);
    } catch (err) {
      console.error('Error in removeFriend:', err);
    }
  };

  const refreshFriendsList = async (overrideProfile?: UserProfile) => {
    const activeProfile = overrideProfile || profile;
    if (!isOnline || !activeProfile?.id) return;
    if (confirmedFriends.length === 0) setLoadingFriends(true);
    try {
      const { confirmedFriends: confirmed, incomingRequests: incoming, updatedFriendsArray } = 
        await fetchFriendRequestsAndSync(activeProfile);

      const confirmedMapped = confirmed.map(p => ({
        id: p.id,
        name: p.name || (p as any).username || (p as any).displayName || 'Oyuncu',
        avatarUrl: p.avatarUrl,
        isOnline: (p as any).isOnline ?? false,
        status: (p as any).status,
        lastSeen: (p as any).lastSeen || ((p as any).lastActive ? new Date((p as any).lastActive).getTime() : undefined)
      }));

      const incomingMapped = incoming.map(p => ({
        id: p.id,
        name: p.name || (p as any).username || (p as any).displayName || 'Oyuncu',
        avatarUrl: p.avatarUrl,
        isOnline: (p as any).isOnline ?? false,
        status: (p as any).status,
        lastSeen: (p as any).lastSeen || ((p as any).lastActive ? new Date((p as any).lastActive).getTime() : undefined)
      }));

      setConfirmedFriends(confirmedMapped);
      setIncomingRequests(incomingMapped);

      if (onUpdateFriends && updatedFriendsArray) {
        const currentFriends = profile.friends || [];
        const isDifferent =
          updatedFriendsArray.length !== currentFriends.length ||
          updatedFriendsArray.some((id, idx) => id !== currentFriends[idx]);
        if (isDifferent) {
          onUpdateFriends(updatedFriendsArray);
        }
      }
    } catch (err) {
      console.error('Error refreshing friends list:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleSearchPlayers = async () => {
    const term = friendsSearchTerm.trim();
    if (!term) {
      setSearchedPlayers([]);
      setSearchHasRun(false);
      return;
    }
    setSearching(true);
    setSearchHasRun(true);
    try {
      const results = await searchUserByName(term);
      // Filter out ourself from search results
      setSearchedPlayers(results.filter(u => u.id !== profile.id));
    } catch (err) {
      console.error('Failed searching players:', err);
    } finally {
      setSearching(false);
    }
  };

  // Debounced real-time player search when typing in the 'Oyuncu Bul' tab
  useEffect(() => {
    if (friendsTab !== 'find') return;
    const term = friendsSearchTerm.trim();
    if (!term) {
      setSearchedPlayers([]);
      setSearchHasRun(false);
      return;
    }
    const timer = setTimeout(() => {
      handleSearchPlayers();
    }, 400);
    return () => clearTimeout(timer);
  }, [friendsSearchTerm, friendsTab]);

  const onRewardRef = useRef(onWatchRewardedAdReward);
  useEffect(() => {
    onRewardRef.current = onWatchRewardedAdReward;
  }, [onWatchRewardedAdReward]);

  const clearAdRequestFlags = () => {
    adRequestActiveRef.current = false;
    if (typeof window !== 'undefined') {
      (window as any).userExplicitAdRequested = false;
    }
    try {
      sessionStorage.removeItem('user_explicit_ad_requested');
    } catch (e) {}
  };

  useEffect(() => {
    initGlobalAdMobListeners();
  }, []);

  const startRewardedAdWatch = () => {
    setIsAdLoading(true);
    setAdProgress(15);
    triggerRewardedAdWatch(
      async () => {
        setIsAdLoading(false);
        setIsWatchingAd(false);
        setShowAdSuccess(true);
        setAdProgress(100);
        if (onRewardRef.current) {
          await onRewardRef.current();
        }
      },
      () => {
        setIsAdLoading(false);
        setIsWatchingAd(true);
      },
      (reason) => {
        setIsAdLoading(false);
        setIsWatchingAd(false);
        setAdProgress(0);
        if (showToast) showToast(reason, 'error');
        else alert(reason);
      }
    );
  };

  useEffect(() => {
    if (showFriendsModal) {
      refreshFriendsList();
      // Clear search results upon opening modal
      setFriendsSearchTerm('');
      setSearchedPlayers([]);
      setSearchHasRun(false);
    }
  }, [showFriendsModal]);

  // Profile Inline Editor State
  const isGenericName = (n?: string) => !n || n === 'Oyuncu' || n === 'Kelime Oyuncusu' || n === 'Google Oyuncusu' || n.startsWith('Savaşçı_');
  
  const [isEditing, setIsEditing] = useState<boolean>(() => {
    if (!profile) return true;
    return !profile.nameSet || isGenericName(profile.name);
  });
  const [editName, setEditName] = useState<string>(() => {
    if (profile?.name && !isGenericName(profile.name)) return profile.name;
    return '';
  });
  const [selectedAvatar, setSelectedAvatar] = useState<string>(profile?.avatarUrl || '🧠');
  const [isTouched, setIsTouched] = useState<boolean>(false);
  const [dbUsernameError, setDbUsernameError] = useState<string | null>(null);
  const [isCheckingName, setIsCheckingName] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const checkMediaPermission = async (type: 'camera' | 'gallery'): Promise<boolean> => {
    // 1. Capacitor Camera Plugin Request & Check (if running in hybrid / native Capacitor environment)
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      const cameraPlugin = (window as any).Capacitor?.Plugins?.Camera;
      if (cameraPlugin) {
        try {
          let status = typeof cameraPlugin.checkPermissions === 'function' ? await cameraPlugin.checkPermissions() : null;
          const currentPerm = type === 'camera' ? status?.camera : status?.photos;

          // If not explicitly granted, request native permission to trigger OS permission prompt
          if (currentPerm !== 'granted' && typeof cameraPlugin.requestPermissions === 'function') {
            const reqPerms = type === 'camera' ? ['camera'] : ['photos'];
            status = await cameraPlugin.requestPermissions({ permissions: reqPerms });
          }

          const finalPerm = type === 'camera' ? status?.camera : status?.photos;
          if (finalPerm === 'denied') {
            return false; // User manually tapped Deny on the permission prompt
          }
          return true;
        } catch (err) {
          console.warn('Capacitor camera permission request warning:', err);
        }
      }
    }

    // 2. Web navigator.permissions API
    if (typeof navigator !== 'undefined' && navigator.permissions && typeof (navigator.permissions as any).query === 'function') {
      try {
        const permName = type === 'camera' ? 'camera' : 'photos';
        const res = await (navigator.permissions as any).query({ name: permName as any });
        if (res.state === 'denied') {
          return false; // User manually blocked camera/photos in browser settings
        }
      } catch (e) {
        // Permission query descriptor for camera/photos might not be supported on all browsers
      }
    }

    // 3. Web getUserMedia camera permission prompt trigger
    if (type === 'camera' && typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (camErr: any) {
        console.warn('Camera getUserMedia result:', camErr);
        // Only return false if user explicitly clicked Block / Deny on the native prompt
        if (camErr?.name === 'NotAllowedError' || camErr?.name === 'PermissionDeniedError') {
          return false;
        }
        // For other non-permission errors, proceed to open camera input element
      }
    }

    return true;
  };

  const handleImageFileSelected = async (file: File) => {
    if (!file) return;
    setPermissionError(null);
    try {
      if (profile?.id) {
        try {
          const publicUrl = await uploadAvatarToStorage(profile.id, file);
          if (publicUrl && publicUrl.startsWith('http')) {
            setSelectedAvatar(publicUrl);
            setPermissionError(null);
            return;
          }
        } catch (upErr) {
          console.warn('Direct upload error in WelcomeScreen:', upErr);
        }
      }

      const reader = new FileReader();
      reader.onerror = () => {
        const msg = 'Kameraya veya galeriye erişim izni vermeniz gerekmektedir.';
        setPermissionError(msg);
        if (showToast) showToast(msg, 'error');
      };
      reader.onloadend = () => {
        const img = new window.Image();
        img.onerror = () => {
          const msg = 'Kameraya veya galeriye erişim izni vermeniz gerekmektedir.';
          setPermissionError(msg);
          if (showToast) showToast(msg, 'error');
        };
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 128;
            const MAX_HEIGHT = 128;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              let finalUrl = dataUrl;
              if (profile?.id) {
                finalUrl = await uploadAvatarToStorage(profile.id, dataUrl);
              }
              setSelectedAvatar(finalUrl);
              setPermissionError(null);
            }
          } catch (err) {
            const msg = 'Kameraya veya galeriye erişim izni vermeniz gerekmektedir.';
            setPermissionError(msg);
            if (showToast) showToast(msg, 'error');
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      const msg = 'Kameraya veya galeriye erişim izni vermeniz gerekmektedir.';
      setPermissionError(msg);
      if (showToast) showToast(msg, 'error');
    }
  };

  const handleOpenGallery = async () => {
    setPermissionError(null);
    try {
      const hasPermission = await checkMediaPermission('gallery');
      if (!hasPermission) {
        const msg = 'Kameraya veya galeriye erişim izni vermeniz gerekmektedir.';
        setPermissionError(msg);
        if (showToast) showToast(msg, 'error');
        return;
      }
      if (galleryInputRef.current) {
        galleryInputRef.current.click();
      }
    } catch (err) {
      console.warn('Gallery permission error:', err);
      const msg = 'Kameraya veya galeriye erişim izni vermeniz gerekmektedir.';
      setPermissionError(msg);
      if (showToast) showToast(msg, 'error');
    }
  };

  const handleOpenCamera = async () => {
    setPermissionError(null);
    try {
      const hasPermission = await checkMediaPermission('camera');
      if (!hasPermission) {
        const msg = 'Kameraya veya galeriye erişim izni vermeniz gerekmektedir.';
        setPermissionError(msg);
        if (showToast) showToast(msg, 'error');
        return;
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    } catch (err) {
      console.warn('Camera request error:', err);
      const msg = 'Kameraya veya galeriye erişim izni vermeniz gerekmektedir.';
      setPermissionError(msg);
      if (showToast) showToast(msg, 'error');
    }
  };
  const error = (isTouched || editName !== profile?.name ? validateUsername(editName, [], profile?.id || '') : null) || dbUsernameError;

  React.useEffect(() => {
    if (profile) {
      if (profile.name && !isGenericName(profile.name)) {
        setEditName(profile.name);
      } else {
        setIsEditing(true);
      }
      if (profile.avatarUrl) {
        setSelectedAvatar(profile.avatarUrl);
      }
    }
  }, [profile?.name, profile?.avatarUrl, profile?.nameSet]);

  const AVATAR_PRESETS = ['⚔️', '🧠', '🐺', '🦁', '🧙‍♂️', '🦊', '👾', '🦄', '⚡', '👑', '🎯', '🚀', '🔥', '🐉', '🐼', '🛡️', '🏆', '🦉'];

  const handleCopyLink = () => {
    const baseUrl = getBaseUrl();
    const shareLink = baseUrl ? baseUrl : (window.location.origin || window.location.href);
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveProfile = async () => {
    setIsTouched(true);
    setDbUsernameError(null);
    const validationError = validateUsername(editName, [], profile?.id || '');
    if (validationError) return;

    if (editName.trim() && editName.trim() !== profile?.name) {
      setIsCheckingName(true);
      try {
        const exists = await checkUsernameExists(editName.trim(), profile?.id || '');
        if (exists) {
          setDbUsernameError('Bu kullanıcı adı daha önce alınmıştır, lütfen başka bir tane seçin.');
          setIsCheckingName(false);
          return;
        }
      } catch (err) {
        console.error('Error checking unique username:', err);
      } finally {
        setIsCheckingName(false);
      }
    }

    onUpdateProfile(editName.trim(), selectedAvatar);
    setIsEditing(false);
    setIsTouched(false);
  };

  // Determine dynamic inclusive player title based on dailyScore
  const getWarriorTitle = (score: number) => {
    const level = getLevelForScore(score);
    let title = 'Kelime Kaşifi 🔍';
    if (level === 1) title = 'Kelime Kaşifi 🔍';
    else if (level === 2) title = 'Hece Gezgini 🗺️';
    else if (level === 3) title = 'Sözcük Mimarı 🧱';
    else if (level === 4) title = 'Dil Sanatçısı 🎨';
    else if (level < 10) title = 'Usta Sözlükçü 📚';
    else if (level < 20) title = 'Kelime Savaşçısı ⚔️';
    else if (level < 50) title = 'Cümle Muhafızı 🛡️';
    else if (level < 100) title = 'Edebiyat Şövalyesi 🎖️';
    else if (level < 250) title = 'Leksikograf Şefi 🎓';
    else if (level < 500) title = 'Dil Bilimci Profesör 🧠';
    else title = 'Efsanevi Kelime Bilgesi 👑';

    return `${level}. Seviye: ${title}`;
  };

  // Calculate detailed progress towards the next level
  const getLevelProgress = (score: number) => {
    const level = getLevelForScore(score);
    const currentLevelScore = getXPForLevel(level);
    const nextLevelScore = getXPForLevel(level + 1);
    const range = nextLevelScore - currentLevelScore;
    const progressInLevel = score - currentLevelScore;
    const percent = range > 0 ? Math.min(100, Math.max(0, (progressInLevel / range) * 100)) : 100;
    const remainingForNextLevel = Math.max(0, Math.round(nextLevelScore - score));

    // Derive title
    let title = 'Kelime Kaşifi 🔍';
    if (level === 1) title = 'Kelime Kaşifi 🔍';
    else if (level === 2) title = 'Hece Gezgini 🗺️';
    else if (level === 3) title = 'Sözcük Mimarı 🧱';
    else if (level === 4) title = 'Dil Sanatçısı 🎨';
    else if (level < 10) title = 'Usta Sözlükçü 📚';
    else if (level < 20) title = 'Kelime Savaşçısı ⚔️';
    else if (level < 50) title = 'Cümle Muhafızı 🛡️';
    else if (level < 100) title = 'Edebiyat Şövalyesi 🎖️';
    else if (level < 250) title = 'Leksikograf Şefi 🎓';
    else if (level < 500) title = 'Dil Bilimci Profesör 🧠';
    else title = 'Efsanevi Kelime Bilgesi 👑';

    return {
      level,
      title,
      currentLevelScore: Math.round(currentLevelScore),
      nextLevelScore: Math.round(nextLevelScore),
      percent,
      progressInLevel: Math.round(progressInLevel),
      range: Math.round(range),
      remainingForNextLevel
    };
  };

  // Helper to determine real-time friend online status
  const isFriendOnline = (friend: { id: string; isOnline?: boolean; lastSeen?: number }) => {
    // 1. Check WebSocket active lobby players
    if (lobbyPlayers && lobbyPlayers.length > 0) {
      const found = lobbyPlayers.some(lp => lp.id === friend.id || String(lp.id) === String(friend.id));
      if (found) return true;
    }
    // 2. Check Firestore presence flag or last active timestamp within 3 minutes
    if (friend.isOnline === true) return true;
    if (friend.lastSeen && (Date.now() - Number(friend.lastSeen)) < 180000) return true;
    return false;
  };

  // Get all friends with status
  const friendsWithStatus = confirmedFriends.map(friend => {
    const online = isFriendOnline(friend);
    return {
      ...friend,
      isOnline: online,
      status: online ? 'online' : 'offline',
      avatarUrl: friend.avatarUrl
    };
  }).sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return a.name.localeCompare(b.name, 'tr-TR');
  });

  const winRate = profile?.stats && profile.stats.gamesPlayed > 0 
    ? Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100) 
    : 0;

  if (showGameSetup) {
    return (
      <div className="w-full max-w-md md:max-w-[90%] lg:max-w-[85%] xl:max-w-[1000px] mx-auto card-theme rounded-[2rem] border border-[#3E485A]/30 p-4 sm:p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between gap-y-3 h-full max-h-full transition-all duration-200 text-white animate-scale-up" id="welcome-setup-page">
        {/* Decorative ambient glowing background rings */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-52 h-52 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Header section with back button and centered title */}
        <div className="w-full flex flex-col md:grid md:grid-cols-5 items-center gap-2 border-b border-[#3E485A]/40 pb-2.5 relative z-10" id="setup-header-section">
          <div className="md:col-span-1 w-full flex justify-start">
            <button
              onClick={() => setShowGameSetup(false)}
              className="flex items-center gap-1 text-xs font-black uppercase bg-[#FAF6E9] hover:bg-[#F3EFE0] active:bg-[#EBE6D5] text-[#2E3748] px-3 py-1.5 rounded-xl border border-[#EBE6D5] shadow-md transition-all active:scale-95 cursor-pointer"
              id="setup-back-btn"
            >
              <ArrowLeft size={12} className="stroke-[2.5]" />
              <span>Geri Dön</span>
            </button>
          </div>
          
          <div className="md:col-span-3 flex flex-col items-center justify-center gap-0.5 text-center">
            <div className="flex items-center justify-center gap-2">
              <Swords className="w-5 h-5 text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)] animate-pulse" />
              <h1 className="text-lg sm:text-xl font-light font-serif tracking-[0.2em] text-[#FAF6E9] uppercase drop-shadow-md leading-none">
                KELİME SAVAŞI
              </h1>
            </div>
            <div className="h-0.5 w-12 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent mt-1" />
            <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-amber-200/50 uppercase mt-0.5">OYUN MODU VE AYARLARI</span>
          </div>

          <div className="hidden md:block md:col-span-1" />
        </div>

        {/* MODE TABS HEADER INSIDE GAME SETUP SCREEN */}
        <div className="w-full bg-[#1A212D]/95 border-2 border-[#3E485A]/70 p-1.5 rounded-2xl shadow-xl flex items-center gap-1.5 relative z-10" id="setup-game-mode-tab-bar">
          <button
            onClick={() => setSelectedGameModeTab('solo')}
            className={`flex-1 py-3 px-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
              selectedGameModeTab === 'solo'
                ? 'bg-[#FAF6E9] text-[#2E3748] shadow-[0_3px_0_#D9D4C3] scale-[1.01]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            id="tab-btn-solo-mode"
          >
            <Puzzle size={18} className={selectedGameModeTab === 'solo' ? 'text-emerald-700 stroke-[2.5]' : 'text-gray-400'} />
            <div className="text-left leading-none">
              <span className="block font-black text-xs sm:text-sm">Solo Oyun</span>
              <span className="block text-[8px] opacity-75 font-sans mt-0.5 font-bold">Tek Oyunculu Mod</span>
            </div>
          </button>

          <button
            onClick={() => setSelectedGameModeTab('duel')}
            className={`flex-1 py-3 px-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
              selectedGameModeTab === 'duel'
                ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 shadow-[0_3px_0_#D97706] scale-[1.01]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            id="tab-btn-duel-mode"
          >
            <Swords size={18} className={selectedGameModeTab === 'duel' ? 'text-slate-950 stroke-[2.5]' : 'text-gray-400'} />
            <div className="text-left leading-none">
              <div className="flex items-center gap-1">
                <span className="font-black text-xs sm:text-sm">Canlı Oyna</span>
                <span className="text-[7.5px] bg-slate-950 text-amber-300 font-mono font-black px-1.5 py-0.2 rounded-full uppercase">1v1</span>
              </div>
              <span className="block text-[8px] opacity-80 font-sans mt-0.5 font-bold">Online Düello</span>
            </div>
          </button>
        </div>

        {/* Setup Content Based on Active Tab */}
        <div className="space-y-3 relative z-10 flex-1 flex flex-col justify-between min-h-0" id="action-settings-card">
          {selectedGameModeTab === 'solo' ? (
            /* SOLO OYUN TAB CONTENT */
            <div className="space-y-3 flex-1 flex flex-col justify-between min-h-0 animate-fade-in" id="solo-setup-panel">
              <div className="space-y-3 bg-[#3D4756]/30 p-4 sm:p-4.5 rounded-[1.5rem] border border-white/5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Word Length Selector */}
                  <div className="space-y-1.5 text-left">
                    <span className="text-[9px] font-black text-amber-300/80 font-mono tracking-wider uppercase block">HARF SAYISI SEÇİMİ</span>
                    <div className="grid grid-cols-6 gap-1 p-0.5 bg-black/35 rounded-xl border border-white/5">
                      {[3, 4, 5, 6, 7, 8].map((len) => (
                        <button
                          key={len}
                          onClick={() => onChangeWordLength(len)}
                          className={`py-1.5 rounded-lg text-xs font-black transition-all duration-200 active:scale-90 cursor-pointer ${
                            wordLength === len
                              ? 'bg-[#FAF6E9] text-[#2E3748] shadow-sm ring-2 ring-amber-400/20'
                              : 'text-[#FAF6E9]/75 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {len}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dictionary Mode Selector */}
                  <div className="space-y-1.5 text-left">
                    <span className="text-[9px] font-black text-amber-300/80 font-mono tracking-wider uppercase block">SÖZLÜK MODU</span>
                    <div className="grid grid-cols-2 gap-1 bg-black/35 p-0.5 rounded-xl border border-white/5">
                      <button
                        onClick={() => onChangeDictionaryMode('tdk_online')}
                        className={`py-1.5 rounded-lg text-xs font-black transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                          dictionaryMode === 'tdk_online'
                            ? 'bg-[#FAF6E9] text-[#2E3748] shadow-sm ring-2 ring-amber-400/20'
                            : 'text-[#FAF6E9]/75 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <Globe size={11} className="stroke-[2.5]" />
                        <span>Sözlük Modu</span>
                      </button>
                      <button
                        onClick={() => onChangeDictionaryMode('no_validation')}
                        className={`py-1.5 rounded-lg text-xs font-black transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                          dictionaryMode === 'no_validation'
                            ? 'bg-[#FAF6E9] text-[#2E3748] shadow-sm ring-2 ring-amber-400/20'
                            : 'text-[#FAF6E9]/75 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <ShieldAlert size={11} className="stroke-[2.5]" />
                        <span>Serbest</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Time Rule */}
                <div className="space-y-1.5 text-left border-t border-white/5 pt-2">
                  <span className="text-[9px] font-black text-amber-300/80 font-mono tracking-wider uppercase flex items-center gap-1">
                    <Zap size={10} className="text-amber-400 animate-pulse fill-amber-400/20" /> SÜRE VE ZAMAN KURALI
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onChangeGameMode('timed')}
                      className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all duration-200 flex items-center justify-center gap-1.5 border active:scale-95 cursor-pointer ${
                        gameMode === 'timed'
                          ? 'bg-[#FAF6E9] border-[#FAF6E9] text-[#2E3748] shadow-sm ring-2 ring-amber-400/20'
                          : 'bg-black/20 text-[#FAF6E9]/75 border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <span>⏱️ Süreli (20 sn)</span>
                    </button>
                    <button
                      onClick={() => onChangeGameMode('untimed')}
                      className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all duration-200 flex items-center justify-center gap-1.5 border active:scale-95 cursor-pointer ${
                        gameMode === 'untimed'
                          ? 'bg-[#FAF6E9] border-[#FAF6E9] text-[#2E3748] shadow-sm ring-2 ring-amber-400/20'
                          : 'bg-black/20 text-[#FAF6E9]/75 border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <span>♾️ Süresiz</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Info Panel */}
              <div className="bg-black/35 border border-white/5 rounded-2xl p-3 text-left space-y-0.5 relative overflow-hidden" id="solo-info-panel">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] font-black text-emerald-300 uppercase tracking-widest font-mono">
                    SOLO PRATİK MODU
                  </span>
                </div>
                <p className="text-[11px] text-gray-300 leading-snug font-sans">
                  Kendi başınıza pratik yapıp kendinizi test edin! Süreli veya süresiz oynayarak kelime haznenizi genişletin.
                </p>
              </div>

              {/* Solo Launch Button */}
              <button
                onClick={() => {
                  onStartSoloGame();
                  setShowGameSetup(false);
                }}
                className="w-full bg-[#FAF6E9] hover:bg-[#F3EFE0] active:scale-[0.98] text-[#2E3748] font-black text-sm py-3.5 px-4 rounded-2xl shadow-[0_4px_0_#D9D4C3,0_5px_10px_rgba(0,0,0,0.15)] transition-all flex items-center justify-between uppercase tracking-wider cursor-pointer border border-[#EBE6D5]"
                id="start-solo-btn"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <Puzzle size={20} className="text-emerald-700 stroke-[2.5]" />
                  </div>
                  <div className="text-left leading-tight">
                    <span className="font-black text-[#2E3748] text-sm tracking-wide block">SOLO OYUNA BAŞLA</span>
                    <span className="block text-[9.5px] font-bold text-gray-500 font-sans normal-case mt-0.5">Tek oyunculu kelime oyunu</span>
                  </div>
                </div>
                <div className="px-3 py-1.5 bg-[#2E3748] text-[#FAF6E9] text-[10px] font-black rounded-xl uppercase tracking-widest flex items-center gap-1">
                  <span>BAŞLAT</span>
                  <Play size={10} className="fill-current" />
                </div>
              </button>
            </div>
          ) : (
            /* CANLI OYNA / DÜELLO TAB CONTENT */
            <div className="space-y-3 flex-1 flex flex-col justify-between min-h-0 animate-fade-in" id="duel-setup-panel">
              <div className="space-y-3 bg-[#3D4756]/30 p-4 sm:p-4.5 rounded-[1.5rem] border border-white/5 text-left">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[9px] font-black text-amber-300 font-mono tracking-wider uppercase block">CANLI DÜELLO AYARLARI</span>
                  <button
                    onClick={onReconnect}
                    className={`flex items-center gap-1.5 text-[9px] font-mono font-black px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                      isOnline
                        ? "text-emerald-400 bg-emerald-950/60 border-emerald-500/30 hover:bg-emerald-900/60"
                        : "text-rose-400 bg-rose-950/60 border-rose-500/40 hover:bg-rose-900/60 animate-pulse"
                    }`}
                    title={isOnline ? "Canlı sunucu bağlantısı aktif" : "Bağlantı koptu. Yeniden bağlanmak için tıklayın."}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
                    <span>{isOnline ? 'ONLINE CANLI' : 'BAĞLANTI YOK / ÇEVRİMDIŞI'}</span>
                  </button>
                </div>
              </div>

              {/* Duel Mode Info Box */}
              <div className="bg-black/40 border border-amber-500/25 rounded-2xl p-3.5 sm:p-4 text-left space-y-1.5 relative overflow-hidden shadow-inner" id="duel-info-panel">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <span className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-widest font-mono">
                    CANLI 1v1 DÜELLO KURALLARI
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-100 leading-relaxed font-sans font-medium">
                  Oyuna başla butonuna bastığınızda sistem sizi anında rastgele bir rakiple eşleştirir. Her iki oyuncu da aynı kelimeyi en hızlı şekilde tahmin etmeye çalışır. En hızlı ve doğru tahminleri yapan oyunu kazanır.
                </p>
              </div>

              {/* Queued or Start Matchmaking Button */}
              {matchmakingStatus === 'queued' ? (
                <div className="w-full bg-amber-950/60 border border-amber-500/50 rounded-2xl p-4 flex flex-col items-center gap-2 text-center shadow-lg">
                  <div className="flex items-center gap-2 text-amber-300 font-black text-xs sm:text-sm uppercase tracking-wider">
                    <Swords size={20} className="animate-spin text-amber-400" />
                    <span>RAKİP ARANIYOR...</span>
                  </div>
                  <p className="text-[10px] text-amber-200/80 font-bold">Lütfen bekleyin, uygun bir rakip eşleştiriliyor.</p>
                  <button
                    onClick={() => onStartMatchmaking && onStartMatchmaking()}
                    className="mt-1 text-xs font-black text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 px-4 py-2 rounded-xl uppercase tracking-wider transition cursor-pointer active:scale-95 shadow-sm"
                    id="cancel-matchmaking-setup-btn"
                  >
                    Aramayı İptal Et
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (onStartMatchmaking) {
                      onStartMatchmaking();
                    }
                  }}
                  className="w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] text-slate-950 py-3.5 px-4 rounded-2xl shadow-[0_4px_0_#D97706,0_8px_20px_rgba(245,158,11,0.35)] transition-all flex items-center justify-between uppercase tracking-wider cursor-pointer border border-amber-200/40"
                  id="start-duel-setup-btn"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-950/15 flex items-center justify-center shrink-0 border border-slate-900/10">
                      <Swords size={20} className="text-slate-950 stroke-[2.5]" />
                    </div>
                    <div className="text-left leading-tight">
                      <span className="font-black text-slate-950 text-sm tracking-wide block">OYUNA BAŞLA</span>
                      <span className="block text-[9.5px] font-bold text-slate-900/80 font-sans normal-case mt-0.5">Online 1v1 Rakip Bul</span>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 bg-slate-950 text-amber-300 text-[10px] font-black rounded-xl uppercase tracking-widest flex items-center gap-1 shadow-sm">
                    <span>2 Altın 🪙</span>
                    <Play size={10} className="fill-current" />
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return isEditing ? (
    <div className="w-full max-w-md md:max-w-[90%] lg:max-w-[85%] xl:max-w-[1000px] mx-auto card-theme rounded-[2.5rem] border p-5 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between gap-y-[3.5vh] sm:gap-5 min-h-[82vh] md:min-h-0 animate-scale-up" id="welcome-screen-root">
      {/* Sparkles / Title */}
      <div className="flex justify-between items-center pb-2 border-b border-white/10">
        <span className="text-sm font-bold font-mono text-amber-200 uppercase tracking-widest flex items-center gap-1.5">
          <Sparkles size={14} className="animate-pulse" />
          {profile?.nameSet && !isGenericName(profile?.name) ? 'Profilini Düzenle' : 'Kullanıcı Adınızı Belirleyin'}
        </span>
        {profile?.nameSet && !isGenericName(profile?.name) && (
          <button 
            onClick={() => setIsEditing(false)}
            className="text-xs text-[#FAF6E9]/70 hover:text-white transition cursor-pointer"
          >
            Kapat
          </button>
        )}
      </div>

      {/* Avatar Selector Grid */}
      <div className="space-y-3 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-[10px] font-bold text-amber-100/60 uppercase tracking-wider block font-sans">
            AVATAR VEYA FOTOĞRAF SEÇİN
          </label>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Hidden Gallery Input */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageFileSelected(file);
                e.target.value = '';
              }}
            />

            {/* Hidden Camera Input */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageFileSelected(file);
                e.target.value = '';
              }}
            />

            {/* Fotoğraf Yükle (Galeri) Button */}
            <button
              type="button"
              onClick={handleOpenGallery}
              className="text-[9.5px] bg-[#FAF6E9] hover:bg-[#F3EFE0] active:scale-95 text-slate-900 font-black px-2.5 py-1.5 rounded-xl transition duration-150 cursor-pointer uppercase tracking-wider flex items-center gap-1 shadow-sm"
              title="Galeriden Fotoğraf Yükle"
            >
              <ImageIcon size={12} className="text-slate-800" />
              <span>Fotoğraf Yükle</span>
            </button>

            {/* Fotoğraf Çek (Kamera) Button */}
            <button
              type="button"
              onClick={handleOpenCamera}
              className="text-[9.5px] bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black px-2.5 py-1.5 rounded-xl transition duration-150 cursor-pointer uppercase tracking-wider flex items-center gap-1 shadow-sm"
              title="Kamerayla Fotoğraf Çek"
            >
              <Camera size={12} className="text-slate-950" />
              <span>Fotoğraf Çek</span>
            </button>
          </div>
        </div>

        {/* Permission Error Notification Banner */}
        {permissionError && (
          <div className="bg-rose-500/20 border border-rose-500/50 rounded-xl p-2.5 text-xs font-bold text-rose-300 flex items-center justify-between gap-2 animate-fade-in shadow-md">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm shrink-0">⚠️</span>
              <span className="leading-tight">{permissionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setPermissionError(null)}
              className="p-1 text-rose-300 hover:text-white transition shrink-0"
              title="Uyarıyı kapat"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-6 gap-2 p-2.5 bg-black/30 rounded-2xl border border-white/5 max-h-32 overflow-y-auto">
          {selectedAvatar && isImageUrl(selectedAvatar) && (
            <button
              type="button"
              onClick={() => setSelectedAvatar(selectedAvatar)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition duration-150 active:scale-90 relative overflow-hidden ring-2 ring-amber-400 scale-105 shadow"
            >
              <img src={selectedAvatar} alt="Custom Avatar" className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
            </button>
          )}
          {AVATAR_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setSelectedAvatar(preset)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xl transition duration-150 active:scale-90 hover:bg-white/10 ${
                selectedAvatar === preset 
                  ? 'bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-900 scale-105 shadow' 
                  : ''
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Edit Name Input */}
      <div className="space-y-2 text-left">
        <label className="text-[10px] font-bold text-amber-100/60 uppercase tracking-wider block font-sans">TAKMA ADINIZ</label>
        <input
          type="text"
          maxLength={26}
          value={editName}
          onChange={(e) => {
            setEditName(e.target.value);
            setIsTouched(true);
            setDbUsernameError(null);
          }}
          placeholder="Takma adınızı yazın..."
          className={`w-full bg-[#2E3748]/55 border ${error ? 'border-rose-500 focus:ring-rose-400/40' : 'border-white/5 focus:ring-amber-200/40'} rounded-xl px-4 py-2.5 text-sm font-bold text-[#FAF6E9] focus:outline-none focus:ring-2`}
        />
        {error && (
          <p className="text-xs text-rose-400 font-semibold px-1 mt-1 animate-fade-in">
            ⚠️ {error}
          </p>
        )}
      </div>

      {/* Save / Cancel buttons */}
      <div className="flex gap-2 mt-2">
        {profile?.nameSet && !isGenericName(profile?.name) && (
          <button
            onClick={() => {
              setIsEditing(false);
              setIsTouched(false);
            }}
            className="flex-1 py-3 px-4 rounded-xl border border-white/10 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/5 transition cursor-pointer"
          >
            Vazgeç
          </button>
        )}
        <button
          onClick={handleSaveProfile}
          disabled={!editName.trim() || !!error || isCheckingName}
          className="flex-1 py-3 px-4 rounded-xl bg-[#FAF6E9] hover:bg-[#F3EFE0] disabled:opacity-50 text-[#2E3748] text-xs font-black transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {isCheckingName ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-[#2E3748] border-t-transparent rounded-full animate-spin" />
              <span>Kontrol ediliyor...</span>
            </>
          ) : (
            <span>Kaydet ve Oyuna Başla</span>
          )}
        </button>
      </div>
    </div>
  ) : (
    <div className="w-full max-w-md md:max-w-[90%] lg:max-w-[85%] xl:max-w-[1000px] mx-auto bg-[#1E2532] rounded-[2.5rem] p-5 sm:p-7 shadow-2xl relative overflow-hidden flex flex-col justify-between gap-y-4 sm:gap-y-5 min-h-[82vh] md:min-h-0 md:max-h-none md:h-auto transition-all duration-200 text-white animate-scale-up" id="welcome-screen-root">
      
      {/* App Title Header with AKTİF status */}
      <div className="flex items-center justify-between w-full relative z-10 gap-2" id="welcome-header-title">
        {/* Shimmering Gold Wallet in welcome header with Daily Bonus Status Indicator */}
        <div className="flex flex-col items-start gap-1 shrink-0">
          <GoldWallet gold={profile?.gold !== undefined ? profile.gold : 20} />
          <button
            onClick={() => {
              if (!isDailyClaimed && onClaimDailyReward) {
                onClaimDailyReward();
              }
            }}
            disabled={isDailyClaimed}
            className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border transition-all ${
              isDailyClaimed
                ? "bg-slate-800/40 border-white/5 text-gray-500 cursor-default"
                : "bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 border-amber-500/30 text-amber-300 cursor-pointer shadow-[0_0_8px_rgba(245,158,11,0.2)]"
            }`}
            title={isDailyClaimed ? "Bugünkü günlük giriş ödülü alındı" : "Günlük bonusun hazır! Almak için tıkla."}
          >
            <span className={`w-1 h-1 rounded-full ${isDailyClaimed ? "bg-gray-500" : "bg-amber-400 animate-pulse"}`} />
            <span>Bonus: {isDailyClaimed ? "ALINDI" : "HAZIR!"}</span>
          </button>
        </div>
        
        <div className="flex items-center justify-center gap-2 flex-1 md:flex-initial">
          {/* Stylized Golden Emblem */}
          <div className="w-5 h-5 flex items-center justify-center text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
              <polygon points="5 3 19 12 5 21 5 3" fill="rgba(245, 158, 11, 0.2)" />
              <line x1="12" y1="5" x2="12" y2="19" strokeWidth="1.5" />
            </svg>
          </div>
          <h1 className="text-sm xs:text-base sm:text-xl font-serif tracking-[0.1em] sm:tracking-[0.15em] text-[#F3EFE0] uppercase font-semibold text-center truncate">
            KELİME SAVAŞI
          </h1>
        </div>

        {/* Dynamic connection status badge */}
        <button
          onClick={onReconnect}
          className={`flex items-center gap-1.5 border rounded-full px-2.5 py-0.5 text-[8.5px] font-extrabold shadow-sm shrink-0 transition-all cursor-pointer ${
            isOnline
              ? "bg-[#1F2633] border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/40"
              : "bg-rose-950/80 border-rose-500/50 text-rose-300 hover:bg-rose-900/80 animate-pulse"
          }`}
          title={isOnline ? "İnternet ve Sunucu Bağlantısı Aktif" : "İnternet veya Sunucu Bağlantısı Kesildi - Yeniden Bağlanmak İçin Tıklayın"}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
          <span>{isOnline ? "AKTİF" : "BAĞLANTI YOK / ÇEVRİMDIŞI"}</span>
        </button>
      </div>

      {/* Unified Level, Profile Photo, Name Card (Requirement 5) */}
      {(() => {
        const progress = getLevelProgress(profile?.dailyScore || 0);
        return (
          <div className="w-full bg-[#FAF6E9] border-2 border-[#EBE6D5] rounded-3xl p-4 sm:p-5 shadow-[0_5px_0_#D9D4C3,0_8px_16px_rgba(0,0,0,0.15)] flex flex-col gap-3.5 text-left relative z-10 overflow-hidden" id="unified-level-profile-card">
            
            {/* Elegant Vintage Double Border & Corner Ornaments */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-[#E2DCBF]/85 fill-none p-1" viewBox="0 0 100 100" preserveAspectRatio="none">
              <rect x="2" y="2" width="96" height="96" rx="8" strokeWidth="0.75" />
              <rect x="3.5" y="3.5" width="93" height="93" rx="6" strokeWidth="0.5" strokeDasharray="1 1.5" />
              <path d="M 3.5 8 Q 8 8 8 3.5" strokeWidth="0.75" />
              <path d="M 96.5 8 Q 92 8 92 3.5" strokeWidth="0.75" />
              <path d="M 3.5 92 Q 8 92 8 96.5" strokeWidth="0.75" />
              <path d="M 96.5 92 Q 92 92 92 96.5" strokeWidth="0.75" />
            </svg>

            {/* Row 1: Avatar + Name & Level Title */}
            <div className="flex items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3.5">
                {/* Clickable Avatar */}
                <div 
                  className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#1A212D] border-2 border-amber-500/50 flex items-center justify-center overflow-hidden shrink-0 transition-transform duration-300 hover:scale-105 cursor-pointer shadow-md"
                  onClick={() => setIsEditing(true)}
                  title="Profil resmini değiştir"
                >
                  <UserAvatar avatarUrl={profile?.avatarUrl} name={profile?.name} fallbackIcon="🧠" textClassName="text-2xl sm:text-3xl font-black text-amber-300" />
                </div>

                <div className="flex flex-col">
                  {/* Player Name */}
                  <span className="text-xl sm:text-2xl font-serif tracking-wide text-[#2E3748] font-bold leading-tight truncate">
                    {profile?.name || 'Oyuncu'}
                  </span>
                  {/* Level Badge */}
                  <span className="text-[11px] sm:text-xs font-black text-[#C59B27] font-mono tracking-wider uppercase mt-0.5">
                    {progress.level}. SEVİYE
                  </span>
                </div>
              </div>

              {/* Edit Icon Button */}
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 rounded-xl bg-[#E2DCBF]/40 hover:bg-[#E2DCBF] text-[#2E3748] transition-all cursor-pointer border border-[#E2DCBF]/80 active:scale-95"
                title="Profili Düzenle"
              >
                <Edit2 size={16} />
              </button>
            </div>

            {/* Simplified Puan ve Seviye Alanı */}
            <div className="w-full relative z-10 flex flex-col gap-2 pt-2.5 border-t border-[#E2DCBF]/80">
              {/* 1. Ekranın üst kısmında oyuncunun güncel toplam puanını net bir şekilde gösteren tek ana puan alanı */}
              <div className="flex items-center justify-between bg-[#F3EFE0] border border-[#E2DCBF] rounded-2xl px-3.5 py-2 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 text-sm sm:text-base">⭐</span>
                  <span className="text-xs sm:text-sm font-bold text-[#2E3748]">Güncel Toplam Puan</span>
                </div>
                <span className="font-mono font-black text-amber-700 text-xs sm:text-sm bg-amber-100/90 px-2.5 py-1 rounded-xl border border-amber-300/80 shadow-xs">
                  {profile?.dailyScore || 0} Puan
                </span>
              </div>

              {/* 2. Hemen altında sadece seviye ilerleme çubuğu */}
              <div className="w-full bg-slate-200/80 h-3 rounded-full overflow-hidden p-0.5 border border-slate-300/40 mt-1">
                <div 
                  style={{ width: `${progress.percent}%` }}
                  className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 rounded-full transition-all duration-700 ease-out shadow-[0_0_6px_rgba(245,158,11,0.3)]"
                />
              </div>

              {/* 3. Çubuğun altında sonraki seviyeye geçmek için kalan puan bilgisi */}
              <div className="text-center text-[11px] sm:text-xs font-semibold text-slate-600 font-sans mt-0.5">
                {progress.level < 500 ? (
                  <span>Sonraki seviyeye geçmek için <strong className="text-amber-700 font-mono font-black">{progress.remainingForNextLevel}</strong> puan kaldı</span>
                ) : (
                  <span className="text-amber-600 font-extrabold">Maksimum Seviyeye Ulaşıldı! 👑</span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ALTIN & ÖDÜL MERKEZİ CARD */}
      <div className="w-full bg-[#FAF6E9] border-2 border-[#EBE6D5] rounded-3xl p-4 sm:p-5 shadow-[0_5px_0_#D9D4C3,0_8px_16px_rgba(0,0,0,0.15)] flex flex-col gap-3.5 text-left relative z-10 overflow-hidden animate-fade-in" id="gold-rewards-card">
        {/* Elegant Vintage Double Border & Corner Ornaments */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-[#E2DCBF]/85 fill-none p-1" viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect x="2" y="2" width="96" height="96" rx="8" strokeWidth="0.75" />
          <rect x="3.5" y="3.5" width="93" height="93" rx="6" strokeWidth="0.5" strokeDasharray="1 1.5" />
          <path d="M 3.5 8 Q 8 8 8 3.5" strokeWidth="0.75" />
          <path d="M 96.5 8 Q 92 8 92 3.5" strokeWidth="0.75" />
          <path d="M 3.5 92 Q 8 92 8 96.5" strokeWidth="0.75" />
          <path d="M 96.5 92 Q 92 92 92 96.5" strokeWidth="0.75" />
        </svg>

        <div className="flex items-center justify-between gap-3 relative z-10 border-b border-[#E2DCBF] pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🪙</span>
            <span className="font-serif tracking-wide text-[#2E3748] font-bold text-base sm:text-lg">Cüzdanım & Ödüller</span>
          </div>
          <div className="bg-[#FEF9E6] px-2.5 py-1 rounded-xl border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
            <span className="text-xs sm:text-sm font-black text-[#C59B27] font-mono leading-none">{profile?.gold !== undefined ? profile.gold : 20}</span>
            <span className="text-[10px] sm:text-xs font-black text-[#C59B27] font-mono leading-none">ALTIN</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 relative z-10">
          {/* Daily Login Button */}
          {(() => {
            const todayStr = getTodayDateStr();
            const isDailyClaimed = profile?.lastDailyLoginClaim === todayStr;
            return (
              <button
                disabled={isDailyClaimed}
                onClick={onClaimDailyReward}
                className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs flex items-center justify-between transition-all duration-150 active:scale-95 border uppercase tracking-wider ${
                  isDailyClaimed
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border-emerald-200 text-emerald-800 shadow-sm cursor-pointer'
                }`}
                title={isDailyClaimed ? 'Günlük giriş ödülü zaten alındı' : 'Günlük 10 altın kazan'}
              >
                <div className="flex items-center gap-2">
                  <span>🎁</span>
                  <div className="text-left">
                    <span className="block font-black text-[10px] leading-tight text-emerald-900/80">GÜNLÜK GİRİŞ</span>
                    <span className="block text-[8px] font-mono text-gray-500 leading-none mt-0.5">RESET 00:00</span>
                  </div>
                </div>
                <span className="font-mono text-xs font-black text-emerald-600">{isDailyClaimed ? '✓ ALINDI' : '+10🪙'}</span>
              </button>
            );
          })()}

          {/* Rewarded Ad Button */}
          <button
            onClick={startRewardedAdWatch}
            disabled={isAdLoading || isWatchingAd}
            className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs flex items-center justify-between transition-all duration-150 active:scale-95 shadow-sm uppercase tracking-wider relative overflow-hidden ${
              isAdLoading || isWatchingAd
                ? "bg-amber-950/80 border-amber-500/60 text-amber-200 cursor-not-allowed"
                : "bg-gradient-to-r from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 border-amber-200 text-amber-850 cursor-pointer"
            }`}
            title="Reklam izleyerek 10 altın kazan"
          >
            {/* Sarı İlerleme Çubuğu (Yellow Progress Bar) */}
            {(isAdLoading || isWatchingAd) && (
              <div className="absolute inset-0 bg-amber-950/40 overflow-hidden pointer-events-none">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all duration-150 ease-linear shadow-[0_0_12px_rgba(245,158,11,0.8)]"
                  style={{ width: `${isAdLoading ? 40 : Math.max(8, adProgress)}%` }}
                />
              </div>
            )}

            <div className="flex items-center gap-2 relative z-10">
              <span className={isAdLoading ? "animate-spin" : isWatchingAd ? "animate-pulse" : ""}>
                {isAdLoading ? "⏳" : isWatchingAd ? "🎬" : "📺"}
              </span>
              <div className="text-left">
                <span className={`block font-black text-[10px] leading-tight ${
                  isWatchingAd || isAdLoading ? "text-white font-mono drop-shadow-sm" : "text-amber-900/80"
                }`}>
                  {isAdLoading ? "REKLAM HAZIRLANIYOR..." : isWatchingAd ? `REKLAM OYNATILIYOR (%${adProgress})` : "İZLE KAZAN"}
                </span>
                {isAdLoading && (
                  <span className="block text-[8px] font-mono text-amber-200/90 leading-none mt-0.5">
                    LÜTFEN BEKLEYİN
                  </span>
                )}
                {isWatchingAd && (
                  <span className="block text-[8px] font-mono text-yellow-300 leading-none mt-0.5 animate-pulse">
                    ÖDÜL YÜKLENİYOR...
                  </span>
                )}
              </div>
            </div>
            <span className={`font-mono text-xs font-black relative z-10 ${
              isWatchingAd || isAdLoading ? "text-yellow-300 drop-shadow-sm" : "text-amber-600"
            }`}>+10🪙</span>
          </button>
        </div>
      </div>

      {/* CARD 1: Single Main Action Button - OYUN OYNA */}
      <div className="w-full flex flex-col gap-2 relative z-10" id="main-play-section">
        <button
          onClick={() => setShowGameSetup(true)}
          className="w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] text-slate-950 py-2.5 px-4 rounded-2xl shadow-[0_4px_0_#D97706,0_6px_16px_rgba(245,158,11,0.3)] transition-all flex items-center justify-between uppercase tracking-wider cursor-pointer relative overflow-hidden border border-amber-200/50"
          id="main-start-game-btn"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-950/15 flex items-center justify-center shrink-0 border border-slate-900/10">
              <Swords size={18} className="text-slate-950 stroke-[2.5]" />
            </div>
            <span className="font-black text-slate-950 text-sm sm:text-base tracking-wide">OYUN OYNA</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-950 text-amber-300 text-[10px] font-black rounded-xl uppercase tracking-widest shadow-sm flex items-center gap-1 shrink-0">
            <span>GİRİŞ</span>
            <Play size={10} className="fill-current" />
          </div>
        </button>
      </div>

      {/* CARD 3: Günün Bulmacası (Daily Puzzle) Card */}
      <div className="w-full relative z-10">
        {isDailyPuzzleCompletedToday ? (
          <div className="w-full relative overflow-hidden bg-[#FAF6E9] border-2 border-[#EBE6D5] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-[0_3px_0_#D9D4C3,0_4px_8px_rgba(0,0,0,0.1)] text-left animate-fade-in">
            {/* Antique ornaments inside card */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-[#E2DCBF]/50 fill-none p-0.5" viewBox="0 0 100 100" preserveAspectRatio="none">
              <rect x="2.5" y="2.5" width="95" height="95" rx="6" strokeWidth="0.5" />
            </svg>

            <div className="flex items-center gap-3 min-w-0 z-10">
              {/* Golden Trophy Icon Badge */}
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 text-white rounded-xl flex items-center justify-center border border-amber-300 shadow-sm shrink-0">
                <Trophy size={18} className="stroke-[2.5]" />
              </div>
              
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[7.5px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider font-mono">TAMAMLANDI</span>
                  <span className="text-[9px] font-black tracking-widest text-amber-800/80 uppercase font-sans">GÜNÜN BULMACASI</span>
                </div>
                <h4 className="text-xs font-black text-[#2E3748] truncate mt-1">Bugünün kelimesini çözdün! 🎉</h4>
                <p className="text-[9px] text-amber-700 font-bold mt-0.5 flex items-center gap-1">
                  <span>Sıfırlanma:</span>
                  <span className="font-mono text-amber-600">{timeLeftToReset || "09:06-31"}</span>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => onStartDailyPuzzle?.()}
            className="w-full relative overflow-hidden bg-[#FAF6E9] hover:bg-[#F3EFE0] active:scale-[0.98] border-2 border-[#EBE6D5] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 text-left transition-all duration-300 shadow-[0_3px_0_#D9D4C3,0_4px_8px_rgba(0,0,0,0.1)] cursor-pointer"
          >
            {/* Antique ornaments inside card */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-[#E2DCBF]/50 fill-none p-0.5" viewBox="0 0 100 100" preserveAspectRatio="none">
              <rect x="2.5" y="2.5" width="95" height="95" rx="6" strokeWidth="0.5" />
            </svg>

            <div className="flex items-center gap-3 min-w-0 z-10">
              {/* Daily Puzzle Puzzle Icon Badge */}
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 text-white rounded-xl flex items-center justify-center border border-amber-300 shadow-sm shrink-0">
                <Puzzle size={18} className="stroke-[2.5]" />
              </div>
              
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[7.5px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider font-mono">YENİ</span>
                  <span className="text-[9px] font-black tracking-widest text-amber-800/80 uppercase font-sans">GÜNÜN BULMACASI</span>
                </div>
                <h4 className="text-xs font-black text-[#2E3748] truncate mt-1">{getDailyWordAndLength().length} Harfli Gizemli Kelime</h4>
                <p className="text-[9px] text-gray-500 mt-0.5 flex items-center gap-1">
                  <span>Kalan:</span>
                  <span className="font-mono text-amber-700 font-bold">{timeLeftToReset}</span>
                </p>
              </div>
            </div>
            
            {/* OYNA Action Button */}
            <div className="px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-lg transition-all shadow-sm flex items-center gap-1 shrink-0 z-10">
              <span>OYNA</span>
              <Play size={8} className="fill-current" />
            </div>
          </button>
        )}
      </div>

      {/* Solid Dark Action Grid */}
      <div className="grid grid-cols-4 gap-2.5 w-full relative z-10" id="bottom-buttons-grid">
        {/* Button 1: REKABET */}
        <button
          onClick={onOpenStats}
          className="bg-[#131A26] hover:bg-[#1A2333] active:scale-[0.97] text-[#FAF6E9] rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 shadow-lg border border-amber-500/25 transition duration-150 cursor-pointer"
        >
          <Trophy size={20} className="text-amber-400 stroke-[2.5]" />
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-100">REKABET</span>
        </button>

        {/* Button 2: ARKADAŞLAR */}
        <button
          onClick={() => setShowFriendsModal(true)}
          className="bg-[#131A26] hover:bg-[#1A2333] active:scale-[0.97] text-[#FAF6E9] rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 shadow-lg border border-amber-500/25 transition duration-150 cursor-pointer relative"
        >
          <Users size={20} className="text-amber-400 stroke-[2.5]" />
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-100">ARKADAŞ</span>
        </button>

        {/* Button 3: AYARLAR */}
        <button
          onClick={onOpenSettings}
          className="bg-[#131A26] hover:bg-[#1A2333] active:scale-[0.97] text-[#FAF6E9] rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 shadow-lg border border-amber-500/25 transition duration-150 cursor-pointer"
        >
          <Sliders size={20} className="text-amber-400 stroke-[2.5]" />
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-100">AYARLAR</span>
        </button>

        {/* Button 4: KURALLAR */}
        <button
          onClick={() => setShowRulesModal(true)}
          className="bg-[#131A26] hover:bg-[#1A2333] active:scale-[0.97] text-[#FAF6E9] rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 shadow-lg border border-amber-500/25 transition duration-150 cursor-pointer"
        >
          <HelpCircle size={18} className="text-amber-400 stroke-[2.5]" />
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-100">KURALLAR</span>
        </button>
      </div>

      {/* Beautiful 4-Point Star ornament background element (Requirement 8) */}
      <div className="absolute bottom-4 right-6 text-white/5 animate-pulse select-none pointer-events-none z-0">
        <svg className="w-14 h-14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c.5 6.5 5.5 11.5 12 12-.5 6.5-5.5 11.5-12 12-.5-6.5-5.5-11.5-12-12 .5-6.5 5.5-11.5 12-12z" />
        </svg>
      </div>

      {/* Rules Detail Popup Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="card-theme bg-[#161D2B] border border-amber-500/20 rounded-[2rem] p-6 w-full max-w-lg shadow-2xl space-y-4 animate-scale-up text-left relative overflow-hidden text-white">
            {/* Glowing 4-point star accent in bottom right */}
            <div className="absolute bottom-6 right-8 text-amber-100/15 animate-pulse select-none pointer-events-none">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c.5 6.5 5.5 11.5 12 12-.5 6.5-5.5 11.5-12 12-.5-6.5-5.5-11.5-12-12 .5-6.5 5.5-11.5 12-12z" />
              </svg>
            </div>

            <div className="flex justify-between items-start border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-black text-[#FAF6E9] uppercase tracking-wide flex items-center gap-2">
                  <HelpCircle size={18} className="text-amber-400" />
                  Nasıl Oynanır & Kurallar
                </h3>
                <p className="text-[10px] text-amber-100/50 font-mono font-bold uppercase mt-0.5">
                  YAPAY ZEKA DESTEKLİ KELİME SAVAŞI REHBERİ & PUANLAMA SİSTEMİ
                </p>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs leading-relaxed text-[#FAF6E9]/90 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
              {/* Rule 1: Harf Renkleri */}
              <div className="bg-[#3D4756]/40 p-3.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Sparkles size={14} />
                  <span>1. Harf Renkleri & İpuçları</span>
                </div>
                <p className="text-[11px] leading-normal text-gray-300">
                  Tahmin ettiğiniz kelimedeki harfler size gizli kelimeye giden yolu gösterir:
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-1.5 text-center">
                    <span className="text-emerald-400 font-black block text-[11px]">YEŞİL</span>
                    <span className="text-[9px] text-gray-300 block">Doğru harf, doğru yer</span>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-1.5 text-center">
                    <span className="text-amber-400 font-black block text-[11px]">TURUNCU</span>
                    <span className="text-[9px] text-gray-300 block">Harf var, yeri yanlış</span>
                  </div>
                  <div className="bg-gray-500/10 border border-gray-500/25 rounded-lg p-1.5 text-center">
                    <span className="text-gray-400 font-black block text-[11px]">GRİ</span>
                    <span className="text-[9px] text-gray-300 block">Harf kelimede yok</span>
                  </div>
                </div>
              </div>

              {/* Rule 2: Puanlama Sistemi */}
              <div className="bg-[#3D4756]/40 p-3.5 rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Award size={14} />
                  <span>2. Yeni Puanlama Sistemi</span>
                </div>
                <p className="text-[11px] leading-normal text-gray-300">
                  Kelimeyi çözdüğünüz deneme sayısına göre alacağınız puanlar şu şekildedir:
                </p>
                <div className="space-y-1.5 text-[11px] bg-black/20 p-2.5 rounded-lg text-gray-300 font-mono">
                  <div className="flex justify-between">
                    <span>🥇 1. Denemede Bilmek:</span>
                    <span className="text-emerald-400 font-bold">+5 Puan</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-1">
                    <span>🥈 2. Denemede Bilmek:</span>
                    <span className="text-teal-400 font-bold">+4 Puan</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-1">
                    <span>🥉 3. Denemede Bilmek:</span>
                    <span className="text-amber-400 font-bold">+3 Puan</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-1">
                    <span>🧱 4. Denemede Bilmek:</span>
                    <span className="text-orange-400 font-bold">+2 Puan</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-1">
                    <span>👾 5 veya 6. Denemede Bilmek:</span>
                    <span className="text-rose-400 font-bold">+1 Puan</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-1 text-[10px] text-amber-300/80">
                    <span>🛡️ Maksimum Limit:</span>
                    <span>Bir kelimeden en fazla 5 Puan kazanılabilir!</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-1 text-[10px] text-yellow-400/90 font-bold">
                    <span>☀️ Günlük Bulmaca Ödülü:</span>
                    <span>Sabit 5 Savaş Puanı & Bilge Rozeti!</span>
                  </div>
                </div>
              </div>

              {/* Rule 3: Süre Kuralları */}
              <div className="bg-[#3D4756]/40 p-3.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Clock size={14} />
                  <span>3. Süre Kuralları (⏱️ Süreli Oyun)</span>
                </div>
                <p className="text-[11px] leading-normal text-gray-300">
                  Süreli oyun modunda her geçerli tahmin girdikten sonra süre sayacı tekrar <strong className="text-white">20 saniyeye</strong> sıfırlanır. Bu sayede hızlı düşünen ve kelimeleri seri bilen oyuncular devasa zaman bonusları toplayabilirler!
                </p>
              </div>

              {/* Rule 4: Sözlük Modu Doğrulaması */}
              <div className="bg-[#3D4756]/40 p-3.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <ShieldAlert size={14} />
                  <span>4. Sözlük Modu Doğrulaması</span>
                </div>
                <p className="text-[11px] leading-normal text-gray-300">
                  Rastgele harf tuşlanmasını veya anlamsız girişleri önlemek için tüm kelimeler Sözlük Modu tarafından anlık doğrulanır. 
                  İnternet kesildiğinde ise akıllı <strong className="text-white">Türkçe Hece ve Harf Uyumu Koruması</strong> devreye girerek geçerli Türkçe kelimeleri oynamaya devam etmenizi sağlar.
                </p>
              </div>

              {/* Rule 5: Çok Oyunculu Düellolar */}
              <div className="bg-[#3D4756]/40 p-3.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Swords size={14} />
                  <span>5. Canlı Düellolar</span>
                </div>
                <p className="text-xs text-gray-200 leading-relaxed font-sans">
                  Oyuna başla butonuna bastığınızda sistem sizi anında rastgele bir rakiple eşleştirir. Her iki oyuncu da aynı kelimeyi en hızlı şekilde tahmin etmeye çalışır. En hızlı ve doğru tahminleri yapan oyunu kazanır.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-between items-center">
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 bg-[#3D4756]/30 hover:bg-[#3D4756]/60 text-gray-300 px-3 py-2 rounded-xl text-[10px] font-bold transition border border-white/5 cursor-pointer"
              >
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                <span>{copied ? 'Kopyalandı!' : 'Arkadaş Davet Et'}</span>
              </button>

              <button
                onClick={() => setShowRulesModal(false)}
                className="bg-[#FAF6E9] hover:bg-[#F3EFE0] text-[#2E3748] font-black text-xs px-4 py-2 rounded-xl shadow-md transition cursor-pointer"
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Friends Modal */}
      {showFriendsModal && profile && (
        <FriendsModal
          profile={profile}
          onClose={() => setShowFriendsModal(false)}
          onUpdateFriends={(newFriends) => {
            if (onUpdateFriends) onUpdateFriends(newFriends);
          }}
          isOnline={isOnline}
          lobbyPlayers={lobbyPlayers}
          onChallengePlayer={(player, wLen) => {
            setShowFriendsModal(false);
            if (onChallengePlayer) onChallengePlayer(player, wLen);
          }}
          isChallengePending={isChallengePending}
          wordLength={wordLength}
          showToast={showToast}
        />
      )}



      {/* 🎉 AD SUCCESS CELEBRATION POPUP */}
      {showAdSuccess && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 text-center animate-fade-in">
          <div className="w-full max-w-sm bg-[#FAF6E9] border-2 border-amber-500 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-scale-up">
            <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-[#E2DCBF] fill-none p-1" viewBox="0 0 100 100" preserveAspectRatio="none">
              <rect x="2" y="2" width="96" height="96" rx="8" strokeWidth="0.75" />
              <rect x="3.5" y="3.5" width="93" height="93" rx="6" strokeWidth="0.5" strokeDasharray="1 1.5" />
            </svg>

            <div className="text-5xl block mb-4 animate-bounce">🪙✨</div>
            <h3 className="text-[#2E3748] font-serif text-lg sm:text-xl font-black uppercase tracking-wide leading-tight mb-2">
              Tebrikler!
            </h3>
            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed mb-6">
              Ödüllü reklam başarıyla tamamlandı! Hesabınıza <span className="font-bold text-amber-600">10 Altın</span> eklendi.
            </p>

            <button
              onClick={() => setShowAdSuccess(false)}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-md transition cursor-pointer"
            >
              Altınları Al!
            </button>
          </div>
        </div>
      )}

      {/* ⚔️ SEARCHING OPPONENT FULLSCREEN OVERLAY */}
      {matchmakingStatus === 'queued' && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in pointer-events-auto">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.25)] relative overflow-hidden animate-scale-up">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin flex items-center justify-center mx-auto">
                <Swords size={32} className="text-amber-400 animate-pulse" />
              </div>
            </div>

            <span className="text-xs font-black text-amber-400 font-mono tracking-widest uppercase block mb-1">CANLI 1v1 DÜELLO</span>
            <h3 className="text-xl font-black text-[#FAF6E9] tracking-wide uppercase mb-2">
              RAKİP ARANIYOR...
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed mb-6">
              Canlı düello için rakip bekleniyor. Rakip eşleştiği anda kelime uzunluğu (3-8 harf) rastgele belirlenerek oyun iki oyuncu için de aynı anda başlayacaktır.
            </p>

            <button
              onClick={() => onStartMatchmaking && onStartMatchmaking()}
              className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer active:scale-95 shadow-md"
              id="cancel-matchmaking-overlay-btn"
            >
              Aramayı İptal Et
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
