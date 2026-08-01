import React, { useState, useEffect } from 'react';
import { Sparkles, Swords, User, Mail, Lock, ShieldAlert, LogIn, AlertCircle, Smartphone, ArrowLeft } from 'lucide-react';
import { UserProfile, isImageUrl } from '../types';
import { validateUsername, validatePassword } from '../utils/usernameValidation';
import PrivacyPolicyModal from './PrivacyPolicyModal';
import { 
  signInAsGuest, 
  registerWithEmailAndPassword, 
  loginWithEmailAndPassword,
  fetchUserProfile,
  saveUserProfileToFirestore,
  signInWithGoogle,
  linkWithCredential,
  auth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  checkUsernameExists,
  createOrMergeProfile,
  fetchUserProfileByDeviceId,
  uploadAvatarToStorage
} from '../lib/firebase';
import UserAvatar from './UserAvatar';

interface AuthScreenProps {
  onAuthComplete: (profile: UserProfile, firebaseUser: any) => void;
}

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn('localStorage getItem blocked/unavailable:', e);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('localStorage setItem blocked/unavailable:', e);
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('localStorage removeItem blocked/unavailable:', e);
    }
  }
};

const AVATAR_PRESETS = [
  '⚔️', '🧠', '🐺', '🦁', '🧙‍♂️', '🦊', 
  '👾', '🦄', '⚡', '👑', '🎯', '🚀', 
  '🔥', '🐉', '🐼', '🛡️', '🏆', '🦉'
];

type AuthMode = 'guest' | 'login' | 'register' | 'phone';

