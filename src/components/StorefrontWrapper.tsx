'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { StoreData, Review } from '@/types';
import type { CheckoutStoreOrderDraft, CheckoutCustomerDraft } from '@/views/StorefrontView';

const StorefrontView = dynamic(
  () => import('@/views/StorefrontView').then((m) => m.StorefrontView),
  {
    ssr: true,
    loading: () => (
      <div className="min-h-screen w-full flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-[#f56b2a]/30 border-t-[#f56b2a] rounded-full animate-spin" />
      </div>
    ),
  },
);

interface StorefrontWrapperProps {
  stores: StoreData[];
  initialCategory?: string;
  onBackToApp?: () => Promise<void>;
  onMarketplaceCheckout: (
    ordersData: Record<string, CheckoutStoreOrderDraft>,
    customerData: CheckoutCustomerDraft,
  ) => Promise<{ success: boolean; error?: string | undefined }>;
  onAddReview: (
    storeId: string,
    productId: string,
    review: Review,
  ) => Promise<{ success: boolean; error?: string | undefined }>;
  onNotifyCartInterest: (
    storeId: string,
    productName: string,
  ) => Promise<{ success: boolean; error?: string | undefined }>;
  onNotifyPostCheckout: (
    ordersData: Record<string, CheckoutStoreOrderDraft>,
  ) => Promise<{ success: boolean; error?: string | undefined }>;
}

export function StorefrontWrapper({ stores, initialCategory, onBackToApp, onMarketplaceCheckout, onAddReview, onNotifyCartInterest, onNotifyPostCheckout }: StorefrontWrapperProps) {
  const router = useRouter();

  return (
    <StorefrontView
      stores={stores}
      initialCategory={initialCategory}
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
      onAddReview={async (storeId, productId, review) => {
        const result = await onAddReview(storeId, productId, review);
        return result;
      }}
      onNotifyCartInterest={onNotifyCartInterest}
      onNotifyPostCheckout={onNotifyPostCheckout}
      notify={(msg, type) => {
          console.log(`${type}: ${msg}`);
      }}
    />
  );
}
