// Complete rebuild stamp: 2026-07-28 v1.0.3
import React, { memo, useMemo } from 'react';
import { ArrowDownFromLine } from 'lucide-react';

interface GameBoardProps {
  attempts: { word: string; feedback: ('green' | 'orange' | 'grey')[] }[];
  currentAttempt: string;
  wordLength: number;
  maxAttempts?: number;
  boardTheme?: 'classic' | 'ocean' | 'neon' | 'autumn' | 'pastel';
  isGameOver?: boolean;
  revealedHints?: { [index: number]: string };
  isDuplicateAttempt?: boolean;
  onTransferRowGreenLetters?: (rowIndex: number) => void;
}

// Cell Sizing Helper
const getCellSizeClass = (wordLength: number) => {
  if (wordLength === 3) {
    return 'w-[clamp(2.6rem,min(14vw,9vh),5.2rem)] h-[clamp(2.6rem,min(14vw,9vh),5.2rem)] text-2xl sm:text-3xl md:text-4xl border-[2.5px] rounded-2xl';
  }
  if (wordLength === 4) {
    return 'w-[clamp(2.3rem,min(12vw,8.5vh),4.8rem)] h-[clamp(2.3rem,min(12vw,8.5vh),4.8rem)] text-xl sm:text-2xl md:text-3xl border-[2.5px] rounded-xl';
  }
  if (wordLength === 5) {
    return 'w-[clamp(2.0rem,min(10vw,7.8vh),4.4rem)] h-[clamp(2.0rem,min(10vw,7.8vh),4.4rem)] text-lg sm:text-xl md:text-2xl border-[2px] rounded-xl';
  }
  if (wordLength === 6) {
    return 'w-[clamp(1.8rem,min(9vw,7vh),4.0rem)] h-[clamp(1.8rem,min(9vw,7vh),4.0rem)] text-base sm:text-lg md:text-xl border-[2px] rounded-xl';
  }
  if (wordLength === 7) {
    return 'w-[clamp(1.6rem,min(8vw,6.5vh),3.5rem)] h-[clamp(1.6rem,min(8vw,6.5vh),3.5rem)] text-sm sm:text-base md:text-lg border-[1.5px] rounded-lg';
  }
  return 'w-[clamp(1.4rem,min(7vw,6vh),3.1rem)] h-[clamp(1.4rem,min(7vw,6vh),3.1rem)] text-xs sm:text-sm md:text-base border-[1.5px] rounded-md sm:rounded-lg';
};

