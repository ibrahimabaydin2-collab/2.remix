import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sliders, 
  Palette, 
  Layout, 
  Volume2, 
  VolumeX, 
  Check, 
  Smartphone, 
  Sun, 
  Moon, 
  BarChart2, 
  Type, 
  User, 
  Edit2, 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  Key, 
  Bell, 
  Sparkles,
  Wifi,
  LogOut,
  Zap
} from 'lucide-react';
import { UserProfile, NetworkLogEntry, isImageUrl } from '../types';
import { validateUsername, validatePassword } from '../utils/usernameValidation';
import PrivacyPolicyModal from './PrivacyPolicyModal';
import { 
  auth, 
  db,
  signOutUser,
  linkGuestToEmailAndPassword, 
  sendVerificationEmail,
  linkGuestWithGoogle,
  PhoneAuthProvider,
  RecaptchaVerifier,
  linkWithCredential,
  checkUsernameExists
} from '../lib/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

export interface AppSettings {
  boardTheme: 'classic' | 'ocean' | 'neon' | 'autumn' | 'pastel';
  bgTheme: 'default' | 'sapphire' | 'forest' | 'amethyst' | 'nord';
  keyboardLayout: 'Q' | 'F';
  soundEnabled: boolean;
  hapticEnabled: boolean;
  fontFamily?: 'poppins' | 'montserrat' | 'fredoka' | 'inter' | 'pacifico' | 'roboto-mono';
  notificationEnabled?: boolean;
  lowLatencyMode?: boolean;
}

interface SettingsModalProps {
  settings: AppSettings;
  onChangeSettings: (newSettings: AppSettings) => void;
  onClose: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  onOpenStats?: () => void;
  profile: UserProfile | null;
  onUpdateProfile: (name: string, avatarUrl?: string) => void;
  networkLogs?: NetworkLogEntry[];
  onReconnect?: () => void;
  onSignOut?: () => void;
}

type TabType = 'account' | 'appearance' | 'preferences';

