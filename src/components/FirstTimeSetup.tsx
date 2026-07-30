import React, { useState, useRef } from 'react';
import { Sparkles, Swords, User, Camera, Image as ImageIcon, X } from 'lucide-react';
import { UserProfile, isImageUrl } from '../types';
import { validateUsername } from '../utils/usernameValidation';
import { checkUsernameExists } from '../lib/firebase';

interface FirstTimeSetupProps {
  profile?: UserProfile | null;
  onComplete: (name: string, avatarUrl: string) => void;
  showToast?: (message: string, type?: 'info' | 'error' | 'success') => void;
}

const AVATAR_PRESETS = [
  '⚔️', '🧠', '🐺', '🦁', '🧙‍♂️', '🦊', 
  '👾', '🦄', '⚡', '👑', '🎯', '🚀', 
  '🔥', '🐉', '🐼', '🛡️', '🏆', '🦉'
];

export default function FirstTimeSetup({ profile, onComplete, showToast }: FirstTimeSetupProps) {
  const [username, setUsername] = useState<string>('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('🧠');
  const [isTouched, setIsTouched] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const checkMediaPermission = async (type: 'camera' | 'gallery'): Promise<boolean> => {
    // 1. Capacitor Camera Plugin Check (if running in hybrid / native Capacitor environment)
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      const cameraPlugin = (window as any).Capacitor?.Plugins?.Camera;
      if (cameraPlugin && typeof cameraPlugin.checkPermissions === 'function') {
        try {
          let status = await cameraPlugin.checkPermissions();
          if (type === 'camera' && (status?.camera === 'prompt' || status?.camera === 'prompt-with-rationale')) {
            status = await cameraPlugin.requestPermissions({ permissions: ['camera'] });
          } else if (type === 'gallery' && (status?.photos === 'prompt' || status?.photos === 'prompt-with-rationale')) {
            status = await cameraPlugin.requestPermissions({ permissions: ['photos'] });
          }
          
          const isDenied = type === 'camera' 
            ? status?.camera === 'denied' 
            : status?.photos === 'denied';

          if (isDenied) {
            return false;
          }
        } catch (err) {
          console.warn('Capacitor camera permission check warning:', err);
        }
      }
    }

    // 2. Web navigator.permissions API
    if (typeof navigator !== 'undefined' && navigator.permissions && typeof (navigator.permissions as any).query === 'function') {
      try {
        const permName = type === 'camera' ? 'camera' : 'photos';
        const res = await (navigator.permissions as any).query({ name: permName });
        if (res.state === 'denied') {
          return false;
        }
      } catch (e) {
        // Permission query descriptor for camera/photos might not be supported on all desktop/mobile browsers
      }
    }

    // 3. Web getUserMedia test for camera
    if (type === 'camera' && typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (camErr: any) {
        console.warn('Camera permission denied or error:', camErr);
        return false;
      }
    }

    return true;
  };

  // Debounced real-time check for username availability in database
  React.useEffect(() => {
    const trimmed = username.trim();
    setDbError(null);

    const clientErr = validateUsername(trimmed, [], profile?.id || '');
    if (clientErr || !trimmed) {
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    const timer = setTimeout(async () => {
      try {
        const exists = await checkUsernameExists(trimmed, profile?.id || '');
        if (exists) {
          setDbError('Bu kullanıcı adı daha önce alınmıştır, lütfen başka bir tane seçin.');
        } else {
          setDbError(null);
        }
      } catch (err) {
        console.warn('Error checking username uniqueness in FirstTimeSetup:', err);
      } finally {
        setIsChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, profile?.id]);

  const error = (isTouched || username ? validateUsername(username, [], profile?.id || '') : null) || dbError;

  const handleImageFileSelected = (file: File) => {
    if (!file) return;
    setPermissionError(null);
    try {
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
        img.onload = () => {
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
              setSelectedAvatar(dataUrl);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTouched(true);
    setDbError(null);
    const validationError = validateUsername(username, [], profile?.id || '');
    if (validationError) return;

    setIsChecking(true);
    try {
      const exists = await checkUsernameExists(username, profile?.id || '');
      if (exists) {
        setDbError('Bu kullanıcı adı daha önce alınmıştır, lütfen başka bir tane seçin.');
        setIsChecking(false);
        return;
      }
    } catch (err) {
      console.error('Error checking unique username:', err);
    }
    setIsChecking(false);
    onComplete(username.trim(), selectedAvatar);
  };

  return (
    <div className="w-full max-w-md md:max-w-[90%] lg:max-w-[85%] xl:max-w-[1000px] mx-auto bg-[#2E3748] rounded-[2.5rem] border border-[#3E485A] p-6 sm:p-8 shadow-2xl relative overflow-hidden text-white flex flex-col gap-6 animate-scale-up" id="first-time-setup-card">
      {/* Ambient glow inside the card */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="text-center relative z-10 space-y-2">
        <div className="relative flex justify-center pb-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 text-3xl">
            ⚔️
          </div>
          <span className="absolute top-0 right-[40%] text-amber-200 animate-pulse text-xs">✦</span>
        </div>
        <h1 className="text-2xl font-serif font-medium tracking-wide text-[#FAF6E9] uppercase">
          Kullanıcı Profilini Oluştur
        </h1>
        <p className="text-xs text-gray-400 font-medium max-w-xs mx-auto">
          Kelime Savaşı'na başlamadan önce kendine harika bir takma ad ve avatar seç!
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 relative z-10 text-left">
        {/* Username input */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-amber-100/60 uppercase tracking-wider block font-sans">
            Kullanıcı Adınız
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <User size={16} />
            </span>
            <input
              type="text"
              maxLength={26}
              required
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setIsTouched(true);
                setDbError(null);
              }}
              placeholder="Kullanıcı adını belirle..."
              className={`w-full bg-[#3D4756]/40 border ${error ? 'border-rose-500 focus:ring-rose-400/40 focus:border-rose-400/40' : 'border-[#3E485A] focus:ring-amber-400/40 focus:border-amber-400/40'} rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-[#FAF6E9] placeholder-gray-500 focus:outline-none focus:ring-2 transition`}
            />
          </div>
          {error && (
            <p className="text-xs text-rose-400 font-semibold px-1 mt-1 animate-fade-in">
              ⚠️ {error}
            </p>
          )}
        </div>

        {/* Avatar selection */}
        <div className="space-y-3">
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

          <div className="grid grid-cols-6 gap-2 p-3 bg-black/30 rounded-2xl border border-white/5 max-h-32 overflow-y-auto">
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

        {/* Submit button */}
        <button
          type="submit"
          disabled={!username.trim() || !!error || isChecking}
          className="w-full bg-[#FAF6E9] hover:bg-[#F3EFE0] active:scale-[0.98] active:translate-y-0.5 text-[#2E3748] font-black text-sm py-4 px-6 rounded-2xl shadow-[0_4px_0_#D9D4C3,0_6px_10px_rgba(0,0,0,0.15)] disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center uppercase tracking-wider cursor-pointer border border-[#EBE6D5]"
        >
          <Sparkles size={14} className="mr-2 text-amber-500 fill-amber-500" />
          <span>{isChecking ? 'Kontrol ediliyor...' : 'Savaşa Katıl ➔'}</span>
        </button>
      </form>
    </div>
  );
}
