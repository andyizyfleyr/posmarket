'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { StoreData } from '@/types';
import type { CheckoutStoreOrderDraft, CheckoutCustomerDraft } from '@/views/StorefrontView';

const StorefrontView = dynamic(
  () => import('@/views/StorefrontView').then((m) => m.StorefrontView),
  {
    ssr: true,
    loading: () => null,
  },
);

interface StorefrontWrapperProps {
  stores: StoreData[];
  initialCategory?: string;
  initialStoreId?: string;
  /**
   * Conservé pour la compatibilité des 5 pages qui le fournissent. La prop
   * n'était pas consommée par `StorefrontView` : elle est délibérément absente
   * de la destructuration ci-dessous (paramètre déclaré sans usage = lint).
   */
  onBackToApp?: () => void | Promise<void>;
  onMarketplaceCheckout: (
    ordersData: Record<string, CheckoutStoreOrderDraft>,
    customerData: CheckoutCustomerDraft,
    idempotencyKey?: string,
  ) => Promise<{
    success: boolean;
    error?: string | undefined;
    orderId?: string;
    orderIds?: string[];
  }>;
  onNotifyCartInterest: (
    storeId: string,
    productName: string,
  ) => Promise<{ success: boolean; error?: string | undefined }>;
  onNotifyPostCheckout: (
    ordersData: Record<string, CheckoutStoreOrderDraft>,
  ) => Promise<{ success: boolean; error?: string | undefined }>;
}

export function StorefrontWrapper({ stores, initialCategory, initialStoreId, onMarketplaceCheckout, onNotifyCartInterest, onNotifyPostCheckout }: StorefrontWrapperProps) {
  const pathname = usePathname();

  return (
    <StorefrontView
      key={pathname || '/'}
      stores={stores}
      initialCategory={initialCategory}
      initialStoreId={initialStoreId}
      onMarketplaceCheckout={async (ordersData, customerData, idempotencyKey) => {
        const result = await onMarketplaceCheckout(
          ordersData,
          customerData,
          idempotencyKey,
        );
        return result;
      }}
      onNotifyCartInterest={onNotifyCartInterest}
      onNotifyPostCheckout={onNotifyPostCheckout}
      notify={(msg, type) => {
          if (process.env.NODE_ENV !== 'production') console.log(`${type}: ${msg}`);
      }}
    />
  );
}
