import React, { memo } from 'react';
import { Hourglass, Swords } from 'lucide-react';

interface GameTimerDisplayProps {
  gameMode: string;
  isDailyPuzzle: boolean;
  activeMatch: any;
  secondsLeft: number;
}

/**
 * Isolated GameTimerDisplay Component
 * Encapsulates timer rendering and prevents secondsLeft updates
 * from triggering re-renders of GameBoard, Keyboard, and Header.
 */
function GameTimerDisplay({
  gameMode,
  isDailyPuzzle,
  activeMatch,
  secondsLeft,
}: GameTimerDisplayProps) {
  if (activeMatch) {
    return (
      <div className="text-xs font-extrabold font-mono px-2 py-0.5 rounded-lg border bg-amber-500/15 border-amber-500/30 text-amber-400 flex items-center gap-1">
        <Swords size={12} className="animate-pulse text-amber-400" />
        <span>CANLI DÜELLO</span>
      </div>
    );
  }

  if (gameMode === 'timed' && !isDailyPuzzle) {
    const isDanger = secondsLeft <= 5;
    return (
      <>
        <Hourglass size={16} className={`animate-spin ${isDanger ? 'text-rose-500' : 'text-emerald-500'}`} />
        <div
          className={`text-sm font-bold font-mono px-2 py-0.5 rounded-lg border ${
            isDanger
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 animate-pulse'
              : 'bg-black/25 border-[#3E485A] text-emerald-400'
          }`}
        >
          {secondsLeft} sn
        </div>
      </>
    );
  }

  return (
    <div
      className="text-xs font-extrabold font-mono px-2.5 py-0.5 rounded-lg border bg-black/25 border-[#3E485A] text-emerald-400 flex items-center gap-1"
      title="Süresiz Serbest Mod"
    >
      <Hourglass size={14} className="text-emerald-400 animate-pulse" />
      <span>♾️</span>
    </div>
  );
}

export default memo(GameTimerDisplay);