// Submitted Row Component (Memoized so it never re-renders while user types)
const SubmittedRow = memo(function SubmittedRow({
  row,
  rowIndex,
  wordLength,
  boardTheme = 'classic',
  isGameOver = false,
  onTransferRowGreenLetters
}: {
  row: { word: string; feedback: ('green' | 'orange' | 'grey')[] };
  rowIndex: number;
  wordLength: number;
  boardTheme?: string;
  isGameOver?: boolean;
  onTransferRowGreenLetters?: (rowIndex: number) => void;
}) {
  const sizeClass = useMemo(() => getCellSizeClass(wordLength), [wordLength]);
  const baseCell = `${sizeClass} flex items-center justify-center font-bold uppercase transition-all duration-200 select-none`;
  const wordChars = useMemo(() => row.word.split(''), [row.word]);
  const hasGreenInRow = useMemo(
    () => Boolean(row.feedback && Array.isArray(row.feedback) && row.feedback.includes('green')),
    [row.feedback]
  );

  const getSubmittedCellClass = (feedback?: 'green' | 'orange' | 'grey') => {
    let greenStyle = 'border-emerald-400 bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/20';
    let orangeStyle = 'border-amber-400 bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/20';
    let greyStyle = 'border-[#3E485A] bg-gradient-to-br from-slate-500 to-slate-600 text-slate-100 shadow-sm';

    if (boardTheme === 'ocean') {
      greenStyle = 'border-blue-500 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20';
      orangeStyle = 'border-sky-400 bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-lg shadow-sky-400/20';
      greyStyle = 'border-[#3E485A] bg-gradient-to-br from-slate-500 to-slate-600 text-slate-100 shadow-sm';
    } else if (boardTheme === 'neon') {
      greenStyle = 'border-fuchsia-500 bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white shadow-lg shadow-fuchsia-500/30';
      orangeStyle = 'border-cyan-400 bg-gradient-to-br from-cyan-400 to-teal-400 text-slate-950 shadow-lg shadow-cyan-400/30';
      greyStyle = 'border-[#3E485A] bg-gradient-to-br from-zinc-600 to-zinc-700 text-zinc-100 shadow-sm';
    } else if (boardTheme === 'autumn') {
      greenStyle = 'border-orange-500 bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/20';
      orangeStyle = 'border-amber-500 bg-gradient-to-br from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/20';
      greyStyle = 'border-[#3E485A] bg-gradient-to-br from-stone-550 to-stone-650 text-stone-100 shadow-sm';
    } else if (boardTheme === 'pastel') {
      greenStyle = 'border-teal-300 bg-gradient-to-br from-teal-200 to-emerald-300 text-teal-950 shadow-md shadow-teal-300/20';
      orangeStyle = 'border-rose-300 bg-gradient-to-br from-rose-200 to-orange-300 text-rose-950 shadow-md shadow-rose-300/20';
      greyStyle = 'border-[#3E485A] bg-gradient-to-br from-slate-300 to-slate-400 text-slate-700 shadow-sm';
    }

    switch (feedback) {
      case 'green':
        return `${baseCell} ${greenStyle}`;
      case 'orange':
        return `${baseCell} ${orangeStyle}`;
      case 'grey':
        return `${baseCell} ${greyStyle}`;
      default:
        return `${baseCell} border-[#3E485A] bg-[#222B3A]/45 text-[#FAF6E9]`;
    }
  };

  return (
    <div className="relative flex items-center justify-center">
      <div className="flex gap-[clamp(0.08rem,0.4vw,0.22rem)]">
        {wordChars.map((char, charIndex) => {
          const feedback = row.feedback?.[charIndex];
          const cellClass = getSubmittedCellClass(feedback);
          return (
            <div
              key={charIndex}
              className={cellClass}
              id={`cell-${rowIndex}-${charIndex}`}
            >
              <span className="font-sans font-bold">
                {char !== ' ' ? char : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* Right-side Green Letter Transfer Bubble */}
      {!isGameOver && (
        <button
          type="button"
          onClick={() => onTransferRowGreenLetters?.(rowIndex)}
          disabled={!hasGreenInRow}
          className={`absolute left-[calc(100%+6px)] sm:left-[calc(100%+10px)] top-1/2 -translate-y-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-all duration-150 z-10 ${
            hasGreenInRow
              ? 'bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 border border-emerald-300 shadow-md shadow-emerald-500/30 hover:scale-110 active:scale-95 cursor-pointer ring-2 ring-emerald-400/40'
              : 'bg-[#222B3A]/40 text-slate-600 border border-slate-700/40 opacity-25 cursor-not-allowed'
          }`}
          title={hasGreenInRow ? "Bu satırdaki yeşil harfleri alt satıra aktar" : "Bu satırda yeşil harf bulunmuyor"}
          id={`transfer-green-row-${rowIndex}`}
        >
          <ArrowDownFromLine size={13} className={hasGreenInRow ? "stroke-[2.5] text-slate-950" : "text-slate-500"} />
        </button>
      )}
    </div>
  );
});

// Active Row Component (Optimized for ultra-fast keystroke updates)
const ActiveRow = memo(function ActiveRow({
  currentAttempt,
  wordLength,
  rowIndex,
  revealedHints = {},
  isDuplicateAttempt = false
}: {
  currentAttempt: string;
  wordLength: number;
  rowIndex: number;
  revealedHints?: { [index: number]: string };
  isDuplicateAttempt?: boolean;
}) {
  const sizeClass = useMemo(() => getCellSizeClass(wordLength), [wordLength]);
  const baseCell = `${sizeClass} flex items-center justify-center font-bold uppercase transition-all duration-100 select-none`;
  const padded = useMemo(() => currentAttempt.padEnd(wordLength, ' ').split(''), [currentAttempt, wordLength]);

  return (
    <div className="relative flex items-center justify-center">
      <div className="flex gap-[clamp(0.08rem,0.4vw,0.22rem)]">
        {padded.map((char, charIndex) => {
          const isHinted = char === ' ' && revealedHints[charIndex] !== undefined;
          let cellClass = `${baseCell} border-[#3E485A] bg-[#222B3A]/45 text-[#FAF6E9]/30`;
          let displayChar = char !== ' ' ? char : '';

          if (isHinted) {
            cellClass = `${sizeClass} flex items-center justify-center font-bold uppercase transition-all duration-150 select-none border-emerald-500/70 bg-emerald-500/10 text-emerald-400 border-dashed animate-pulse scale-[1.02]`;
            displayChar = revealedHints[charIndex];
          } else if (char !== ' ') {
            if (isDuplicateAttempt) {
              cellClass = `${baseCell} border-rose-500 bg-rose-500/25 text-rose-200 scale-105 shadow-md shadow-rose-500/20 animate-pulse`;
            } else {
              cellClass = `${baseCell} border-amber-300/60 text-[#FAF6E9] bg-[#3D4756] scale-105 shadow-sm`;
            }
          }

          return (
            <div
              key={charIndex}
              className={cellClass}
              id={`cell-${rowIndex}-${charIndex}`}
            >
              <span className="font-sans font-bold">
                {displayChar}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// Empty Row Component
const EmptyRow = memo(function EmptyRow({
  wordLength,
  rowIndex
}: {
  wordLength: number;
  rowIndex: number;
}) {
  const sizeClass = useMemo(() => getCellSizeClass(wordLength), [wordLength]);
  const cellClass = `${sizeClass} flex items-center justify-center font-bold uppercase border-[#3E485A] bg-[#222B3A]/45 text-[#FAF6E9]/30 select-none`;
  const emptyChars = useMemo(() => Array(wordLength).fill(' '), [wordLength]);

  return (
    <div className="relative flex items-center justify-center">
      <div className="flex gap-[clamp(0.08rem,0.4vw,0.22rem)]">
        {emptyChars.map((_, charIndex) => (
          <div
            key={charIndex}
            className={cellClass}
            id={`cell-${rowIndex}-${charIndex}`}
          />
        ))}
      </div>
    </div>
  );
});

function GameBoard({
  attempts,
  currentAttempt,
  wordLength,
  maxAttempts = 6,
  boardTheme = 'classic',
  isGameOver = false,
  revealedHints = {},
  isDuplicateAttempt = false,
  onTransferRowGreenLetters
}: GameBoardProps) {
  const submittedCount = attempts.length;
  const isCompleted = submittedCount >= maxAttempts;

  // Determine how many empty rows to render after active row
  const remainingCount = Math.max(0, maxAttempts - submittedCount - (isGameOver || isCompleted ? 0 : 1));

  const emptyRowIndices = useMemo(() => {
    const start = submittedCount + (isGameOver || isCompleted ? 0 : 1);
    return Array.from({ length: remainingCount }, (_, idx) => start + idx);
  }, [remainingCount, submittedCount, isGameOver, isCompleted]);

  return (
    <div className="flex flex-col gap-[clamp(0.08rem,0.4vh,0.22rem)] items-center justify-center overflow-visible w-full px-8 shrink-0">
      {/* 1. Submitted Rows */}
      {attempts.map((row, rowIndex) => (
        <SubmittedRow
          key={rowIndex}
          row={row}
          rowIndex={rowIndex}
          wordLength={wordLength}
          boardTheme={boardTheme}
          isGameOver={isGameOver}
          onTransferRowGreenLetters={onTransferRowGreenLetters}
        />
      ))}

      {/* 2. Active Row (if game is still active) */}
      {!isGameOver && !isCompleted && (
        <ActiveRow
          key={`active-row-${submittedCount}`}
          currentAttempt={currentAttempt}
          wordLength={wordLength}
          rowIndex={submittedCount}
          revealedHints={revealedHints}
          isDuplicateAttempt={isDuplicateAttempt}
        />
      )}

      {/* 3. Future Empty Rows */}
      {emptyRowIndices.map((rowIndex) => (
        <EmptyRow
          key={`empty-row-${rowIndex}`}
          wordLength={wordLength}
          rowIndex={rowIndex}
        />
      ))}
    </div>
  );
}

export default memo(GameBoard);
