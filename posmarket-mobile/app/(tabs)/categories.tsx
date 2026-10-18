/**
 * Écran Catégories — Phase 4 du plan.
 * Exploration des rayons par catégorie.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { fetchCatalog } from '@/api/client';
import { Loader } from '@/components/Loader';
import { MAIN_CATEGORIES, CATEGORY_ICONS } from '@/constants';
import type { StoreData, StorefrontProduct } from '@/types';

interface CategoryRow {
  name: string;
  icon: string;
  count: number;
  products: StorefrontProduct[];
}

export default function CategoriesScreen() {
  const router = useRouter();

  const { data: catalogData, isLoading } = useQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
    staleTime: 60_000,
  });

  const categories = useMemo(() => {
    const stores = catalogData?.stores || [];
    const productsByCategory: Record<string, StorefrontProduct[]> = {};

    stores.forEach((store: StoreData) => {
      (store.products || []).forEach((product) => {
        if (product.isOnline === false) return;
        const cat = product.mainCategory || product.category || 'Divers';
        if (!productsByCategory[cat]) productsByCategory[cat] = [];
        productsByCategory[cat].push({
          ...product,
          storeId: store.id,
          storeName: store.settings?.name || store.name || 'Boutique',
          storeSlug: store.slug || undefined,
        });
      });
    });

    return MAIN_CATEGORIES.filter((cat) => (productsByCategory[cat]?.length || 0) > 0)
      .map(
        (cat): CategoryRow => ({
          name: cat,
          icon: CATEGORY_ICONS[cat] || '📦',
          count: productsByCategory[cat]?.length || 0,
          products: productsByCategory[cat] || [],
        }),
      );
  }, [catalogData]);

  if (isLoading) {
    return <Loader fullScreen message="Chargement..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Catégories</Text>
        <Text style={styles.headerSubtitle}>
          Explorez par rayon
        </Text>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.categoryRow,
              pressed && styles.categoryRowPressed,
            ]}
            onPress={() => {
              // Navigate to home with category filter
              router.push('/(tabs)' as never);
            }}
          >
            <View style={styles.categoryIcon}>
              <Text style={styles.categoryIconText}>{item.icon}</Text>
            </View>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>{item.name}</Text>
              <Text style={styles.categoryCount}>
                {item.count} produit{item.count > 1 ? 's' : ''}
              </Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </Pressable>
        )}
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  listContent: {
    padding: 12,
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  categoryRowPressed: {
    backgroundColor: '#F9FAFB',
    transform: [{ scale: 0.98 }],
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryIconText: {
    fontSize: 22,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  categoryCount: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
});
