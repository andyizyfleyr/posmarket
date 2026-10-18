/**
 * CartContext — Panier global pour toute l'application mobile.
 * Persisté dans AsyncStorage avec la clé `storefront_cart`.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEffectiveItemPrice } from '@/utils';
import type { CartItem, StorefrontProduct } from '@/types';

const CART_STORAGE_KEY = 'storefront_cart';

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: StorefrontProduct, quantity?: number, variantId?: string, selectedOptions?: Record<string, string>) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const [loaded, setLoaded] = useState(false);

  // Load cart from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(CART_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const { data, timestamp } = JSON.parse(raw);
            if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && Array.isArray(data)) {
              setCart(data);
            }
          } catch {}
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  // Persist cart to storage
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({ data: cartRef.current, timestamp: Date.now() }),
      ).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [cart, loaded]);

  const addToCart = useCallback(
    (product: StorefrontProduct, quantity = 1, variantId?: string, selectedOptions?: Record<string, string>) => {
      setCart((prev) => {
        const existing = prev.find(
          (item) =>
            item.product.id === product.id &&
            (item.variantId || '') === (variantId || ''),
        );
        if (existing) {
          return prev.map((item) =>
            item.product.id === product.id &&
            (item.variantId || '') === (variantId || '')
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          );
        }
        return [...prev, { product, quantity, variantId, selectedOptions }];
      });
    },
    [],
  );

  const removeFromCart = useCallback(
    (productId: string, variantId?: string) => {
      setCart((prev) =>
        prev.filter(
          (item) =>
            !(
              item.product.id === productId &&
              (item.variantId || '') === (variantId || '')
            ),
        ),
      );
    },
    [],
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number, variantId?: string) => {
      if (quantity <= 0) {
        removeFromCart(productId, variantId);
        return;
      }
      setCart((prev) =>
        prev.map((item) =>
          item.product.id === productId &&
          (item.variantId || '') === (variantId || '')
            ? { ...item, quantity }
            : item,
        ),
      );
    },
    [removeFromCart],
  );

  const clearCart = useCallback(() => {
    setCart([]);
    AsyncStorage.removeItem(CART_STORAGE_KEY).catch(() => {});
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, item) => sum + getEffectiveItemPrice(item) * item.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
