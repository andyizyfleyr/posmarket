'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { OnboardingProvider } from '@/components/Onboarding/OnboardingContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <OnboardingProvider 
        storesCount={0} 
        productsCount={0} 
        ordersCount={0} 
        settingsConfigured={false}
      >
        {children}
      </OnboardingProvider>
    </QueryClientProvider>
  );
}
