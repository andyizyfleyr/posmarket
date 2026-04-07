'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { OnboardingProvider } from '@/components/Onboarding/OnboardingContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // 🚀 Register Service Worker (Caching Manager)
  useEffect(() => {
    if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(
                (registration) => {
                    console.log('✅ ServiceWorker registration successful:', registration.scope);
                },
                (err) => {
                    console.log('❌ ServiceWorker registration failed:', err);
                }
            );
        });
    }
  }, []);

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
