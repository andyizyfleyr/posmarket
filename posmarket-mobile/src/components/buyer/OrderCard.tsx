/**
 * Carte de commande — design unique partagé par l'aperçu « Mon compte » et
 * la page « Commandes ».
 *
 * Anatomie : boutique + total / méta + statut / liste des produits.
 * Les actions (avis, recommander) sont optionnelles.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RotateCcw, Star } from 'lucide-react-native';
import { formatCurrency } from '@/utils';
import type { BuyerOrder } from '@/types';
import {
  ProductNameLink,
  ProductThumb,
  StatusBadge,
  formatShortDate,
} from '@/components/buyer/ui';
import { COLORS } from '@/theme';

export interface ReviewTarget {
  id: string;
  name: string;
  image: string;
  business_type?: string;
}

interface OrderCardProps {
  order: BuyerOrder;
  /** Rendre la carte cliquable (aperçu). */
  onPress?: () => void;
  /** Callback d'avis produit (page Commandes). */
  onReviewProduct?: (product: ReviewTarget, storeId: string) => void;
  /** Callback « commander à nouveau ». */
  onReorder?: () => void;
  /** Libellé du bouton de récommandation. */
  reorderLabel?: string;
  reorderDisabled?: boolean;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onPress,
  onReviewProduct,
  onReorder,
  reorderLabel = 'Commander à nouveau',
  reorderDisabled = false,
}) => {
  const items = order.order_items || [];
  const storeName = order.stores?.[0]?.name || 'Boutique';
  const businessType =
    order.stores?.[0]?.business_type ||
    order.order_items?.[0]?.products?.[0]?.business_type;
  const articleCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const body = (
    <>
      <View style={styles.head}>
        <Text style={styles.store} numberOfLines={1}>
          {storeName}
        </Text>
        <StatusBadge status={order.status} businessType={businessType} />
      </View>

      <Text style={styles.meta} numberOfLines={1}>
        {articleCount} article{articleCount > 1 ? 's' : ''} ·{' '}
        {formatShortDate(order.date)}
      </Text>

      <View style={styles.items}>
        {items.map((item, idx) => {
          const product = item.products?.[0];
          return (
            <View key={item.id || `${order.id}-unit-${idx}`} style={styles.item}>
              <ProductThumb src={product?.image} size={28} iconSize={12} />
              <ProductNameLink product={product} style={styles.itemName} />
              <Text style={styles.itemMeta} numberOfLines={1}>
                {item.quantity} × {formatCurrency(item.price)}
              </Text>
              {onReviewProduct && product?.id ? (
                <Pressable
                  onPress={() => onReviewProduct(product, order.store_id || '')}
                  style={({ pressed }) => [styles.reviewBtn, pressed && styles.pressed]}
                  accessibilityLabel={`Laisser un avis sur ${product.name}`}
                >
                  <Star size={12} color={COLORS.brand} fill={COLORS.brand} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLabel}>Total</Text>
        <Text style={styles.footerValue}>{formatCurrency(order.total)}</Text>
      </View>

      {onReorder ? (
        <Pressable
          onPress={onReorder}
          disabled={reorderDisabled}
          style={({ pressed }) => [
            styles.reorderBtn,
            pressed && styles.pressed,
            reorderDisabled && styles.disabled,
          ]}
          accessibilityLabel="Remettre cette commande au panier"
        >
          <RotateCcw size={12} color={COLORS.brand} />
          <Text style={styles.reorderText}>
            {reorderDisabled ? 'Ajout…' : reorderLabel}
          </Text>
        </Pressable>
      ) : null}
    </>
  );

  if (!onPress) return <View style={styles.card}>{body}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      {body}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  store: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: -0.1,
  },
  meta: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textFaint,
  },
  items: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    gap: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textFaint,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  footerValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  itemMeta: {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textFaint,
    fontVariant: ['tabular-nums'],
  },
  reviewBtn: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.brandSoft,
    borderWidth: 1,
    borderColor: COLORS.brandTint,
  },
  reorderText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.brand,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default OrderCard;
