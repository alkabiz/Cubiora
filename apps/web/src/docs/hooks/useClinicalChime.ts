import { useRef, useState, useCallback } from 'react';

export function useClinicalChime() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(false);

  const getOrCreateContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    return audioCtxRef.current;
  }, []);

  const unlockAudio = useCallback(async () => {
    const ctx = getOrCreateContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    setIsAudioUnlocked(ctx.state === 'running');
  }, [getOrCreateContext]);

  const playChime = useCallback(async () => {
    const ctx = getOrCreateContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        setIsAudioUnlocked(false);
        return;
      }
    }

    setIsAudioUnlocked(ctx.state === 'running');
    const now = ctx.currentTime;

    const notes = [
      { freq: 659.25, start: 0, duration: 0.35 },
      { freq: 880.0, start: 0.18, duration: 0.65 },
    ];

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0.001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.25, now + start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration);
    });
  }, [getOrCreateContext]);

  return { playChime, unlockAudio, isAudioUnlocked };
}
