/**
 * Barre panier fixe — bandeau blanc + pilule orange 48 px « Voir mon panier ».
 *
 * Même habillage que le web (StorefrontView) : visible sur les pages de
 * découverte (accueil, boutique) et sous les feuilles « Voir tout », où la
 * feuille s'arrête juste au-dessus pour laisser la barre visible et cliquable.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ShoppingCart } from 'lucide-react-native';
import { COLORS } from '@/theme';
import { formatCurrency, getEffectiveItemPrice } from '@/utils';
import { useCart } from '@/context/CartContext';
import { usePromo } from '@/context/PromoContext';

/**
 * Hauteur de la barre sans la zone de sécurité basse :
 * paddingTop 10 + bouton 48 + paddingBottom 10.
 */
export const CART_BAR_CONTENT_HEIGHT = 68;

interface CartBarProps {
  /** Appelé avant la navigation (ex. : fermer la feuille ouverte). */
  onPress?: () => void;
}

export function CartBar({ onPress }: CartBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cart, cartCount } = useCart();
  const { promoApplied } = usePromo();

  if (cartCount <= 0) return null;

  // Total affiché = même calcul que le web (prix de gros − coupon).
  const baseTotal = cart.reduce(
    (sum, item) => sum + getEffectiveItemPrice(item) * (item.quantity || 1),
    0,
  );
  const discount = promoApplied
    ? cart
        .filter((item) => item.product.storeId === promoApplied.store_id)
        .reduce(
          (sum, item) => sum + getEffectiveItemPrice(item) * (item.quantity || 1),
          0,
        ) *
      (promoApplied.discount_pct / 100)
    : 0;
  const cartTotal = Math.max(0, baseTotal - discount);

  const handlePress = () => {
    onPress?.();
    router.push('/cart' as never);
  };

  return (
    <View style={[styles.cartBar, { paddingBottom: insets.bottom + 10 }]}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        onPress={handlePress}
      >
        <View style={styles.iconWrap}>
          <ShoppingCart size={15} strokeWidth={2.5} color="#FFF" />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {cartCount > 99 ? '99+' : cartCount}
            </Text>
          </View>
        </View>
        <Text style={styles.text} numberOfLines={1}>
          Voir mon panier <Text style={styles.bullet}>•</Text>{' '}
          {formatCurrency(cartTotal)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cartBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
  },
  button: {
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  buttonPressed: {
    backgroundColor: '#E04E0F',
  },
  iconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#111827',
    borderWidth: 2,
    borderColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bullet: {
    opacity: 0.4,
  },
});
