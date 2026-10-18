/**
 * Design tokens PosMarket — alignés sur le web (`src/app/globals.css`).
 *
 * Le web utilise la marque historique orange (#f56b2a) : toute l'app mobile
 * doit référencer ces tokens plutôt que des hex codés en dur.
 */

export const COLORS = {
  // Marque
  brand: '#F56B2A',
  brandHover: '#E55A1B',
  brandSoft: '#FFF3ED',
  brandTint: '#FDE4D7',

  // Encre / textes
  ink: '#002F34',
  text: '#111827',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  price: '#1A1A1A',

  // Surfaces
  background: '#F3F4F6',
  surface: '#FFFFFF',
  surfaceMuted: '#F9FAFB',

  // Lignes
  line: '#EEF0F2',
  lineStrong: '#E2E5E9',
  border: '#F3F4F6',

  // Sémantique
  success: '#059669',
  danger: '#EF4444',
  warning: '#F59E0B',
} as const;

export const RADIUS = {
  card: 12,
  panel: 24,
  chip: 999,
  button: 10,
  input: 12,
} as const;

export const SPACING = {
  page: 16,
  gap: 8,
} as const;
