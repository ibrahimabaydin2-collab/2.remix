import { X, Target, CheckCircle2, Trophy, Lock, ChevronRight, Sparkles, Flame, Play } from 'lucide-react';
import { UserProfile, DailyMission } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface MissionsModalProps {
  profile: UserProfile;
  onClose: () => void;
  onStartWordGame?: (length: number) => void;
}

export default function MissionsModal({
  profile,
  onClose,
  onStartWordGame
}: MissionsModalProps) {
  const missions = profile?.missions || [];
  
  // Find the single active/promoted mission (the first uncompleted one)
  const activeMission = missions.find(m => !m.completed);
  
  // Find other uncompleted missions (the queue)
  const pendingQueue = missions.filter(m => !m.completed && m.id !== activeMission?.id);
  
  // Find completed missions
  const completedMissions = missions.filter(m => m.completed);
  
  // Calculate overall progress percentage
  const totalMissions = missions.length;
  const completedCount = completedMissions.length;
  const progressPct = totalMissions > 0 ? Math.round((completedCount / totalMissions) * 100) : 0;

  // Helper to get mission difficulty/theme color
  const getMissionColor = (type: string) => {
    if (type.startsWith('solve_')) {
      const len = type.split('_')[1];
      if (len === '3' || len === '4') return 'text-sky-500 bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900/50';
      if (len === '5' || len === '6') return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50';
      return 'text-purple-500 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900/50';
    }
    if (type === 'fast_solve') return 'text-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50';
    if (type === 'perfect') return 'text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50';
    return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50';
  };

  // Helper to extract word length from mission type for "Oyna" action
  const getWordLengthFromType = (type: string): number | null => {
    if (type.startsWith('solve_')) {
      return Number(type.split('_')[1]);
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" id="missions-modal-backdrop">
      <div 
        className="card-theme bg-[#161D2B] border border-amber-500/20 rounded-[2.2rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors duration-200 relative text-white"
        id="missions-modal-card"
      >
        {/* Glowing star */}
        <div className="absolute bottom-4 right-4 text-amber-100/10 animate-pulse select-none pointer-events-none">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c.5 6.5 5.5 11.5 12 12-.5 6.5-5.5 11.5-12 12-.5-6.5-5.5-11.5-12-12 .5-6.5 5.5-11.5 12-12z" />
          </svg>
        </div>

        {/* Header */}
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#161D2B]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-xl shadow-md shadow-amber-500/20">
              <Target size={22} className="animate-pulse" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-bold text-[#FAF6E9]">Savaş Görevleri & İlerleme</h2>
              <p className="text-xs text-gray-400 font-mono">Toplam Başarım: {completedCount} / {totalMissions} (%{progressPct})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            id="close-missions-modal-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Global Progress Bar */}
        <div className="px-5 py-3 bg-[#3D4756]/20 border-b border-[#3E485A]">
          <div className="flex justify-between items-center text-xs font-semibold text-gray-300 mb-1.5">
            <span>Savaş Görevleri İlerlemesi</span>
            <span className="text-amber-400 font-black">% {progressPct} Tamamlandı</span>
          </div>
          <div className="w-full bg-black/35 h-3 rounded-full overflow-hidden shadow-inner">
            <div 
              style={{ width: `${progressPct}%` }}
              className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(251,191,36,0.2)]"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 relative z-10">
          
          {/* 1. FEATURED ACTIVE MISSION CARD (Auto-Promoted Slot) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono flex items-center gap-1.5 text-left">
              <Sparkles size={14} className="text-amber-400" />
              Şu Anki Hedefiniz (Aktif Görev)
            </h3>

            <AnimatePresence mode="wait">
              {activeMission ? (
                <motion.div
                  key={activeMission.id}
                  initial={{ opacity: 0, y: 15, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -15, scale: 0.98 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="bg-gradient-to-r from-[#3D4756]/50 to-slate-900 border-2 border-amber-500/30 p-5 rounded-2xl shadow-md relative overflow-hidden text-left"
                >
                  {/* Decorative glowing background elements */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />

                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 relative z-10">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg border uppercase tracking-wider font-mono ${getMissionColor(activeMission.type)}`}>
                          {activeMission.type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-amber-400 font-extrabold bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/30 font-mono flex items-center gap-1">
                          <Flame size={12} />
                          +150 SKOR
                        </span>
                      </div>
                      <h4 className="text-base font-extrabold text-[#FAF6E9] flex items-center gap-2">
                        {activeMission.title}
                      </h4>
                      <p className="text-xs text-gray-300 font-medium">
                        {activeMission.description}
                      </p>
                    </div>

                    {/* Action Button for specific length missions */}
                    {getWordLengthFromType(activeMission.type) !== null && onStartWordGame && (
                      <button
                        onClick={() => {
                          const len = getWordLengthFromType(activeMission.type);
                          if (len) {
                            onStartWordGame(len);
                            onClose();
                          }
                        }}
                        className="w-full sm:w-auto shrink-0 bg-[#FAF6E9] hover:bg-[#F3EFE0] text-[#2E3748] font-black py-2.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 text-xs transition duration-150 self-end sm:self-center cursor-pointer border border-[#EBE6D5]"
                      >
                        <Play size={12} fill="currentColor" />
                        Savaşa Başla
                      </button>
                    )}
                  </div>

                  {/* Progress Info */}
                  <div className="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-xs font-mono font-extrabold text-amber-400">
                        İlerleme: {activeMission.current} / {activeMission.target}
                      </span>
                    </div>
                    
                    <div className="w-full sm:flex-1 max-w-xs bg-black/30 h-2.5 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min((activeMission.current / activeMission.target) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-[#3D4756]/30 border border-amber-500/20 p-6 rounded-2xl text-center space-y-2.5"
                >
                  <Trophy className="mx-auto text-amber-400 animate-bounce" size={36} />
                  <h4 className="font-bold text-[#FAF6E9] text-base">Harika İş! Tüm Görevleri Bitirdin</h4>
                  <p className="text-xs text-gray-400">Yarın yeni günlük savaş hedefleri eklenecektir. Şimdilik serbest modda rekabet etmeye devam edebilirsin!</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 2. NEXT IN QUEUE (Sıradaki Görevler) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono text-left">
              Sıradaki Görevler Kuyruğu ({pendingQueue.length})
            </h3>

            {pendingQueue.length > 0 ? (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {pendingQueue.map((mission, index) => {
                  const progressPct = Math.min((mission.current / mission.target) * 100, 100);
                  const isLocked = index > 0; // Highlight the very next one, lock the rest visually
                  
                  return (
                    <div 
                      key={mission.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition duration-200 text-left ${
                        isLocked 
                          ? 'bg-[#3D4756]/15 border-white/5 opacity-50' 
                          : 'bg-[#3D4756]/35 border-[#3E485A] hover:border-amber-400/30 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`p-1.5 rounded-lg border ${isLocked ? 'bg-black/20 text-gray-500 border-white/5' : 'bg-[#3D4756] text-amber-400 border-[#3E485A]'}`}>
                          {isLocked ? <Lock size={14} /> : <ChevronRight size={14} className="animate-pulse" />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm text-[#FAF6E9] truncate flex items-center gap-2">
                            {mission.title}
                            {isLocked && (
                              <span className="text-[9px] font-normal text-gray-500 bg-black/20 px-1.5 py-0.5 rounded">
                                Kilitli
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] sm:text-xs text-gray-400 truncate">{mission.description}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-mono font-bold text-gray-300">
                          {mission.current} / {mission.target}
                        </span>
                        <div className="w-16 bg-black/30 h-1.5 rounded-full overflow-hidden mt-1">
                          <div 
                            className={`h-full rounded-full ${isLocked ? 'bg-gray-600' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic text-left">Sırada bekleyen başka görev yok.</p>
            )}
          </div>

          {/* 3. COMPLETED MISSIONS (Tamamlanan Savaşlar) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono text-left">
              Tamamlanan Savaşlar ({completedCount})
            </h3>

            {completedMissions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                {completedMissions.map((mission) => (
                  <div 
                    key={mission.id}
                    className="p-2.5 bg-[#3D4756]/25 border border-emerald-500/10 rounded-xl flex items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs text-emerald-400 truncate flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        {mission.title}
                      </h4>
                      <p className="text-[10px] text-gray-450 truncate">{mission.description}</p>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                      Başarıldı
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic text-left">Henüz hiçbir görevi tamamlamadınız. Savaşlara katılın!</p>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#3E485A] flex justify-end bg-[#3D4756]/30">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#FAF6E9] hover:bg-[#F3EFE0] text-[#2E3748] font-black text-xs rounded-xl shadow-sm transition cursor-pointer border border-[#EBE6D5]"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
