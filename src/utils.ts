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

/** Note affichée à la française : 4,8 (et non 4.8). */
export const formatRating = (rating: number): string =>
  (Number.isFinite(rating) ? rating : 0).toFixed(1).replace('.', ',');

/**
 * Fourchette de prix des variantes actives. Sert à afficher « dès X FCFA »
 * sur la carte quand les options changent le prix.
 */
export const variantPriceRange = (
  product: {
    variants?: Array<{ price?: number | null; enabled?: boolean }>;
  } | null
  | undefined,
): { min: number; max: number } | null => {
  const prices = (product?.variants || [])
    .filter((variant) => variant.enabled !== false)
    .map((variant) => Number(variant.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
};

/**
 * Prix affiché d'un produit : celui de la variante la moins chère quand le
 * produit en a, sinon le prix de base.
 */
export const displayPriceOf = (
  product: {
    price?: number | null;
    variants?: Array<{ price?: number | null; enabled?: boolean }>;
  } | null
  | undefined,
): number => {
  const basePrice = Number(product?.price) || 0;
  return variantPriceRange(product)?.min ?? basePrice;
};

/**
 * Produit affichable en vitrine : image et prix valide. Les fiches à 0 FCFA
 * sans variante tarifée sont écartées de l'accueil (elles restent
 * accessibles via la recherche).
 *
 * Le stock n'est pas ici un critère : le web affiche volontairement les
 * produits en rupture (badge « Rupture ») plutôt que de les faire
 * disparaître.
 */
export const isMarketableProduct = (
  product: { image?: string | null; price?: number | null } | null | undefined,
): boolean => Boolean(product?.image) && displayPriceOf(product) > 0;

/**
 * Masque le nom complet pour préserver la vie privée des clients dans les avis.
 * Exemple : "Poppy Roberts" -> "P**** R*****"
 */
export const maskName = (name?: string | null): string => {
  if (!name || !name.trim()) return 'Client vérifié';
  const parts = name.trim().split(/\s+/);
  return parts
    .map((part) => {
      if (part.length <= 1) return part + '***';
      return part[0] + '*'.repeat(Math.min(part.length - 1, 5));
    })
    .join(' ');
};

export * from '@/constants/countries';
import { formatPhoneNumber, isValidPhoneNumber } from '@/constants/countries';

// Legacy / Helper aliases for backward-compatibility
export const formatPhoneSN = (value: string): string => {
  return formatPhoneNumber(value);
};

export const isValidPhoneSN = (value: string): boolean => {
  return isValidPhoneNumber(value);
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
