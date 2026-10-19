/**
 * Écran Accueil — fidèle à la home web (StorefrontView) :
 * header (logo + panier + compte + recherche « Je cherche... »), hero
 * 3 affiches cliquables, boutiques partenaires, produits groupés par
 * catégorie (6 par section + « Voir tout » → feuille bas d'écran), footer,
 * barre panier fixe « Voir mon panier ». Recherche → boutiques trouvées +
 * produits.
 *
 * Navigation 100 % web mobile : plus d'onglets, le panier et le compte
 * s'ouvrent depuis les boutons du header (comme la vitrine web).
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
  Modal,
  useWindowDimensions,
  Linking,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
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
  ShoppingCart,
  User,
} from 'lucide-react-native';
import {
  fetchCatalog,
  searchProducts,
  API_BASE_URL,
} from '@/api/client';
import { ProductCard } from '@/components/ProductCard';
import { CartBar, CART_BAR_CONTENT_HEIGHT } from '@/components/CartBar';
import { Loader } from '@/components/Loader';
import { MAIN_CATEGORIES, verticalOfProduct } from '@/constants';
import { generateProductSlug } from '@/utils';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { COLORS } from '@/theme';
import logoTrimmed from '../assets/logo-trimmed.png';
import type { StorefrontProduct, StoreData } from '@/types';

const SECTION_PREVIEW_COUNT = 6;

/** Slides du hero — mêmes affiches et mêmes cibles que le web. */
const HERO_SLIDES = [
  {
    image: `${API_BASE_URL}/affiches/affiche_mobile_1x.webp`,
    link: '/login',
  },
  {
    image: `${API_BASE_URL}/affiches/affiche_acheteurs_mobile_1x.webp`,
    link: '/login',
  },
  {
    image: `${API_BASE_URL}/affiches/affiche_vente_gros_mobile_1x.webp`,
    link: '/products/wholesale',
  },
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
  | { key: string; type: 'listHeader'; icon: 'store' | 'cart'; label: string }
  | { key: string; type: 'storeRow'; entries: PartnerEntry[] }
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
  // Le cadre a un filet de 1 px : largeur utile = largeur - 2×16 (marges)
  // - 2×1 (bordures), sinon le snap dérive de 2 px.
  const slideWidth = width - 34;
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
        {HERO_SLIDES.map((slide) => (
          <Pressable
            key={slide.image}
            onPress={() =>
              Linking.openURL(`${API_BASE_URL}${slide.link}`).catch(() => {})
            }
          >
            <Image
              source={{ uri: slide.image }}
              style={{ width: slideWidth, aspectRatio: 720 / 560 }}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.heroDots}>
        {HERO_SLIDES.map((slide, i) => (
          <View
            key={slide.image}
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

// ── Boutique trouvée (mode recherche) ─────────────────────────────

function SearchStoreCard({
  entry,
  onOpen,
}: {
  entry: PartnerEntry;
  onOpen: (store: StoreData) => void;
}) {
  const { store, productCount } = entry;
  const name = store.settings?.name || store.name || 'Boutique';
  const logo = resolveStoreLogo(store);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.searchStoreCard,
        pressed && styles.searchStoreCardPressed,
      ]}
      onPress={() => onOpen(store)}
    >
      <View style={styles.searchStoreLogo}>
        {logo ? (
          <Image
            source={{ uri: logo }}
            style={styles.searchStoreLogoImg}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Store size={24} color={COLORS.brand} />
        )}
      </View>
      <Text style={styles.searchStoreName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.searchStoreCount}>{productCount} prod.</Text>
      <Text style={styles.searchStoreSlug} numberOfLines={1}>
        @{(store.slug || 'boutique').toLowerCase()}
      </Text>
    </Pressable>
  );
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
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle} numberOfLines={1}>
          {category}
        </Text>
        {vertical === 'food' && (
          <Text style={styles.sectionFoodTag}>Restauration</Text>
        )}
      </View>
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
        source={logoTrimmed}
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
  const insets = useSafeAreaInsets();
  const { cartCount } = useCart();
  const { user, openAuth } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  // Feuille « Voir tout » : catégorie dépliée avec tous ses produits.
  const [sheetCategory, setSheetCategory] = useState<string | null>(null);

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

  // ── Catégorie dépliée depuis « Voir tout » (feuille bas d'écran) ──
  const sheetSection = useMemo(
    () => sections.find((s) => s.category === sheetCategory) ?? null,
    [sections, sheetCategory],
  );

  // ── Boutiques : partenaires (max 6) + résultats de recherche ──
  // Compteur identique au web : produits en ligne ET avec image.
  const allPartnerEntries = useMemo<PartnerEntry[]>(() => {
    const stores = catalogData?.stores || [];
    return stores
      .map((store) => {
        const productCount = (store.products || []).filter(
          (p) => p.isOnline !== false && p.image,
        ).length;
        return { store, productCount };
      })
      .filter(({ productCount }) => productCount > 0)
      .sort(
        (a, b) =>
          (b.store.rating ?? 0) - (a.store.rating ?? 0) ||
          b.productCount - a.productCount,
      );
  }, [catalogData]);

  const partnerStores = useMemo(
    () => allPartnerEntries.slice(0, 6),
    [allPartnerEntries],
  );

  const searchMatchingStores = useMemo<PartnerEntry[]>(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return allPartnerEntries
      .filter(({ store }) => {
        const name = (store.settings?.name || store.name || '').toLowerCase();
        const slug = (store.slug || '').toLowerCase();
        return name.includes(q) || slug.includes(q);
      })
      .slice(0, 12);
  }, [allPartnerEntries, debouncedSearch]);

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
      if (searching) {
        // Parité web : « Boutiques trouvées » puis « Résultats produits ».
        if (searchMatchingStores.length > 0) {
          items.push({
            key: 'header-stores',
            type: 'listHeader',
            icon: 'store',
            label: `Boutiques trouvées (${searchMatchingStores.length})`,
          });
          for (let i = 0; i < searchMatchingStores.length; i += 2) {
            items.push({
              key: `store-row-${i}`,
              type: 'storeRow',
              entries: searchMatchingStores.slice(i, i + 2),
            });
          }
        }
        if (displayProducts.length > 0 || isSearching) {
          items.push({
            key: 'header-products',
            type: 'listHeader',
            icon: 'cart',
            label: 'Résultats produits',
          });
        }
      } else if (selectedCategory !== 'all') {
        items.push({
          key: 'cat-header',
          type: 'catHeader',
          category: selectedCategory,
          count: displayProducts.length,
        });
      }
      pushRows(displayProducts, 'flat');
      if (
        displayProducts.length === 0 &&
        !isLoading &&
        !(searching && isSearching)
      ) {
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
    sections,
    partnerStores,
    searchMatchingStores,
    selectedCategory,
    debouncedSearch,
    displayProducts,
    isLoading,
    isSearching,
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

  // « Voir tout » : ouvre la feuille de la catégorie (comportement web
  // mobile) au lieu de filtrer la page.
  const openCategorySheet = useCallback((category: string) => {
    setSheetCategory(category);
  }, []);

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
              onSeeAll={openCategorySheet}
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

        case 'listHeader':
          return (
            <View style={styles.listHeader}>
              {item.icon === 'store' ? (
                <Store size={18} color={COLORS.brand} />
              ) : (
                <ShoppingCart size={18} color={COLORS.brand} />
              )}
              <Text style={styles.listHeaderText}>{item.label}</Text>
            </View>
          );

        case 'storeRow':
          return (
            <View style={styles.gridRow}>
              {item.entries.map((entry) => (
                <View key={entry.store.id} style={styles.gridCell}>
                  <SearchStoreCard entry={entry} onOpen={openStore} />
                </View>
              ))}
              {item.entries.length === 1 && <View style={styles.gridCell} />}
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
    [partnerStores, openStore, navigateToProduct, openCategorySheet],
  );

  if (isLoading && allProducts.length === 0) {
    return <Loader fullScreen message="Chargement du catalogue..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header — même structure que le web mobile : logo, panier, compte,
          puis la barre de recherche « Je cherche... » */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Image
            source={logoTrimmed}
            style={styles.logo}
            contentFit="contain"
          />
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [
                styles.headerCartBtn,
                pressed && styles.headerBtnPressed,
              ]}
              onPress={() => router.push('/cart' as never)}
              accessibilityLabel={
                cartCount > 0 ? `Panier (${cartCount} articles)` : 'Panier'
              }
            >
              <ShoppingCart size={20} strokeWidth={2.5} color="#111827" />
              {cartCount > 0 && (
                <View style={styles.headerCartBadge}>
                  <Text style={styles.headerCartBadgeText}>
                    {cartCount > 99 ? '99+' : cartCount}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.headerProfileBtn,
                !!user && styles.headerProfileBtnActive,
                pressed && styles.headerBtnPressed,
              ]}
              onPress={() => {
                if (user) {
                  router.push('/account' as never);
                } else {
                  openAuth('login');
                }
              }}
              accessibilityLabel={user ? 'Mon compte' : 'Se connecter'}
            >
              <View
                style={[
                  styles.headerProfileAvatar,
                  !!user && styles.headerProfileAvatarActive,
                ]}
              >
                {user?.avatarUrl ? (
                  <Image
                    source={{ uri: user.avatarUrl }}
                    style={styles.headerProfileAvatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <User
                    size={18}
                    strokeWidth={3}
                    color={user ? '#FFFFFF' : COLORS.textFaint}
                  />
                )}
              </View>
            </Pressable>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Search
            size={16}
            strokeWidth={2.5}
            color="#4B5563"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Je cherche..."
            placeholderTextColor="#9CA3AF"
            value={searchTerm}
            onChangeText={setSearchTerm}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchTerm.length > 0 && (
            <Pressable
              onPress={() => setSearchTerm('')}
              hitSlop={8}
              style={styles.searchClear}
            >
              <X size={16} color={COLORS.textFaint} />
            </Pressable>
          )}
        </View>
      </View>

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
        contentContainerStyle={[
          styles.listContent,
          cartCount > 0 && styles.listContentWithCartBar,
        ]}
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

      {/* Barre panier fixe — visible sur les pages de découverte,
          sous la feuille « Voir tout » incluse (comme le web). */}
      <CartBar />

      {/* Feuille « Voir tout » — tous les produits de la catégorie
          (même comportement que la BottomSheet du web mobile). */}
      <Modal
        visible={sheetCategory !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetCategory(null)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSheetCategory(null)}
          />
          {sheetSection && (
            <View
              style={[
                styles.sheetContainer,
                { paddingBottom: Math.max(insets.bottom, 12) + 12 },
                cartCount > 0 && {
                  marginBottom: CART_BAR_CONTENT_HEIGHT + insets.bottom,
                },
              ]}
            >
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>{sheetSection.category}</Text>
              <Text style={styles.sheetSubtitle}>
                {sheetSection.products.length} produits
              </Text>
              <Pressable
                style={styles.sheetClose}
                onPress={() => setSheetCategory(null)}
                hitSlop={8}
                accessibilityLabel="Fermer"
              >
                <X size={16} color={COLORS.textMuted} />
              </Pressable>
              <FlatList
                data={sheetSection.products}
                keyExtractor={(p) => `${p.storeId}-${p.id}`}
                numColumns={2}
                columnWrapperStyle={styles.sheetRow}
                contentContainerStyle={styles.sheetList}
                style={styles.sheetListView}
                showsVerticalScrollIndicator={false}
                initialNumToRender={6}
                renderItem={({ item }) => (
                  <View style={styles.sheetCell}>
                    <ProductCard
                      product={item}
                      onPress={(p) => {
                        setSheetCategory(null);
                        navigateToProduct(p);
                      }}
                    />
                  </View>
                )}
              />
            </View>
          )}

          {/* La barre panier reste visible sous la feuille (comme le web). */}
          <CartBar onPress={() => setSheetCategory(null)} />
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCartBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfileBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfileBtnActive: {
    backgroundColor: 'rgba(245,107,42,0.05)',
    borderColor: 'rgba(245,107,42,0.2)',
  },
  headerProfileAvatar: {
    width: 28,
    height: 28,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerProfileAvatarActive: {
    backgroundColor: COLORS.brand,
  },
  headerProfileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  headerBtnPressed: {
    opacity: 0.85,
  },
  headerCartBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: COLORS.brand,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCartBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    height: 38,
  },
  searchIcon: {
    marginLeft: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  searchClear: {
    paddingRight: 12,
  },
  searchIndicator: {
    paddingVertical: 8,
  },
  listContent: {
    paddingBottom: 24,
  },
  listContentWithCartBar: {
    paddingBottom: 104,
  },
  // Feuille « Voir tout » (bas d'écran)
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,47,52,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingTop: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  sheetTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    paddingHorizontal: 56,
  },
  sheetSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  sheetClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetListView: {
    flexShrink: 1,
  },
  sheetList: {
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sheetRow: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  sheetCell: {
    flex: 1,
  },
  // Hero
  heroWrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
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
    height: 120,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 32,
    height: 32,
    borderRadius: 16,
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
  // Boutique trouvée (recherche)
  searchStoreCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    margin: 4,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  searchStoreCardPressed: {
    borderColor: COLORS.brandTint,
    opacity: 0.92,
  },
  searchStoreLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#FFF3ED',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  searchStoreLogoImg: {
    width: '100%',
    height: '100%',
  },
  searchStoreName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  searchStoreCount: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  searchStoreSlug: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.brand,
    letterSpacing: 0.5,
  },
  // En-tête de liste (boutiques trouvées / résultats produits)
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  listHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  // Sections catégorie
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexShrink: 1,
  },
  sectionTitle: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  sectionFoodTag: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.brand,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    paddingHorizontal: 12,
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
    height: 32,
    width: 141,
    marginBottom: 10,
  },
  footerTagline: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
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
