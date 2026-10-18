/**
 * Vitrine de la boutique — Phase 4 du plan.
 * Profil de la boutique, contact, catégories internes et catalogue produits.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Store,
  Star,
  Package,
} from 'lucide-react-native';
import { fetchCatalog, resolveImageUrl } from '@/api/client';
import { Loader } from '@/components/Loader';
import { ProductCard } from '@/components/ProductCard';
import { generateProductSlug } from '@/utils';
import type { StorefrontProduct, StoreData } from '@/types';

export default function StoreScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { data: catalogData, isLoading } = useQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
    staleTime: 60_000,
  });

  const store = useMemo(() => {
    const stores = catalogData?.stores || [];
    return (
      stores.find((s: StoreData) => s.slug === slug || s.id === slug) || null
    );
  }, [catalogData, slug]);

  const storeProducts = useMemo(() => {
    if (!store) return [];
    const products: StorefrontProduct[] = [];
    (store.products || []).forEach((p) => {
      if (p.isOnline !== false) {
        products.push({
          ...p,
          storeId: store.id,
          storeName: store.settings?.name || store.name || 'Boutique',
          storeSlug: store.slug || undefined,
        });
      }
    });
    return products;
  }, [store]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    storeProducts.forEach((p) => {
      if (p.category) cats.add(p.category);
      if (p.mainCategory) cats.add(p.mainCategory);
    });
    return ['all', ...Array.from(cats)];
  }, [storeProducts]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') return storeProducts;
    return storeProducts.filter(
      (p) =>
        p.category === selectedCategory || p.mainCategory === selectedCategory,
    );
  }, [storeProducts, selectedCategory]);

  const navigateToProduct = useCallback(
    (product: StorefrontProduct) => {
      const productSlug = generateProductSlug({
        id: product.id,
        name: product.name,
      });
      router.push(`/product/${productSlug}` as never);
    },
    [router],
  );

  if (isLoading) {
    return <Loader message="Chargement de la boutique..." fullScreen />;
  }

  if (!store) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Boutique introuvable</Text>
        <Text style={styles.errorSub}>Cette boutique n'existe pas ou n'est plus active.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const storeName = store.settings?.name || store.name || 'Boutique';
  const logoUrl = store.settings?.logo ? resolveImageUrl(store.settings.logo as string) : null;
  const description = store.description || store.settings?.description || '';
  const address = store.address || (store.settings?.address as string) || '';
  const phone = store.phone || (store.settings?.phone as string) || '';

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#111827" />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {storeName}
        </Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={
          <View style={styles.headerComponent}>
            {/* Store Card */}
            <View style={styles.storeCard}>
              <View style={styles.storeHeader}>
                {logoUrl ? (
                  <Image
                    source={{ uri: logoUrl }}
                    style={styles.storeLogo}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.storeLogoFallback}>
                    <Store size={28} color="#F56B2A" />
                  </View>
                )}
                <View style={styles.storeInfoCol}>
                  <Text style={styles.storeCardName}>{storeName}</Text>
                  {Boolean(address) && (
                    <View style={styles.metaRow}>
                      <MapPin size={13} color="#6b7280" />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {address}
                      </Text>
                    </View>
                  )}
                  {Boolean(phone) && (
                    <View style={styles.metaRow}>
                      <Phone size={13} color="#6b7280" />
                      <Text style={styles.metaText}>{phone}</Text>
                    </View>
                  )}
                </View>
              </View>

              {Boolean(description) && (
                <Text style={styles.descriptionText}>{description}</Text>
              )}

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Package size={14} color="#F56B2A" />
                  <Text style={styles.statText}>
                    {storeProducts.length} produits
                  </Text>
                </View>
              </View>
            </View>

            {/* Category chips */}
            {categories.length > 2 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      style={[
                        styles.catChip,
                        isSelected ? styles.catChipActive : null,
                      ]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          isSelected ? styles.catChipTextActive : null,
                        ]}
                      >
                        {cat === 'all' ? 'Tous les produits' : cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Text style={styles.catalogHeading}>
              Catalogue ({filteredProducts.length})
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <ProductCard
              product={item}
              onPress={() => navigateToProduct(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Package size={40} color="#9ca3af" />
            <Text style={styles.emptyText}>Aucun produit dans ce rayon</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  topBarTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  headerComponent: {
    paddingTop: 12,
  },
  storeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  storeHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  storeLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3f4f6',
  },
  storeLogoFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF3ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeInfoCol: {
    flex: 1,
    gap: 4,
  },
  storeCardName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  descriptionText: {
    marginTop: 10,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F56B2A',
  },
  categoryScroll: {
    gap: 8,
    paddingBottom: 12,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  catChipActive: {
    backgroundColor: '#F56B2A',
    borderColor: '#F56B2A',
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  catChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  catalogHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
    marginBottom: 12,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardWrapper: {
    width: '48.5%',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F56B2A',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
