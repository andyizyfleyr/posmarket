export const formatNumber = (num: number): string => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 1_000_000_000) {
    const value = num / 1_000_000_000;
    return value % 1 === 0 ? `${value}B` : `${value.toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (num >= 1_000_000) {
    const value = num / 1_000_000;
    return value % 1 === 0 ? `${value}M` : `${value.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (num >= 1_000) {
    const value = num / 1_000;
    return value % 1 === 0 ? `${value}K` : `${value.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return num.toString();
};

export const formatCurrency = (amount: number): string => {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 FCFA';
  return Math.floor(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
};

// Téléphone Sénégal : "+221 77 123 45 67" (affichage groupé, chiffres seuls stockés côté API)
export const formatPhoneSN = (value: string): string => {
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00221')) digits = digits.slice(5);
  else if (digits.startsWith('221')) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  const groups = digits.match(/.{1,2}/g) || [];
  return `+221 ${groups.join(' ')}`.trim();
};

export const isValidPhoneSN = (value: string): boolean => {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('221')) digits = digits.slice(3);
  return digits.length >= 7 && /^[0-9]+$/.test(digits);
};

export const playSuccessSound = () => {
  try {
    const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextCtor();
    
    // Resume context on mobile
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
  } catch {
    console.log('Sound not supported');
  }
};

export const getDaysRemaining = (end: string): number => {
  const endDate = new Date(end);
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

export const generateSlug = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // remove accents
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
};
