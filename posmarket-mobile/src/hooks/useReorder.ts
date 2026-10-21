/**
 * « Commander à nouveau » — réinjecte dans le panier les lignes d'une
 * commande déjà passée, à l'identique (produit, variante, quantité).
 *
 * Les commandes ne renvoient qu'un instantané (nom, image, prix) : on va donc
 * chercher le catalogue pour retrouver la fiche produit vivante (stock,
 * variantes, options). Ce qui n'existe plus — produit supprimé, boutique
 * hors ligne, rupture de stock, variante retirée — est écarté et signalé.
 */

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { fetchCatalog } from '@/api/client';
import { useCartActions } from '@/context/CartContext';
import { useToast } from '@/components/ToastProvider';
import { findVariantByOptions } from '@/utils/variants';
import { effectiveProductStock } from '@/utils';
import type { BuyerOrder, StoreData, StorefrontProduct } from '@/types';

const CATALOG_QUERY_KEY = ['catalog'];

export function useReorder() {
  const { addToCart } = useCartActions();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const reorder = useCallback(
    async (order: BuyerOrder) => {
      const items = order.order_items || [];
      if (items.length === 0) {
        notify('Cette commande ne contient aucun article.', 'error');
        return;
      }

      setPendingOrderId(order.id);
      try {
        const catalog = await queryClient.fetchQuery({
          queryKey: CATALOG_QUERY_KEY,
          queryFn: fetchCatalog,
          staleTime: 60_000,
        });

        // Index des produits vivants : id -> produit de vitrine.
        const products = new Map<string, StorefrontProduct>();
        for (const store of (catalog?.stores || []) as StoreData[]) {
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
            if (effectiveProductStock(product) <= 0) {
              skipped.push(name);
              continue;
            }
            if (Object.keys(optionValues).length > 0) {
              selectedOptions = optionValues;
            }
          }

          addToCart(product, item.quantity || 1, variantId, selectedOptions);
          added.push(name);
        }

        if (added.length === 0) {
          notify(
            "Aucun article de cette commande n'est encore disponible.",
            'warning',
          );
          return;
        }

        notify(
          `${added.length} article${added.length > 1 ? 's' : ''} remis au panier.`,
          'success',
        );
        if (skipped.length > 0) {
          notify(
            `Indisponible : ${skipped.join(', ')}.`,
            'warning',
          );
        }
        router.push('/cart' as never);
      } catch {
        notify('Impossible de remettre cette commande au panier.', 'error');
      } finally {
        setPendingOrderId(null);
      }
    },
    [addToCart, notify, queryClient],
  );

  return { reorder, pendingOrderId };
}
