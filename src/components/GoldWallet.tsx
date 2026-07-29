import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface GoldWalletProps {
  gold: number;
  className?: string;
  onClick?: () => void;
}

export default function GoldWallet({ gold, className = '', onClick }: GoldWalletProps) {
  const [animateKey, setAnimateKey] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [prevGold, setPrevGold] = useState(gold);

  useEffect(() => {
    if (gold !== prevGold) {
      setAnimateKey(prev => prev + 1);
      setPrevGold(gold);
    }
  }, [gold, prevGold]);

  return (
    <div className={`relative select-none ${className}`}>
      {/* Sparkles / Particles background on animate */}
      <AnimatePresence>
        {animateKey > 0 && (
          <div className="absolute inset-0 pointer-events-none z-0">
            {/* Top Left Sparkle */}
            <motion.span
              key={`sparkle-1-${animateKey}`}
              initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
              animate={{ 
                scale: [0, 1.2, 0], 
                opacity: [0, 1, 0],
                x: -25, 
                y: -20,
                rotate: 45
              }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute text-yellow-300 text-xs left-4 top-2"
            >
              ✨
            </motion.span>
            
            {/* Bottom Right Sparkle */}
            <motion.span
              key={`sparkle-2-${animateKey}`}
              initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
              animate={{ 
                scale: [0, 1.4, 0], 
                opacity: [0, 1, 0],
                x: 25, 
                y: 20,
                rotate: -45
              }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.05 }}
              className="absolute text-amber-400 text-xs right-4 bottom-2"
            >
              🪙
            </motion.span>

            {/* Top Right Mini Sparkle */}
            <motion.span
              key={`sparkle-3-${animateKey}`}
              initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
              animate={{ 
                scale: [0, 1, 0], 
                opacity: [0, 0.8, 0],
                x: 20, 
                y: -15,
                rotate: 90
              }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
              className="absolute text-yellow-200 text-[10px] right-6 top-1"
            >
              ✦
            </motion.span>
          </div>
        )}
      </AnimatePresence>

      {/* Main Wallet Pill with Motion */}
      <motion.div
        key={`wallet-${animateKey}`}
        initial={{ scale: 1 }}
        animate={{ 
          scale: [1, 1.1, 0.98, 1],
          boxShadow: [
            "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
            "0 0 20px 6px rgba(245, 158, 11, 0.55)",
            "0 0 10px 2px rgba(245, 158, 11, 0.25)",
            "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
          ],
          borderColor: [
            "rgba(245, 158, 11, 0.3)",
            "rgba(251, 191, 36, 1)",
            "rgba(245, 158, 11, 0.6)",
            "rgba(245, 158, 11, 0.3)"
          ]
        }}
        transition={{ duration: 0.75, ease: "easeInOut" }}
        className="flex items-center gap-2 bg-[#FEF9E6] hover:bg-[#FFFDF5] border border-amber-500/35 rounded-full px-3 py-1 cursor-pointer transition-colors duration-150 relative z-10 shadow-sm"
        onClick={() => {
          setShowTooltip(prev => !prev);
          if (onClick) onClick();
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        id="gold-wallet-pill"
      >
        {/* Animated Rotating Coin Icon */}
        <motion.div 
          animate={{ rotateY: [0, 360] }}
          transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
          className="w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 border border-amber-600 flex items-center justify-center text-[10px] font-black text-slate-900 shadow-inner"
        >
          ₺
        </motion.div>

        {/* Gold Value with slide-up microtransition on change */}
        <div className="flex items-center gap-1 overflow-hidden">
          <AnimatePresence mode="popLayout">
            <motion.span
              key={gold}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-xs sm:text-sm font-black text-[#C59B27] font-mono leading-none tracking-tight"
            >
              {gold}
            </motion.span>
          </AnimatePresence>
          <span className="text-[9px] sm:text-[10px] font-black text-[#C59B27]/90 font-mono tracking-wider leading-none">
            ALTIN
          </span>
        </div>
      </motion.div>

      {/* Tooltip Popup */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-slate-900/95 backdrop-blur-md text-white text-[10px] p-2.5 rounded-xl border border-amber-500/30 shadow-xl z-50 text-center pointer-events-none"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-2 h-2 bg-slate-900 border-t border-l border-amber-500/30 rotate-45" />
            <p className="font-bold text-amber-400 uppercase tracking-wider mb-1">Altın Cüzdanı 🪙</p>
            <p className="text-gray-300 leading-normal">
              Her ipucu ve kelime tavsiyesi <span className="text-amber-300 font-bold">2 Altın</span> harcar. Reklam izleyerek veya günlük ödüllerle kazanabilirsin!
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