export default function SettingsModal({
  settings,
  onChangeSettings,
  onClose,
  darkMode,
  onToggleDarkMode,
  onOpenStats,
  profile,
  onUpdateProfile,
  networkLogs = [],
  onReconnect,
  onSignOut
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('account');
  const [isPrivacyOpen, setIsPrivacyOpen] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>(profile?.name || '');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(profile?.avatarUrl || '🧠');

  // Keep local fields dynamically synchronized with central profile state
  useEffect(() => {
    if (profile?.avatarUrl) {
      setSelectedAvatar(profile.avatarUrl);
    }
    if (profile?.name) {
      setEditName(profile.name);
    }
  }, [profile?.avatarUrl, profile?.name]);
  const [showAvatarPresets, setShowAvatarPresets] = useState<boolean>(false);
  const [isTouched, setIsTouched] = useState<boolean>(false);
  const [dbUsernameError, setDbUsernameError] = useState<string | null>(null);
  const [isCheckingName, setIsCheckingName] = useState<boolean>(false);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);
  const [confirmSignOut, setConfirmSignOut] = useState<boolean>(false);

  const handleSignOutAction = async () => {
    setIsSigningOut(true);
    try {
      if (onSignOut) {
        await onSignOut();
      } else {
        try {
          window.localStorage.removeItem('kelimesavasi_profile');
          window.localStorage.removeItem('saved_username');
          window.localStorage.removeItem('kelimesavasi_is_registered');
          window.localStorage.removeItem('kelimesavasi_entered');
          window.localStorage.removeItem('kelimesavasi_signing_in');
          window.localStorage.removeItem('pending_restoration_profile');
          window.localStorage.setItem('kelimesavasi_just_signed_out', 'true');
        } catch (e) {}
        await signOutUser();
        onClose();
      }
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setIsSigningOut(false);
      setConfirmSignOut(false);
    }
  };

  // Account Security state
  const [secureEmail, setSecureEmail] = useState<string>('');
  const [securePassword, setSecurePassword] = useState<string>('');
  const [securePasswordConfirm, setSecurePasswordConfirm] = useState<string>('');
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [resendingVerification, setResendingVerification] = useState<boolean>(false);
  const [verificationSent, setVerificationSent] = useState<boolean>(false);

  // Phone Linking state
  const [selectedLinkMethod, setSelectedLinkMethod] = useState<'none' | 'phone' | 'email' | 'google'>('none');
  const [linkPhone, setLinkPhone] = useState<string>('+90');
  const [linkOtp, setLinkOtp] = useState<string>('');
  const [phoneStep, setPhoneStep] = useState<'number' | 'otp'>('number');
  const [phoneVerificationId, setPhoneVerificationId] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState<boolean>(false);

  // Database Purge state
  const [isClearingDb, setIsClearingDb] = useState<boolean>(false);
  const [clearDbMessage, setClearDbMessage] = useState<string | null>(null);
  const [clearDbError, setClearDbError] = useState<string | null>(null);

  const handlePurgeUsersDatabase = async () => {
    if (!window.confirm('Firestore "users" koleksiyonundaki tüm eski/hayalet oyuncu profillerini tamamen silmek istediğinizden emin misiniz? (Kendi profiliniz korunacak ve arkadaş listeleri sıfırlanacaktır)')) {
      return;
    }

    setIsClearingDb(true);
    setClearDbError(null);
    setClearDbMessage('Kullanıcı listesi alınıyor...');

    try {
      const usersCol = collection(db, 'users');
      const querySnapshot = await getDocs(usersCol);
      
      if (querySnapshot.empty) {
        setClearDbMessage('Temizlenecek eski kullanıcı bulunamadı.');
        setIsClearingDb(false);
        return;
      }

      setClearDbMessage(`${querySnapshot.size} kullanıcı bulundu, temizleniyor...`);
      
      const currentUid = auth.currentUser?.uid;
      const batch = writeBatch(db);
      let deletedCount = 0;

      querySnapshot.forEach((docSnap) => {
        if (docSnap.id !== currentUid) {
          batch.delete(docSnap.ref);
          deletedCount++;
        } else {
          // Clear current user's friends to avoid broken/stale friend requests/links
          batch.update(docSnap.ref, { friends: [] });
        }
      });

      await batch.commit();
      
      setClearDbMessage(`Başarılı! ${deletedCount} eski/hayalet kullanıcı temizlendi, arkadaş listeleri sıfırlandı.`);
      
      // Update local profile state immediately if needed or trigger profile update
      if (currentUid && profile) {
        onUpdateProfile(profile.name, profile.avatarUrl);
      }
    } catch (err: any) {
      console.error('Failed to clear users database:', err);
      setClearDbError(err.message || 'Sıfırlama işlemi başarısız oldu.');
    } finally {
      setIsClearingDb(false);
    }
  };

  const currentUser = auth.currentUser;
  const isAnonymous = currentUser ? currentUser.isAnonymous : true;
  const isPhone = currentUser?.providerData?.some(p => p.providerId === 'phone') || !!currentUser?.phoneNumber;
  const isGoogle = currentUser?.providerData?.some(p => p.providerId === 'google.com') || false;
  const isEmail = !isAnonymous && !isGoogle && !isPhone;

  const formatPhoneNumber = (num: string | null | undefined) => {
    if (!num) return 'Bilinmeyen Numara';
    if (num.length >= 7) {
      return num.substring(0, 4) + ' ' + num.substring(4, 7) + ' *** ' + num.substring(num.length - 2);
    }
    return num;
  };

  const handleSendPhoneOtp = async () => {
    setSecurityError(null);
    setSecuritySuccess(null);
    setPhoneLoading(true);

    try {
      const formattedPhone = linkPhone.trim();
      if (!formattedPhone.startsWith('+')) {
        setSecurityError('Lütfen ülke kodu ile birlikte giriniz (Örn: +905001112233).');
        setPhoneLoading(false);
        return;
      }

      // Initialize Recaptcha
      let verifier = (window as any).recaptchaVerifier;
      if (!verifier) {
        verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {},
          'expired-callback': () => {}
        });
        (window as any).recaptchaVerifier = verifier;
      }

      const phoneProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneProvider.verifyPhoneNumber(formattedPhone, verifier);
      setPhoneVerificationId(verificationId);
      setPhoneStep('otp');
      setSecuritySuccess('Doğrulama kodu telefonunuza gönderildi!');
    } catch (err: any) {
      console.error('Phone link OTP error:', err);
      let msg = err.message || 'Kod gönderilemedi.';
      if (err.code === 'auth/invalid-phone-number') {
        msg = 'Geçersiz telefon numarası formatı.';
      }
      setSecurityError(msg);
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
          (window as any).recaptchaVerifier = null;
        } catch (clearErr) {}
      }
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    setSecurityError(null);
    setSecuritySuccess(null);
    setPhoneLoading(true);

    try {
      if (!phoneVerificationId) {
        setSecurityError('Oturum zaman aşımına uğradı, lütfen tekrar deneyin.');
        setPhoneLoading(false);
        return;
      }

      const credential = PhoneAuthProvider.credential(phoneVerificationId, linkOtp.trim());
      if (!auth.currentUser) {
        throw new Error('Aktif kullanıcı bulunamadı.');
      }
      
      await linkWithCredential(auth.currentUser, credential);
      setSecuritySuccess('Hesabınız başarıyla telefon numaranızla eşleştirildi! 🎉');
      setLinkPhone('+90');
      setLinkOtp('');
      setPhoneStep('number');
      setPhoneVerificationId(null);
      setSelectedLinkMethod('none');
    } catch (err: any) {
      console.error('Phone link verification error:', err);
      let msg = err.message || 'Kod doğrulanamadı.';
      if (err.code === 'auth/invalid-verification-code') {
        msg = 'Girdiğiniz doğrulama kodu hatalı veya süresi dolmuş.';
      } else if (err.code === 'auth/credential-already-in-use') {
        msg = 'Bu telefon numarası zaten başka bir hesaba bağlı.';
      }
      setSecurityError(msg);
    } finally {
      setPhoneLoading(false);
    }
  };

  const error = (isTouched || editName !== profile?.name ? validateUsername(editName, [], profile?.id || '') : null) || dbUsernameError;

  const AVATAR_PRESETS = [
    '⚔️', '🧠', '🐺', '🦁', '🧙‍♂️', '🦊', 
    '👾', '🦄', '⚡', '👑', '🎯', '🚀', 
    '🔥', '🐉', '🐼', '🛡️', '🏆', '🦉'
  ];

  const handleSaveProfile = async (): Promise<boolean> => {
    setIsTouched(true);
    setDbUsernameError(null);
    const validationError = validateUsername(editName, [], profile?.id || '');
    if (validationError) return false;

    if (editName.trim() && editName.trim() !== profile?.name) {
      setIsCheckingName(true);
      try {
        const exists = await checkUsernameExists(editName.trim(), profile?.id || '');
        if (exists) {
          setDbUsernameError('Bu kullanıcı adı daha önce alınmıştır, lütfen başka bir tane seçin.');
          setIsCheckingName(false);
          return false;
        }
      } catch (err) {
        console.error('Error checking username uniqueness:', err);
      } finally {
        setIsCheckingName(false);
      }
    }

    if (editName.trim() && (editName.trim() !== profile?.name || selectedAvatar !== profile?.avatarUrl)) {
      onUpdateProfile(editName.trim(), selectedAvatar);
    }
    return true;
  };

  const handleCustomAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
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
            setSelectedAvatar(dataUrl);
            onUpdateProfile(editName.trim() || profile?.name || 'Oyuncu', dataUrl);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onChangeSettings({
      ...settings,
      [key]: value
    });
  };

  const boardThemes = [
    { id: 'classic', name: 'Klasik Yeşil', desc: 'Yeşil, Turuncu, Gri', preview: ['bg-emerald-500', 'bg-amber-500', 'bg-gray-400'] },
    { id: 'ocean', name: 'Okyanus Mavisi', desc: 'Mavi, Gök Mavisi, Koyu Gri', preview: ['bg-blue-600', 'bg-sky-400', 'bg-slate-400'] },
    { id: 'neon', name: 'Neon Rüya', desc: 'Fuya, Camgöbeği, Koyu Gri', preview: ['bg-fuchsia-500', 'bg-cyan-400', 'bg-zinc-600'] },
    { id: 'autumn', name: 'Sıcak Sonbahar', desc: 'Kızıl, Turuncu, Kahve', preview: ['bg-orange-600', 'bg-amber-600', 'bg-stone-500'] },
    { id: 'pastel', name: 'Şirin Pastel', desc: 'Yumuşak Tonlar', preview: ['bg-teal-300', 'bg-rose-300', 'bg-slate-200'] },
  ];

  const bgThemes = [
    { id: 'default', name: 'Standart Gri', class: 'bg-slate-100 dark:bg-slate-900 border-slate-300' },
    { id: 'sapphire', name: 'Safir Gece', class: 'bg-gradient-to-r from-blue-900 to-indigo-950 border-blue-800' },
    { id: 'forest', name: 'Zümrüt Ormanı', class: 'bg-gradient-to-r from-emerald-900 to-teal-950 border-emerald-800' },
    { id: 'amethyst', name: 'Mistik Mor', class: 'bg-gradient-to-r from-purple-900 to-fuchsia-950 border-purple-800' },
    { id: 'nord', name: 'Nord Kuzey', class: 'bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 border-slate-400' },
  ];

  // Initialize notification settings fallback
  const isNotificationOn = settings.notificationEnabled !== false;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="card-theme bg-[#161D2B] border border-amber-500/20 rounded-[2.2rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all duration-300 text-white" id="app-settings-modal">
        
        {/* Header (Sticky) */}
        <div className="flex-none flex justify-between items-center px-6 pt-6 pb-4 border-b border-white/10 bg-[#161D2B]">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shadow-md shadow-amber-500/20">
              <Sliders size={18} />
            </div>
            <div className="text-left">
              <h3 className="text-base font-black text-amber-300 tracking-wide">Ayarlar</h3>
              <p className="text-[11px] text-gray-300 font-medium">Savaş alanını ve profilinizi özelleştirin</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (handleSaveProfile()) {
                onClose();
              }
            }}
            className="p-1.5 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation (Sticky) */}
        <div className="flex-none bg-[#101520] border-b border-white/10 px-4 py-1.5 flex gap-1">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 py-2 px-1 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'account'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <User size={14} />
            <span className="hidden sm:inline">Hesabım</span>
            <span className="sm:hidden text-[10px]">Hesap</span>
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex-1 py-2 px-1 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'appearance'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Palette size={14} />
            <span className="hidden sm:inline">Görünüm</span>
            <span className="sm:hidden text-[10px]">Görünüm</span>
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex-1 py-2 px-1 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'preferences'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Sliders size={14} />
            <span className="hidden sm:inline">Tercihler</span>
            <span className="sm:hidden text-[10px]">Tercih</span>
          </button>
        </div>

        {/* Main Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5" id="settings-scroll-container">
          
          {/* TAB 1: HESABIM */}
          {activeTab === 'account' && (
            <div className="space-y-4 animate-fade-in">
              
              {/* Card 1: Kullanıcı Profil Ayarları */}
              <div className="inner-theme border border-theme rounded-2xl p-4.5 space-y-4 text-left shadow-md">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <User size={14} className="text-amber-400" />
                  Kullanıcı Profil Ayarları
                </h4>
                
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Avatar Selector */}
                  <div className="relative shrink-0">
                    <div 
                      onClick={() => setShowAvatarPresets(!showAvatarPresets)}
                      className="w-16 h-16 rounded-full bg-[#1E2640] border-2 border-amber-200/60 shadow-[0_0_15px_rgba(251,191,36,0.15)] flex items-center justify-center text-3xl overflow-hidden transition-transform duration-200 hover:scale-105 cursor-pointer"
                    >
                      {selectedAvatar && isImageUrl(selectedAvatar) ? (
                        <img src={selectedAvatar} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="select-none">{selectedAvatar || '🧠'}</span>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      id="settings-avatar-upload"
                      className="hidden"
                      onChange={handleCustomAvatarUpload}
                    />
                    <label 
                      htmlFor="settings-avatar-upload"
                      className="absolute -bottom-1 -right-1 bg-amber-400 hover:bg-amber-300 text-slate-950 p-1.5 rounded-full shadow-md transition cursor-pointer"
                      title="Fotoğraf Yükle"
                    >
                      <Edit2 size={10} strokeWidth={2.5} />
                    </label>
                  </div>

                  {/* Username Input */}
                  <div className="flex-1 w-full space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-amber-100/60 uppercase tracking-widest block font-sans">KULLANICI ADI</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        maxLength={26}
                        value={editName}
                        onChange={(e) => {
                          setEditName(e.target.value);
                          setIsTouched(true);
                          setDbUsernameError(null);
                        }}
                        placeholder="Kullanıcı adınızı yazın..."
                        className={`w-full sm:flex-1 bg-[#1E2640]/75 border ${error ? 'border-rose-500 focus:ring-rose-400/40' : 'border-[#2E3754] focus:ring-amber-200/40'} rounded-xl px-4 py-2 text-xs font-bold text-[#FAF6E9] placeholder-gray-500 focus:outline-none focus:ring-2 transition`}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          setIsTouched(true);
                          const success = await handleSaveProfile();
                          if (success) {
                            setIsTouched(false);
                          }
                        }}
                        disabled={!editName.trim() || !!error || isCheckingName || editName.trim() === profile?.name}
                        className="w-full sm:w-auto px-4 py-2 bg-[#FAF6E9] hover:bg-[#F3EFE0] disabled:opacity-50 text-[#2E3748] text-xs font-black rounded-xl shadow-md transition active:scale-95 cursor-pointer shrink-0"
                      >
                        {isCheckingName ? 'Kontrol...' : 'Güncelle'}
                      </button>
                    </div>
                    {error && (
                      <p className="text-[11px] text-rose-400 font-semibold px-1 mt-1 animate-fade-in text-left leading-normal">
                        ⚠️ {error}
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick Avatar Presets grid */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowAvatarPresets(!showAvatarPresets)}
                    className="text-[10px] text-amber-200 hover:text-amber-100 flex items-center gap-1 font-bold transition focus:outline-none"
                  >
                    <span>{showAvatarPresets ? '✦ Presets Kapat' : '✦ Preset Avatar Seç...'}</span>
                  </button>
                  
                  {showAvatarPresets && (
                    <div className="grid grid-cols-6 gap-2 p-2.5 bg-black/35 rounded-xl border border-[#2E3754] max-h-24 overflow-y-auto animate-fade-in">
                      {AVATAR_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setSelectedAvatar(preset);
                            onUpdateProfile(editName.trim() || profile?.name || 'Oyuncu', preset);
                          }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition duration-150 active:scale-90 hover:bg-white/10 ${
                            selectedAvatar === preset 
                              ? 'bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-900 scale-105 shadow' 
                              : ''
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Hesap Güvenliği & Koruma */}
              <div className="inner-theme border border-theme rounded-2xl p-4.5 space-y-4 text-left shadow-md">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Shield size={14} className="text-amber-400" />
                  Hesap Güvenliği & Giriş Bilgileri
                </h4>

                {securityError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-semibold text-rose-300 leading-normal animate-fade-in">
                    ⚠️ {securityError}
                  </div>
                )}

                {securitySuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-semibold text-emerald-300 leading-normal animate-fade-in">
                    🎉 {securitySuccess}
                  </div>
                )}

                {auth.currentUser ? (
                  !isAnonymous ? (
                    /* Connected Mode */
                    <div className="space-y-3">
                      {isPhone && (
                        <div className="flex items-center justify-between bg-black/25 p-3.5 rounded-xl border border-amber-500/20">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-amber-100/50 uppercase tracking-wider font-sans">GİRİŞ YÖNTEMİ</p>
                            <p className="text-xs font-black text-amber-400">Telefon Numarası ile Giriş Yapıldı</p>
                            <p className="text-[11px] text-gray-300 font-mono select-all truncate max-w-[200px] sm:max-w-[320px]">{formatPhoneNumber(currentUser?.phoneNumber)}</p>
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">
                            <CheckCircle2 size={12} />
                            <span>Bağlı</span>
                          </div>
                        </div>
                      )}

                      {isEmail && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between bg-black/25 p-3.5 rounded-xl border border-amber-500/20">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-amber-100/50 uppercase tracking-wider font-sans">GİRİŞ YÖNTEMİ</p>
                              <p className="text-xs font-black text-amber-400">E-posta ile Giriş Yapıldı</p>
                              <p className="text-[11px] text-gray-300 font-mono select-all truncate max-w-[200px] sm:max-w-[320px]">{currentUser?.email}</p>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">
                              <CheckCircle2 size={12} />
                              <span>Bağlı</span>
                            </div>
                          </div>

                          {currentUser?.emailVerified ? (
                            <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-3 rounded-xl text-xs font-semibold">
                              <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
                              <div>
                                <p className="font-bold text-emerald-200">🟢 Doğrulanmış Üye</p>
                                <p className="text-[10px] text-emerald-300/80 mt-0.5 leading-normal">Hesabınız tamamen doğrulanmış ve veri kurtarma havuzuna eklenmiştir.</p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-xl text-xs font-semibold">
                                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                                <div>
                                  <p className="font-bold text-rose-200">🟡 E-posta Doğrulanmamış</p>
                                  <p className="text-[10px] text-rose-300/80 mt-0.5 font-medium leading-normal">E-postanız doğrulanana kadar hesap kurtarma havuzuna tam dahil edilmezsiniz.</p>
                                </div>
                              </div>
                              
                              <button
                                type="button"
                                disabled={resendingVerification || verificationSent}
                                onClick={async () => {
                                  setResendingVerification(true);
                                  setSecurityError(null);
                                  try {
                                    await sendVerificationEmail();
                                    setVerificationSent(true);
                                  } catch (err: any) {
                                    setSecurityError(err.message || 'Doğrulama e-postası gönderilemedi.');
                                  } finally {
                                    setResendingVerification(false);
                                  }
                                }}
                                className="w-full py-2.5 px-3 bg-[#FAF6E9] hover:bg-[#F3EFE0] disabled:opacity-50 text-slate-900 text-xs font-black rounded-xl transition shadow-md active:scale-95 flex items-center justify-center uppercase tracking-wider cursor-pointer border border-[#EBE6D5]"
                              >
                                {resendingVerification ? 'Gönderiliyor...' : verificationSent ? 'Doğrulama E-postası Gönderildi ✔' : 'Doğrulama E-postası Gönder'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {isGoogle && (
                        <div className="flex items-center justify-between bg-black/25 p-3.5 rounded-xl border border-amber-500/20">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-amber-100/50 uppercase tracking-wider font-sans">GİRİŞ YÖNTEMİ</p>
                            <p className="text-xs font-black text-amber-400">Google Hesabı ile Giriş Yapıldı</p>
                            <p className="text-[11px] text-gray-300 font-mono select-all truncate max-w-[200px] sm:max-w-[320px]">{currentUser?.email}</p>
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-[#EBE6D5]/20 text-emerald-400 text-[10px] font-black uppercase">
                            <CheckCircle2 size={12} />
                            <span>Bağlı</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Anonymous / Guest Mode (Needs Protection) */
                    <div className="space-y-4">
                      <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 p-3.5 rounded-xl text-xs font-semibold">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                        <div>
                          <p className="font-bold text-amber-200">Geçici Misafir Profili</p>
                          <p className="text-[10px] text-amber-300/80 mt-0.5 font-medium leading-normal">Oyunu sildiğinizde veya başka cihazdan giriş yaptığınızda puanlarınız kaybolabilir! Hesabınızı koruma altına alın.</p>
                        </div>
                      </div>

                      {/* Stacked / Accordion options for linking */}
                      <div className="space-y-2.5">
                        
                        {/* 1. TELEFON BAĞLAMA BUTONU / AKORDİYONU */}
                        <div className="border border-[#2E3754] rounded-xl overflow-hidden bg-black/10">
                          <button
                            type="button"
                            onClick={() => setSelectedLinkMethod(selectedLinkMethod === 'phone' ? 'none' : 'phone')}
                            className="w-full px-4 py-3 bg-[#1E2640]/50 hover:bg-[#1E2640] text-left flex items-center justify-between text-xs font-bold text-amber-100/90 transition"
                          >
                            <span className="flex items-center gap-2">
                              <Smartphone size={14} className="text-amber-400 animate-pulse" />
                              Telefon Numarası ile Bağla
                            </span>
                            <span className="text-[10px] text-amber-400/60 font-semibold font-mono">
                              {selectedLinkMethod === 'phone' ? '▲ Kapat' : '▼ Aç'}
                            </span>
                          </button>

                          {selectedLinkMethod === 'phone' && (
                            <div className="p-4 bg-black/20 border-t border-[#2E3754] space-y-3 animate-fade-in text-left">
                              <p className="text-[10px] text-gray-300 leading-normal">
                                Telefon numaranızı kullanarak hesabınızı doğrulayın ve dilediğiniz cihazdan giriş yapın.
                              </p>
                              
                              {phoneStep === 'number' ? (
                                <div className="space-y-3">
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-amber-100/50 uppercase tracking-widest block font-sans">TELEFON NUMARASI</label>
                                    <input
                                      type="tel"
                                      placeholder="+905001112233"
                                      value={linkPhone}
                                      onChange={(e) => setLinkPhone(e.target.value)}
                                      className="w-full bg-[#1E2640]/75 border border-[#2E3754] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#FAF6E9] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-200/40"
                                    />
                                  </div>
                                  
                                  <div id="recaptcha-container" className="my-1"></div>

                                  <button
                                    type="button"
                                    disabled={phoneLoading || !linkPhone}
                                    onClick={handleSendPhoneOtp}
                                    className="w-full py-2.5 px-4 bg-[#FAF6E9] hover:bg-[#F3EFE0] disabled:opacity-50 text-slate-900 text-xs font-black rounded-xl transition shadow-md active:scale-95 flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer border border-[#EBE6D5]"
                                  >
                                    {phoneLoading ? (
                                      <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      'Kod Gönder'
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-amber-100/50 uppercase tracking-widest block font-sans">DOĞRULAMA KODU (OTP)</label>
                                    <input
                                      type="text"
                                      maxLength={6}
                                      placeholder="123456"
                                      value={linkOtp}
                                      onChange={(e) => setLinkOtp(e.target.value)}
                                      className="w-full bg-[#1E2640]/75 border border-[#2E3754] rounded-xl px-3.5 py-2.5 text-xs font-bold text-center tracking-widest text-[#FAF6E9] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-200/40"
                                    />
                                  </div>

                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setPhoneStep('number')}
                                      className="flex-1 py-2.5 px-4 bg-[#2E3754] hover:bg-[#3E4A6F] text-white text-xs font-black rounded-xl transition cursor-pointer"
                                    >
                                      Geri
                                    </button>
                                    <button
                                      type="button"
                                      disabled={phoneLoading || linkOtp.length < 6}
                                      onClick={handleVerifyPhoneOtp}
                                      className="flex-[2] py-2.5 px-4 bg-[#FAF6E9] hover:bg-[#F3EFE0] disabled:opacity-50 text-slate-900 text-xs font-black rounded-xl transition shadow-md active:scale-95 flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer border border-[#EBE6D5]"
                                    >
                                      {phoneLoading ? (
                                        <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        'Kodu Doğrula ve Bağla'
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 2. E-POSTA BAĞLAMA BUTONU / AKORDİYONU */}
                        <div className="border border-[#2E3754] rounded-xl overflow-hidden bg-black/10">
                          <button
                            type="button"
                            onClick={() => setSelectedLinkMethod(selectedLinkMethod === 'email' ? 'none' : 'email')}
                            className="w-full px-4 py-3 bg-[#1E2640]/50 hover:bg-[#1E2640] text-left flex items-center justify-between text-xs font-bold text-amber-100/90 transition"
                          >
                            <span className="flex items-center gap-2">
                              <Key size={14} className="text-amber-400" />
                              E-posta ve Şifre ile Bağla
                            </span>
                            <span className="text-[10px] text-amber-400/60 font-semibold font-mono">
                              {selectedLinkMethod === 'email' ? '▲ Kapat' : '▼ Aç'}
                            </span>
                          </button>

                          {selectedLinkMethod === 'email' && (
                            <div className="p-4 bg-black/20 border-t border-[#2E3754] space-y-3.5 animate-fade-in text-left">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-amber-100/50 uppercase tracking-widest block font-sans">E-POSTA ADRESİ</label>
                                <input
                                  type="email"
                                  placeholder="ornek@domain.com"
                                  value={secureEmail}
                                  onChange={(e) => setSecureEmail(e.target.value)}
                                  className="w-full bg-[#1E2640]/75 border border-[#2E3754] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#FAF6E9] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-200/40"
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-amber-100/50 uppercase tracking-widest block font-sans">YENİ ŞİFRE</label>
                                  <input
                                    type="password"
                                    placeholder="••••••"
                                    value={securePassword}
                                    onChange={(e) => setSecurePassword(e.target.value)}
                                    className="w-full bg-[#1E2640]/75 border border-[#2E3754] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#FAF6E9] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-200/40"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-amber-100/50 uppercase tracking-widest block font-sans">ŞİFRE TEKRAR</label>
                                  <input
                                    type="password"
                                    placeholder="••••••"
                                    value={securePasswordConfirm}
                                    onChange={(e) => setSecurePasswordConfirm(e.target.value)}
                                    className="w-full bg-[#1E2640]/75 border border-[#2E3754] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#FAF6E9] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-200/40"
                                  />
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={isLinking || !secureEmail || !securePassword}
                                onClick={async () => {
                                  setSecurityError(null);
                                  setSecuritySuccess(null);
                                  
                                  const passErr = validatePassword(securePassword);
                                  if (passErr) {
                                    setSecurityError(passErr);
                                    return;
                                  }
                                  if (securePassword !== securePasswordConfirm) {
                                    setSecurityError('Şifreler uyuşmuyor.');
                                    return;
                                  }

                                  setIsLinking(true);
                                  try {
                                    await linkGuestToEmailAndPassword(secureEmail, securePassword);
                                    setSecuritySuccess('Misafir hesabınız başarıyla e-posta ile korunmuştur. Doğrulama e-postası gönderildi!');
                                    setSecureEmail('');
                                    setSecurePassword('');
                                    setSecurePasswordConfirm('');
                                    setSelectedLinkMethod('none');
                                  } catch (err: any) {
                                    console.error('Error protecting account:', err);
                                    let msg = err.message || 'Hesap eşleştirme başarısız oldu.';
                                    if (err.code?.includes('auth/email-already-in-use')) {
                                      msg = 'Bu e-posta adresi zaten kullanımda.';
                                    } else if (err.code?.includes('auth/invalid-email')) {
                                      msg = 'Geçersiz bir e-posta adresi girdiniz.';
                                    } else if (err.code?.includes('auth/weak-password')) {
                                      msg = 'Şifre çok zayıf. Lütfen en az 6 karakter girin.';
                                    }
                                    setSecurityError(msg);
                                  } finally {
                                    setIsLinking(false);
                                  }
                                }}
                                className="w-full py-2.5 px-4 bg-[#FAF6E9] hover:bg-[#F3EFE0] disabled:opacity-50 text-slate-900 text-xs font-black rounded-xl transition shadow-md active:scale-[0.98] flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer border border-[#EBE6D5]"
                              >
                                {isLinking ? (
                                  <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <Key size={12} />
                                    <span>E-posta Bağla ve Koru</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 3. GOOGLE BAĞLAMA BUTONU / AKORDİYONU */}
                        <div className="border border-[#2E3754] rounded-xl overflow-hidden bg-black/10">
                          <button
                            type="button"
                            onClick={() => setSelectedLinkMethod(selectedLinkMethod === 'google' ? 'none' : 'google')}
                            className="w-full px-4 py-3 bg-[#1E2640]/50 hover:bg-[#1E2640] text-left flex items-center justify-between text-xs font-bold text-amber-100/90 transition"
                          >
                            <span className="flex items-center gap-2">
                              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                                <path fill="#FBBC05" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.6c-.28 1.5-1.11 2.76-2.39 3.62v3h3.86c2.26-2.09 3.67-5.17 3.67-8.45z"/>
                              </svg>
                              Google Hesabı ile Bağla
                            </span>
                            <span className="text-[10px] text-amber-400/60 font-semibold font-mono">
                              {selectedLinkMethod === 'google' ? '▲ Kapat' : '▼ Aç'}
                            </span>
                          </button>

                          {selectedLinkMethod === 'google' && (
                            <div className="p-4 bg-black/20 border-t border-[#2E3754] space-y-3 animate-fade-in text-left">
                              <p className="text-[10px] text-gray-300 leading-normal">
                                Misafir hesabınızı tek tıkla Google hesabınıza bağlayarak ilerlemenizi ve başarılarınızı kalıcı olarak koruyun.
                              </p>
                              
                              <button
                                type="button"
                                onClick={async () => {
                                  setSecurityError(null);
                                  setSecuritySuccess(null);
                                  try {
                                    await linkGuestWithGoogle();
                                    setSecuritySuccess('Hesabınız başarıyla Google ile eşleştirilmiştir! 🎉');
                                    setSelectedLinkMethod('none');
                                  } catch (err: any) {
                                    if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
                                      setSecurityError('Giriş penceresi kapatıldı.');
                                      return;
                                    }
                                    if (err?.code === 'auth/popup-blocked') {
                                      setSecurityError('Açılır pencere engelleyici tarafından engellendi.');
                                      return;
                                    }
                                    console.error('Google link error:', err);
                                    let msg = err.message || 'Google ile bağlanma başarısız oldu.';
                                    if (err.code === 'auth/credential-already-in-use') {
                                      msg = 'Bu Google hesabı zaten başka bir kullanıcı profili ile eşleşmiş.';
                                    }
                                    setSecurityError(msg);
                                  }
                                }}
                                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-white hover:bg-slate-50 text-slate-900 text-xs font-black rounded-xl transition shadow active:scale-[0.98] border border-slate-200 cursor-pointer"
                              >
                                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.6c-.28 1.5-1.11 2.76-2.39 3.62v3h3.86c2.26-2.09 3.67-5.17 3.67-8.45z"/>
                                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.21v3.11C3.18 21.88 7.31 24 12 24z"/>
                                  <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.6H1.21C.44 8.13 0 9.85 0 11.7c0 1.85.44 3.57 1.21 5.1l4.06-3.11z"/>
                                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.18 2.12 1.21 5.7L5.27 8.8c.95-2.85 3.6-4.96 6.73-4.96z"/>
                                </svg>
                                <span>Google ile Bağlan</span>
                              </button>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-gray-400 font-medium">Hesap koruması için aktif bir oturum algılanamadı.</p>
                )}
              </div>

              {/* Card 3: Oturum Yönetimi & Çıkış Yap */}
              <div className="inner-theme border border-rose-500/30 bg-rose-500/10 rounded-2xl p-4.5 space-y-3 text-left shadow-md">
                <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
                  <LogOut size={14} className="text-rose-400" />
                  Oturum Yönetimi
                </h4>
                <p className="text-[11px] text-gray-300 leading-normal">
                  Mevcut oyuncu hesabınızdan çıkış yaparak giriş / kayıt ekranına dönebilirsiniz.
                </p>
                {!confirmSignOut ? (
                  <button
                    type="button"
                    onClick={() => setConfirmSignOut(true)}
                    className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl shadow-md transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer border border-rose-400/40"
                  >
                    <LogOut size={15} />
                    <span>Çıkış Yap</span>
                  </button>
                ) : (
                  <div className="p-3 bg-black/40 border border-rose-500/40 rounded-xl space-y-2">
                    <p className="text-xs font-bold text-rose-200 text-center">Hesabınızdan çıkış yapılsın mı?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSignOutAction}
                        disabled={isSigningOut}
                        className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-lg transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <LogOut size={14} />
                        <span>{isSigningOut ? 'Çıkış Yapılıyor...' : 'Evet, Çıkış Yap'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmSignOut(false)}
                        disabled={isSigningOut}
                        className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-gray-200 text-xs font-bold rounded-lg transition cursor-pointer"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: GÖRÜNÜM */}
          {activeTab === 'appearance' && (
            <div className="space-y-4 animate-fade-in">
              
              {/* Card 1: Kelime Kutucukları Teması */}
              <div className="inner-theme border border-theme rounded-2xl p-4.5 space-y-4 text-left shadow-md">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Palette size={14} className="text-amber-400" />
                  Kelime Kutucukları Teması (Tahta Rengi)
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {boardThemes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => updateSetting('boardTheme', theme.id as any)}
                      className={`text-left p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all duration-200 cursor-pointer ${
                        settings.boardTheme === theme.id
                          ? 'border-amber-500 bg-amber-500/10 text-amber-400 font-bold shadow-lg shadow-amber-500/5'
                          : 'border-[#2E3754] hover:bg-[#2E3754]/50 bg-[#242D4D]/20 text-gray-300'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <span className={`text-xs font-black block ${settings.boardTheme === theme.id ? 'text-amber-400' : 'text-slate-100'}`}>{theme.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{theme.desc}</span>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        {theme.preview.map((col, idx) => (
                          <span key={idx} className={`w-3.5 h-3.5 rounded-full ${col} shadow-sm border border-black/25 shrink-0`} />
                        ))}
                        {settings.boardTheme === theme.id && (
                          <Check size={14} className="text-amber-400 ml-1.5 self-center shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Card 2: Arka Plan Teması */}
              <div className="inner-theme border border-theme rounded-2xl p-4.5 space-y-4 text-left shadow-md">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Layout size={14} className="text-amber-400" />
                  Arka Plan Teması (Atmosfer)
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {bgThemes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => updateSetting('bgTheme', theme.id as any)}
                      className={`p-3.5 rounded-2xl border-2 flex flex-col justify-between items-center text-center gap-2 transition duration-200 min-h-[82px] relative overflow-hidden cursor-pointer ${
                        settings.bgTheme === theme.id
                          ? 'border-amber-500 bg-amber-500/5 scale-[1.03] shadow-lg shadow-amber-500/5'
                          : 'border-[#2E3754]'
                      } ${theme.class}`}
                    >
                      <span className="text-xs font-black truncate w-full text-white tracking-wide">
                        {theme.name}
                      </span>
                      
                      {settings.bgTheme === theme.id ? (
                        <span className="absolute bottom-1.5 right-1.5 bg-amber-500 text-slate-950 rounded-full p-0.5 shadow-md">
                          <Check size={10} />
                        </span>
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-white/20 border border-white/10" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card 3: Yazı Tipi Modu */}
              <div className="inner-theme border border-theme rounded-2xl p-4.5 space-y-4 text-left shadow-md">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Type size={14} className="text-amber-400" />
                  Yazı Tipi Modu (Font Selection)
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'poppins', name: 'Poppins', class: 'font-poppins', desc: 'Modern & Dengeli' },
                    { id: 'montserrat', name: 'Montserrat', class: 'font-montserrat', desc: 'Şık & Geometrik' },
                    { id: 'fredoka', name: 'Fredoka', class: 'font-fredoka', desc: 'Tombul & Eğlenceli' },
                    { id: 'inter', name: 'Inter', class: 'font-inter', desc: 'Minimalist & Net' },
                    { id: 'pacifico', name: 'Pacifico', class: 'font-pacifico', desc: 'El Yazısı Tarzı' },
                    { id: 'roboto-mono', name: 'Roboto Mono', class: 'font-roboto-mono', desc: 'Havalı Retro Kod' },
                  ].map((fontItem) => (
                    <button
                      key={fontItem.id}
                      onClick={() => updateSetting('fontFamily', fontItem.id as any)}
                      className={`p-3 rounded-xl border-2 flex flex-col justify-center items-center text-center gap-1 transition-all relative cursor-pointer ${fontItem.class} ${
                        settings.fontFamily === fontItem.id || (!settings.fontFamily && fontItem.id === 'poppins')
                          ? 'border-amber-500 bg-amber-500/10 text-amber-400 scale-[1.02] ring-2 ring-amber-500/15 font-bold shadow-md'
                          : 'border-[#2E3754] text-slate-300 hover:bg-[#2E3754]/50 bg-[#242D4D]/20'
                      }`}
                    >
                      <span className="text-xs tracking-wide">
                        {fontItem.name}
                      </span>
                      <span className="text-[9px] text-slate-400 block leading-tight font-sans">
                        {fontItem.desc}
                      </span>
                      
                      {(settings.fontFamily === fontItem.id || (!settings.fontFamily && fontItem.id === 'poppins')) && (
                        <span className="absolute top-1 right-1 bg-amber-500 text-slate-950 rounded-full p-0.5 shadow">
                          <Check size={8} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: TERCİHLER */}
          {activeTab === 'preferences' && (
            <div className="space-y-4 animate-fade-in">
              
              {/* Row: Keyboard Layout & Sound in side-by-side or stacked Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Card 1: Klavye Düzeni */}
                <div className="inner-theme border border-theme rounded-2xl p-4.5 space-y-3.5 text-left shadow-md">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Smartphone size={14} className="text-amber-400" />
                    Klavye Düzeni
                  </h4>
                  <div className="flex gap-1.5 p-1 bg-black/25 rounded-xl border border-[#2E3754]">
                    {['Q', 'F'].map((layout) => (
                      <button
                        key={layout}
                        onClick={() => updateSetting('keyboardLayout', layout as any)}
                        className={`flex-1 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                          settings.keyboardLayout === layout
                            ? 'bg-amber-500 text-slate-950 shadow font-black'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        Türkçe {layout}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card 2: Ses ve Geri Bildirim */}
                <div className="inner-theme border border-theme rounded-2xl p-4.5 space-y-3.5 text-left shadow-md">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    {settings.soundEnabled ? <Volume2 size={14} className="text-amber-400" /> : <VolumeX size={14} className="text-gray-400" />}
                    Ses ve Geri Bildirim
                  </h4>
                  <button
                    onClick={() => updateSetting('soundEnabled', !settings.soundEnabled)}
                    className={`w-full py-2.5 rounded-xl border-2 text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                      settings.soundEnabled
                        ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow'
                        : 'border-[#2E3754] text-slate-400 hover:bg-[#2E3754]/50'
                    }`}
                  >
                    {settings.soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    <span>Ses Efektleri {settings.soundEnabled ? 'Açık' : 'Kapalı'}</span>
                  </button>
                </div>

              </div>

              {/* Card 3: Görünüm Modu & Bildirim Tercihleri */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Görünüm Modu */}
                {onToggleDarkMode !== undefined && (
                  <div className="inner-theme border border-theme rounded-2xl p-4.5 space-y-3.5 text-left shadow-md">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      {darkMode ? <Moon size={14} className="text-amber-400" /> : <Sun size={14} className="text-amber-500" />}
                      Görünüm Modu
                    </h4>
                    <button
                      onClick={onToggleDarkMode}
                      className={`w-full py-2.5 rounded-xl border-2 text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                        darkMode
                          ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow'
                          : 'border-[#2E3754] text-slate-300 hover:bg-[#2E3754]/50'
                      }`}
                    >
                      {darkMode ? <Moon size={14} className="text-amber-400" /> : <Sun size={14} className="text-amber-500" />}
                      <span>{darkMode ? 'Gece Modu' : 'Gündüz Modu'}</span>
                    </button>
                  </div>
                )}

                {/* Bildirim Tercihleri (New) */}
                <div className="inner-theme border border-theme rounded-2xl p-4.5 space-y-3.5 text-left shadow-md">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Bell size={14} className={isNotificationOn ? "text-amber-400 animate-swing" : "text-gray-400"} />
                    Bildirim Tercihleri
                  </h4>
                  <button
                    onClick={() => updateSetting('notificationEnabled', !isNotificationOn)}
                    className={`w-full py-2.5 rounded-xl border-2 text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                      isNotificationOn
                        ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow'
                        : 'border-[#2E3754] text-slate-400 hover:bg-[#2E3754]/50'
                    }`}
                  >
                    <Bell size={14} />
                    <span>Oyun İçi Hatırlatıcılar {isNotificationOn ? 'Açık' : 'Kapalı'}</span>
                  </button>
                  
                  {isNotificationOn && (
                    <button
                      onClick={() => {
                        onClose();
                        // Delay slightly so the modal transitions closed before triggering the alert
                        setTimeout(() => {
                          (window as any).__simulateRetentionNotification?.();
                        }, 200);
                      }}
                      className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black tracking-wider uppercase rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                      title="3 gün boyunca oyuna girmeme durumunu test eder"
                    >
                      <Sparkles size={11} className="animate-pulse" />
                      Hareketsizlik Bildirimi Simüle Et (Test)
                    </button>
                  )}
                </div>

              </div>

              {/* Card 3.5: Düşük Gecikme Modu (Low Latency Mode) */}
              <div className="inner-theme border border-amber-500/30 bg-amber-500/5 rounded-2xl p-4.5 space-y-3.5 text-left shadow-md">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                    <Zap size={14} className="text-amber-400 animate-pulse" />
                    Düşük Gecikme Modu (Low Latency Mode)
                  </h4>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30 font-mono">
                    350ms Polling
                  </span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  Canlı düellolarda WebSocket ping süresini ve otomatik veri eşitleme (polling) sıklığını 350ms&apos;ye düşürerek rakip hamlelerini anında ekranınıza aktarır. Yüksek gecikmeli hücresel hatlarda kusursuz senkronizasyon sağlar.
                </p>
                <button
                  type="button"
                  onClick={() => updateSetting('lowLatencyMode', !(settings.lowLatencyMode ?? true))}
                  className={`w-full py-2.5 rounded-xl border-2 text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                    (settings.lowLatencyMode ?? true)
                      ? 'border-amber-500 bg-amber-500/20 text-amber-300 shadow-lg shadow-amber-500/10'
                      : 'border-[#2E3754] text-slate-400 hover:bg-[#2E3754]/50'
                  }`}
                >
                  <Zap size={14} className={(settings.lowLatencyMode ?? true) ? 'text-amber-400' : 'text-slate-400'} />
                  <span>Düşük Gecikme Modu: {(settings.lowLatencyMode ?? true) ? 'AÇIK (Ultra Hızlı 350ms)' : 'KAPALI (Standart 800ms)'}</span>
                </button>
              </div>

              {/* Card 4: İstatistikler & Rozetler (Sleek Button at the bottom of Tab 3) */}
              {onOpenStats !== undefined && (
                <div className="inner-theme border border-theme rounded-2xl p-4.5 space-y-3 text-left shadow-md">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <BarChart2 size={14} className="text-amber-400" />
                    Oyuncu İstatistikleri & Başarımlar
                  </h4>
                  <p className="text-[10px] text-slate-300/80 leading-normal">
                    Kazanma oranları, en yüksek skorlar, kelime deneme dağılımınız ve açtığınız özel ünvan ve rozetleri görüntüleyin.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenStats();
                    }}
                    className="w-full mt-1.5 py-3 px-4 rounded-xl border-2 border-dashed border-amber-500/35 hover:border-amber-500 hover:bg-amber-500/5 text-amber-400 text-xs font-black transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <BarChart2 size={14} />
                    <span>İstatistikler ve Rozetleri Aç</span>
                  </button>
                </div>
              )}

              {/* Card 5: Gizlilik Politikası ve Güvenlik (Google Play Compliance) */}
              <div className="inner-theme border border-theme rounded-2xl p-4.5 space-y-3 text-left shadow-md">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Shield size={14} className="text-amber-400 animate-pulse" />
                  Gizlilik Politikası & Güvenlik
                </h4>
                <p className="text-[10px] text-slate-300/80 leading-normal">
                  Kişisel veri güvenliğiniz, Google Play Store politikaları uyumluluğu, kamera/ses izinleri ve veri saklama koşulları hakkında ayrıntılı bilgi edinin.
                </p>
                <button
                  type="button"
                  onClick={() => setIsPrivacyOpen(true)}
                  className="w-full mt-1.5 py-3 px-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400 text-xs font-black transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Shield size={14} />
                  <span>Gizlilik Politikasını Görüntüle</span>
                </button>
              </div>

            </div>
          )}



          {/* Privacy Policy Modal */}
          <PrivacyPolicyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />

        </div>

        {/* Sticky Footer (Kaydet ve Kapat) */}
        <div className="flex-none px-6 py-4.5 border-t border-white/5 bg-black/15 flex items-center justify-between gap-3 rounded-b-[2.2rem]">
          {!confirmSignOut ? (
            <button
              type="button"
              onClick={() => setConfirmSignOut(true)}
              disabled={isSigningOut}
              className="px-4 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
              title="Hesaptan Çıkış Yap"
            >
              <LogOut size={14} />
              <span>Çıkış Yap</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSignOutAction}
                disabled={isSigningOut}
                className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0 shadow-md"
              >
                <LogOut size={13} />
                <span>{isSigningOut ? 'Çıkış...' : 'Onayla'}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmSignOut(false)}
                disabled={isSigningOut}
                className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-gray-200 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          )}

          <button
            onClick={() => {
              if (handleSaveProfile()) {
                onClose();
              }
            }}
            className="w-full sm:w-auto px-6 py-3 bg-[#FAF6E9] hover:bg-[#F3EFE0] text-[#2E3748] hover:shadow-lg hover:shadow-amber-500/5 text-xs font-black rounded-xl transition duration-200 active:scale-[0.98] cursor-pointer border border-[#EBE6D5] uppercase tracking-wider"
          >
            Değişiklikleri Kaydet
          </button>
        </div>

      </div>
    </div>
  );
}
