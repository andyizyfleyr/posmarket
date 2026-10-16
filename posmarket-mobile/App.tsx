import React, { useState, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { ShoppingBag, Search, X, Check, ArrowLeft, ShoppingCart } from 'lucide-react-native';
import { Product, CartItem } from './src/types';
import { ProductCard } from './src/components/ProductCard';
import { formatCurrency } from './src/utils/format';

// Initial catalog data matching PosMarket (Shopping & Food exclusively)
const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    storeId: 'store-1',
    storeName: 'Mode & Tendance',
    name: 'Sneakers Urban Street Edition',
    price: 35000,
    originalPrice: 45000,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
    description: 'Baskets confortables au design moderne pour un usage quotidien.',
    category: 'Chaussures',
    vertical: 'shopping',
    stock: 12,
    salesCount: 48,
    views: 320,
    options: [{ name: 'Pointure', values: ['40', '41', '42', '43', '44'] }],
  },
  {
    id: 'prod-2',
    storeId: 'store-2',
    storeName: 'Le Gourmet Express',
    name: 'Burger Gourmet & Frites Maison',
    price: 6500,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
    description: 'Pain brioché artisanal, steak haché façon bouchère, cheddar affiné.',
    category: 'Burgers',
    vertical: 'food',
    stock: 50,
    salesCount: 130,
    views: 840,
  },
  {
    id: 'prod-3',
    storeId: 'store-1',
    storeName: 'Mode & Tendance',
    name: 'Montre Chrono Minimaliste',
    price: 52000,
    originalPrice: 65000,
    image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600',
    description: 'Montre étanche avec bracelet cuir véritable et mouvement à quartz.',
    category: 'Accessoires',
    vertical: 'shopping',
    stock: 8,
    salesCount: 19,
    views: 195,
  },
  {
    id: 'prod-4',
    storeId: 'store-2',
    storeName: 'Le Gourmet Express',
    name: 'Pizza Margherita Authentique',
    price: 7500,
    originalPrice: 9000,
    image: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600',
    description: 'Mozzarella fior di latte, sauce tomate San Marzano, basilic frais.',
    category: 'Pizzas',
    vertical: 'food',
    stock: 30,
    salesCount: 95,
    views: 512,
  },
  {
    id: 'prod-5',
    storeId: 'store-1',
    storeName: 'Mode & Tendance',
    name: 'Sac à Dos Explorer Étanche',
    price: 28000,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600',
    description: 'Compartiment renforcé pour ordinateur 15 pouces et poches étanches.',
    category: 'Maroquinerie',
    vertical: 'shopping',
    stock: 0, // Rupture de stock test
    salesCount: 64,
    views: 430,
  },
  {
    id: 'prod-6',
    storeId: 'store-2',
    storeName: 'Le Gourmet Express',
    name: 'Poke Bowl Saumon & Avocat',
    price: 8500,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
    description: 'Saumon frais mariné, riz vinaigré, avocat, edamame et graines de sésame.',
    category: 'Bowls',
    vertical: 'food',
    stock: 25,
    salesCount: 78,
    views: 610,
  },
];

