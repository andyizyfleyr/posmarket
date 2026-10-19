/**
 * Factures vendeur — écran mobile (route `/seller/invoices`).
 *
 * Le parent web (`src/app/(app)/invoices/page.tsx`) charge la liste côté
 * serveur puis rend `InvoicesView` ; ici la vue interroge la route
 * `/api/marketplace/seller/invoices` (factures, produits du sélecteur
 * d'articles et boutique de la facture).
 *
 * Comme au web, l'entrée « Factures » n'existe pas dans la navigation mobile
 * (BottomNav) : l'écran n'est atteignable que par cette URL.
 */

import React from 'react';
import { useSeller } from '@/context/SellerContext';
import { SellerInvoicesView } from '@/components/seller/InvoicesView';

export default function SellerInvoicesScreen() {
  const { currentStoreId, permissions, role, sessionExpired } = useSeller();

  if (!currentStoreId) return null;

  return (
    <SellerInvoicesView
      storeId={currentStoreId}
      canManageInvoices={Boolean(permissions?.canManageInvoices)}
      isSeller={role === 'SELLER'}
      onUnauthorized={sessionExpired}
    />
  );
}
