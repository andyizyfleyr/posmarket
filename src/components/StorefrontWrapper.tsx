'use client';

import { StorefrontView } from '@/views/StorefrontView';
import { useRouter } from 'next/navigation';
import { StoreData } from '@/types';

interface StorefrontWrapperProps {
  stores: StoreData[];
  onBackToApp?: () => Promise<void>;
  onMarketplaceCheckout: (ordersData: any, customerData: any) => Promise<any>;
  onAddReview: (storeId: string, productId: string, review: any) => Promise<any>;
  onNotifyCartInterest: (storeId: string, productName: string) => Promise<any>;
  onNotifyPostCheckout: (ordersData: any) => Promise<any>;
}

export function StorefrontWrapper({ stores, onBackToApp, onMarketplaceCheckout, onAddReview, onNotifyCartInterest, onNotifyPostCheckout }: StorefrontWrapperProps) {
  const router = useRouter();

  return (
    <StorefrontView
      stores={stores}
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
