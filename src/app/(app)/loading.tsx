import DashboardSkeleton from '@/components/skeletons/DashboardSkeleton';

/**
 * Squelette par défaut de l'espace vendeur.
 *
 * Il ne sert plus qu'aux pages sans `loading.tsx` dédié : `/pos`, `/inventory`,
 * `/orders`, `/invoices`, `/customers`, `/reports` et `/dashboard` ont le leur,
 * calqué sur leur vraie mise en page. Auparavant, ce tableau de bord
 * s'affichait aussi en ouvrant la caisse.
 */
export default function Loading() {
  return <DashboardSkeleton />;
}
