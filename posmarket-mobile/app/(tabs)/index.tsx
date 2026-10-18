/**
 * Écran Accueil — fidèle à la home web (StorefrontView) :
 * header (logo + recherche + catégories), hero 3 affiches, boutiques
 * partenaires, produits groupés par catégorie (6 par section + « Voir tout »),
 * footer. Recherche et filtre catégorie → grille simple 2 colonnes.
 */

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
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
  useWindowDimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  Search,
  X,
  Store,
  Star,
  Check,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  MapPin,
} from 'lucide-react-native';
import {
  fetchCatalog,
  searchProducts,
  API_BASE_URL,
} from '@/api/client';
import { ProductCard } from '@/components/ProductCard';
import { Loader } from '@/components/Loader';
import {
  MAIN_CATEGORIES,
  CATEGORY_ICONS,
  verticalOfProduct,
} from '@/constants';
import { generateProductSlug } from '@/utils';
import { COLORS } from '@/theme';
import type { StorefrontProduct, StoreData } from '@/types';

const SECTION_PREVIEW_COUNT = 6;

const HERO_SLIDES = [
  `${API_BASE_URL}/affiches/affiche_mobile_1x.webp`,
  `${API_BASE_URL}/affiches/affiche_acheteurs_mobile_1x.webp`,
  `${API_BASE_URL}/affiches/affiche_vente_gros_mobile_1x.webp`,
];

const LEGAL_LINKS = [
  { label: "Guide d'utilisation", path: '/docs/utilisation' },
  { label: 'Conditions Générales de Vente', path: '/cgv' },
  { label: 'Politique de confidentialité', path: '/confidentialite' },
];

// ── Types des éléments de la liste hétérogène ─────────────────────

type HomeItem =
  | { key: string; type: 'hero' }
  | { key: string; type: 'partners' }
  | {
      key: string;
      type: 'sectionHeader';
      category: string;
      vertical: 'shopping' | 'food';
    }
  | { key: string; type: 'catHeader'; category: string; count: number }
  | { key: string; type: 'row'; products: StorefrontProduct[] }
  | { key: string; type: 'empty'; mode: 'search' | 'category' | 'none'; label: string }
  | { key: string; type: 'footer' };

interface PartnerEntry {
  store: StoreData;
  productCount: number;
}

// ── Hero carrousel (3 affiches, défilement auto) ──────────────────

