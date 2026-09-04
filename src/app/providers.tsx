'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { OnboardingProvider } from '@/components/Onboarding/OnboardingContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  // 📲 Capture le prompt d'installation PWA (banner custom côté storefront)
  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as unknown as { __pwaInstallPrompt?: Event }).__pwaInstallPrompt = e;
      window.dispatchEvent(new Event('pwa:install-available'));
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () =>
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  // 🚀 Register Service Worker (Caching Manager)
  useEffect(() => {
    if (!('serviceWorker' in navigator) || window.location.hostname === 'localhost') return;

    // Auto-reload unique quand un NOUVEAU Service Worker prend le contrôle :
    // garantit que tout le monde exécute le dernier bundle après un
    // déploiement (fini les vieilles UI restées en cache).
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      const last = Number(sessionStorage.getItem('sw_cc_ts') || 0);
      if (Date.now() - last < 30_000) return; // anti-boucle
      refreshing = true;
      sessionStorage.setItem('sw_cc_ts', String(Date.now()));
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('✅ ServiceWorker registration successful:', registration.scope);
          // Vérifie périodiquement les mises à jour du SW
          setInterval(() => registration.update(), 60 * 60 * 1000);
        },
        (err) => {
          console.log('❌ ServiceWorker registration failed:', err);
        }
      );
    };
    window.addEventListener('load', onLoad);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.removeEventListener('load', onLoad);
    };
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
