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
  Platform,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Search,
  X,
  Store,
  Check,
  ChevronRight,
  ChevronLeft,
  BadgeCheck,
  MapPin,
  ShoppingCart,
  User,
} from 'lucide-react-native';
import {
  fetchHomeCatalog,
  searchProducts,
  API_BASE_URL,
} from '@/api/client';
import {
  PRODUCT_GRID_COLUMN_GAP,
  PRODUCT_GRID_PADDING,
  ProductRow,
} from '@/components/ProductRow';
import { ProductGridSkeleton } from '@/components/ProductGridSkeleton';
import { ProductTile } from '@/components/ProductTile';
import { CartBar, CART_BAR_CONTENT_HEIGHT } from '@/components/CartBar';
import { StorefrontSkeleton } from '@/components/StorefrontSkeleton';
import { MAIN_CATEGORIES, verticalOfProduct } from '@/constants';
import { COUNTRIES } from '@/constants/countries';
import {
  formatNumber,
  formatRating,
  generateProductSlug,
  isMarketableProduct,
  productColumnsForWidth,
  productDiscountPercent,
} from '@/utils';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { fetchSellerBootstrap } from '@/api/seller';
import { COLORS } from '@/theme';
import logoTrimmed from '../assets/logo-trimmed.png';
import type { StorefrontProduct, StoreData } from '@/types';

const SECTION_PREVIEW_COUNT = 6;

/** Slides du hero — mêmes affiches et mêmes cibles que le web. */
const HERO_SLIDES = [
  {
    image: `${API_BASE_URL}/affiches/affiche_mobile_1x.webp`,
    link: '/login',
    label: 'Affiche PosMarket — espace vendeur',
  },
  {
    image: `${API_BASE_URL}/affiches/affiche_acheteurs_mobile_1x.webp`,
    link: '/login',
    label: 'Affiche PosMarket — espace acheteur',
  },
  {
    image: `${API_BASE_URL}/affiches/affiche_vente_gros_mobile_1x.webp`,
    link: '/products/wholesale',
    label: 'Affiche PosMarket — vente en gros',
  },
];

// ── Types des éléments de la liste hétérogène ─────────────────────

type HomeItem =
  | { key: string; type: 'hero' }
  | { key: string; type: 'partners' }
  | {
      key: string;
      type: 'sectionHeader';
      sectionKey: string;
      title: string;
      vertical?: 'shopping' | 'food';
      seeAll: boolean;
    }
  | { key: string; type: 'catHeader'; category: string; count: number }
  | { key: string; type: 'listHeader'; icon: 'store' | 'cart'; label: string }
  | { key: string; type: 'storeRow'; entries: PartnerEntry[] }
  | { key: string; type: 'productRow'; products: StorefrontProduct[] }
  | { key: string; type: 'searchLoading' }
  | { key: string; type: 'searchError' }
  | { key: string; type: 'catalogError' }
  | { key: string; type: 'empty'; mode: 'search' | 'category' | 'none'; label: string }
  | { key: string; type: 'footer' };

interface PartnerEntry {
  store: StoreData;
  productCount: number;
  salesCount: number;
  viewsCount: number;
}

