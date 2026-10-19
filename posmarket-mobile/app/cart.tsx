/**
 * Écran Panier — Phase 4 du plan.
 * Récapitulatif du panier avec modification des quantités.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ArrowLeft, Minus, Plus, Trash2, ShoppingCart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCart } from '@/context/CartContext';
import { resolveImageUrl } from '@/api/client';
import { formatCurrency, getEffectiveItemPrice } from '@/utils';
import type { CartItem } from '@/types';

export default function CartScreen() {
  const router = useRouter();
  const { cart, updateQuantity, removeFromCart, clearCart, cartTotal } =
    useCart();

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/' as never);
  }, [router]);

  const handleRemove = useCallback(
    (item: CartItem) => {
      Alert.alert(
        'Retirer',
        `Retirer « ${item.product.name} » du panier ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Retirer',
            style: 'destructive',
            onPress: () =>
              removeFromCart(item.product.id, item.variantId),
          },
        ],
      );
    },
    [removeFromCart],
  );

  const handleClearCart = useCallback(() => {
    Alert.alert(
      'Vider le panier',
      'Voulez-vous vider tout le panier ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Vider', style: 'destructive', onPress: clearCart },
      ],
    );
  }, [clearCart]);

  const renderCartItem = useCallback(
    ({ item }: { item: CartItem }) => {
      const imageUrl = resolveImageUrl(item.product.image);
      const lineTotal = getEffectiveItemPrice(item) * item.quantity;

      return (
        <View style={styles.cartItem}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.itemImage}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.itemInfo}>
            <Text style={styles.itemStoreName} numberOfLines={1}>
              {item.product.storeName}
            </Text>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.product.name}
            </Text>
            {item.selectedOptions && (
              <Text style={styles.itemVariant} numberOfLines={1}>
                {Object.values(item.selectedOptions).join(' / ')}
              </Text>
            )}
            <Text style={styles.itemPrice}>
              {formatCurrency(lineTotal)}
            </Text>

            <View style={styles.quantityRow}>
              <Pressable
                style={styles.quantityBtn}
                onPress={() =>
                  updateQuantity(
                    item.product.id,
                    item.quantity - 1,
                    item.variantId,
                  )
                }
              >
                <Minus size={16} color="#374151" />
              </Pressable>
              <Text style={styles.quantityText}>{item.quantity}</Text>
              <Pressable
                style={styles.quantityBtn}
                onPress={() =>
                  updateQuantity(
                    item.product.id,
                    item.quantity + 1,
                    item.variantId,
                  )
                }
              >
                <Plus size={16} color="#374151" />
              </Pressable>
              <Pressable
                style={styles.deleteBtn}
                onPress={() => handleRemove(item)}
              >
                <Trash2 size={16} color="#EF4444" />
              </Pressable>
            </View>
          </View>
        </View>
      );
    },
    [updateQuantity, handleRemove],
  );

  if (cart.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              style={styles.backBtn}
              onPress={goBack}
              hitSlop={8}
              accessibilityLabel="Retour"
            >
              <ArrowLeft size={22} color="#111827" />
            </Pressable>
            <Text style={styles.headerTitle}>Panier</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <ShoppingCart size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Votre panier est vide</Text>
          <Text style={styles.emptySubtitle}>
            Parcourez le catalogue et ajoutez des produits
          </Text>
          <Pressable
            style={styles.browseButton}
            onPress={() => router.push('/' as never)}
          >
            <Text style={styles.browseButtonText}>Explorer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            style={styles.backBtn}
            onPress={goBack}
            hitSlop={8}
            accessibilityLabel="Retour"
          >
            <ArrowLeft size={22} color="#111827" />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Panier</Text>
            <Text style={styles.headerSubtitle}>
              {cart.length} article{cart.length > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <Pressable onPress={handleClearCart}>
          <Text style={styles.clearText}>Vider</Text>
        </Pressable>
      </View>

      <FlatList
        data={cart}
        renderItem={renderCartItem}
        keyExtractor={(item, idx) =>
          `${item.product.id}-${item.variantId || ''}-${idx}`
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom total bar */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{formatCurrency(cartTotal)}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.checkoutButton,
            pressed && styles.checkoutButtonPressed,
          ]}
          onPress={() => router.push('/checkout' as never)}
        >
          <Text style={styles.checkoutText}>Commander</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  clearText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
    gap: 10,
    paddingBottom: 100,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  itemStoreName: {
    fontSize: 11,
    color: '#6B7280',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginTop: 2,
  },
  itemVariant: {
    fontSize: 11,
    color: '#F56B2A',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F56B2A',
    marginTop: 4,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  quantityBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    minWidth: 24,
    textAlign: 'center',
  },
  deleteBtn: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  totalLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  checkoutButton: {
    backgroundColor: '#F56B2A',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  checkoutButtonPressed: {
    backgroundColor: '#E55A1B',
    transform: [{ scale: 0.97 }],
  },
  checkoutText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  browseButton: {
    backgroundColor: '#F56B2A',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  browseButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
