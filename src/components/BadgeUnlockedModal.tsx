import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  Award, 
  Calendar, 
  Sparkles, 
  X, 
  Share2, 
  Check,
  Trophy,
  Zap,
  Brain,
  Shield,
  Crown,
  Search,
  Flame,
  Target,
  Compass,
  Star
} from 'lucide-react';
import { Badge } from '../types';
import { playVictorySound, playClickSound } from '../utils/soundEffects';
import { getBaseUrl } from '../utils/api';

interface BadgeUnlockedModalProps {
  badge: Badge | null;
  onClose: () => void;
  soundEnabled?: boolean;
}

export default function BadgeUnlockedModal({
  badge,
  onClose,
  soundEnabled = true
}: BadgeUnlockedModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (badge) {
      // Play celebratory sound on unlock
      playVictorySound(soundEnabled);
    }
  }, [badge, soundEnabled]);

  const handleShare = () => {
    if (!badge) return;
    playClickSound(soundEnabled);

    const baseUrl = getBaseUrl();
    const shareLink = baseUrl ? baseUrl : (window.location.origin || window.location.href);
    const shareText = `🏆 Kelime Savaşı'nda Yeni Rozet Kazandım! 

🎖️ Rozet: "${badge.title}"
✨ Başarı: ${badge.description}

Sen de katıl, kelime dağarcığını test et! 🚀 ${shareLink}`;

    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Calendar':
        return <Calendar className="w-14 h-14 text-amber-400" />;
      case 'Trophy':
        return <Trophy className="w-14 h-14 text-amber-400" />;
      case 'Zap':
        return <Zap className="w-14 h-14 text-amber-400 animate-bounce" />;
      case 'Star':
        return <Star className="w-14 h-14 text-amber-400" />;
      case 'Brain':
        return <Brain className="w-14 h-14 text-amber-400" />;
      case 'Shield':
        return <Shield className="w-14 h-14 text-amber-400" />;
      case 'Crown':
        return <Crown className="w-14 h-14 text-amber-400 animate-pulse" />;
      case 'Search':
        return <Search className="w-14 h-14 text-amber-400" />;
      case 'Flame':
        return <Flame className="w-14 h-14 text-orange-500 animate-pulse" />;
      case 'Sparkles':
        return <Sparkles className="w-14 h-14 text-amber-400" />;
      case 'Target':
        return <Target className="w-14 h-14 text-amber-400" />;
      case 'Compass':
        return <Compass className="w-14 h-14 text-amber-400 animate-spin-slow" />;
      case 'Award':
      default:
        return <Award className="w-14 h-14 text-amber-400" />;
    }
  };

  const isAndroidHybrid = typeof window !== 'undefined' && (
    (window as any).AndroidBridge || 
    /android/i.test(navigator.userAgent) ||
    (navigator.userAgent && navigator.userAgent.toLowerCase().includes('android-hybrid')) ||
    (document.documentElement && document.documentElement.classList.contains('android-hybrid'))
  );

  return (
    <AnimatePresence>
      {badge && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          {isAndroidHybrid ? (
            <div 
              onClick={onClose}
              className="absolute inset-0 bg-[#0f172a]/95"
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
          )}

          {/* Modal content card */}
          {isAndroidHybrid ? (
            <div className="bg-[#242d3d] border border-amber-500/30 rounded-[2.5rem] p-7 w-full max-w-sm text-center shadow-2xl relative overflow-hidden text-white">
              {/* Close Button */}
              <button
                onClick={() => {
                  playClickSound(soundEnabled);
                  onClose();
                }}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition duration-200 cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Simple Static Circle container behind icon */}
              <div className="relative w-28 h-28 mx-auto mb-6 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-dashed border-amber-500/20 scale-110" />
                
                {/* Icon Container with simple style */}
                <div className="w-20 h-20 bg-amber-500/10 rounded-3xl border-2 border-amber-500 flex items-center justify-center shadow-lg">
                  {getIcon(badge.iconName)}
                </div>
              </div>

              {/* Text Information block */}
              <div className="space-y-4 mb-7 relative z-10">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400 font-mono block">
                    🎖️ ROZET KİLİDİ AÇILDI 🎖️
                  </span>
                  <h3 className="text-2xl font-black text-[#FAF6E9] tracking-tight drop-shadow-md font-sans">
                    {badge.title}
                  </h3>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed max-w-[240px] mx-auto font-medium">
                  {badge.description}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 relative z-10">
                <button
                  onClick={() => {
                    playClickSound(soundEnabled);
                    onClose();
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black py-3 px-4 rounded-xl shadow-lg transition duration-150 uppercase tracking-wider text-xs cursor-pointer"
                >
                  Harika! 🎉
                </button>

                <button
                  onClick={handleShare}
                  className="w-full bg-slate-800/60 hover:bg-slate-800 text-slate-200 font-extrabold py-2.5 px-4 rounded-xl text-xs transition duration-150 flex items-center justify-center gap-1.5 border border-slate-700/50 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span>Panoya Kopyalandı!</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={14} />
                      <span>Başarıyı Paylaş</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ scale: 0.9, y: 50, opacity: 0 }}
              animate={{ 
                scale: 1, 
                y: 0, 
                opacity: 1,
                transition: { type: 'spring', damping: 22, stiffness: 180 } 
              }}
              exit={{ scale: 0.9, y: 30, opacity: 0 }}
              className="bg-gradient-to-b from-[#2a344a] to-[#1a2130] border border-amber-500/30 rounded-[2.5rem] p-7 w-full max-w-sm text-center shadow-[0_0_50px_rgba(245,158,11,0.15)] relative overflow-hidden text-white"
            >
              {/* Ambient light glow */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={() => {
                  playClickSound(soundEnabled);
                  onClose();
                }}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition duration-200 cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Glowing animated background rings behind icon */}
              <div className="relative w-28 h-28 mx-auto mb-6 flex items-center justify-center">
                {/* Rotating outer light rays */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
                  className="absolute inset-0 rounded-full border border-dashed border-amber-500/25 scale-125"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 25, ease: 'linear' }}
                  className="absolute inset-0 rounded-full border border-dotted border-amber-400/20 scale-105"
                />

                {/* Pulsing ring */}
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-full bg-amber-500/10 border border-amber-500/30 blur-xs"
                />

                {/* Floating Star particles */}
                <motion.div
                  animate={{ y: [-5, 5, -5], rotate: 180 }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                  className="absolute top-0 right-0 text-amber-300 pointer-events-none"
                >
                  <Sparkles size={14} className="animate-pulse" />
                </motion.div>
                <motion.div
                  animate={{ y: [5, -5, 5], rotate: -180 }}
                  transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
                  className="absolute bottom-1 left-1 text-yellow-400 pointer-events-none"
                >
                  <Sparkles size={10} className="animate-pulse" />
                </motion.div>

                {/* Icon Container with pop-in scale animation */}
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 120, delay: 0.15 }}
                  className="w-20 h-20 bg-gradient-to-br from-amber-500/20 to-yellow-500/10 rounded-3xl border-2 border-amber-500 flex items-center justify-center shadow-[0_8px_20px_rgba(245,158,11,0.2)]"
                >
                  {getIcon(badge.iconName)}
                </motion.div>
              </div>

              {/* Text Information block with staggered animation */}
              <div className="space-y-4 mb-7 relative z-10">
                <div className="space-y-1">
                  <motion.span
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400 font-mono block"
                  >
                    🎖️ ROZET KİLİDİ AÇILDI 🎖️
                  </motion.span>
                  <motion.h3
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-black text-[#FAF6E9] tracking-tight drop-shadow-md font-sans"
                  >
                    {badge.title}
                  </motion.h3>
                </div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                  className="text-xs text-gray-300 leading-relaxed max-w-[240px] mx-auto font-medium"
                >
                  {badge.description}
                </motion.p>
              </div>

              {/* Action buttons (Staggered bottom) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col gap-2 relative z-10"
              >
                <button
                  onClick={() => {
                    playClickSound(soundEnabled);
                    onClose();
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black py-3 px-4 rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition duration-150 active:scale-[0.98] uppercase tracking-wider text-xs cursor-pointer"
                >
                  Harika! 🎉
                </button>

                <button
                  onClick={handleShare}
                  className="w-full bg-slate-800/60 hover:bg-slate-800 text-slate-200 font-extrabold py-2.5 px-4 rounded-xl text-xs transition duration-150 flex items-center justify-center gap-1.5 border border-slate-700/50 cursor-pointer active:scale-[0.98]"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span>Panoya Kopyalandı!</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={14} />
                      <span>Başarıyı Paylaş</span>
                    </>
                  )}
                </button>
              </motion.div>
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
