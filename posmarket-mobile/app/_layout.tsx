/**
 * Root Layout — Phase 4 du plan.
 * Providers globaux : React Query, CartProvider.
 * Redirige vers /seller (tableau de bord vendeur) comme l'app web vendeur.
 */

/**
 * Root Layout — Phase 4 du plan.
 * Providers globaux : React Query, CartProvider.
 * Redirige vers /seller (tableau de bord vendeur) comme l'app web vendeur.
 */

import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CartProvider } from '@/context/CartContext';
import { PromoProvider } from '@/context/PromoContext';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ToastProvider';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SplashScreen as SplashScreenComponent } from '@/components/SplashScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
    },
  },
});

// Empêcher l'écran de lancement natif de se cacher automatiquement
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // Préparer l'application (chargement polices, auth, etc.)
    const prepare = async () => {
      try {
        // Attendre un minimum pour afficher le splash custom (ex: 1.5s)
        await new Promise(resolve => setTimeout(resolve, 1500));
        // Ici vous pouvez ajouter d'autres initialisations asynchrones
      } catch (e) {
        console.warn('Erreur pendant le chargement initial', e);
      } finally {
        // Cacher l'écran de lancement natif
        await SplashScreen.hideAsync();
        setAppReady(true);
      }
    };

    prepare();
  }, []);

  if (!appReady) {
    return <SplashScreenComponent />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <PromoProvider>
            <StatusBar style="dark" />
            <OfflineBanner />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="seller/*" />
              <Stack.Screen
                name="cart"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="account"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="product/[slug]"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="store/[slug]"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="checkout"
                options={{
                  headerShown: false,
                  animation: 'slide_from_bottom',
                }}
              />
            </Stack>
            </PromoProvider>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