export default function AuthScreen({ onAuthComplete }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('guest');
  const [isPrivacyOpen, setIsPrivacyOpen] = useState<boolean>(false);
  
  // Fields
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('🧠');
  
  // Phone Login fields
  const [phoneNumber, setPhoneNumber] = useState<string>('+90');
  const [otpCode, setOtpCode] = useState<string>('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [phoneStep, setPhoneStep] = useState<'number' | 'otp'>('number');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<any>(null);
  
  // Touched states for validations
  const [isTouched, setIsTouched] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [dbUsernameError, setDbUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState<boolean>(false);

  // Real-time debounced check for username availability in database
  useEffect(() => {
    if (mode !== 'guest' && mode !== 'register') {
      setDbUsernameError(null);
      setIsCheckingUsername(false);
      return;
    }

    const trimmed = username.trim();
    setDbUsernameError(null);

    const clientErr = validateUsername(trimmed, []);
    if (clientErr || !trimmed) {
      setIsCheckingUsername(false);
      return;
    }

    setIsCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const exists = await checkUsernameExists(trimmed);
        if (exists) {
          setDbUsernameError('Bu kullanıcı adı daha önce alınmıştır, lütfen başka bir tane seçin.');
        } else {
          setDbUsernameError(null);
        }
      } catch (err) {
        console.warn('Error checking username uniqueness in AuthScreen:', err);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, mode]);

  // Social & Account Linking states
  const [pendingCredential, setPendingCredential] = useState<any>(null);
  const [pendingEmail, setPendingEmail] = useState<string>('');
  const [linkingPassword, setLinkingPassword] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [linkingError, setLinkingError] = useState<string | null>(null);

  // Validations
  const usernameError = isTouched && (mode === 'guest' || mode === 'register') 
    ? validateUsername(username, []) 
    : null;
    
  const passwordError = isTouched && (mode === 'register') 
    ? validatePassword(password) 
    : null;

  const handleCustomAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const currentUid = auth.currentUser?.uid || 'guest';
      try {
        const publicUrl = await uploadAvatarToStorage(currentUid, file);
        if (publicUrl && publicUrl.startsWith('http')) {
          setSelectedAvatar(publicUrl);
          return;
        }
      } catch (err) {
        console.warn('Storage upload error in AuthScreen:', err);
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = async () => {
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
            if (currentUid) {
              finalUrl = await uploadAvatarToStorage(currentUid, dataUrl);
            }
            setSelectedAvatar(finalUrl);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const getFirebaseErrorMessage = (err: any): string => {
    const code = err?.code || '';
    const message = err?.message || '';

    if (code.includes('auth/email-already-in-use')) {
      return 'Bu e-posta adresi zaten kullanımda.';
    }
    if (code.includes('auth/invalid-email')) {
      return 'Geçersiz bir e-posta adresi girdiniz.';
    }
    if (code.includes('auth/weak-password')) {
      return 'Şifre çok zayıf. Lütfen daha güvenli bir şifre seçin.';
    }
    if (code.includes('auth/user-not-found') || code.includes('auth/wrong-password') || code.includes('auth/invalid-credential')) {
      return 'Hatalı e-posta veya şifre girdiniz.';
    }
    if (code.includes('auth/too-many-requests')) {
      return 'Çok fazla başarısız deneme yapıldı. Lütfen daha sonra tekrar deneyin.';
    }
    if (code.includes('auth/admin-restricted-operation')) {
      return 'Firebase Console üzerinde "Anonymous Authentication" (Misafir Girişi) sağlayıcısı etkinleştirilmemiş. Lütfen Firebase Console -> Authentication -> Sign-in method sekmesinden "Anonymous" (Anonim) seçeneğini aktif hale getirin.';
    }
    if (code.includes('auth/operation-not-allowed')) {
      return 'Misafir girişi (Anonymous Auth) şu an için devre dışı bırakılmış. Lütfen Firebase Console -> Authentication sayfasından "Anonymous" sağlayıcısını aktif hale getirin.';
    }
    if (code.includes('auth/network-request-failed') || message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
      return 'Şu an bağlanılamıyor, lütfen internet bağlantınızı kontrol edip tekrar deneyin.';
    }
    return 'Şu an bağlanılamıyor, lütfen tekrar deneyin.';
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setFirebaseError(null);
    try {
      const { user, credential } = await signInWithGoogle();
      if (credential) {
        setPendingCredential(credential);
        setPendingEmail(credential.email || '');
        setLinkingError(null);
        return;
      }

      if (user) {
        try {
          safeLocalStorage.setItem('kelimesavasi_is_registered', 'true');
        } catch (e) {}
        const profile = await fetchUserProfile(user.uid);
        const deviceId = safeLocalStorage.getItem('kelimesavasi_device_id') || '';
        const deviceProfile = await fetchUserProfileByDeviceId(deviceId);
        const cachedProfileStr = safeLocalStorage.getItem('kelimesavasi_profile');
        let cachedProfile: UserProfile | null = null;
        if (cachedProfileStr) {
          try { cachedProfile = JSON.parse(cachedProfileStr); } catch (e) {}
        }
        const mergedProfile = createOrMergeProfile(
          profile,
          {
            id: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'Google Oyuncusu',
            avatarUrl: user.photoURL || '🧠',
            nameSet: true
          },
          deviceProfile,
          cachedProfile
        );
        await saveUserProfileToFirestore(mergedProfile);
        onAuthComplete(mergedProfile, user);
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        setFirebaseError('Giriş penceresi kapatıldı.');
        return;
      }
      if (err?.code === 'auth/popup-blocked') {
        setFirebaseError('Açılır pencere engelleyici tarafından engellendi.');
        return;
      }
      console.error('Google login error:', err);
      setFirebaseError('Giriş yapılamadı, lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const setupRecaptcha = () => {
    if (recaptchaVerifier) return recaptchaVerifier;
    try {
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {},
        'expired-callback': () => {}
      });
      setRecaptchaVerifier(verifier);
      return verifier;
    } catch (error) {
      console.error('Recaptcha error:', error);
      setPhoneError('Güvenlik doğrulaması başlatılamadı.');
      return null;
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    setLoading(true);

    const verifier = setupRecaptcha();
    if (!verifier) {
      setLoading(false);
      return;
    }

    try {
      const formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) {
        setPhoneError('Lütfen ülke kodu ile birlikte giriniz (Örn: +905001112233).');
        setLoading(false);
        return;
      }

      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      setConfirmationResult(confirmation);
      setPhoneStep('otp');
    } catch (error: any) {
      console.error('Phone auth send OTP error:', error);
      setPhoneError(getFirebaseErrorMessage(error));
      setRecaptchaVerifier(null);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    setLoading(true);

    try {
      if (!confirmationResult) {
        setPhoneError('Oturum zaman aşımına uğradı, lütfen tekrar deneyin.');
        setLoading(false);
        return;
      }

      if (username.trim()) {
        try {
          safeLocalStorage.setItem('saved_username', username.trim());
          const tempProfile = {
            name: username.trim(),
            avatarUrl: selectedAvatar || '🧠',
            nameSet: true
          };
          safeLocalStorage.setItem('kelimesavasi_profile', JSON.stringify(tempProfile));
        } catch (e) {
          console.warn(e);
        }
      }

      const result = await confirmationResult.confirm(otpCode.trim());
      const user = result.user;

      if (user) {
        try {
          safeLocalStorage.setItem('kelimesavasi_is_registered', 'true');
        } catch (e) {}
        const profile = await fetchUserProfile(user.uid);
        const deviceId = safeLocalStorage.getItem('kelimesavasi_device_id') || '';
        const deviceProfile = await fetchUserProfileByDeviceId(deviceId);
        const cachedProfileStr = safeLocalStorage.getItem('kelimesavasi_profile');
        let cachedProfile: UserProfile | null = null;
        if (cachedProfileStr) {
          try { cachedProfile = JSON.parse(cachedProfileStr); } catch (e) {}
        }
        const mergedProfile = createOrMergeProfile(
          profile,
          {
            id: user.uid,
            name: username.trim() || 'Savaşçı_' + user.uid.substring(0, 5),
            avatarUrl: selectedAvatar || '🧠',
            nameSet: !!username.trim()
          },
          deviceProfile,
          cachedProfile
        );
        await saveUserProfileToFirestore(mergedProfile);
        onAuthComplete(mergedProfile, user);
      }
    } catch (error: any) {
      console.error('Phone auth verify OTP error:', error);
      if (error.code?.includes('invalid-verification-code')) {
        setPhoneError('Hatalı doğrulama kodu girdiniz.');
      } else {
        setPhoneError(getFirebaseErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTouched(true);
    setFirebaseError(null);

    // 1. GİRİŞ KONTROLÜ: Anonim giriş (misafir olarak oyna) butonuna tıklandığında, eğer kullanıcı adı kutusu boşsa, kullanıcıya 'Lütfen önce bir kullanıcı adı giriniz' şeklinde bir uyarı (alert) göster ve girişi engelle.
    if (mode === 'guest') {
      if (!username.trim()) {
        alert('Lütfen önce bir kullanıcı adı giriniz');
        return;
      }
    }

    // Validate based on mode
    if (mode === 'guest' || mode === 'register') {
      const uErr = validateUsername(username, []);
      if (uErr) return;
    }
    if (mode === 'register') {
      const pErr = validatePassword(password);
      if (pErr) return;
    }

    setLoading(true);

    try {
      if (mode === 'guest' || mode === 'register') {
        setIsCheckingUsername(true);
        const usernameTaken = await checkUsernameExists(username);
        setIsCheckingUsername(false);
        if (usernameTaken) {
          setDbUsernameError('Bu kullanıcı adı daha önce alınmıştır, lütfen başka bir tane seçin.');
          setFirebaseError('Bu kullanıcı adı daha önce alınmıştır, lütfen başka bir tane seçin.');
          setLoading(false);
          return;
        }
      }

      if (mode === 'guest') {
        const cleanName = username.trim();
        // Save the manual username and preset profile to local storage first
        try {
          safeLocalStorage.setItem('kelimesavasi_signing_in', 'true');
          safeLocalStorage.setItem('kelimesavasi_is_registered', 'false');
          safeLocalStorage.setItem('saved_username', cleanName);
          const tempProfile = {
            name: cleanName,
            avatarUrl: selectedAvatar,
            nameSet: true
          };
          safeLocalStorage.setItem('kelimesavasi_profile', JSON.stringify(tempProfile));
        } catch (e) {
          console.warn(e);
        }

        // 1. Play as Guest (Anonymous Auth)
        const firebaseUser = await signInAsGuest();
        const deviceId = safeLocalStorage.getItem('kelimesavasi_device_id') || '';
        const fetchedProfile = await fetchUserProfile(firebaseUser.uid);
        const deviceProfile = await fetchUserProfileByDeviceId(deviceId);
        const cachedProfileStr = safeLocalStorage.getItem('kelimesavasi_profile');
        let cachedProfile: UserProfile | null = null;
        if (cachedProfileStr) {
          try { cachedProfile = JSON.parse(cachedProfileStr); } catch (e) {}
        }

        const mergedProfile = createOrMergeProfile(
          fetchedProfile,
          { id: firebaseUser.uid, name: cleanName, avatarUrl: selectedAvatar, nameSet: true, deviceId },
          deviceProfile,
          cachedProfile
        );

        // Save complete profile to local storage immediately so it is instantly available in APK
        try {
          safeLocalStorage.setItem('kelimesavasi_profile', JSON.stringify(mergedProfile));
          safeLocalStorage.setItem('saved_username', cleanName);
          safeLocalStorage.setItem('kelimesavasi_is_registered', 'false');
        } catch (e) {}

        // Non-blocking save to Firestore
        saveUserProfileToFirestore(mergedProfile).catch((err) => {
          console.warn('Firestore guest profile save warning:', err);
        });

        onAuthComplete(mergedProfile, firebaseUser);

      } else if (mode === 'register') {
        const cleanName = username.trim();
        try {
          safeLocalStorage.setItem('kelimesavasi_signing_in', 'true');
          safeLocalStorage.setItem('kelimesavasi_is_registered', 'true');
          safeLocalStorage.setItem('saved_username', cleanName);
        } catch (e) {
          console.warn(e);
        }

        // 2. Register with Email/Password
        const firebaseUser = await registerWithEmailAndPassword(email, password);
        const deviceId = safeLocalStorage.getItem('kelimesavasi_device_id') || '';
        const deviceProfile = await fetchUserProfileByDeviceId(deviceId);
        const cachedProfileStr = safeLocalStorage.getItem('kelimesavasi_profile');
        let cachedProfile: UserProfile | null = null;
        if (cachedProfileStr) {
          try { cachedProfile = JSON.parse(cachedProfileStr); } catch (e) {}
        }
        
        const mergedProfile = createOrMergeProfile(
          { id: firebaseUser.uid, name: cleanName, avatarUrl: selectedAvatar, nameSet: true, deviceId },
          deviceProfile,
          cachedProfile
        );

        try {
          safeLocalStorage.setItem('kelimesavasi_profile', JSON.stringify(mergedProfile));
          safeLocalStorage.setItem('saved_username', cleanName);
          safeLocalStorage.setItem('kelimesavasi_is_registered', 'true');
        } catch (e) {}

        saveUserProfileToFirestore(mergedProfile).catch((err) => {
          console.warn('Firestore register profile save warning:', err);
        });

        onAuthComplete(mergedProfile, firebaseUser);

      } else if (mode === 'login') {
        try {
          safeLocalStorage.setItem('kelimesavasi_is_registered', 'true');
        } catch (e) {}
        // 3. Login with Email/Password
        const firebaseUser = await loginWithEmailAndPassword(email, password);
        
        // Fetch existing profile from Firestore and merge with device / local profile if any
        const fetchedProfile = await fetchUserProfile(firebaseUser.uid);
        const deviceId = safeLocalStorage.getItem('kelimesavasi_device_id') || '';
        const deviceProfile = await fetchUserProfileByDeviceId(deviceId);
        const cachedProfileStr = safeLocalStorage.getItem('kelimesavasi_profile');
        let cachedProfile: UserProfile | null = null;
        if (cachedProfileStr) {
          try { cachedProfile = JSON.parse(cachedProfileStr); } catch (e) {}
        }
        
        const mergedProfile = createOrMergeProfile(
          fetchedProfile,
          { id: firebaseUser.uid, name: firebaseUser.email?.split('@')[0] || 'Oyuncu', avatarUrl: '🧠', nameSet: true, deviceId },
          deviceProfile,
          cachedProfile
        );
        
        safeLocalStorage.setItem('kelimesavasi_profile', JSON.stringify(mergedProfile));
        if (mergedProfile.name) safeLocalStorage.setItem('saved_username', mergedProfile.name);
        saveUserProfileToFirestore(mergedProfile).catch(err => console.warn(err));
        onAuthComplete(mergedProfile, firebaseUser);
      }
    } catch (err: any) {
      try {
        safeLocalStorage.removeItem('kelimesavasi_signing_in');
      } catch (e) {}
      console.error('Auth error:', err);
      setFirebaseError(getFirebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };



  if (pendingCredential) {
    return (
      <div className="w-full max-w-md mx-auto card-theme rounded-[2.5rem] border border-[#3E485A]/30 p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col gap-5 animate-scale-up" id="auth-linking-card">
        {/* Glows */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center space-y-2 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center mx-auto text-2xl shadow-lg shadow-amber-500/15">
            ⚠️
          </div>
          <h2 className="text-lg font-serif font-semibold tracking-widest text-[#FAF6E9] uppercase">Hesap Birleştirme</h2>
          <p className="text-xs text-gray-400 leading-normal max-w-xs mx-auto">
            <b>{pendingEmail}</b> e-posta adresi ile zaten bir kullanıcı hesabınız bulunuyor. 
            Sosyal medya hesabınızı bağlayarak puanlarınızı tek hesapta toplamak için şifrenizi girin.
          </p>
        </div>

        {linkingError && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs font-semibold text-rose-300 flex items-start gap-2 animate-fade-in relative z-10">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{linkingError}</span>
          </div>
        )}

        <div className="space-y-4 text-left relative z-10">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-amber-100/60 uppercase tracking-wider block font-sans">Mevcut Şifreniz</label>
            <input
              type="password"
              placeholder="••••••"
              value={linkingPassword}
              onChange={(e) => setLinkingPassword(e.target.value)}
              className="w-full bg-[#3D4756]/40 border border-[#3E485A] rounded-2xl px-4 py-3 text-sm font-bold text-[#FAF6E9] focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/40 transition"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={async () => {
                if (!linkingPassword) {
                  setLinkingError('Lütfen şifrenizi girin.');
                  return;
                }
                setIsLinking(true);
                setLinkingError(null);
                try {
                  // 1. Sign in with the existing account
                  const user = await loginWithEmailAndPassword(pendingEmail, linkingPassword);
                  // 2. Link the credential
                  await linkWithCredential(user, pendingCredential);
                  
                  // 3. Sync profile
                  const profile = await fetchUserProfile(user.uid);
                  if (profile) {
                    onAuthComplete(profile, user);
                  } else {
                    const fallbackProfile: UserProfile = {
                      id: user.uid,
                      name: user.displayName || pendingEmail.split('@')[0] || 'Oyuncu',
                      avatarUrl: user.photoURL || '🧠',
                      stats: {
                        gamesPlayed: 0,
                        gamesWon: 0,
                        currentStreak: 0,
                        maxStreak: 0,
                        winDistribution: [0, 0, 0, 0, 0, 0],
                      },
                      badges: [],
                      missions: [],
                      dailyScore: 0,
                      lastUpdated: new Date().toISOString(),
                      nameSet: true
                    };
                    await saveUserProfileToFirestore(fallbackProfile);
                    onAuthComplete(fallbackProfile, user);
                  }
                } catch (err: any) {
                  console.error('Account linking error:', err);
                  if (err.code?.includes('wrong-password') || err.code?.includes('invalid-credential')) {
                    setLinkingError('Hatalı şifre girdiniz.');
                  } else {
                    setLinkingError(err.message || 'Hesaplar birleştirilemedi. Lütfen tekrar deneyin.');
                  }
                } finally {
                  setIsLinking(false);
                }
              }}
              disabled={isLinking}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs py-3.5 px-4 rounded-xl transition shadow-md active:scale-95 flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer border border-emerald-500/20"
            >
              {isLinking ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Hesapları Güvenle Birleştir'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setPendingCredential(null);
                setPendingEmail('');
                setLinkingPassword('');
                setLinkingError(null);
              }}
              disabled={isLinking}
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs py-3.5 px-4 rounded-xl transition active:scale-95 uppercase cursor-pointer border border-white/5"
            >
              İptal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md md:max-w-[90%] lg:max-w-[85%] xl:max-w-[1000px] mx-auto card-theme rounded-[2.5rem] border border-[#3E485A]/30 p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col gap-6 animate-scale-up" id="auth-screen-card">
      {/* Ambient glow inside the card */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="text-center relative z-10 space-y-1">
        <div className="relative flex justify-center pb-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 text-3xl">
            ⚔️
          </div>
          <span className="absolute top-0 right-[40%] text-amber-200 animate-pulse text-xs">✦</span>
        </div>
        <h1 className="text-2xl font-serif font-medium tracking-widest text-[#FAF6E9] uppercase">
          KELİME SAVAŞI
        </h1>
        <p className="text-xs text-gray-400 font-medium max-w-xs mx-auto">
          {mode === 'guest' && 'Sadece bir takma ad belirleyerek hemen misafir olarak başla!'}
          {mode === 'register' && 'E-posta ile kayıt ol, tüm puanlarını ve rütbeni koruma altına al!'}
          {mode === 'login' && 'Eski rütbelerin, puanların ve profil bilgilerinle kaldığın yerden devam et!'}
        </p>
      </div>

      {/* Auth Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 bg-[#232B39]/80 p-1.5 rounded-2xl border border-white/5 relative z-10 gap-1.5">
        <button
          type="button"
          onClick={() => {
            setMode('guest');
            setFirebaseError(null);
            setIsTouched(false);
          }}
          className={`py-2.5 px-2 rounded-xl text-[10px] sm:text-xs font-black tracking-wider transition uppercase cursor-pointer text-center ${
            mode === 'guest' 
              ? 'bg-[#FAF6E9] text-[#2E3748] shadow-md' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Misafir Girişi
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setFirebaseError(null);
            setIsTouched(false);
          }}
          className={`py-2.5 px-2 rounded-xl text-[10px] sm:text-xs font-black tracking-wider transition uppercase cursor-pointer text-center ${
            mode === 'register' 
              ? 'bg-[#FAF6E9] text-[#2E3748] shadow-md' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Kayıt Ol
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setFirebaseError(null);
            setIsTouched(false);
          }}
          className={`py-2.5 px-2 rounded-xl text-[10px] sm:text-xs font-black tracking-wider transition uppercase cursor-pointer text-center ${
            mode === 'login' 
              ? 'bg-[#FAF6E9] text-[#2E3748] shadow-md' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Giriş Yap
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('phone');
            setPhoneStep('number');
            setPhoneError(null);
            setFirebaseError(null);
            setIsTouched(false);
          }}
          className={`py-2.5 px-2 rounded-xl text-[10px] sm:text-xs font-black tracking-wider transition uppercase cursor-pointer text-center ${
            mode === 'phone' 
              ? 'bg-[#FAF6E9] text-[#2E3748] shadow-md' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Telefonla Giriş
        </button>
      </div>

      {firebaseError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 animate-fade-in relative z-10">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
          <span>{firebaseError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 relative z-10 text-left">
        
        {mode === 'phone' ? (
          <div className="space-y-4 animate-fade-in">
            {phoneError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs font-semibold text-rose-300 flex items-start gap-2 animate-fade-in">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>{phoneError}</span>
              </div>
            )}

            {/* Hidden recaptcha element */}
            <div id="recaptcha-container" />

            {phoneStep === 'number' ? (
              <div className="space-y-4 animate-fade-in">
                {/* Optional username/avatar for new users */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-amber-100/60 uppercase tracking-wider block font-sans">
                    Kullanıcı Adı (Yeni Üye İçin - İsteğe Bağlı)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                      <User size={15} />
                    </span>
                    <input
                      type="text"
                      placeholder="Takma adınızı belirleyin..."
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-[#3D4756]/40 border border-[#3E485A] rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-[#FAF6E9] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/40 transition"
                    />
                  </div>
                </div>

                {/* Avatar selection for phone registration if new */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-bold text-amber-100/60 uppercase tracking-wider block font-sans">
                      Kullanıcı Avatarını Seç
                    </label>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        id="custom-avatar-upload-auth-phone"
                        className="hidden"
                        onChange={handleCustomAvatarUpload}
                      />
                      <label 
                        htmlFor="custom-avatar-upload-auth-phone"
                        className="text-[10px] bg-[#3D4756]/60 hover:bg-[#3D4756]/90 text-amber-200 border border-white/5 px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 transition active:scale-95 shadow-md font-bold"
                      >
                        <Sparkles size={11} className="text-amber-400" />
                        Kendi Fotoğrafını Yükle
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-4 items-center bg-[#232B39]/50 p-3 rounded-2xl border border-white/5">
                    <div className="w-14 h-14 rounded-full bg-[#3D4756] border-2 border-amber-200/60 shadow-[0_0_15px_rgba(251,191,36,0.25)] flex items-center justify-center text-2xl overflow-hidden shrink-0">
                      <UserAvatar avatarUrl={selectedAvatar} fallbackIcon="🧠" textClassName="text-2xl font-bold select-none" />
                    </div>
                    <div className="flex-1 overflow-x-auto py-1 flex gap-2 scrollbar-none">
                      {AVATAR_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setSelectedAvatar(preset)}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition duration-150 shrink-0 active:scale-90 hover:bg-white/10 ${
                            selectedAvatar === preset 
                              ? 'bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-900 scale-105 shadow-md' 
                              : 'bg-[#2E3748]/50 text-white border border-white/5'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-amber-100/60 uppercase tracking-wider block font-sans">
                    Telefon Numaranız
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                      <Smartphone size={15} />
                    </span>
                    <input
                      type="tel"
                      placeholder="+905001112233"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                      className="w-full bg-[#3D4756]/40 border border-[#3E485A] rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-[#FAF6E9] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/40 transition"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="w-full bg-[#FAF6E9] hover:bg-[#F3EFE0] active:scale-[0.98] active:translate-y-0.5 text-[#2E3748] font-black text-sm py-4 px-6 rounded-2xl shadow-[0_4px_0_#D9D4C3,0_6px_10px_rgba(0,0,0,0.15)] disabled:opacity-50 transition-all flex items-center justify-center uppercase tracking-wider cursor-pointer border border-[#EBE6D5] mt-4"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Smartphone size={15} className="mr-2 text-[#2E3748]" />
                      <span>Doğrulama Kodu Gönder</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-amber-100/60 uppercase tracking-wider block font-sans">
                    Doğrulama Kodu (OTP)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    required
                    className="w-full bg-[#3D4756]/40 border border-[#3E485A] rounded-2xl px-4 py-3 text-sm font-bold text-[#FAF6E9] tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/40 transition"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={loading}
                    className="flex-grow bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs py-4 px-4 rounded-2xl transition shadow-md active:scale-95 flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer border border-emerald-500/20"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Kodu Doğrula'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPhoneStep('number');
                      setOtpCode('');
                    }}
                    disabled={loading}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs py-4 px-4 rounded-2xl transition active:scale-95 uppercase cursor-pointer border border-white/5"
                  >
                    Tekrar Dene
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Username field (Guest & Register mode) */}
            {(mode === 'guest' || mode === 'register') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-amber-100/60 uppercase tracking-wider block font-sans">
                    Kullanıcı Adın (Username)
                  </label>
                  {isCheckingUsername && (
                    <span className="text-[10px] text-amber-300 font-semibold animate-pulse flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                      Kontrol ediliyor...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                    <User size={15} />
                  </span>
                  <input
                    type="text"
                    maxLength={26}
                    required
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setIsTouched(true);
                      setFirebaseError(null);
                    }}
                    placeholder="Kullanıcı adını belirle..."
                    className={`w-full bg-[#3D4756]/40 border ${(usernameError || dbUsernameError) ? 'border-rose-500 focus:ring-rose-400/40 focus:border-rose-400/40' : 'border-[#3E485A] focus:ring-amber-400/40 focus:border-amber-400/40'} rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-[#FAF6E9] placeholder-gray-500 focus:outline-none focus:ring-2 transition`}
                  />
                </div>
                {(usernameError || dbUsernameError) && (
                  <p className="text-xs text-rose-400 font-semibold px-1 mt-1 leading-normal animate-fade-in">
                    ⚠️ {usernameError || dbUsernameError}
                  </p>
                )}
              </div>
            )}

            {/* Email field (Login & Register mode) */}
            {(mode === 'login' || mode === 'register') && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-amber-100/60 uppercase tracking-wider block font-sans">
                  E-Posta Adresiniz
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                    <Mail size={15} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@domain.com"
                    className="w-full bg-[#3D4756]/40 border border-[#3E485A] rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-[#FAF6E9] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/40 transition"
                  />
                </div>
              </div>
            )}

            {/* Password field (Login & Register mode) */}
            {(mode === 'login' || mode === 'register') && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-amber-100/60 uppercase tracking-wider block font-sans">
                  Şifreniz
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                    <Lock size={15} />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setIsTouched(true);
                    }}
                    placeholder="••••••"
                    className={`w-full bg-[#3D4756]/40 border ${passwordError ? 'border-rose-500 focus:ring-rose-400/40 focus:border-rose-400/40' : 'border-[#3E485A] focus:ring-amber-400/40 focus:border-amber-400/40'} rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-[#FAF6E9] placeholder-gray-500 focus:outline-none focus:ring-2 transition`}
                  />
                </div>
                {passwordError ? (
                  <p className="text-xs text-rose-400 font-semibold px-1 mt-1 leading-normal">
                    ⚠️ {passwordError}
                  </p>
                ) : mode === 'register' && (
                  <p className="text-[10px] text-gray-400 px-1 mt-0.5 font-medium">
                    * Şifreniz en az 6 karakterden oluşmalı, en az bir harf ve bir sayı içermelidir.
                  </p>
                )}
              </div>
            )}

            {/* Avatar selection (Guest & Register mode) */}
            {(mode === 'guest' || mode === 'register') && (
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-bold text-amber-100/60 uppercase tracking-wider block font-sans">
                    Kullanıcı Avatarını Seç
                  </label>
                  
                  {/* Custom Image Upload Button */}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      id="custom-avatar-upload-auth"
                      className="hidden"
                      onChange={handleCustomAvatarUpload}
                    />
                    <label 
                      htmlFor="custom-avatar-upload-auth"
                      className="text-[10px] bg-[#3D4756]/60 hover:bg-[#3D4756]/90 text-amber-200 border border-white/5 px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 transition active:scale-95 shadow-md font-bold"
                    >
                      <Sparkles size={11} className="text-amber-400" />
                      Kendi Fotoğrafını Yükle
                    </label>
                  </div>
                </div>

                <div className="flex gap-4 items-center bg-[#232B39]/50 p-3 rounded-2xl border border-white/5">
                  {/* Preview */}
                  <div className="w-14 h-14 rounded-full bg-[#3D4756] border-2 border-amber-200/60 shadow-[0_0_15px_rgba(251,191,36,0.25)] flex items-center justify-center text-2xl overflow-hidden shrink-0">
                    <UserAvatar avatarUrl={selectedAvatar} fallbackIcon="🧠" textClassName="text-2xl font-bold select-none" />
                  </div>

                  {/* Presets Slider */}
                  <div className="flex-1 overflow-x-auto py-1 flex gap-2 scrollbar-none">
                    {AVATAR_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSelectedAvatar(preset)}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition duration-150 shrink-0 active:scale-90 hover:bg-white/10 ${
                          selectedAvatar === preset 
                            ? 'bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-900 scale-105 shadow-md' 
                            : 'bg-[#2E3748]/50 text-white border border-white/5'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              type="submit"
              disabled={
                loading ||
                isCheckingUsername ||
                ((mode === 'guest' || mode === 'register') && (!username.trim() || !!usernameError || !!dbUsernameError)) ||
                (mode === 'login' && (!email || !password)) ||
                (mode === 'register' && (!email || !password || !!passwordError))
              }
              className="w-full bg-[#FAF6E9] hover:bg-[#F3EFE0] active:scale-[0.98] active:translate-y-0.5 text-[#2E3748] font-black text-sm py-4 px-6 rounded-2xl shadow-[0_4px_0_#D9D4C3,0_6px_10px_rgba(0,0,0,0.15)] disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center uppercase tracking-wider cursor-pointer border border-[#EBE6D5] mt-4"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'guest' && (
                    <>
                      <Swords size={15} className="mr-2 text-[#2E3748]" />
                      <span>Misafir Olarak Oyna</span>
                    </>
                  )}
                  {mode === 'register' && (
                    <>
                      <Sparkles size={15} className="mr-2 text-amber-500 fill-amber-500" />
                      <span>Kayıt Ol ve Oyuna Başla</span>
                    </>
                  )}
                  {mode === 'login' && (
                    <>
                      <LogIn size={15} className="mr-2 text-[#2E3748]" />
                      <span>E-posta İle Giriş Yap</span>
                    </>
                  )}
                </>
              )}
            </button>
          </>
        )}

        {/* Social logins */}
        <div className="relative flex py-2 items-center" id="social-auth-separator">
          <div className="flex-grow border-t border-white/5" />
          <span className="flex-shrink mx-4 text-gray-400 text-[10px] font-black uppercase tracking-widest font-sans">Giriş Alternatifleri</span>
          <div className="flex-grow border-t border-white/5" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="social-auth-buttons">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 bg-[#182C25]/45 hover:bg-[#1E3A2F]/60 disabled:opacity-50 text-[#FAF6E9] border border-emerald-500/20 hover:border-emerald-400/40 rounded-2xl py-3 px-4 text-xs font-black uppercase tracking-wider transition active:scale-95 shadow-md cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 14.97 1 12 1 7.35 1 3.39 3.65 1.43 7.5l3.8 2.94C6.18 7.02 8.84 5.04 12 5.04z"
              />
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.45h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.97 3.75-4.87 3.75-8.49z"
              />
              <path
                fill="#FBBC05"
                d="M5.23 14.94c-.23-.69-.36-1.42-.36-2.19 0-.77.13-1.5.36-2.19L1.43 7.5C.52 9.32 0 11.36 0 13.5s.52 4.18 1.43 6l3.8-2.94-.36-1.62z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.1.74-2.51 1.18-4.3 1.18-3.16 0-5.82-1.98-6.77-4.9l-3.8 2.94C3.39 20.35 7.35 23 12 23z"
              />
            </svg>
            <span>Google ile Giriş</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPhoneError(null);
              setMode('phone');
              setPhoneStep('number');
            }}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 bg-[#182C25]/45 hover:bg-[#1E3A2F]/60 disabled:opacity-50 text-[#FAF6E9] border border-emerald-500/20 hover:border-emerald-400/40 rounded-2xl py-3 px-4 text-xs font-black uppercase tracking-wider transition active:scale-95 shadow-md cursor-pointer"
          >
            <Smartphone size={14} className="text-amber-400 shrink-0" />
            <span>Telefon ile Giriş</span>
          </button>
        </div>

      </form>

      {/* Google Play Compliance Privacy Policy Link */}
      <div className="mt-6 text-center animate-fade-in relative z-10">
        <button
          type="button"
          onClick={() => setIsPrivacyOpen(true)}
          className="text-[10px] text-slate-400 hover:text-amber-400 font-bold tracking-wider uppercase underline decoration-dashed underline-offset-4 transition cursor-pointer"
        >
          Gizlilik Politikası ve Kullanım Koşulları
        </button>
      </div>

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
    </div>
  );
}
