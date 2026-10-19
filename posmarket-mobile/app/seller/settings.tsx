/**
 * Réglages vendeur — écran mobile (route `/seller/settings`).
 *
 * Le parent web (`src/app/(app)/settings/page.tsx`) fusionne les colonnes de
 * `stores` avec le JSONB `settings` puis rend `SettingsView` ; ici la vue
 * charge l'ensemble via `/api/marketplace/seller/settings` (mêmes données).
 */

import React from 'react';
import { useSeller } from '@/context/SellerContext';
import { SellerSettingsView } from '@/components/seller/SettingsView';
import type { StoreData } from '@/types';

export default function SellerSettingsScreen() {
  const {
    currentStoreId,
    stores,
    permissions,
    user,
    refresh,
    sessionExpired,
  } = useSeller();

  const storeData: StoreData[] = stores.map((store) => ({
    id: store.id,
    slug: store.slug,
    name: store.name,
    description: store.description,
    logo: store.logo,
    settings: {
      ...(store.settings || {}),
      name: store.settings?.name || store.name || '',
      email: store.settings?.email || '',
      phone: store.settings?.phone || '',
      address: store.settings?.address || '',
      ninea: store.settings?.ninea || '',
    },
    business_type: store.businessType === 'food' ? 'food' : 'shopping',
  }));

  return (
    <SellerSettingsView
      storeId={currentStoreId || ''}
      currentUserId={user?.id || ''}
      permissions={permissions}
      stores={storeData}
      userName={user?.name}
      userEmail={user?.email}
      onUnauthorized={sessionExpired}
      onSaved={refresh}
    />
  );
}