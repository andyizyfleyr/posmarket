let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export function unlockAlertSound() {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') {
    c.resume().catch(() => {});
  }
}

if (typeof window !== 'undefined') {
  const unlockOnce = () => {
    unlockAlertSound();
    window.removeEventListener('pointerdown', unlockOnce);
    window.removeEventListener('keydown', unlockOnce);
  };
  window.addEventListener('pointerdown', unlockOnce);
  window.addEventListener('keydown', unlockOnce);
}

export function playAlertSound() {
  const c = getCtx();
  if (!c) return;
  unlockAlertSound();
  if (c.state !== 'running') return;

  const now = c.currentTime;
  const beeps = 5;
  const freqs = [880, 1174, 880, 1174, 880];

  for (let i = 0; i < beeps; i++) {
    const t = now + i * 0.3;
    const freq = freqs[i] || 880;

    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;

    const osc2 = c.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = freq * 1.5;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.45, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(c.destination);

    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.26);
    osc2.stop(t + 0.26);
  }

  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([300, 80, 300, 80, 300]);
  }
}