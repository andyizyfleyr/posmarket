/**
 * Root Layout.
 * Providers globaux : React Query, panier, authentification, promotions.
 * L'application démarre sur le storefront acheteur (`app/index.tsx`).
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CartProvider } from '@/context/CartContext';
import { PromoProvider } from '@/context/PromoContext';
import { AuthProvider } from '@/context/AuthContext';
import { CartAddToastProvider } from '@/components/CartAddToast';
import { ToastProvider } from '@/components/ToastProvider';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AnimatedSplash } from '@/components/AnimatedSplash';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
    },
  },
});

// Empêcher l'écran de lancement natif de se cacher automatiquement.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const handleSplashFinish = useCallback(() => setIsSplashVisible(false), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CartAddToastProvider>
          <AuthProvider>
            <CartProvider>
              <PromoProvider>
                <View style={styles.root}>
                  <StatusBar style="dark" />
                  <OfflineBanner />
                  <View style={styles.content}>
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
                  </View>
                  {isSplashVisible && (
                    <AnimatedSplash onFinish={handleSplashFinish} />
                  )}
                </View>
              </PromoProvider>
            </CartProvider>
          </AuthProvider>
        </CartAddToastProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
});
