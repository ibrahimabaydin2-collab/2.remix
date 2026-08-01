import { useState } from 'react';
import { 
  X, 
  Award, 
  CheckCircle, 
  BarChart2, 
  Share2, 
  Sparkles, 
  Copy, 
  Check,
  Calendar,
  Trophy,
  Zap,
  Star,
  Brain,
  Shield,
  Crown,
  Search,
  Flame,
  Target,
  Compass,
  Download
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell, 
  CartesianGrid,
  LabelList 
} from 'recharts';
import { UserProfile, Badge, DailyMission } from '../types';
import { getBaseUrl } from '../utils/api';

interface StatsModalProps {
  profile: UserProfile;
  onClose: () => void;
}

const renderBadgeIcon = (iconName: string, isUnlocked: boolean) => {
  const className = isUnlocked ? 'animate-pulse text-amber-400' : '';
  switch (iconName) {
    case 'Calendar':
      return <Calendar size={24} className={className} />;
    case 'Trophy':
      return <Trophy size={24} className={className} />;
    case 'Zap':
      return <Zap size={24} className={className} />;
    case 'Star':
      return <Star size={24} className={className} />;
    case 'Brain':
      return <Brain size={24} className={className} />;
    case 'Shield':
      return <Shield size={24} className={className} />;
    case 'Crown':
      return <Crown size={24} className={className} />;
    case 'Search':
      return <Search size={24} className={className} />;
    case 'Flame':
      return <Flame size={24} className={isUnlocked ? 'animate-pulse text-orange-400' : ''} />;
    case 'Sparkles':
      return <Sparkles size={24} className={className} />;
    case 'Target':
      return <Target size={24} className={className} />;
    case 'Compass':
      return <Compass size={24} className={className} />;
    case 'Award':
    default:
      return <Award size={24} className={className} />;
  }
};

const CustomWordLengthTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#101520] border border-amber-500/40 p-2.5 rounded-xl shadow-2xl text-white text-xs space-y-1">
        <p className="font-extrabold text-amber-300 flex items-center gap-1.5 border-b border-white/10 pb-1">
          <Target size={13} className="text-amber-400" />
          {data.rawLength} Harfli Kelimeler
        </p>
        <div className="flex justify-between items-center gap-4 text-xs font-mono pt-1">
          <span className="text-gray-300">Kazanılan Oyun:</span>
          <span className="font-black text-amber-400">{data['Galibiyet']}</span>
        </div>
        <div className="flex justify-between items-center gap-4 text-[10.5px] font-mono text-gray-400">
          <span>Galibiyet Payı:</span>
          <span className="font-bold text-amber-200 font-mono">%{data.percentage}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function StatsModal({
  profile,
  onClose
}: StatsModalProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'missions' | 'badges'>('stats');
  const [copied, setCopied] = useState(false);

  const rawStats = profile?.stats || { gamesPlayed: 0, gamesWon: 0, currentStreak: 0, maxStreak: 0, winDistribution: [0, 0, 0, 0, 0, 0] };
  const rawWordStats = profile?.wordLengthStats || {};

  // 1. Calculate word length wins per category
  const wordLengthWinsMap: { [key: number]: number } = {
    3: rawWordStats['3'] || 0,
    4: rawWordStats['4'] || 0,
    5: rawWordStats['5'] || 0,
    6: rawWordStats['6'] || 0,
    7: rawWordStats['7'] || 0,
    8: rawWordStats['8'] || 0,
  };
  const totalWordLengthWins = Object.values(wordLengthWinsMap).reduce((a, b) => a + b, 0);

  // 2. Calculate attempt distribution wins (attempts 1 to 6)
  const distWinsArray = Array.isArray(rawStats.winDistribution) && rawStats.winDistribution.length === 6
    ? [...rawStats.winDistribution]
    : [0, 0, 0, 0, 0, 0];
  const totalDistWins = distWinsArray.reduce((a, b) => a + b, 0);

  // 3. Unified Total Wins: Ensure 100% mathematical match across all categories
  const effectiveGamesWon = Math.max(rawStats.gamesWon || 0, totalWordLengthWins, totalDistWins);

  // 4. Mathematical Synchronization: If subcategory sums were behind, adjust 5-letter category and attempt 3
  if (totalWordLengthWins < effectiveGamesWon) {
    const diff = effectiveGamesWon - totalWordLengthWins;
    wordLengthWinsMap[5] = (wordLengthWinsMap[5] || 0) + diff;
  }

  if (totalDistWins < effectiveGamesWon) {
    const diff = effectiveGamesWon - totalDistWins;
    distWinsArray[2] = (distWinsArray[2] || 0) + diff;
  }

  // 5. Total Games Played must be >= Total Wins
  const effectiveGamesPlayed = Math.max(rawStats.gamesPlayed || 0, effectiveGamesWon);
  const winRate = effectiveGamesPlayed > 0 ? Math.round((effectiveGamesWon / effectiveGamesPlayed) * 100) : 0;
  
  // Find highest frequency in win distribution for scaling bars
  const maxDistribution = Math.max(...distWinsArray, 1);

  // Unlocked badges count
  const unlockedBadgesCount = (profile?.badges || []).filter(b => b.unlockedAt).length;

  // Completed missions count
  const completedMissionsCount = (profile?.missions || []).filter(m => m.completed).length;

  let bestWordLength = '5';
  let maxWinsForLength = -1;
  [3, 4, 5, 6, 7, 8].forEach((len) => {
    const wins = wordLengthWinsMap[len];
    if (wins > maxWinsForLength) {
      maxWinsForLength = wins;
      bestWordLength = String(len);
    }
  });

  const wordLengthColors = ['#FCD34D', '#FBBF24', '#F59E0B', '#D97706', '#B45309', '#92400E'];

  const wordLengthData = [3, 4, 5, 6, 7, 8].map((len, index) => {
    const wins = wordLengthWinsMap[len];
    const percentage = effectiveGamesWon > 0 ? Math.round((wins / effectiveGamesWon) * 100) : 0;
    return {
      name: `${len} Harf`,
      rawLength: len,
      'Galibiyet': wins,
      percentage,
      fill: wordLengthColors[index]
    };
  });

  const handleShare = () => {
    const baseUrl = getBaseUrl();
    const shareLink = baseUrl ? baseUrl : (window.location.origin || window.location.href);
    const shareText = `🧩 Kelime Savaşı Türkçe Kelime Oyunu! 

🏆 Günlük Skor: ${profile.dailyScore} Puan
🥇 Galibiyet Oranı: %${winRate}
🔥 En İyi Seri: ${rawStats.maxStreak} Gün
🎖️ Kazanılan Rozet: ${unlockedBadgesCount}/${profile.badges.length}

Sen de bana meydan oku! 🚀 ${shareLink}`;

    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportStats = () => {
    try {
      const statsToExport = {
        oyuncu_adi: profile.name,
        oyuncu_id: profile.id,
        toplam_skor: profile.dailyScore,
        altin: profile.gold || 0,
        istatistikler: {
          oynanan_oyun: effectiveGamesPlayed,
          kazanilan_oyun: effectiveGamesWon,
          kazanma_orani: `${winRate}%`,
          mevcut_seri: rawStats.currentStreak,
          en_iyi_seri: rawStats.maxStreak,
          deneme_dagilimi: {
            "1. Deneme": distWinsArray[0] || 0,
            "2. Deneme": distWinsArray[1] || 0,
            "3. Deneme": distWinsArray[2] || 0,
            "4. Deneme": distWinsArray[3] || 0,
            "5. Deneme": distWinsArray[4] || 0,
            "6. Deneme": distWinsArray[5] || 0,
          }
        },
        kelime_uzunluk_basarisi: {
          "3 Harfli": wordLengthWinsMap[3] || 0,
          "4 Harfli": wordLengthWinsMap[4] || 0,
          "5 Harfli": wordLengthWinsMap[5] || 0,
          "6 Harfli": wordLengthWinsMap[6] || 0,
          "7 Harfli": wordLengthWinsMap[7] || 0,
          "8 Harfli": wordLengthWinsMap[8] || 0,
        },
        gorevler: profile.missions.map(m => ({
          gorev: m.title,
          aciklama: m.description,
          hedef: m.target,
          ilerleme: m.current,
          tamamlandi: m.completed
        })),
        rozetler: profile.badges.map(b => ({
          rozet: b.title,
          aciklama: b.description,
          kazanildi: b.unlockedAt ? new Date(b.unlockedAt).toLocaleDateString('tr-TR') : 'Henüz kazanılmadı'
        })),
        disa_aktarma_tarihi: new Date().toLocaleString('tr-TR')
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(statsToExport, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${profile.name.replace(/\s+/g, '_')}_kelime_savasi_istatistikleri.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error("Failed to export statistics", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="card-theme bg-[#161D2B] border border-amber-500/20 rounded-[2.2rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors duration-200 relative text-white">
        {/* Glowing star */}
        <div className="absolute bottom-4 right-4 text-amber-100/10 animate-pulse select-none pointer-events-none">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c.5 6.5 5.5 11.5 12 12-.5 6.5-5.5 11.5-12 12-.5-6.5-5.5-11.5-12-12 .5-6.5 5.5-11.5 12-12z" />
          </svg>
        </div>

        {/* Header */}
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#161D2B]">
          <h2 className="text-lg font-bold text-[#FAF6E9] flex items-center gap-2">
            <BarChart2 className="text-amber-400" size={20} />
            Kişisel Profil & İlerleme
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-white/10 bg-[#101520]">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'stats'
                ? 'border-amber-400 text-amber-400 bg-[#161D2B]'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-[#3D4756]/10'
            }`}
          >
            <BarChart2 size={16} />
            İstatistikler
          </button>
          <button
            onClick={() => setActiveTab('missions')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'missions'
                ? 'border-amber-400 text-amber-400 bg-[#3D4756]/40'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-[#3D4756]/10'
            }`}
          >
            <CheckCircle size={16} />
            Görevler ({completedMissionsCount}/{profile.missions.length})
          </button>
          <button
            onClick={() => setActiveTab('badges')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'badges'
                ? 'border-amber-400 text-amber-400 bg-[#3D4756]/40'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-[#3D4756]/10'
            }`}
          >
            <Award size={16} />
            Rozetler ({unlockedBadgesCount}/{profile.badges.length})
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 relative z-10">
          {/* STATS TAB */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-[#3D4756]/30 p-3 rounded-2xl border border-white/5">
                  <span className="text-xl sm:text-2xl font-bold text-[#FAF6E9]">{effectiveGamesPlayed}</span>
                  <span className="block text-[9px] sm:text-xs text-gray-400 uppercase font-mono mt-1 font-bold">Oyun</span>
                </div>
                <div className="bg-[#3D4756]/30 p-3 rounded-2xl border border-white/5">
                  <span className="text-xl sm:text-2xl font-bold text-amber-400">{winRate}%</span>
                  <span className="block text-[9px] sm:text-xs text-gray-400 uppercase font-mono mt-1 font-bold">Galibiyet</span>
                </div>
                <div className="bg-[#3D4756]/30 p-3 rounded-2xl border border-white/5">
                  <span className="text-xl sm:text-2xl font-bold text-amber-300">{rawStats.currentStreak}</span>
                  <span className="block text-[9px] sm:text-xs text-gray-400 uppercase font-mono mt-1 font-bold">Seri</span>
                </div>
                <div className="bg-[#3D4756]/30 p-3 rounded-2xl border border-white/5">
                  <span className="text-xl sm:text-2xl font-bold text-amber-200">{rawStats.maxStreak}</span>
                  <span className="block text-[9px] sm:text-xs text-gray-400 uppercase font-mono mt-1 font-bold">En İyi Seri</span>
                </div>
              </div>

              {/* Solve Distribution */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 font-mono">Deneme Dağılımı</h3>
                <div className="space-y-2">
                  {distWinsArray.map((count, index) => {
                    const pct = Math.max((count / maxDistribution) * 100, 5);
                    return (
                      <div key={index} className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-gray-400 w-3">{index + 1}</span>
                        <div className="flex-1 bg-black/25 h-6 rounded-lg overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className={`h-full flex items-center justify-end pr-2 rounded-lg text-xs font-black text-slate-950 transition-all duration-500 ${
                              count > 0 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-[#3D4756]/20 text-gray-500'
                            }`}
                          >
                            {count > 0 ? count : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Word Length Success Bar Chart Section */}
              <div className="bg-[#101520] p-4 rounded-2xl border border-amber-500/20 space-y-3 shadow-lg">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div>
                    <h3 className="text-xs font-black text-[#FAF6E9] uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <BarChart2 size={15} className="text-amber-400" />
                      Harf Sayısına Göre Galibiyetler
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Hangi harf uzunluğunda kaç kelime bildiğinizi gösterir
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-amber-400 font-mono block">
                      {effectiveGamesWon} Galibiyet
                    </span>
                    <span className="text-[9px] text-gray-400 uppercase font-mono block">
                      En İyi: {bestWordLength} Harf ({maxWinsForLength > 0 ? maxWinsForLength : 0})
                    </span>
                  </div>
                </div>

                {/* Recharts Column Chart */}
                <div className="h-48 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={wordLengthData} margin={{ top: 18, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3E485A" opacity={0.25} vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#9CA3AF" 
                        fontSize={11} 
                        fontWeight="bold"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#9CA3AF" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<CustomWordLengthTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                      <Bar dataKey="Galibiyet" radius={[6, 6, 0, 0]}>
                        <LabelList 
                          dataKey="Galibiyet" 
                          position="top" 
                          fill="#FBBF24" 
                          fontSize={10} 
                          fontWeight="bold"
                          formatter={(val: number) => (val > 0 ? val : '')}
                        />
                        {wordLengthData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.fill} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Detailed Grid Breakdown */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                  {wordLengthData.map((item) => (
                    <div key={item.rawLength} className="bg-[#161D2B] p-2 rounded-xl border border-white/5 flex flex-col justify-between space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-gray-300 font-mono">{item.rawLength} Harf</span>
                        <span className="text-amber-400 font-mono font-black">{item['Galibiyet']}</span>
                      </div>
                      <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${item.percentage}%` }}
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-300"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social Share & Export */}
              <div className="flex flex-col gap-2 pt-4">
                <button
                  onClick={handleShare}
                  className="w-full bg-[#FAF6E9] hover:bg-[#F3EFE0] text-[#2E3748] font-black py-3 px-4 rounded-xl shadow-[0_4px_0_#D9D4C3,0_6px_10px_rgba(0,0,0,0.15)] border border-[#EBE6D5] flex items-center justify-center gap-2 transition duration-150 cursor-pointer text-sm"
                >
                  {copied ? <Check size={18} /> : <Share2 size={18} />}
                  {copied ? 'Kopyalandı!' : 'Skorunu Paylaş'}
                </button>
                
                <div className="flex items-center justify-between gap-2 mt-1">
                  <button
                    onClick={handleExportStats}
                    className="w-full py-2.5 px-3 rounded-xl text-xs bg-[#3D4756]/45 hover:bg-[#3D4756]/70 text-[#FAF6E9] border border-[#3E485A]/40 transition flex items-center justify-center gap-1.5 cursor-pointer font-bold"
                  >
                    <Download size={14} className="text-amber-400" />
                    İstatistikleri Dışa Aktar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MISSIONS TAB */}
          {activeTab === 'missions' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 italic mb-2">
                Günlük görevleri tamamlayarak ekstra rozetler ve puanlar kazanın. Her gün sıfırlanır!
              </p>
              {profile.missions.map((mission) => {
                const progressPct = Math.min((mission.current / mission.target) * 100, 100);
                return (
                  <div
                    key={mission.id}
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left ${
                      mission.completed
                        ? 'bg-[#3D4756]/60 border-amber-400/30 text-white'
                        : 'bg-[#3D4756]/20 border-white/5'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${mission.completed ? 'text-amber-400' : 'text-[#FAF6E9]'}`}>
                          {mission.title}
                        </span>
                        {mission.completed && (
                          <span className="text-[9px] bg-amber-500/10 text-amber-400 font-extrabold px-1.5 py-0.5 rounded border border-amber-400/30 uppercase tracking-wide">
                            Tamamlandı
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{mission.description}</p>
                    </div>

                    <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between gap-2 sm:gap-0 shrink-0">
                      <span className="text-xs font-mono font-bold text-gray-300">
                        {mission.current} / {mission.target}
                      </span>
                      <div className="w-24 bg-black/30 h-2 rounded-full overflow-hidden mt-1">
                        <div
                          style={{ width: `${progressPct}%` }}
                          className={`h-full rounded-full ${mission.completed ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gray-500'}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* BADGES TAB */}
          {activeTab === 'badges' && (
            <div className="grid grid-cols-2 gap-3">
              {profile.badges.map((badge) => {
                const isUnlocked = !!badge.unlockedAt;
                return (
                  <div
                    key={badge.id}
                    className={`p-3 rounded-2xl border flex flex-col items-center text-center space-y-2 transition duration-200 ${
                      isUnlocked
                        ? 'bg-[#3D4756]/50 border-amber-400/40 text-white'
                        : 'bg-[#3D4756]/10 border-white/5 opacity-40 filter grayscale'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      isUnlocked
                        ? 'bg-[#3D4756] text-amber-400 border border-amber-400/50'
                        : 'bg-black/20 text-gray-500'
                    }`}>
                      {renderBadgeIcon(badge.iconName, isUnlocked)}
                    </div>
                    <div>
                      <h4 className={`font-bold text-sm ${isUnlocked ? 'text-amber-300' : 'text-gray-500'}`}>
                        {badge.title}
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-1 leading-tight">
                        {badge.description}
                      </p>
                      {isUnlocked && badge.unlockedAt && (
                        <span className="block text-[9px] text-amber-400 font-mono mt-1.5 font-bold">
                          Kazanıldı: {new Date(badge.unlockedAt).toLocaleDateString('tr-TR')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