interface HomeSection {
  key: string;
  title: string;
  vertical?: 'shopping' | 'food';
  products: StorefrontProduct[];
  preview: StorefrontProduct[];
  canSeeAll: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Score de classement doux : ventes, note, avis, vues et fraîcheur. */
function productRankScore(product: StorefrontProduct): number {
  const sales = product.salesCount ?? 0;
  const rating = product.rating ?? 0;
  const reviews = product.reviewCount ?? 0;
  const views = product.views ?? 0;
  const createdAt = product.createdAt ? Date.parse(product.createdAt) : NaN;
  const ageDays = Number.isFinite(createdAt)
    ? Math.max(0, (Date.now() - createdAt) / MS_PER_DAY)
    : 90;
  const recency = Number.isFinite(createdAt)
    ? Math.max(0, 1 - ageDays / 60)
    : 0;
  return (
    Math.log1p(sales) * 2.4 +
    rating * 0.9 +
    Math.log1p(reviews) * 0.55 +
    Math.log1p(views) * 0.08 +
    recency * 0.9
  );
}

function rankProducts(products: StorefrontProduct[]): StorefrontProduct[] {
  return [...products].sort((a, b) => {
    const scoreDiff = productRankScore(b) - productRankScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    const salesDiff = (b.salesCount ?? 0) - (a.salesCount ?? 0);
    if (salesDiff !== 0) return salesDiff;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });
}

/**
 * Limite la domination d'une boutique (2 produits max sur 6) puis complète
 * avec les meilleurs produits restants.
 */
function diversifyProducts(
  products: StorefrontProduct[],
  limit: number,
): StorefrontProduct[] {
  const maxPerStore = Math.max(1, Math.ceil(limit / 3));
  const picked: StorefrontProduct[] = [];
  const overflow: StorefrontProduct[] = [];
  const perStore = new Map<string, number>();

  for (const product of products) {
    const count = perStore.get(product.storeId) ?? 0;
    if (picked.length < limit && count < maxPerStore) {
      picked.push(product);
      perStore.set(product.storeId, count + 1);
    } else {
      overflow.push(product);
    }
  }

  for (const product of overflow) {
    if (picked.length >= limit) break;
    picked.push(product);
  }

  return picked;
}

function chunkProducts(
  products: StorefrontProduct[],
  columns: number,
): StorefrontProduct[][] {
  const rows: StorefrontProduct[][] = [];
  for (let index = 0; index < products.length; index += columns) {
    rows.push(products.slice(index, index + columns));
  }
  return rows;
}

// ── Hero carrousel (3 affiches, défilement auto) ──────────────────

function HeroCarousel() {
  const { width } = useWindowDimensions();
  const router = useRouter();
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
            accessibilityRole="button"
            accessibilityLabel={slide.label}
            onPress={() => {
              if (slide.link === '/login') {
                // Session vendeur déjà active : on saute la page de connexion
                // et on va directement au tableau de bord (le web renvoie vers
                // `AuthView`, qui redirige quand la session existe).
                void (async () => {
                  const res = await fetchSellerBootstrap().catch(() => null);
                  if (res?.success) {
                    router.replace('/seller/dashboard');
                    return;
                  }
                  router.push('/login');
                })();
                return;
              }
              Linking.openURL(`${API_BASE_URL}${slide.link}`).catch(() => {});
            }}
          >
            <Image
              source={{ uri: slide.image }}
              style={{ width: slideWidth, aspectRatio: 720 / 560 }}
              contentFit="cover"
              transition={200}
              alt=""
              accessible={false}
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
  // Deux cartes largement visibles, la suivante dépasse légèrement pour
  // inviter au défilement horizontal.
  const cardWidth = Math.min((width - 44) / 2 + 18, 228);
  const cardGap = 12;
  // Toutes les stats tiennent sur une ligne : on adapte finement la taille
  // selon la largeur réelle de la carte.
  const statsFontSize =
    cardWidth >= 180 ? 9 : cardWidth >= 160 ? 8.5 : 8;

  return (
    <View style={styles.partnersSection}>
      <View style={styles.partnersHeader}>
        <View style={styles.partnersAccent} />
        <View style={styles.partnersHeading}>
          <View style={styles.partnersTitleLine}>
            <Text style={styles.partnersTitle}>Boutiques partenaires</Text>
            <View style={styles.partnersCount}>
              <Text style={styles.partnersCountText}>{entries.length}</Text>
            </View>
          </View>
          <Text style={styles.partnersSubtitle}>
            Des commerçants vérifiés à découvrir
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.partnersScroll, { gap: cardGap }]}
        snapToInterval={cardWidth + cardGap}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {entries.map(({ store, salesCount, viewsCount }) => {
          const name = store.settings?.name || store.name || 'Boutique';
          const logo = resolveStoreLogo(store);
          const rating = store.rating ?? 0;
          const reviewCount = store.reviewCount ?? 0;
          const initials = name.trim().slice(0, 2).toUpperCase();
          const country = resolveCountryName(store.settings?.country);

          return (
            <Pressable
              key={store.id}
              style={({ pressed }) => [
                styles.partnerCard,
                { width: cardWidth },
                pressed && styles.partnerCardPressed,
              ]}
              onPress={() => onOpen(store)}
              accessibilityRole="button"
              accessibilityLabel={`Voir la boutique ${name}`}
            >
              <LinearGradient
                colors={['#FFF6F0', '#FFE3D3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.partnerCover}
              >
                <View style={[styles.partnerBubble, styles.partnerBubbleLarge]} />
                <View style={[styles.partnerBubble, styles.partnerBubbleSmall]} />
                <View style={styles.partnerBadge}>
                  <BadgeCheck size={9} color={COLORS.brand} strokeWidth={2.5} />
                  <Text style={styles.partnerBadgeText}>Vérifié</Text>
                </View>
              </LinearGradient>

              <View style={styles.partnerBody}>
                <View style={styles.partnerLogoWrap}>
                  <View style={styles.partnerLogo}>
                    {logo ? (
                      <Image
                        source={{ uri: logo }}
                        style={styles.partnerLogoImg}
                        contentFit="cover"
                        transition={150}
                        alt=""
                        accessible={false}
                      />
                    ) : (
                      <Text style={styles.partnerLogoInitials}>{initials}</Text>
                    )}
                  </View>
                  <View style={styles.partnerVerified}>
                    <Check size={7} strokeWidth={4} color="#FFF" />
                  </View>
                </View>

                <View style={styles.partnerNameRow}>
                  <Text style={styles.partnerName} numberOfLines={1}>
                    {name}
                  </Text>
                  <ChevronRight size={12} color="#C4C8CE" strokeWidth={2.5} />
                </View>

                <View style={styles.partnerCountry}>
                  <MapPin
                    size={9.5}
                    color={country ? COLORS.brand : COLORS.textFaint}
                    strokeWidth={2.5}
                  />
                  <Text
                    style={[
                      styles.partnerCountryText,
                      !country && styles.partnerCountryTextEmpty,
                    ]}
                    numberOfLines={1}
                  >
                    {country || 'Non défini'}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.partnerMetaLine,
                    { fontSize: statsFontSize },
                  ]}
                  numberOfLines={1}
                >
                  {rating > 0 ? (
                    <>
                      <Text style={styles.partnerStar}>★ </Text>
                      <Text style={styles.partnerRatingValue}>
                        {formatRating(rating)}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.partnerNew}>Nouveau</Text>
                  )}
                  <Text style={styles.partnerMetaSep}> | </Text>
                  <Text style={styles.partnerStatValue}>
                    {formatNumber(reviewCount)}
                  </Text>
                  <Text style={styles.partnerStatLabel}> Avis</Text>
                  <Text style={styles.partnerMetaSep}> | </Text>
                  <Text style={styles.partnerStatValue}>
                    {formatNumber(salesCount)}
                  </Text>
                  <Text style={styles.partnerStatLabel}>
                    {' '}
                    {salesCount > 1 ? 'ventes' : 'vente'}
                  </Text>
                  <Text style={styles.partnerMetaSep}> | </Text>
                  <Text style={styles.partnerStatValue}>
                    {formatNumber(viewsCount)}
                  </Text>
                  <Text style={styles.partnerStatLabel}>
                    {' '}
                    {viewsCount > 1 ? 'vues' : 'vue'}
                  </Text>
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

/** Le pays est stocké par nom (sélecteur vendeur), mais on tolère un code. */
function resolveCountryName(value?: string): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  const match = COUNTRIES.find(
    (country) =>
      country.name.toLowerCase() === normalized ||
      country.code.toLowerCase() === normalized,
  );
  return match?.name || raw;
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
      accessibilityRole="button"
      accessibilityLabel={`Voir la boutique ${name}`}
    >
      <View style={styles.searchStoreLogo}>
        {logo ? (
          <Image
            source={{ uri: logo }}
            style={styles.searchStoreLogoImg}
            contentFit="cover"
            transition={150}
            alt=""
            accessible={false}
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
  title,
  vertical,
  onSeeAll,
}: {
  title: string;
  vertical?: 'shopping' | 'food';
  onSeeAll?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Text
          style={styles.sectionTitle}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {vertical === 'food' && (
          <Text style={styles.sectionFoodTag}>Restauration</Text>
        )}
      </View>
      {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          style={styles.sectionSeeAll}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Voir tous les produits de la section ${title}`}
        >
          <Text style={styles.sectionSeeAllText}>Voir tout</Text>
          <ChevronRight size={13} strokeWidth={3} color={COLORS.brand} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ── Footer ────────────────────────────────────────────────────────

function HomeFooter() {
  return (
    <View style={styles.footer}>
      <Image
        source={logoTrimmed}
        style={styles.footerLogo}
        contentFit="contain"
        alt="PosMarket"
      />
      <Text style={styles.footerTagline}>
        Place de marché reliant les vendeurs et les acheteurs.
      </Text>

      <View style={styles.footerDivider} />
      <Text style={styles.footerLegal}>
        © {new Date().getFullYear()} PosMarket — Tous droits réservés
      </Text>
    </View>
  );
}

function ListErrorState({
  title,
  subtitle,
  onRetry,
}: {
  title: string;
  subtitle: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      <Pressable
        style={styles.emptyButton}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Réessayer"
      >
        <Text style={styles.emptyButtonText}>Réessayer</Text>
      </Pressable>
    </View>
  );
}

// ── Écran principal ───────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const productColumns = productColumnsForWidth(screenWidth);
  const sheetCardWidth = Math.max(
    0,
    (screenWidth -
      PRODUCT_GRID_PADDING * 2 -
      PRODUCT_GRID_COLUMN_GAP * (productColumns - 1)) /
      productColumns,
  );
  const compactCards = screenWidth < 360;
  const { cartCount } = useCart();
  const { user, openAuth } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  // Feuille « Voir tout » : clé de section (verticale + catégorie).
  const [sheetSectionKey, setSheetSectionKey] = useState<string | null>(null);
  const listRef = useRef<FlatList<HomeItem>>(null);

  // ── Catalogue allégé de l'accueil ──
  const {
    data: catalogData,
    isLoading,
    isError: catalogFailed,
    refetch,
  } = useQuery({
    queryKey: ['home-catalog'],
    queryFn: fetchHomeCatalog,
    staleTime: 60_000,
    retry: 1,
  });

  // ── Recherche différée (300 ms) pour ne pas appeler l'API à chaque frappe.
  useEffect(() => {
    const term = searchTerm.trim();
    // Sous 2 caractères, on vide après le tick courant (pas de setState
    // synchrone dans l'effet) ; sinon debounce de 300 ms.
    const timer = setTimeout(
      () => setDebouncedSearch(term.length >= 2 ? term : ''),
      term.length >= 2 ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const searchMode = searchTerm.trim().length >= 2;
  const isDebouncing = searchMode && searchTerm.trim() !== debouncedSearch;
  const searchQueryActive = debouncedSearch.length >= 2;

  const {
    data: searchData,
    isFetching: isSearching,
    isError: searchFailed,
    refetch: searchRefetch,
  } = useQuery({
    queryKey: ['search', debouncedSearch],
    queryFn: () => searchProducts(debouncedSearch, 30),
    enabled: searchQueryActive,
    staleTime: 30_000,
    retry: 1,
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
  // Pendant le debounce, on n'affiche jamais l'ancien catalogue sous
  // « Résultats produits » : la liste montre un squelette.
  const displayProducts = useMemo(() => {
    if (searchMode) {
      if (isDebouncing) return [];
      return searchData?.products ?? [];
    }
    if (selectedCategory === 'all') return allProducts;
    return allProducts.filter(
      (p) => p.category === selectedCategory || p.mainCategory === selectedCategory,
    );
  }, [
    allProducts,
    selectedCategory,
    searchMode,
    isDebouncing,
    searchData,
  ]);

  // ── Produits réellement commercialisables (image + stock disponible) ──
  const marketableProducts = useMemo(
    () => allProducts.filter(isMarketableProduct),
    [allProducts],
  );

  // ── Sections catégorie : classées, diversifiées, 6 aperçus ──
  const categorySections = useMemo<HomeSection[]>(() => {
    const groups = new Map<string, StorefrontProduct[]>();
    marketableProducts.forEach((p) => {
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
        const ranked = rankProducts(products);
        return {
          key,
          title: key.slice(sep + 2),
          vertical: key.slice(0, sep) as 'shopping' | 'food',
          products: ranked,
          preview: diversifyProducts(ranked, SECTION_PREVIEW_COUNT),
          canSeeAll: true,
        };
      });
  }, [marketableProducts]);

  // ── Sections éditoriales : meilleures ventes, promos, nouveautés ──
  const curatedSections = useMemo<HomeSection[]>(() => {
    const curated: HomeSection[] = [];

    const bestSellers = [...marketableProducts]
      .filter((p) => (p.salesCount ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.salesCount ?? 0) - (a.salesCount ?? 0) ||
          productRankScore(b) - productRankScore(a),
      );
    const bestPreview = diversifyProducts(bestSellers, SECTION_PREVIEW_COUNT);
    if (bestPreview.length > 0) {
      curated.push({
        key: 'collection-best-sellers',
        title: 'Meilleures ventes',
        products: bestPreview,
        preview: bestPreview,
        canSeeAll: false,
      });
    }

    const promotions = [...marketableProducts]
      .filter((p) => productDiscountPercent(p) > 0)
      .sort(
        (a, b) =>
          productDiscountPercent(b) - productDiscountPercent(a) ||
          productRankScore(b) - productRankScore(a),
      );
    const promoPreview = diversifyProducts(promotions, SECTION_PREVIEW_COUNT);
    if (promoPreview.length > 0) {
      curated.push({
        key: 'collection-promotions',
        title: 'Promotions',
        products: promoPreview,
        preview: promoPreview,
        canSeeAll: false,
      });
    }

    const newArrivals = [...marketableProducts]
      .filter(
        (p) =>
          Boolean(p.createdAt) &&
          Number.isFinite(Date.parse(p.createdAt as string)),
      )
      .sort(
        (a, b) =>
          Date.parse(b.createdAt as string) -
          Date.parse(a.createdAt as string),
      );
    const newPreview = diversifyProducts(newArrivals, SECTION_PREVIEW_COUNT);
    if (newPreview.length > 0) {
      curated.push({
        key: 'collection-new-arrivals',
        title: 'Nouveautés',
        products: newPreview,
        preview: newPreview,
        canSeeAll: false,
      });
    }

    return curated;
  }, [marketableProducts]);

  const homeSections = useMemo(
    () => [...curatedSections, ...categorySections],
    [curatedSections, categorySections],
  );

  // ── Catégorie dépliée depuis « Voir tout » (feuille bas d'écran) ──
  const sheetSection = useMemo(
    () =>
      categorySections.find((section) => section.key === sheetSectionKey) ??
      null,
    [categorySections, sheetSectionKey],
  );

  // ── Boutiques : partenaires (max 6) + résultats de recherche ──
  // Compteur identique au web : produits en ligne ET avec image.
  const allPartnerEntries = useMemo<PartnerEntry[]>(() => {
    const stores = catalogData?.stores || [];
    return stores
      .map((store) => {
        const onlineProducts = (store.products || []).filter(
          (p) => p.isOnline !== false && p.image,
        );
        const salesCount = onlineProducts.reduce(
          (sum, product) => sum + (product.salesCount ?? 0),
          0,
        );
        const viewsCount =
          (store.views ?? 0) +
          onlineProducts.reduce(
            (sum, product) => sum + (product.views ?? 0),
            0,
          );
        return {
          store,
          productCount: onlineProducts.length,
          salesCount,
          viewsCount,
        };
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
    const filtered = searchMode || selectedCategory !== 'all';

    const pushProductRows = (
      products: StorefrontProduct[],
      prefix: string,
    ) => {
      chunkProducts(products, productColumns).forEach((row, index) => {
        items.push({
          key: `${prefix}-row-${index}`,
          type: 'productRow',
          products: row,
        });
      });
    };

    if (filtered) {
      if (searchMode) {
        // Parité web : « Boutiques trouvées » puis « Résultats produits ».
        if (!isDebouncing && !searchFailed && searchMatchingStores.length > 0) {
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

        const waitingForSearch =
          isDebouncing ||
          (searchQueryActive &&
            searchData === undefined &&
            !searchFailed) ||
          (isSearching && displayProducts.length === 0);

        items.push({
          key: 'header-products',
          type: 'listHeader',
          icon: 'cart',
          label:
            displayProducts.length > 0 && !waitingForSearch
              ? `Résultats produits (${displayProducts.length})`
              : 'Résultats produits',
        });

        if (
          searchFailed &&
          !isDebouncing &&
          displayProducts.length === 0
        ) {
          items.push({ key: 'search-error', type: 'searchError' });
          return items;
        }

        if (waitingForSearch) {
          items.push({ key: 'search-loading', type: 'searchLoading' });
          return items;
        }

        if (displayProducts.length > 0) {
          pushProductRows(displayProducts, 'search');
          return items;
        }

        items.push({
          key: 'empty',
          type: 'empty',
          mode: 'search',
          label: debouncedSearch || searchTerm.trim(),
        });
        return items;
      }

      items.push({
        key: 'cat-header',
        type: 'catHeader',
        category: selectedCategory,
        count: displayProducts.length,
      });
      pushProductRows(displayProducts, 'category');
      if (displayProducts.length === 0 && !isLoading) {
        items.push({
          key: 'empty',
          type: 'empty',
          mode: 'category',
          label: selectedCategory,
        });
      }
      return items;
    }

    // Vue par défaut : hero + partenaires + sections + footer
    if (catalogFailed && allProducts.length === 0) {
      items.push({ key: 'catalog-error', type: 'catalogError' });
      items.push({ key: 'footer', type: 'footer' });
      return items;
    }

    items.push({ key: 'hero', type: 'hero' });
    if (partnerStores.length > 0) {
      items.push({ key: 'partners', type: 'partners' });
    }
    homeSections.forEach((section) => {
      items.push({
        key: `section-${section.key}`,
        type: 'sectionHeader',
        sectionKey: section.key,
        title: section.title,
        vertical: section.vertical,
        seeAll: section.canSeeAll,
      });
      pushProductRows(section.preview, `section-${section.key}`);
    });
    if (homeSections.length === 0 && !isLoading) {
      items.push({ key: 'empty', type: 'empty', mode: 'none', label: '' });
    }
    items.push({ key: 'footer', type: 'footer' });
    return items;
  }, [
    homeSections,
    partnerStores,
    searchMatchingStores,
    selectedCategory,
    searchMode,
    isDebouncing,
    debouncedSearch,
    searchTerm,
    searchQueryActive,
    searchData,
    displayProducts,
    isLoading,
    isSearching,
    searchFailed,
    catalogFailed,
    allProducts.length,
    productColumns,
  ]);

  // Une nouvelle recherche (ou un changement de filtre) repart du haut.
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [debouncedSearch, searchMode, selectedCategory]);

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

  // « Voir tout » : ouvre la feuille de la section (clé verticale::catégorie,
  // ce qui évite les collisions entre commerces et restauration).
  const openCategorySheet = useCallback((sectionKey: string) => {
    setSheetSectionKey(sectionKey);
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
              title={item.title}
              vertical={item.vertical}
              onSeeAll={
                item.seeAll
                  ? () => openCategorySheet(item.sectionKey)
                  : undefined
              }
            />
          );

        case 'catHeader':
          return (
            <View style={styles.catHeader}>
              <Pressable
                style={styles.catHeaderBack}
                onPress={() => setSelectedCategory('all')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Revenir à toutes les catégories"
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
              <Text style={styles.listHeaderText} accessibilityRole="header">
                {item.label}
              </Text>
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

        case 'productRow':
          return (
            <ProductRow
              products={item.products}
              columns={productColumns}
              onPress={navigateToProduct}
              showStore
              style={styles.homeProductRow}
            />
          );

        case 'searchLoading':
          return <ProductGridSkeleton count={6} />;

        case 'searchError':
          return (
            <ListErrorState
              title="Recherche impossible"
              subtitle="Vérifiez votre connexion puis réessayez."
              onRetry={() => {
                void searchRefetch();
              }}
            />
          );

        case 'catalogError':
          return (
            <ListErrorState
              title="Impossible de charger le catalogue"
              subtitle="Vérifiez votre connexion puis réessayez."
              onRetry={() => {
                void refetch();
              }}
            />
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
                    accessibilityRole="button"
                    accessibilityLabel="Voir tout le catalogue"
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
    [
      partnerStores,
      openStore,
      navigateToProduct,
      openCategorySheet,
      productColumns,
      searchRefetch,
      refetch,
    ],
  );

  if (isLoading && allProducts.length === 0 && !catalogFailed) {
    return <StorefrontSkeleton />;
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
            alt="PosMarket"
          />
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [
                styles.headerCartBtn,
                pressed && styles.headerBtnPressed,
              ]}
              onPress={() => router.push('/cart' as never)}
              accessibilityRole="button"
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
              accessibilityRole="button"
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
                    alt=""
                    accessible={false}
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
            accessibilityLabel="Rechercher un produit ou une boutique"
          />
          {searchTerm.length > 0 && (
            <Pressable
              onPress={() => setSearchTerm('')}
              hitSlop={8}
              style={styles.searchClear}
              accessibilityRole="button"
              accessibilityLabel="Effacer la recherche"
            >
              <X size={16} color={COLORS.textFaint} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Liste principale — virtualisée ligne par ligne */}
      <FlatList
        ref={listRef}
        data={listItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        contentContainerStyle={[
          styles.listContent,
          cartCount > 0 && styles.listContentWithCartBar,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
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
        visible={sheetSection !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetSectionKey(null)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSheetSectionKey(null)}
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
              <Text style={styles.sheetTitle}>{sheetSection.title}</Text>
              <Text style={styles.sheetSubtitle}>
                {sheetSection.products.length}{' '}
                {sheetSection.products.length > 1 ? 'produits' : 'produit'}
              </Text>
              <Pressable
                style={styles.sheetClose}
                onPress={() => setSheetSectionKey(null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Fermer"
              >
                <X size={16} color={COLORS.textMuted} />
              </Pressable>
              <FlatList
                key={`sheet-grid-${productColumns}`}
                data={sheetSection.products}
                keyExtractor={(product) => `${product.storeId}-${product.id}`}
                numColumns={productColumns}
                columnWrapperStyle={[
                  styles.sheetRow,
                  { gap: PRODUCT_GRID_COLUMN_GAP },
                ]}
                contentContainerStyle={styles.sheetList}
                style={styles.sheetListView}
                showsVerticalScrollIndicator={false}
                initialNumToRender={productColumns * 2}
                maxToRenderPerBatch={productColumns * 2}
                windowSize={7}
                renderItem={({ item }) => (
                  <View style={[styles.sheetTile, { width: sheetCardWidth }]}>
                    <ProductTile
                      product={item}
                      showStore
                      compact={compactCards}
                      onPress={(product) => {
                        setSheetSectionKey(null);
                        navigateToProduct(product);
                      }}
                    />
                  </View>
                )}
              />
            </View>
          )}

          {/* La barre panier reste visible sous la feuille (comme le web). */}
          <CartBar onPress={() => setSheetSectionKey(null)} />
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
    paddingTop: 16,
    paddingBottom: 24,
  },
  sheetRow: {
    paddingHorizontal: 8,
  },
  sheetTile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 4,
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
  // Partenaires — refonte mobile : carrousel de cartes compactes
  partnersSection: {
    marginBottom: 22,
  },
  partnersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  partnersAccent: {
    width: 3,
    height: 24,
    borderRadius: 2,
    backgroundColor: COLORS.brand,
    marginRight: 9,
  },
  partnersHeading: {
    flex: 1,
  },
  partnersTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partnersTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.35,
  },
  partnersCount: {
    backgroundColor: COLORS.brandSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  partnersCountText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.brand,
  },
  partnersSubtitle: {
    fontSize: 10.5,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginTop: 2,
    letterSpacing: 0.05,
  },
  partnersScroll: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 6,
  },
  partnerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0F1F3',
    elevation: 3,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
  },
  partnerCardPressed: {
    borderColor: COLORS.brandTint,
    opacity: 0.94,
    transform: [{ scale: 0.98 }],
  },
  partnerCover: {
    height: 44,
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    paddingHorizontal: 10,
    paddingTop: 8,
    alignItems: 'flex-end',
    overflow: 'hidden',
  },
  partnerBubble: {
    position: 'absolute',
    borderRadius: 999,
  },
  partnerBubbleLarge: {
    width: 76,
    height: 76,
    right: -24,
    top: -32,
    backgroundColor: 'rgba(245, 107, 42, 0.10)',
  },
  partnerBubbleSmall: {
    width: 36,
    height: 36,
    left: 30,
    bottom: -22,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  partnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
  },
  partnerBadgeText: {
    fontSize: 7.5,
    fontWeight: '700',
    color: COLORS.brand,
    letterSpacing: 0.15,
  },
  partnerCountry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  partnerCountryText: {
    flexShrink: 1,
    fontSize: 9.5,
    fontWeight: '600',
    color: '#6B7280',
  },
  partnerBody: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  partnerLogoWrap: {
    width: 42,
    height: 42,
    marginTop: -21,
    position: 'relative',
  },
  partnerLogo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
  },
  partnerLogoImg: {
    width: '100%',
    height: '100%',
  },
  partnerLogoInitials: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.brand,
    letterSpacing: -0.4,
  },
  partnerVerified: {
    position: 'absolute',
    right: -1,
    bottom: 0,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  partnerName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  partnerCountryTextEmpty: {
    color: COLORS.textFaint,
    fontWeight: '500',
  },
  partnerMetaLine: {
    marginTop: 3,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: -0.1,
  },
  partnerStar: {
    fontWeight: '700',
    color: COLORS.brand,
  },
  partnerRatingValue: {
    fontWeight: '700',
    color: COLORS.text,
  },
  partnerNew: {
    fontWeight: '700',
    color: COLORS.brand,
  },
  partnerMetaSep: {
    fontWeight: '600',
    color: '#D1D5DB',
  },
  partnerStatValue: {
    fontWeight: '700',
    color: COLORS.text,
  },
  partnerStatLabel: {
    fontWeight: '600',
    color: COLORS.textMuted,
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
    justifyContent: 'center',
    gap: 2,
    minHeight: 32,
    paddingLeft: 6,
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
  homeProductRow: {
    marginBottom: 14,
  },
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
  },
  footerDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginTop: 18,
    marginBottom: 14,
  },
  footerLegal: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});