export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVertical, setSelectedVertical] = useState<'all' | 'shopping' | 'food'>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return INITIAL_PRODUCTS.filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchVertical = selectedVertical === 'all' || item.vertical === selectedVertical;
      return matchSearch && matchVertical;
    });
  }, [searchTerm, selectedVertical]);

  // Add to cart
  const handleAddToCart = (product: Product, options?: Record<string, string>) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, selectedOptions: options }];
    });
  };

  // Modify Cart Quantity
  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            return { ...item, quantity: item.quantity + delta };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            <ShoppingBag size={22} color="#EA580C" />
            <Text style={styles.brandTitle}>PosMarket</Text>
          </View>

          <TouchableOpacity
            onPress={() => setIsCartVisible(true)}
            style={styles.cartButton}
            accessibilityLabel="Ouvrir le panier"
          >
            <ShoppingCart size={22} color="#111827" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher des produits ou plats..."
            placeholderTextColor="#9CA3AF"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <X size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Pills: Shopping & Food */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            onPress={() => setSelectedVertical('all')}
            style={[styles.tab, selectedVertical === 'all' && styles.tabActive]}
          >
            <Text style={[styles.tabText, selectedVertical === 'all' && styles.tabTextActive]}>
              Tous les rayons
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedVertical('shopping')}
            style={[styles.tab, selectedVertical === 'shopping' && styles.tabActive]}
          >
            <Text style={[styles.tabText, selectedVertical === 'shopping' && styles.tabTextActive]}>
              🛍️ Shopping
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedVertical('food')}
            style={[styles.tab, selectedVertical === 'food' && styles.tabActive]}
          >
            <Text style={[styles.tabText, selectedVertical === 'food' && styles.tabTextActive]}>
              🍔 Food & Resto
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Product List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onAddToCart={handleAddToCart}
            onClick={() => setSelectedProduct(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucun produit trouvé</Text>
          </View>
        }
      />

      {/* Sticky Bottom Cart Bar if items in cart */}
      {cartCount > 0 && (
        <View style={styles.floatingCartBar}>
          <View>
            <Text style={styles.floatingCartCount}>{cartCount} article{cartCount > 1 ? 's' : ''}</Text>
            <Text style={styles.floatingCartTotal}>{formatCurrency(cartTotal)}</Text>
          </View>
          <TouchableOpacity
            style={styles.floatingCartButton}
            onPress={() => setIsCartVisible(true)}
          >
            <Text style={styles.floatingCartButtonText}>Voir le panier</Text>
            <ShoppingCart size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Product Details Modal */}
      <Modal
        visible={selectedProduct !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedProduct(null)}
      >
        {selectedProduct && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setSelectedProduct(null)}
                style={styles.closeButton}
              >
                <ArrowLeft size={22} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle} numberOfLines={1}>
                {selectedProduct.name}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Image
                source={{ uri: selectedProduct.image }}
                style={styles.detailImage}
                contentFit="cover"
              />

              <View style={styles.detailBody}>
                <Text style={styles.detailStore}>{selectedProduct.storeName}</Text>
                <Text style={styles.detailTitle}>{selectedProduct.name}</Text>
                <Text style={styles.detailPrice}>{formatCurrency(selectedProduct.price)}</Text>

                {selectedProduct.description && (
                  <View style={styles.descriptionBlock}>
                    <Text style={styles.sectionHeading}>Description</Text>
                    <Text style={styles.detailDescription}>
                      {selectedProduct.description}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  selectedProduct.stock === 0 && styles.disabledButton,
                ]}
                disabled={selectedProduct.stock === 0}
                onPress={() => {
                  handleAddToCart(selectedProduct);
                  setSelectedProduct(null);
                }}
              >
                <Text style={styles.primaryButtonText}>
                  {selectedProduct.stock === 0 ? 'Rupture de stock' : 'Ajouter au panier'}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}
      </Modal>

      {/* Cart Modal */}
      <Modal
        visible={isCartVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsCartVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsCartVisible(false)} style={styles.closeButton}>
              <X size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Mon Panier</Text>
            <View style={{ width: 24 }} />
          </View>

          {orderSuccess ? (
            <View style={styles.successBlock}>
              <View style={styles.successIconCircle}>
                <Check size={36} color="#FFFFFF" />
              </View>
              <Text style={styles.successTitle}>Commande Confirmée !</Text>
              <Text style={styles.successSubtitle}>
                Merci pour votre achat sur PosMarket. Votre commande est en cours de préparation.
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  setCart([]);
                  setOrderSuccess(false);
                  setIsCartVisible(false);
                }}
              >
                <Text style={styles.primaryButtonText}>Continuer les achats</Text>
              </TouchableOpacity>
            </View>
          ) : cart.length === 0 ? (
            <View style={styles.emptyCartContainer}>
              <ShoppingBag size={48} color="#D1D5DB" />
              <Text style={styles.emptyCartTitle}>Votre panier est vide</Text>
              <Text style={styles.emptyCartSubtitle}>
                Explorez le catalogue pour ajouter des articles.
              </Text>
            </View>
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.cartItemsList}>
                {cart.map((item) => (
                  <View key={item.product.id} style={styles.cartItemRow}>
                    <Image
                      source={{ uri: item.product.image }}
                      style={styles.cartItemImage}
                      contentFit="cover"
                    />
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemTitle} numberOfLines={1}>
                        {item.product.name}
                      </Text>
                      <Text style={styles.cartItemPrice}>
                        {formatCurrency(item.product.price)}
                      </Text>
                    </View>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        onPress={() => handleUpdateQuantity(item.product.id, -1)}
                        style={styles.stepperButton}
                      >
                        <Text style={styles.stepperButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{item.quantity}</Text>
                      <TouchableOpacity
                        onPress={() => handleUpdateQuantity(item.product.id, 1)}
                        style={styles.stepperButton}
                      >
                        <Text style={styles.stepperButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.cartFooter}>
                <View style={styles.cartTotalRow}>
                  <Text style={styles.cartTotalLabel}>Total TTC</Text>
                  <Text style={styles.cartTotalAmount}>{formatCurrency(cartTotal)}</Text>
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => setOrderSuccess(true)}
                >
                  <Text style={styles.primaryButtonText}>Valider la commande</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  cartButton: {
    padding: 6,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EA580C',
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  tabActive: {
    backgroundColor: '#EA580C',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 8,
    paddingBottom: 90,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  floatingCartBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  floatingCartCount: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
  floatingCartTotal: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  floatingCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EA580C',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  floatingCartButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeButton: {
    padding: 4,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  modalScroll: {
    paddingBottom: 24,
  },
  detailImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F3F4F6',
  },
  detailBody: {
    padding: 16,
  },
  detailStore: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EA580C',
    marginBottom: 4,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  detailPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },
  descriptionBlock: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  detailDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  primaryButton: {
    backgroundColor: '#EA580C',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#D1D5DB',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cartItemsList: {
    padding: 16,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cartItemImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EA580C',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
  },
  stepperButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stepperButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  stepperValue: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 8,
    color: '#111827',
  },
  cartFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  cartTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cartTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
  cartTotalAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  emptyCartContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyCartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 6,
  },
  emptyCartSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  successBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
});
