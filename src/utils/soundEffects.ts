// Web Audio API Sound Effects Synthesizer for TDK Savaşçısı Word Game
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    } catch (e) {
      console.warn('Web Audio API is not supported or was blocked:', e);
      return null;
    }
  }
  
  // Resume context if suspended (e.g. due to user gesture policy)
  if (audioCtx && audioCtx.state === 'suspended') {
    try {
      audioCtx.resume();
    } catch (e) {
      console.warn('Failed to resume AudioContext:', e);
    }
  }
  
  return audioCtx;
}

/**
 * Suspends the sound synthesizer context when app goes to background
 */
export function suspendAudioContext() {
  if (audioCtx && audioCtx.state === 'running') {
    audioCtx.suspend().catch(e => console.warn('Failed to suspend AudioContext:', e));
  }
}

/**
 * Resumes the sound synthesizer context when app comes to foreground
 */
export function resumeAudioContext() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(e => console.warn('Failed to resume AudioContext:', e));
  }
}

/**
 * Play a standard key press/click sound
 */
export function playClickSound(enabled: boolean) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  // Quick frequency sweep down for a snappy tap feel
  osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.04);

  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

/**
 * Play a deletion sound
 */
export function playDeleteSound(enabled: boolean) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(350, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.06);

  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.07);
}

/**
 * Play an enter/word submission feedback sound (neutral to pleasant)
 */
export function playEnterSound(enabled: boolean) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.04); // C#
  osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E

  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.setValueAtTime(0.08, ctx.currentTime + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.18);
}

/**
 * Play an error / invalid word buzz sound
 */
export function playErrorSound(enabled: boolean) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  // Detuned saw waves for a dramatic synth-buzz
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(130, ctx.currentTime);
  
  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(132, ctx.currentTime);

  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start();
  osc2.start();
  
  osc1.stop(ctx.currentTime + 0.26);
  osc2.stop(ctx.currentTime + 0.26);
}

/**
 * Play a grand victory arpeggio sound sequence (Havai Fişek & Galibiyet Sesi)
 */
export function playVictorySound(enabled: boolean) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
  
  // Play sparkling arpeggio notes in sequence
  notes.forEach((freq, idx) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    
    // Smooth soft synth tone using triangle wave
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + idx * 0.08);
    
    // Quick volume envelope for each note
    gain.gain.setValueAtTime(0, now + idx * 0.08);
    gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
    
    osc.connect(gain);
    gain.connect(ctx!.destination);
    
    osc.start(now + idx * 0.08);
    osc.stop(now + idx * 0.08 + 0.4);
  });

  // Add a warm brassy root chord in the background
  setTimeout(() => {
    const chordNotes = [261.63, 329.63, 392.00, 523.25]; // C Major Chord
    chordNotes.forEach((freq) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx!.currentTime);
      
      gain.gain.setValueAtTime(0.06, ctx!.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx!.currentTime + 0.8);
      
      osc.connect(gain);
      gain.connect(ctx!.destination);
      
      osc.start();
      osc.stop(ctx!.currentTime + 0.8);
    });
  }, 480);
}

/**
 * Play a melancholic defeat arpeggio/chord sound sequence
 */
export function playDefeatSound(enabled: boolean) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // G4 -> Eb4 -> C4 (Minor Triad downward arpeggio)
  const notes = [392.00, 311.13, 261.63]; 
  
  notes.forEach((freq, idx) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now + idx * 0.12);
    
    // Lowpass filter to make it sound vintage and heavy
    const filter = ctx!.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);

    gain.gain.setValueAtTime(0, now + idx * 0.12);
    gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.12 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.5);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx!.destination);
    
    osc.start(now + idx * 0.12);
    osc.stop(now + idx * 0.12 + 0.65);
  });

  // Low rumbling detuned background bass drone
  setTimeout(() => {
    const bassFreqs = [130.81, 131.81]; // C3 detuned
    bassFreqs.forEach((freq) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx!.currentTime);
      
      gain.gain.setValueAtTime(0.1, ctx!.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx!.currentTime + 1.2);
      
      osc.connect(gain);
      gain.connect(ctx!.destination);
      
      osc.start();
      osc.stop(ctx!.currentTime + 1.2);
    });
  }, 360);
}

/**
 * Play a suspenseful, rhythmic and deep tick-tock/warning sound for the countdown (son 5 saniye)
 */
export function playCountdownBeepSound(enabled: boolean, secondsLeft: number) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const isOdd = secondsLeft % 2 === 1;

  if (isOdd) {
    // "tik" - Woody, resonant mid-frequency click-thud for the clock tick
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(320, now);
    osc1.frequency.exponentialRampToValueAtTime(70, now + 0.08);

    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start();
    osc1.stop(now + 0.12);

    // Crisp high frequency transient layer for the "click"
    const oscClick = ctx.createOscillator();
    const gainClick = ctx.createGain();
    
    oscClick.type = 'sine';
    oscClick.frequency.setValueAtTime(1600, now);
    
    gainClick.gain.setValueAtTime(0.03, now);
    gainClick.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
    
    oscClick.connect(gainClick);
    gainClick.connect(ctx.destination);
    
    oscClick.start();
    oscClick.stop(now + 0.02);
  } else {
    // "tak" - Deep, heavy bass thump for high-suspense heartbeat thud
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(140, now);
    osc2.frequency.exponentialRampToValueAtTime(45, now + 0.15);

    gain2.gain.setValueAtTime(0.28, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start();
    osc2.stop(now + 0.22);
  }
}
