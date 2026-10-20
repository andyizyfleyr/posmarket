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
    let mounted = true;

    // Préparer l'application (chargement polices, auth, etc.)
    const prepare = async () => {
      try {
        // Le splash custom est déjà rendu derrière le splash natif :
        // on masque le natif tout de suite pour révéler le custom, puis
        // on le laisse affiché 1,5 s avant de monter l'application.
        await SplashScreen.hideAsync();
        await new Promise(resolve => setTimeout(resolve, 1500));
        // Ici vous pouvez ajouter d'autres initialisations asynchrones
      } catch (e) {
        console.warn('Erreur pendant le chargement initial', e);
      } finally {
        if (mounted) setAppReady(true);
      }
    };

    prepare();
    return () => {
      mounted = false;
    };
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