function HeroCarousel() {
  const { width } = useWindowDimensions();
  const slideWidth = width - 32;
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (pausedRef.current) return;
      setIndex((i) => {
        const next = (i + 1) % HERO_SLIDES.length;
        scrollRef.current?.scrollTo({ x: next * slideWidth, animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(timer);
  }, [slideWidth]);

  return (
    <View style={styles.heroWrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={slideWidth}
        decelerationRate="fast"
        onScrollBeginDrag={() => {
          pausedRef.current = true;
        }}
        onScrollEndDrag={() => {
          pausedRef.current = false;
        }}
        onMomentumScrollEnd={(e) =>
          setIndex(
            Math.min(
              HERO_SLIDES.length - 1,
              Math.max(0, Math.round(e.nativeEvent.contentOffset.x / slideWidth)),
            ),
          )
        }
      >
        {HERO_SLIDES.map((uri) => (
          <Image
            key={uri}
            source={{ uri }}
            style={{ width: slideWidth, aspectRatio: 720 / 560 }}
            contentFit="cover"
            transition={200}
          />
        ))}
      </ScrollView>
      <View style={styles.heroDots}>
        {HERO_SLIDES.map((uri, i) => (
          <View
            key={uri}
            style={[styles.heroDot, i === index && styles.heroDotActive]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Boutiques partenaires ─────────────────────────────────────────

function PartnersRow({
  entries,
  onOpen,
}: {
  entries: PartnerEntry[];
  onOpen: (store: StoreData) => void;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - 32 - 10) / 2;

  return (
    <View style={styles.partnersSection}>
      <View style={styles.partnersTitleRow}>
        <Text style={styles.partnersTitle}>Boutiques partenaires</Text>
        <Text style={styles.partnersCount}>{entries.length}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.partnersScroll}
        snapToInterval={cardWidth + 10}
        decelerationRate="fast"
      >
        {entries.map(({ store, productCount }) => {
          const name = store.settings?.name || store.name || 'Boutique';
          const logo = resolveStoreLogo(store);
          return (
            <Pressable
              key={store.id}
              style={({ pressed }) => [
                styles.partnerCard,
                { width: cardWidth },
                pressed && styles.partnerCardPressed,
              ]}
              onPress={() => onOpen(store)}
            >
              <View style={styles.partnerLogo}>
                {logo ? (
                  <Image
                    source={{ uri: logo }}
                    style={styles.partnerLogoImg}
                    contentFit="cover"
                    transition={150}
                  />
                ) : (
                  <Store size={18} color={COLORS.brand} />
                )}
              </View>
              <View style={styles.partnerNameRow}>
                <Text style={styles.partnerName} numberOfLines={1}>
                  {name}
                </Text>
                <View style={styles.verifiedBadge}>
                  <Check size={6} strokeWidth={4} color="#FFF" />
                </View>
              </View>
              <View style={styles.partnerMeta}>
                {(store.rating ?? 0) > 0 ? (
                  <View style={styles.partnerRating}>
                    <Star size={9} color={COLORS.brand} fill={COLORS.brand} />
                    <Text style={styles.partnerRatingText}>
                      {(store.rating ?? 0).toFixed(1)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.partnerNew}>Nouveau</Text>
                )}
                <Text style={styles.partnerDot}>•</Text>
                <Text style={styles.partnerCount} numberOfLines={1}>
                  {productCount} produits
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function resolveStoreLogo(store: StoreData): string {
  const raw = store.settings?.logo;
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return `${API_BASE_URL}${raw}`;
  return raw;
}

// ── En-tête de section catégorie ──────────────────────────────────

function SectionHeader({
  category,
  vertical,
  onSeeAll,
}: {
  category: string;
  vertical: 'shopping' | 'food';
  onSeeAll: (category: string) => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} numberOfLines={1}>
        {category}
        {vertical === 'food' && (
          <Text style={styles.sectionFoodTag}>  Restauration</Text>
        )}
      </Text>
      <Pressable
        onPress={() => onSeeAll(category)}
        style={styles.sectionSeeAll}
        hitSlop={8}
      >
        <Text style={styles.sectionSeeAllText}>Voir tout</Text>
        <ChevronRight size={13} strokeWidth={3} color={COLORS.brand} />
      </Pressable>
    </View>
  );
}

// ── Footer ────────────────────────────────────────────────────────

function HomeFooter() {
  const openUrl = useCallback((path: string) => {
    Linking.openURL(`${API_BASE_URL}${path}`).catch(() => {});
  }, []);

  return (
    <View style={styles.footer}>
      <Image
        source={require('../../assets/logo-trimmed.png')}
        style={styles.footerLogo}
        contentFit="contain"
      />
      <Text style={styles.footerTagline}>
        Place de marché reliant les vendeurs et les acheteurs.
      </Text>

      <Text style={styles.footerHeading}>Légal</Text>
      {LEGAL_LINKS.map((link) => (
        <Pressable key={link.path} onPress={() => openUrl(link.path)}>
          <Text style={styles.footerLink}>{link.label}</Text>
        </Pressable>
      ))}

      <Text style={styles.footerHeading}>Nos engagements</Text>
      <View style={styles.footerBulletRow}>
        <ShieldCheck size={14} color="#22C55E" />
        <Text style={styles.footerBullet}>Paiement sécurisé</Text>
      </View>
      <View style={styles.footerBulletRow}>
        <MapPin size={14} color={COLORS.brand} />
        <Text style={styles.footerBullet}>Commerçants locaux vérifiés</Text>
      </View>

      <View style={styles.footerDivider} />
      <Text style={styles.footerLegal}>
        © {new Date().getFullYear()} PosMarket — Tous droits réservés
      </Text>
      <Text style={styles.footerLegal}>Prix affichés en FCFA (XOF)</Text>
    </View>
  );
}

// ── Écran principal ───────────────────────────────────────────────

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
  const { data: searchData, isFetching: isSearching } = useQuery({
    queryKey: ['search', debouncedSearch],
    queryFn: () => searchProducts(debouncedSearch, 30),
    enabled: debouncedSearch.length >= 2,
    staleTime: 30_000,
  });

  // ── Produits en ligne de toutes les boutiques ──
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

  // ── Résultats affichés (recherche ou catégorie) ──
  const displayProducts = useMemo(() => {
    if (debouncedSearch.length >= 2 && searchData?.products) {
      return searchData.products;
    }
    if (selectedCategory === 'all') return allProducts;
    return allProducts.filter(
      (p) => p.category === selectedCategory || p.mainCategory === selectedCategory,
    );
  }, [allProducts, selectedCategory, debouncedSearch, searchData]);

  // ── Sections groupées par catégorie (comme le web) ──
  const sections = useMemo(() => {
    const groups = new Map<string, StorefrontProduct[]>();
    allProducts.forEach((p) => {
      const cat = p.mainCategory || p.category || 'Autres';
      const key = `${verticalOfProduct(p)}::${cat}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => {
        const [va, ca] = a.split('::');
        const [vb, cb] = b.split('::');
        if (va !== vb) return va === 'shopping' ? -1 : 1;
        const ia = MAIN_CATEGORIES.indexOf(ca);
        const ib = MAIN_CATEGORIES.indexOf(cb);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      })
      .map(([key, products]) => {
        const sep = key.indexOf('::');
        return {
          category: key.slice(sep + 2),
          vertical: key.slice(0, sep) as 'shopping' | 'food',
          products,
        };
      });
  }, [allProducts]);

  // ── Boutiques partenaires (max 6, avec produits en ligne) ──
  const partnerStores = useMemo<PartnerEntry[]>(() => {
    const stores = catalogData?.stores || [];
    return stores
      .map((store) => {
        const productCount = (store.products || []).filter(
          (p) => p.isOnline !== false,
        ).length;
        return { store, productCount };
      })
      .filter(({ productCount }) => productCount > 0)
      .sort(
        (a, b) =>
          (b.store.rating ?? 0) - (a.store.rating ?? 0) ||
          b.productCount - a.productCount,
      )
      .slice(0, 6);
  }, [catalogData]);

  // ── Construction des éléments de la liste ──
  const listItems = useMemo<HomeItem[]>(() => {
    const items: HomeItem[] = [];
    const searching = debouncedSearch.length >= 2;
    const filtered = searching || selectedCategory !== 'all';

    const pushRows = (
      products: StorefrontProduct[],
      prefix: string,
    ) => {
      for (let i = 0; i < products.length; i += 2) {
        items.push({
          key: `${prefix}-row-${i}`,
          type: 'row',
          products: products.slice(i, i + 2),
        });
      }
    };

    if (filtered) {
      if (selectedCategory !== 'all' && !searching) {
        items.push({
          key: 'cat-header',
          type: 'catHeader',
          category: selectedCategory,
          count: displayProducts.length,
        });
      }
      pushRows(displayProducts, 'flat');
      if (displayProducts.length === 0 && !isLoading) {
        items.push({
          key: 'empty',
          type: 'empty',
          mode: searching ? 'search' : 'category',
          label: searching ? debouncedSearch : selectedCategory,
        });
      }
      return items;
    }

    // Vue par défaut : hero + partenaires + sections + footer
    items.push({ key: 'hero', type: 'hero' });
    if (partnerStores.length > 0) {
      items.push({ key: 'partners', type: 'partners' });
    }
    sections.forEach((section, idx) => {
      items.push({
        key: `section-${idx}`,
        type: 'sectionHeader',
        category: section.category,
        vertical: section.vertical,
      });
      pushRows(
        section.products.slice(0, SECTION_PREVIEW_COUNT),
        `section-${idx}`,
      );
    });
    if (sections.length === 0 && !isLoading) {
      items.push({ key: 'empty', type: 'empty', mode: 'none', label: '' });
    }
    items.push({ key: 'footer', type: 'footer' });
    return items;
  }, [
    allProducts,
    sections,
    partnerStores,
    selectedCategory,
    debouncedSearch,
    displayProducts,
    isLoading,
  ]);

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

  const openStore = useCallback(
    (store: StoreData) => {
      const slug = store.slug || store.id;
      router.push(`/store/${slug}` as never);
    },
    [router],
  );

  const navigateToSlug = useCallback(
    (slug: string | undefined) => {
      if (slug) router.push(`/store/${slug}` as never);
    },
    [router],
  );

  // ── Catégories avec compteurs (chips) ──
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

  // ── Rendu des éléments ──
  const renderItem = useCallback(
    ({ item }: { item: HomeItem }) => {
      switch (item.type) {
        case 'hero':
          return <HeroCarousel />;

        case 'partners':
          return <PartnersRow entries={partnerStores} onOpen={openStore} />;

        case 'sectionHeader':
          return (
            <SectionHeader
              category={item.category}
              vertical={item.vertical}
              onSeeAll={setSelectedCategory}
            />
          );

        case 'catHeader':
          return (
            <View style={styles.catHeader}>
              <Pressable
                style={styles.catHeaderBack}
                onPress={() => setSelectedCategory('all')}
                hitSlop={8}
              >
                <ChevronLeft size={18} strokeWidth={3} color={COLORS.text} />
              </Pressable>
              <Text style={styles.catHeaderTitle} numberOfLines={1}>
                {item.category}
              </Text>
              <Text style={styles.catHeaderCount}>{item.count} produits</Text>
            </View>
          );

        case 'row':
          return (
            <View style={styles.gridRow}>
              {item.products.map((product) => (
                <View key={`${product.storeId}-${product.id}`} style={styles.gridCell}>
                  <ProductCard product={product} onPress={navigateToProduct} />
                </View>
              ))}
              {item.products.length === 1 && <View style={styles.gridCell} />}
            </View>
          );

        case 'empty':
          return (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                {item.mode === 'search'
                  ? `Aucun résultat pour « ${item.label} »`
                  : item.mode === 'category'
                    ? `Aucun produit dans « ${item.label} »`
                    : 'Aucune boutique ne publie encore de produit.'}
              </Text>
              {item.mode !== 'none' && (
                <>
                  <Text style={styles.emptySubtitle}>
                    Essayez un autre terme ou explorez les catégories
                  </Text>
                  <Pressable
                    style={styles.emptyButton}
                    onPress={() => {
                      setSearchTerm('');
                      setSelectedCategory('all');
                    }}
                  >
                    <Text style={styles.emptyButtonText}>
                      Voir tout le catalogue
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          );

        case 'footer':
          return <HomeFooter />;

        default:
          return null;
      }
    },
    [partnerStores, openStore, navigateToProduct, navigateToSlug],
  );

  if (isLoading && allProducts.length === 0) {
    return <Loader fullScreen message="Chargement du catalogue..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Image
            source={require('../../assets/logo-trimmed.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <View style={styles.headerBadge}>
            <Store size={16} color={COLORS.brand} />
            <Text style={styles.headerBadgeText}>
              {catalogData?.stores?.length || 0}
            </Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Search size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Chercher un produit, une boutique..."
            placeholderTextColor={COLORS.textFaint}
            value={searchTerm}
            onChangeText={setSearchTerm}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchTerm.length > 0 && (
            <Pressable onPress={() => setSearchTerm('')} hitSlop={8}>
              <X size={18} color={COLORS.textFaint} />
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

      {/* Liste principale */}
      <FlatList
        data={listItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.brand}
            colors={[COLORS.brand]}
          />
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: '#F9FAFB',
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
  logo: {
    height: 30,
    width: 132,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.brandSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.brand,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EEF0F2',
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EEF0F2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 6,
  },
  categoryChipActive: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
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
  listContent: {
    paddingBottom: 24,
  },
  // Hero
  heroWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.brandTint,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  heroDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
  },
  heroDotActive: {
    backgroundColor: COLORS.brand,
    width: 16,
  },
  // Partenaires
  partnersSection: {
    marginBottom: 24,
  },
  partnersTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  partnersTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  partnersCount: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textFaint,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  partnersScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  partnerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  partnerCardPressed: {
    borderColor: COLORS.brandTint,
    opacity: 0.9,
  },
  partnerLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.brand,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  partnerLogoImg: {
    width: '100%',
    height: '100%',
  },
  partnerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    maxWidth: '100%',
  },
  partnerName: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    flexShrink: 1,
  },
  verifiedBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    maxWidth: '100%',
  },
  partnerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  partnerRatingText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#4B5563',
  },
  partnerNew: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textFaint,
  },
  partnerDot: {
    fontSize: 9,
    color: '#D1D5DB',
  },
  partnerCount: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textFaint,
    flexShrink: 1,
  },
  // Sections catégorie
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  sectionFoodTag: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.brand,
    textTransform: 'uppercase',
  },
  sectionSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sectionSeeAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.brand,
  },
  // En-tête catégorie filtrée
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  catHeaderBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catHeaderTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  catHeaderCount: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textFaint,
  },
  // Grille
  gridRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  gridCell: {
    flex: 1,
  },
  // Vide
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
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
    color: COLORS.textFaint,
    textAlign: 'center',
    marginTop: 6,
  },
  emptyButton: {
    marginTop: 16,
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // Footer
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
    marginTop: 16,
  },
  footerLogo: {
    height: 26,
    width: 114,
    marginBottom: 10,
  },
  footerTagline: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 19,
    marginBottom: 20,
  },
  footerHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 8,
  },
  footerLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 8,
  },
  footerBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  footerBullet: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  footerDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginTop: 16,
    marginBottom: 14,
  },
  footerLegal: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
});
