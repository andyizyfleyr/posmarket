'use client';

import dynamic from 'next/dynamic';
import { useRouter, usePathname } from 'next/navigation';
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
  onBackToApp?: () => Promise<void>;
  onMarketplaceCheckout: (
    ordersData: Record<string, CheckoutStoreOrderDraft>,
    customerData: CheckoutCustomerDraft,
  ) => Promise<{ success: boolean; error?: string | undefined }>;
  onNotifyCartInterest: (
    storeId: string,
    productName: string,
  ) => Promise<{ success: boolean; error?: string | undefined }>;
  onNotifyPostCheckout: (
    ordersData: Record<string, CheckoutStoreOrderDraft>,
  ) => Promise<{ success: boolean; error?: string | undefined }>;
}

export function StorefrontWrapper({ stores, initialCategory, initialStoreId, onBackToApp, onMarketplaceCheckout, onNotifyCartInterest, onNotifyPostCheckout }: StorefrontWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <StorefrontView
      key={pathname || '/'}
      stores={stores}
      initialCategory={initialCategory}
      initialStoreId={initialStoreId}
      onBackToApp={async () => {
        if (onBackToApp) {
          await onBackToApp();
        } else {
          router.push('/dashboard');
        }
      }}
      onMarketplaceCheckout={async (ordersData, customerData) => {
        const result = await onMarketplaceCheckout(ordersData, customerData);
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
