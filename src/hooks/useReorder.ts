'use client';

import { useCallback, useState } from 'react';
import { useNavigate } from '@/components/RouterPolyfill';
import { fetchMarketplaceData } from '@/app/actions/marketplace';
import { findVariantByOptions, totalVariantStock } from '@/utils/variants';
import type { BuyerOrder } from '@/components/buyer/accountTypes';
import type { NotifyFn } from '@/components/buyer/accountTypes';
import type { Product, StoreData } from '@/types';

/** Même clé et même forme que le panier du storefront. */
const CART_STORAGE_KEY = 'storefront_cart';

type StorefrontProduct = Product & {
  storeId: string;
  storeName: string;
  storeSlug?: string;
};

type CartLine = {
  product: StorefrontProduct;
  quantity: number;
  variantId?: string;
  selectedOptions?: Record<string, string>;
};

/** Compare deux sélections d'options sans tenir compte de l'ordre des clés. */
const sameSelectedOptions = (
  a?: Record<string, string> | null,
  b?: Record<string, string> | null,
): boolean => {
  if (!a || !b) return !a && !b;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a[k] === b[k]);
};

/** Stock réellement disponible (variantes actives sinon stock de base). */
const effectiveStock = (product: Product): number => {
  const variantStock = totalVariantStock(product.variants);
  if (variantStock !== null) return Math.max(0, variantStock);
  return Math.max(0, Number(product.stock) || 0);
};

const readCart = (): CartLine[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { data?: CartLine[]; timestamp?: number };
    if (!parsed || !Array.isArray(parsed.data)) return [];
    return parsed.data;
  } catch {
    return [];
  }
};

const writeCart = (lines: CartLine[]) => {
  try {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ data: lines, timestamp: Date.now() }),
    );
  } catch {
    /* quota dépassé : on ne casse pas l'interface */
  }
};

/**
 * « Commander à nouveau » — réinjecte dans le panier les lignes d'une commande
 * déjà passée, à l'identique (produit, variante, quantité).
 *
 * Les commandes ne renvoient qu'un instantané (nom, image, prix) : on va donc
 * chercher le catalogue pour retrouver la fiche produit vivante (stock,
 * variantes, options). Ce qui n'existe plus — produit supprimé, boutique hors
 * ligne, rupture de stock, variante retirée — est écarté et signalé.
 */
export function useReorder(notify?: NotifyFn) {
  const navigate = useNavigate();
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const reorder = useCallback(
    async (order: BuyerOrder) => {
      const items = order.order_items || [];
      if (items.length === 0) {
        notify?.('Cette commande ne contient aucun article.', 'error');
        return;
      }

      setPendingOrderId(order.id);
      try {
        const stores = (await fetchMarketplaceData()) as StoreData[];

        // Index des produits vivants : id -> produit de vitrine.
        const products = new Map<string, StorefrontProduct>();
        for (const store of stores || []) {
          const storeName = store.settings?.name || store.name || 'Boutique';
          for (const product of store.products || []) {
            products.set(product.id, {
              ...product,
              storeId: store.id,
              storeName,
              storeSlug: store.slug || undefined,
            });
          }
        }

        const added: string[] = [];
        const skipped: string[] = [];
        /** Lignes prêtes à être fusionnées dans le panier. */
        const toAdd: CartLine[] = [];

        for (const item of items) {
          const reference = item.products?.[0];
          const name = reference?.name || 'Article';
          const product = reference?.id ? products.get(reference.id) : undefined;
          if (!product || product.isOnline === false) {
            skipped.push(name);
            continue;
          }

          const optionValues = item.variantOptionValues || {};
          const variants = product.variants || [];
          let variantId: string | undefined;
          let selectedOptions: Record<string, string> | undefined;

          if (variants.length > 0) {
            const variant =
              findVariantByOptions(variants, optionValues) ||
              (item.variantSku
                ? variants.find(
                    (v) => v.sku === item.variantSku && v.enabled !== false,
                  )
                : undefined);
            if (!variant || variant.enabled === false || Number(variant.stock) <= 0) {
              skipped.push(name);
              continue;
            }
            variantId = variant.id;
            selectedOptions =
              Object.keys(optionValues).length > 0 ? optionValues : undefined;
          } else {
            if (effectiveStock(product) <= 0) {
              skipped.push(name);
              continue;
            }
            if (Object.keys(optionValues).length > 0) {
              selectedOptions = optionValues;
            }
          }

          // Fusion dans le panier existant : une ligne identique ne doit pas
          // être dupliquée, elle est simplement incrémentée.
          const lines = readCart();
          const existing = lines.find(
            (line) =>
              line.product.id === product.id &&
              line.product.storeId === product.storeId &&
              (line.variantId === variantId ||
                (!line.variantId && !variantId)) &&
              sameSelectedOptions(line.selectedOptions, selectedOptions),
          );
          if (existing) {
            existing.quantity += item.quantity || 1;
          } else {
            lines.push({
              product,
              quantity: item.quantity || 1,
              variantId,
              selectedOptions,
            });
          }
          toAdd.push({
            product,
            quantity: item.quantity || 1,
            variantId,
            selectedOptions,
          });
          writeCart(lines);
          added.push(name);
        }

        if (added.length === 0) {
          notify?.(
            "Aucun article de cette commande n'est encore disponible.",
            'warning',
          );
          return;
        }

        // Le panier en mémoire (côté vitrine) doit aussi recevoir les lignes :
        // sa sauvegarde différée ne doit pas écraser cet ajout.
        window.dispatchEvent(
          new CustomEvent('posmarket:cart-add', { detail: { items: toAdd } }),
        );

        notify?.(
          `${added.length} article${added.length > 1 ? 's' : ''} remis au panier.`,
          'success',
        );
        if (skipped.length > 0) {
          notify?.(`Indisponible : ${skipped.join(', ')}.`, 'warning');
        }
        navigate('/cart');
      } catch {
        notify?.('Impossible de remettre cette commande au panier.', 'error');
      } finally {
        setPendingOrderId(null);
      }
    },
    [navigate, notify],
  );

  return { reorder, pendingOrderId };
}

export default useReorder;
