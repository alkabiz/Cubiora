// ─── [SCR-PUB-001] Campanilla Acústica con Web Audio API (Sin Archivos Externos) ─

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioCtx ? new AudioCtx() : null;
}

let sharedContext: AudioContext | null = null;

export function initAudioContext(): AudioContext | null {
  try {
    if (!sharedContext) {
      sharedContext = getAudioContext();
    }
    if (sharedContext && sharedContext.state === 'suspended') {
      sharedContext.resume().catch(() => {});
    }
    return sharedContext;
  } catch {
    return null;
  }
}

/**
 * Reproduce dos tonos armónicos suaves (E5 -> C5) estilo clínica / aeropuerto
 * Degradación silenciosa en entornos sin AudioContext o navegadores con políticas estrictas de autoplay.
 */
export function playChimeSound(): void {
  try {
    const ctx = initAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now); // E5

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(523.25, now + 0.18); // C5

    // Envolvente de volumen suave y decreciente
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.18);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.7);
  } catch {
    // Degradación silenciosa si el navegador bloquea audio o en entorno de tests
  }
}

