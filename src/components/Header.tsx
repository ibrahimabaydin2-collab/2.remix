// Complete rebuild stamp: 2026-07-23 v1.0.2
import React, { memo } from 'react';
import { Sun, Moon, BarChart2, Award, Users, RefreshCw, Sliders, Target } from 'lucide-react';
import { isImageUrl } from '../types';
import UserAvatar from './UserAvatar';

interface HeaderProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onOpenStats: () => void;
  onOpenBadges: () => void;
  onOpenMissions: () => void;
  onOpenLobby: () => void;
  onOpenSettings: () => void;
  playerName: string;
  avatarUrl?: string;
  onEditName: () => void;
  dailyScore: number;
  isOnline: boolean;
}

function Header({
  darkMode,
  setDarkMode,
  onOpenStats,
  onOpenBadges,
  onOpenMissions,
  onOpenLobby,
  onOpenSettings,
  playerName,
  avatarUrl,
  onEditName,
  dailyScore,
  isOnline
}: HeaderProps) {
  return (
    <header className="w-full border-b border-[#3E485A] bg-[#2E3748] transition-colors duration-200">
      <div className="max-w-full md:max-w-[95vw] lg:max-w-[90vw] mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src="./logo.svg" 
            alt="Kelime Savaşı Logo" 
            className="w-10 h-10 rounded-xl shadow-md shadow-emerald-500/25 transition duration-300 hover:scale-105"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#FAF6E9] font-sans flex items-center gap-2">
              Kelime Savaşı
              <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Türkçe
              </span>
            </h1>
            <p className="text-[10px] text-gray-300 font-mono">
              6 Hak • 20 Saniye
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Daily Score Display */}
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">Skor</span>
            <span id="score" className="text-sm font-semibold text-amber-400">{dailyScore} Puan</span>
          </div>

          {/* Player Name */}
          <button
            onClick={onEditName}
            className="flex items-center gap-2 text-xs bg-[#3D4756] hover:bg-[#3D4756]/80 text-[#FAF6E9] pl-2 pr-3 py-1 rounded-xl border border-[#3E485A] transition duration-150 font-medium max-w-[150px]"
          >
            <span className="w-6 h-6 rounded-full overflow-hidden border border-emerald-500 flex items-center justify-center bg-[#2E3748] font-bold shrink-0">
              <UserAvatar avatarUrl={avatarUrl} name={playerName} fallbackIcon="🧠" textClassName="text-xs font-bold text-emerald-300" />
            </span>
            <span className="truncate">{playerName || 'Oyuncu'}</span>
          </button>

          {/* Lobby Button */}
          <button
            onClick={onOpenLobby}
            className="relative p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition duration-150"
            title="Arkadaş Listesi & Rekabet"
          >
            <Users size={20} />
            <span className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          </button>

          {/* Missions Button */}
          <button
            onClick={onOpenMissions}
            className="p-2 rounded-lg text-emerald-400 hover:bg-white/5 transition duration-150 relative"
            title="Savaş Görevleri"
            id="header-missions-btn"
          >
            <Target size={20} className="animate-pulse" />
          </button>

          {/* Stats Button */}
          <button
            onClick={onOpenStats}
            className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition duration-150"
            title="İstatistikler"
          >
            <BarChart2 size={20} />
          </button>

          {/* Badges Button */}
          <button
            onClick={onOpenBadges}
            className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition duration-150"
            title="Rozetler"
          >
            <Award size={20} />
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition duration-150"
            title="Ayarlar"
            id="settings-button-header"
          >
            <Sliders size={20} />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition duration-150"
            title={darkMode ? 'Gündüz Modu' : 'Gece Modu'}
          >
            {darkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}

export default memo(Header);
