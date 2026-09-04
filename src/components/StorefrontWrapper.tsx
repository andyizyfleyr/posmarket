'use client';

import { StorefrontView, CheckoutStoreOrderDraft, CheckoutCustomerDraft } from '@/views/StorefrontView';
import { useRouter } from 'next/navigation';
import { StoreData, Review } from '@/types';

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
          // You could use a global toast here if you have one, 
          // but StorefrontView has its own local toast system too.
          console.log(`${type}: ${msg}`);
      }}
    />
  );
}
