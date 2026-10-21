/**
 * CartContext — Panier global pour toute l'application mobile.
 * Persisté dans AsyncStorage avec la clé `storefront_cart`.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEffectiveItemPrice } from '@/utils';
import { sameSelectedOptions } from '@/utils/variants';
import type { CartItem, StorefrontProduct } from '@/types';

const CART_STORAGE_KEY = 'storefront_cart';

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: StorefrontProduct, quantity?: number, variantId?: string, selectedOptions?: Record<string, string>) => void;
  removeFromCart: (
    productId: string,
    variantId?: string,
    selectedOptions?: Record<string, string>,
  ) => void;
  updateQuantity: (
    productId: string,
    quantity: number,
    variantId?: string,
    selectedOptions?: Record<string, string>,
  ) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

type CartActions = Pick<
  CartContextType,
  'addToCart' | 'removeFromCart' | 'updateQuantity' | 'clearCart'
>;

const CartContext = createContext<CartContextType | undefined>(undefined);
const CartActionsContext = createContext<CartActions | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
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
        JSON.stringify({ data: cart, timestamp: Date.now() }),
      ).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [cart, loaded]);

  /**
   * Plafond de stock réellement disponible pour la ligne. Pour une variante,
   * on utilise son stock ; sinon le stock produit. Une variante désactivée ou
   * un produit hors ligne vaut 0. `null` = stock inconnu (pas de plafond).
   */
  const getAvailableStock = useCallback(
    (product: StorefrontProduct, variantId?: string): number | null => {
      if (product.isOnline === false) return 0;
      if (variantId && Array.isArray(product.variants)) {
        const variant = product.variants.find((entry) => entry.id === variantId);
        if (!variant || variant.enabled === false) return 0;
        const stock = Number(variant.stock);
        return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null;
      }
      if (Array.isArray(product.variants) && product.variants.length > 0) {
        // Une fiche à variantes ne peut pas être ajoutée sans variante.
        return 0;
      }
      const stock = Number(product.stock);
      return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null;
    },
    [],
  );

  const addToCart = useCallback(
    (product: StorefrontProduct, quantity = 1, variantId?: string, selectedOptions?: Record<string, string>) => {
      const available = getAvailableStock(product, variantId);
      if (available !== null && available <= 0) return;

      setCart((prev) => {
        // Deux lignes du même produit ne sont identiques que si la variante
        // ET les options choisies le sont : sans cela, « Rouge » et « Bleu »
        // d'un produit sans matrice seraient fusionnés dans le panier.
        const matches = (item: CartItem) =>
          item.product.id === product.id &&
          item.product.storeId === product.storeId &&
          (item.variantId ?? null) === (variantId ?? null) &&
          sameSelectedOptions(item.selectedOptions, selectedOptions);

        const requested = Math.max(1, Math.floor(Number(quantity) || 1));
        const clamp = (value: number) =>
          available === null ? value : Math.min(value, available);

        const existing = prev.find(matches);
        if (existing) {
          const nextQuantity = clamp(existing.quantity + requested);
          if (nextQuantity <= 0) {
            return prev.filter((item) => !matches(item));
          }
          return prev.map((item) =>
            matches(item) ? { ...item, quantity: nextQuantity } : item,
          );
        }
        const safeQuantity = clamp(requested);
        if (safeQuantity <= 0) return prev;
        return [...prev, { product, quantity: safeQuantity, variantId, selectedOptions }];
      });
    },
    [getAvailableStock],
  );

  const removeFromCart = useCallback(
    (
      productId: string,
      variantId?: string,
      selectedOptions?: Record<string, string>,
    ) => {
      setCart((prev) =>
        prev.filter(
          (item) =>
            !(
              item.product.id === productId &&
              (item.variantId ?? null) === (variantId ?? null) &&
              sameSelectedOptions(item.selectedOptions, selectedOptions)
            ),
        ),
      );
    },
    [],
  );

  const updateQuantity = useCallback(
    (
      productId: string,
      quantity: number,
      variantId?: string,
      selectedOptions?: Record<string, string>,
    ) => {
      if (quantity <= 0) {
        removeFromCart(productId, variantId, selectedOptions);
        return;
      }
      setCart((prev) =>
        prev.flatMap((item) => {
          const matches =
            item.product.id === productId &&
            (item.variantId ?? null) === (variantId ?? null) &&
            sameSelectedOptions(item.selectedOptions, selectedOptions);
          if (!matches) return [item];
          const available = getAvailableStock(item.product, item.variantId);
          const nextQuantity =
            available === null
              ? Math.max(1, Math.floor(Number(quantity) || 1))
              : Math.min(Math.max(1, Math.floor(Number(quantity) || 1)), available);
          if (nextQuantity <= 0) return [];
          return [{ ...item, quantity: nextQuantity }];
        }),
      );
    },
    [getAvailableStock, removeFromCart],
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

  // Les actions sont stables et isolées de l'état du panier : les tuiles
  // produit peuvent ajouter au panier sans se re-rendre à chaque mutation.
  const actions = useMemo<CartActions>(
    () => ({ addToCart, removeFromCart, updateQuantity, clearCart }),
    [addToCart, removeFromCart, updateQuantity, clearCart],
  );

  return (
    <CartActionsContext.Provider value={actions}>
      <CartContext.Provider
        value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal }}
      >
        {children}
      </CartContext.Provider>
    </CartActionsContext.Provider>
  );
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

/** Actions panier seules — à privilégier dans les cartes produit. */
export function useCartActions(): CartActions {
  const ctx = useContext(CartActionsContext);
  if (!ctx) throw new Error('useCartActions must be used within CartProvider');
  return ctx;
}
