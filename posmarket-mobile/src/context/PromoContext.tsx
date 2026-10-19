/**
 * Codes promo du panier — mêmes règles que le web (StorefrontView) :
 * - coupons actifs des boutiques présentes dans le panier (React Query) ;
 * - application manuelle du code (saisie, temporisation de 600 ms) ;
 * - persistance locale 24 h (clé `storefront_promo`, comme le web) ;
 * - retrait automatique si le coupon n'est plus actif côté serveur.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { fetchCoupons } from '@/api/client';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/components/ToastProvider';
import type { Coupon } from '@/types';

const PROMO_STORAGE_KEY = 'storefront_promo';

interface PromoContextValue {
  promoApplied: Coupon | null;
  setPromoApplied: React.Dispatch<React.SetStateAction<Coupon | null>>;
  promoCodeInput: string;
  setPromoCodeInput: (value: string) => void;
  isPromoOpen: boolean;
  setIsPromoOpen: (open: boolean) => void;
  isApplying: boolean;
  applyPromo: () => Promise<void>;
}

const PromoContext = createContext<PromoContextValue | undefined>(undefined);

export function PromoProvider({ children }: { children: React.ReactNode }) {
  const { cart } = useCart();
  const { notify } = useToast();

  const [promoApplied, setPromoApplied] = useState<Coupon | null>(null);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [isPromoOpen, setIsPromoOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /** Boutiques du panier — clé stable, comme `cartStoreIdsKey` du web. */
  const storeIds = useMemo(
    () => [...new Set(cart.map((item) => item.product?.storeId).filter(Boolean) as string[])].sort(),
    [cart],
  );
  const storeIdsKey = storeIds.join('|');

  const couponsQuery = useQuery({
    queryKey: ['marketplace-coupons', storeIdsKey],
    enabled: storeIdsKey.length > 0,
    queryFn: async (): Promise<Coupon[]> => {
      const res = await fetchCoupons(storeIds);
      if (!res.success) throw new Error(res.error || 'Erreur lors du chargement des codes promo');
      return res.coupons || [];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  const coupons = useMemo(() => couponsQuery.data || [], [couponsQuery.data]);

  // Restauration du code promo (24 h, comme le web).
  useEffect(() => {
    AsyncStorage.getItem(PROMO_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const { data, timestamp } = JSON.parse(raw);
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && data) {
            setPromoApplied(data);
          }
        } catch {}
      })
      .finally(() => setLoaded(true));
  }, []);

  // Sauvegarde locale à chaque changement.
  useEffect(() => {
    if (!loaded) return;
    if (promoApplied) {
      AsyncStorage.setItem(
        PROMO_STORAGE_KEY,
        JSON.stringify({ data: promoApplied, timestamp: Date.now() }),
      ).catch(() => {});
    } else {
      AsyncStorage.removeItem(PROMO_STORAGE_KEY).catch(() => {});
    }
  }, [promoApplied, loaded]);

  // Un coupon restauré peut avoir été désactivé ou supprimé entre-temps.
  useEffect(() => {
    if (!promoApplied || coupons.length === 0) return;
    const stillValid = coupons.some(
      (c) => c.id === promoApplied.id && c.active,
    );
    if (!stillValid) {
      setPromoApplied(null);
      notify(
        'Code promo expiré ou désactivé : il a été retiré de votre commande.',
        'info',
      );
    }
  }, [coupons, promoApplied, notify]);

  const applyPromo = useCallback(async () => {
    const inputCode = promoCodeInput.trim().toUpperCase();
    setIsApplying(true);

    try {
      await new Promise((r) => setTimeout(r, 600)); // ressenti « traitement », comme le web
      const matchedCoupon = coupons.find(
        (c) => c.code === inputCode && c.active,
      );

      if (matchedCoupon) {
        // La remise ne porte que sur les lignes de la boutique du coupon.
        const eligible = cart.some(
          (item) => item.product.storeId === matchedCoupon.store_id,
        );
        if (!eligible) {
          setPromoCodeInput('');
          notify(
            "Ce code promo s'applique à une boutique qui n'est pas dans votre panier.",
            'error',
          );
          return;
        }
        setPromoApplied({ ...matchedCoupon });
        setPromoCodeInput('');
        notify(
          `Code promo appliqué: ${matchedCoupon.discount_pct}% de réduction!`,
          'success',
        );
      } else if (coupons.length === 0) {
        notify('Aucun code promo disponible pour cette boutique.', 'error');
      } else {
        notify("Ce code promo n'existe pas pour cette boutique.", 'error');
      }
    } catch {
      notify("Erreur lors de l'application du code promo.", 'error');
    } finally {
      setIsApplying(false);
    }
  }, [cart, coupons, notify, promoCodeInput]);

  return (
    <PromoContext.Provider
      value={{
        promoApplied,
        setPromoApplied,
        promoCodeInput,
        setPromoCodeInput,
        isPromoOpen,
        setIsPromoOpen,
        isApplying,
        applyPromo,
      }}
    >
      {children}
    </PromoContext.Provider>
  );
}

export function usePromo(): PromoContextValue {
  const ctx = useContext(PromoContext);
  if (!ctx) throw new Error('usePromo must be used within PromoProvider');
  return ctx;
}
