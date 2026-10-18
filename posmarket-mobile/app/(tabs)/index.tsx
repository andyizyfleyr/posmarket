/**
 * Écran Accueil — Phase 4.1 du plan.
 * Barre de recherche, filtres catégories, grille 2 colonnes FlatList.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Search, X, Store, MapPin } from 'lucide-react-native';
import { fetchCatalog, searchProducts } from '@/api/client';
import { ProductCard } from '@/components/ProductCard';
import { Loader } from '@/components/Loader';
import { MAIN_CATEGORIES, CATEGORY_ICONS } from '@/constants';
import { formatCurrency, generateProductSlug } from '@/utils';
import type { StorefrontProduct, StoreData } from '@/types';

export default function HomeScreen() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // ── Catalog query ──
  const {
    data: catalogData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
    staleTime: 60_000,
  });

  // ── Search query ──
  const debouncedSearch = searchTerm.trim();
  const {
    data: searchData,
    isFetching: isSearching,
  } = useQuery({
    queryKey: ['search', debouncedSearch],
    queryFn: () => searchProducts(debouncedSearch, 30),
    enabled: debouncedSearch.length >= 2,
    staleTime: 30_000,
  });

  // ── Derive products ──
  const allProducts = useMemo(() => {
    const stores = catalogData?.stores || [];
    const products: StorefrontProduct[] = [];
    stores.forEach((store: StoreData) => {
      (store.products || []).forEach((product) => {
        if (product.isOnline !== false) {
          products.push({
            ...product,
            storeId: store.id,
            storeName: store.settings?.name || store.name || 'Boutique',
            storeSlug: store.slug || undefined,
          });
        }
      });
    });
    return products;
  }, [catalogData]);

  const displayProducts = useMemo(() => {
    if (debouncedSearch.length >= 2 && searchData?.products) {
      return searchData.products;
    }
    if (selectedCategory === 'all') return allProducts;
    return allProducts.filter(
      (p) =>
        p.category === selectedCategory ||
        p.mainCategory === selectedCategory,
    );
  }, [allProducts, selectedCategory, debouncedSearch, searchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const navigateToProduct = useCallback(
    (product: StorefrontProduct) => {
      const slug = generateProductSlug({ id: product.id, name: product.name });
      router.push(`/product/${slug}` as never);
    },
    [router],
  );

  // ── Categories with counts ──
  const categoriesWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allProducts.forEach((p) => {
      const cat = p.mainCategory || p.category || 'Divers';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return MAIN_CATEGORIES.filter((cat) => (counts[cat] || 0) > 0).map(
      (cat) => ({
        name: cat,
        count: counts[cat] || 0,
        icon: CATEGORY_ICONS[cat] || '📦',
      }),
    );
  }, [allProducts]);

  const renderProduct = useCallback(
    ({ item }: { item: StorefrontProduct }) => (
      <ProductCard product={item} onPress={navigateToProduct} />
    ),
    [navigateToProduct],
  );

  if (isLoading && allProducts.length === 0) {
    return <Loader fullScreen message="Chargement du catalogue..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>PosMarket</Text>
            <Text style={styles.headerSubtitle}>
              {allProducts.length} produit{allProducts.length > 1 ? 's' : ''} disponible{allProducts.length > 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.headerBadge}>
            <Store size={18} color="#2563EB" />
            <Text style={styles.headerBadgeText}>
              {catalogData?.stores?.length || 0}
            </Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un produit, une boutique..."
            placeholderTextColor="#9CA3AF"
            value={searchTerm}
            onChangeText={setSearchTerm}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchTerm.length > 0 && (
            <Pressable onPress={() => setSearchTerm('')}>
              <X size={18} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Category filter chips */}
      {debouncedSearch.length < 2 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          <Pressable
            style={[
              styles.categoryChip,
              selectedCategory === 'all' && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === 'all' && styles.categoryChipTextActive,
              ]}
            >
              Tout ({allProducts.length})
            </Text>
          </Pressable>
          {categoriesWithCounts.map((cat) => (
            <Pressable
              key={cat.name}
              style={[
                styles.categoryChip,
                selectedCategory === cat.name && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat.name)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === cat.name &&
                    styles.categoryChipTextActive,
                ]}
              >
                {cat.icon} {cat.name.split(' ')[0]} ({cat.count})
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Search indicator */}
      {isSearching && debouncedSearch.length >= 2 && (
        <View style={styles.searchIndicator}>
          <Loader size="small" message={`Recherche « ${debouncedSearch} »...`} />
        </View>
      )}

      {/* Products grid */}
      <FlatList
        data={displayProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => `${item.id}-${item.storeId}`}
        numColumns={2}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563EB"
            colors={['#2563EB']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              {debouncedSearch.length >= 2
                ? `Aucun résultat pour « ${debouncedSearch} »`
                : 'Aucun produit dans cette catégorie'}
            </Text>
            <Text style={styles.emptySubtitle}>
              Essayez un autre terme ou explorez les catégories
            </Text>
          </View>
        }
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    ...Platform.select({
      android: { paddingVertical: 0 },
    }),
  },
  categoriesContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  categoryChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 6,
  },
  categoryChipActive: {
    backgroundColor: '#2563EB',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  categoryChipTextActive: {
    color: '#FFF',
  },
  searchIndicator: {
    paddingVertical: 8,
  },
  gridContent: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 6,
  },
});
