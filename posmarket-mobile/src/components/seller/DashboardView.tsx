/**
 * Tableau de bord vendeur — copie fidèle de `src/views/DashboardView.tsx` du
 * web (rendu mobile < 768 px) : en-tête (avatar, salutation, badge verticale,
 * filtre), 4 statistiques compactes, graphique de comparaison avec sélecteur
 * de période, et les cartes Plus Visités / Meilleures Ventes / Alertes.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import {
  BarChart2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Eye,
  Flame,
  Package,
  ShoppingBag,
  Zap,
} from 'lucide-react-native';
import { COLORS } from '@/theme';
import { formatCurrency, formatNumber } from '@/utils';
import type { Product } from '@/types';
import type { SellerOrder, SellerStoreRow } from '@/api/seller';

type Vertical = 'all' | 'shopping' | 'food';

interface SellerDashboardViewProps {
  orders: SellerOrder[];
  products: Product[];
  store?: SellerStoreRow | null;
  userName?: string;
  userAvatarUrl?: string | null;
  canViewReports?: boolean;
  /** Tirer vers le bas : recharge les données de l'écran (route parente). */
  onRefresh?: () => Promise<void> | void;
}

function getLocalYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function parseLocalDate(dStr: string): Date {
  const [y, m, d] = dStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function getVertical(
  product?:
    | { businessType?: string; business_type?: string; mainCategory?: string; main_category?: string }
    | null,
): string {
  if (!product) return 'shopping';
  const bt = product.businessType || product.business_type;
  if (bt) return String(bt);
  const mc = product.mainCategory || product.main_category;
  if (mc === 'Restauration & Livraison Rapide') return 'food';
  return 'shopping';
}

/**
 * Apparition décalée (fondu + montée) : équivalent des animations d'entrée du
 * web (`animate-shopify-reveal`), appliquées à chaque bloc du tableau de bord.
 */
function Reveal({
  delay = 0,
  children,
}: {
  delay?: number;
  children: React.ReactNode;
}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Léger retour tactile sur les lignes cliquables. */
function TapScale({
  onPress,
  children,
  style,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: object;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        style,
        { transform: [{ scale: pressed ? 0.985 : 1 }], opacity: pressed ? 0.9 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

export function SellerDashboardView({
  orders,
  products,
  store,
  userName,
  userAvatarUrl,
  canViewReports,
  onRefresh,
}: SellerDashboardViewProps) {
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return getLocalYMD(d);
  });
  const [endDate, setEndDate] = useState<string>(() => getLocalYMD(new Date()));
  const [selectedVertical, setSelectedVertical] = useState<Vertical>(
    store?.business_type || 'all',
  );

  React.useEffect(() => {
    setSelectedVertical(store?.business_type || 'all');
  }, [store?.business_type]);

  // ── Métriques ────────────────────────────────────────────────────
  const filteredMetrics = useMemo(() => {
    let start = parseLocalDate(startDate);
    start.setHours(0, 0, 0, 0);
    let end = parseLocalDate(endDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      [start, end] = [end, start];
    }

    const diffMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - diffMs);
    const prevEnd = new Date(start.getTime());

    const orderMatchesVertical = (o: SellerOrder) => {
      if (selectedVertical === 'all') return true;
      return (o.items || []).some((item) => getVertical(item.product) === selectedVertical);
    };

    const currentOrders = orders.filter((o) => {
      const d = new Date(o.date);
      if (!(d >= start && d <= end)) return false;
      return orderMatchesVertical(o);
    });

    const prevOrders = orders.filter((o) => {
      const d = new Date(o.date);
      if (!(d >= prevStart && d <= prevEnd)) return false;
      return orderMatchesVertical(o);
    });

    const currentRev = currentOrders.reduce((sum, o) => sum + o.total, 0);
    const prevRev = prevOrders.reduce((sum, o) => sum + o.total, 0);
    const revTrend = prevRev === 0 ? (currentRev > 0 ? 100 : 0) : Math.round(((currentRev - prevRev) / prevRev) * 100);

    const currentCount = currentOrders.length;
    const prevCount = prevOrders.length;
    const countTrend = prevCount === 0 ? (currentCount > 0 ? 100 : 0) : Math.round(((currentCount - prevCount) / prevCount) * 100);

    const currentBasket = currentCount > 0 ? currentRev / currentCount : 0;
    const prevBasket = prevCount > 0 ? prevRev / prevCount : 0;
    const basketTrend = prevBasket === 0 ? (currentBasket > 0 ? 100 : 0) : Math.round(((currentBasket - prevBasket) / prevBasket) * 100);

    const totalTraffic =
      (store?.views || 0) + (products || []).reduce((sum, p) => sum + (p.views || 0), 0);

    return {
      revenue: { current: currentRev, trend: revTrend >= 0 ? 'up' : 'down', pct: Math.min(Math.abs(revTrend), 100) },
      orders: { current: currentCount, trend: countTrend >= 0 ? 'up' : 'down', pct: Math.min(Math.abs(countTrend), 100) },
      basket: { current: currentBasket, trend: basketTrend >= 0 ? 'up' : 'down', pct: Math.min(Math.abs(basketTrend), 100) },
      traffic: { current: totalTraffic },
    };
  }, [orders, products, store, startDate, endDate, selectedVertical]);

  // ── Données du graphique ─────────────────────────────────────────
  const chartDataRaw = useMemo(() => {
    const start = parseLocalDate(startDate);
    start.setHours(0, 0, 0, 0);
    const end = parseLocalDate(endDate);
    end.setHours(23, 59, 59, 999);

    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
      const hourSlots = [8, 10, 12, 14, 16, 18, 20];
      return hourSlots.map((hourInt) => {
        const total = orders
          .filter((o) => {
            const d = new Date(o.date);
            return d >= start && d <= end && d.getHours() >= hourInt && d.getHours() < hourInt + 2;
          })
          .reduce((sum, o) => sum + o.total, 0);
        return { label: `${hourInt}h`, value: total, isMajor: false };
      });
    }

    const bucketCount = Math.min(Math.max(diffDays, 1), diffDays < 7 ? diffDays + 1 : 10);
    const msPerBucket = diffMs / (bucketCount - 1 || 1);

    const buckets: Array<{ label: string; value: number; isMajor: boolean }> = [];
    let lastMonth = '';

    for (let i = 0; i < bucketCount; i++) {
      const bStart = new Date(start.getTime() + i * msPerBucket);
      const bEnd = new Date(start.getTime() + (i + 1) * msPerBucket - 1);

      const total = orders
        .filter((o) => {
          const orderDate = new Date(o.date);
          return orderDate >= bStart && orderDate <= (i === bucketCount - 1 ? end : bEnd);
        })
        .reduce((sum, o) => sum + o.total, 0);

      let label = '';
      const currentMonth = bStart.toLocaleDateString('fr-FR', { month: 'short' });

      if (diffDays <= 31) {
        if (i === 0 || i === bucketCount - 1 || currentMonth !== lastMonth) {
          label = bStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
          lastMonth = currentMonth;
        } else {
          label = String(bStart.getDate());
        }
      } else {
        label = bStart.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      }

      buckets.push({ label, value: total, isMajor: label.includes(' ') || diffDays > 31 });
    }

    return buckets;
  }, [orders, startDate, endDate]);

  const currentData = useMemo(() => {
    const maxValue = Math.max(...chartDataRaw.map((d) => d.value), 1);
    return chartDataRaw.map((d) => ({
      ...d,
      displayValue: d.value,
      normalized: (d.value / maxValue) * 80 + 10,
    }));
  }, [chartDataRaw]);

  const mostVisited = useMemo(
    () =>
      [...products]
        .filter((p) => {
          if (!((p.views || 0) > 0)) return false;
          if (selectedVertical === 'all') return true;
          return getVertical(p) === selectedVertical;
        })
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 5),
    [products, selectedVertical],
  );

  const topSelling = useMemo(() => {
    const salesMap: Record<string, number> = {};
    (orders || []).forEach((order) => {
      (order.items || []).forEach((item) => {
        const id = item.product?.id;
        if (id) salesMap[id] = (salesMap[id] || 0) + (item.quantity || 1);
      });
    });

    return [...products]
      .map((p) => ({ ...p, salesCount: salesMap[p.id] || p.salesCount || 0 }))
      .filter((p) => {
        if (!(p.salesCount > 0)) return false;
        if (selectedVertical === 'all') return true;
        return getVertical(p) === selectedVertical;
      })
      .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
      .slice(0, 5);
  }, [products, orders, selectedVertical]);

  const avatarUrl =
    userAvatarUrl ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userName || 'user')}`;

  const lowStockProducts = products.filter(
    (p) => (getVertical(p) === 'shopping' || !getVertical(p)) && p.stock < 15,
  );
  const pausedFood = products.filter((p) => getVertical(p) === 'food' && p.stock === 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={COLORS.brand}
          colors={[COLORS.brand]}
        />
      }
    >
      {/* En-tête */}
      <Reveal>
        <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarBox}>
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} contentFit="cover" />
          </View>
          <View style={styles.headerTextCol}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                Salut, {userName || 'Utilisateur'}
              </Text>
            </View>

            {!store?.business_type ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.verticalScroll}
                contentContainerStyle={styles.verticalRow}
              >
                {(
                  [
                    { id: 'all', label: 'Global', Icon: Package, activeColor: '#6B7280' },
                    { id: 'shopping', label: 'Shopping', Icon: ShoppingBag, activeColor: '#F97316' },
                    { id: 'food', label: 'Resto', Icon: Zap, activeColor: '#EAB308' },
                  ] as const
                ).map((v) => {
                  const active = selectedVertical === v.id;
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => setSelectedVertical(v.id)}
                      style={[
                        styles.verticalBtn,
                        active
                          ? { backgroundColor: v.activeColor, borderColor: v.activeColor }
                          : styles.verticalBtnIdle,
                      ]}
                    >
                      <v.Icon size={14} color={active ? '#FFFFFF' : '#9CA3AF'} />
                      <Text
                        style={[styles.verticalBtnText, active ? styles.verticalBtnTextActive : null]}
                      >
                        {v.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </View>
      </Reveal>

      {/* Statistiques (grille 2 colonnes : un seul bloc animé, la mise en page
          interne reste celle du web) */}
      <Reveal delay={60}>
        <View style={styles.statsGrid}>
          <StatCard
            title={store?.business_type === 'food' ? 'Ventes Resto' : 'Ventes effectuées'}
            value={filteredMetrics.revenue.current}
            isCurrency
            icon={<DollarSign size={14} color="#111827" />}
            trend={filteredMetrics.revenue.trend as 'up' | 'down'}
            trendValue={`${filteredMetrics.revenue.pct}%`}
          />
          <StatCard
            title={store?.business_type === 'food' ? 'Plats servis' : 'Commandes'}
            value={filteredMetrics.orders.current}
            icon={<ShoppingBag size={14} color="#111827" />}
            trend={filteredMetrics.orders.trend as 'up' | 'down'}
            trendValue={`${filteredMetrics.orders.pct}%`}
          />
          <StatCard
            title="Panier Moyen"
            value={filteredMetrics.basket.current}
            isCurrency
            icon={<Zap size={14} color="#111827" />}
            trend={filteredMetrics.basket.trend as 'up' | 'down'}
            trendValue={`${filteredMetrics.basket.pct}%`}
          />
          <StatCard
            title="Trafic Boutique"
            value={filteredMetrics.traffic.current}
            icon={<Eye size={14} color="#111827" />}
          />
        </View>
      </Reveal>

      {/* Comparaison des Performances */}
      {canViewReports ? (
        <Reveal delay={300}>
          <PerformanceChart
            startDate={startDate}
            endDate={endDate}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
            data={currentData}
          />
        </Reveal>
      ) : null}

      {/* Plus Visités */}
      <Reveal delay={380}>
        <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Eye size={16} color="#3B82F6" />
            <Text style={styles.cardTitle}>Plus Visités</Text>
          </View>
          <Text style={styles.cardHint}>Storefront</Text>
        </View>
        {mostVisited.length > 0 ? (
          mostVisited.map((product) => (
            <TapScale
              key={product.id}
              onPress={() => router.push(`/product/${product.id}`)}
              style={styles.rankRow}
            >
              <View style={styles.rankLeft}>
                <View style={styles.thumb}>
                  {product.image ? (
                    <Image source={{ uri: product.image }} style={styles.thumbImg} contentFit="cover" />
                  ) : null}
                </View>
                <View style={styles.rankTextCol}>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.rankSub}>{formatCurrency(product.price)}</Text>
                </View>
              </View>
              <View style={styles.rankRight}>
                <Text style={styles.rankValueBlue}>{formatNumber(product.views || 0)}</Text>
                <Text style={styles.rankUnit}>Vues</Text>
              </View>
            </TapScale>
          ))
        ) : (
          <Text style={styles.emptyText}>Aucune visite enregistrée</Text>
        )}
        </View>
      </Reveal>

      {/* Meilleures Ventes */}
      <Reveal delay={440}>
        <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Flame size={16} color="#F97316" />
            <Text style={styles.cardTitle}>Meilleures Ventes</Text>
          </View>
          <Text style={styles.cardHint}>Volume</Text>
        </View>
        {topSelling.length > 0 ? (
          topSelling.map((product) => (
            <TapScale
              key={product.id}
              onPress={() => router.push(`/product/${product.id}`)}
              style={styles.rankRow}
            >
              <View style={styles.rankLeft}>
                <View style={styles.thumb}>
                  {product.image ? (
                    <Image source={{ uri: product.image }} style={styles.thumbImg} contentFit="cover" />
                  ) : null}
                </View>
                <View style={styles.rankTextCol}>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.rankSub}>{product.category}</Text>
                </View>
              </View>
              <View style={styles.rankRight}>
                <Text style={styles.rankValueOrange}>x{formatNumber(product.salesCount || 0)}</Text>
                <Text style={styles.rankUnit}>Vendus</Text>
              </View>
            </TapScale>
          ))
        ) : (
          <Text style={styles.emptyText}>Aucune vente enregistrée</Text>
        )}
        </View>
      </Reveal>

      {/* Alertes stock */}
      <Reveal delay={500}>
        <View style={styles.card}>
        <Text style={styles.stockTitle}>
          {store?.business_type === 'food' ? 'Plats en Pause' : 'Alertes Stock'}
        </Text>
        {store?.business_type === 'food' ? (
          pausedFood.length > 0 ? (
            pausedFood.slice(0, 6).map((product) => (
              <View key={product.id} style={styles.stockRow}>
                <View style={styles.stockThumb}>
                  {product.image ? (
                    <Image source={{ uri: product.image }} style={styles.thumbImg} contentFit="cover" />
                  ) : null}
                </View>
                <View style={styles.stockBody}>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <View style={styles.pausedRow}>
                    <View style={styles.redDot} />
                    <Text style={styles.pausedText}>En pause</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.stockEmpty}>Tous les plats sont disponibles</Text>
          )
        ) : lowStockProducts.length > 0 ? (
          lowStockProducts.slice(0, 6).map((product) => (
            <View key={product.id} style={styles.stockRow}>
              <View style={styles.stockThumb}>
                {product.image ? (
                  <Image source={{ uri: product.image }} style={styles.thumbImg} contentFit="cover" />
                ) : null}
              </View>
              <View style={styles.stockBody}>
                <Text style={styles.rankName} numberOfLines={1}>
                  {product.name}
                </Text>
                <View style={styles.progressRow}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, (product.stock / 20) * 100)}%`,
                          backgroundColor: product.stock < 5 ? '#EF4444' : '#F97316',
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.progressValue,
                      { color: product.stock < 5 ? '#EF4444' : '#F97316' },
                    ]}
                  >
                    {product.stock}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.stockEmpty}>Tous les stocks sont corrects</Text>
        )}
        </View>
      </Reveal>
    </ScrollView>
  );
}

// ── Carte statistique ──────────────────────────────────────────────

interface StatCardProps {
  title: string;
  /** Valeur numérique affichée (animée de 0 à la valeur). */
  value: number;
  /** Montants formatés en FCFA (sinon nombre simple). */
  isCurrency?: boolean;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  trendValue?: string;
}

/** Compteur animé des statistiques (montée de 0 à la valeur). */
function AnimatedStatValue({ value, isCurrency }: { value: number; isCurrency?: boolean }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    progress.setValue(0);
    const listener = progress.addListener(({ value: p }) => {
      setDisplay(p * target);
    });
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      // Le texte est recalculé à chaque frame : pas de driver natif possible.
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      progress.removeListener(listener);
      animation.stop();
    };
  }, [progress, value]);

  return (
    <Text style={styles.statValue} numberOfLines={1}>
      {isCurrency ? formatCurrency(display) : formatNumber(Math.round(display))}
    </Text>
  );
}

function StatCard({ title, value, isCurrency, icon, trend, trendValue }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statTop}>
        <View style={styles.statIcon}>{icon}</View>
        {trend ? (
          <View
            style={[
              styles.trendBadge,
              trend === 'up' ? styles.trendUp : styles.trendDown,
            ]}
          >
            <Text
              style={[
                styles.trendText,
                { color: trend === 'up' ? '#16A34A' : '#DC2626' },
              ]}
            >
              {trendValue}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.statLabel} numberOfLines={1}>
        {title}
      </Text>
      <AnimatedStatValue value={value} isCurrency={isCurrency} />
    </View>
  );
}

// ── Graphique de performances + sélecteur de période ───────────────

interface ChartPoint {
  label: string;
  value: number;
  isMajor: boolean;
  displayValue: number;
  normalized: number;
}

interface PerformanceChartProps {
  startDate: string;
  endDate: string;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  data: ChartPoint[];
}

function PerformanceChart({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  data,
}: PerformanceChartProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerStep, setPickerStep] = useState<'start' | 'end'>('start');
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [viewDate, setViewDate] = useState<Date>(() => parseLocalDate(startDate));
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  // Animations « Shopify » du web : rideau qui s'ouvre (clipPath 0 → 100 en
  // 1,2 s), apparition décalée des points et des libellés d'axe.
  const [revealAnim] = useState(() => new Animated.Value(0));
  const [curtainAnim] = useState(() => new Animated.Value(0));
  const [dotsAnim] = useState(() => new Animated.Value(0));
  const [labelsAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    revealAnim.setValue(0);
    curtainAnim.setValue(0);
    dotsAnim.setValue(0);
    labelsAnim.setValue(0);
    const animation = Animated.parallel([
      Animated.timing(revealAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(curtainAnim, {
        toValue: 1,
        duration: 1200,
        delay: 100,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        // Les attributs SVG ne sont pas animables par le driver natif.
        useNativeDriver: false,
      }),
      Animated.timing(dotsAnim, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: true,
      }),
      Animated.timing(labelsAnim, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [curtainAnim, data, dotsAnim, labelsAnim, revealAnim, startDate, endDate]);

  /** Progression décalée d'un élément (équivalent du `animationDelay` web). */
  const staggered = useCallback(
    (progress: Animated.Value, index: number, startMs: number, stepMs: number) =>
      progress.interpolate({
        inputRange: [
          Math.max(0, startMs / 1600),
          Math.min(1, (startMs + 350) / 1600),
        ],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [],
  );

  const diffDays = Math.round(
    (parseLocalDate(draftEnd).getTime() - parseLocalDate(draftStart).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const openPicker = () => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setPickerStep('start');
    setViewDate(parseLocalDate(startDate));
    setIsPickerOpen(true);
  };

  const closePicker = (apply: boolean) => {
    if (apply) {
      setStartDate(draftStart);
      setEndDate(draftEnd);
    }
    setIsPickerOpen(false);
  };

  const handleDraftSelect = (day: number) => {
    const dateStr = getLocalYMD(new Date(viewDate.getFullYear(), viewDate.getMonth(), day));
    if (pickerStep === 'start') {
      setDraftStart(dateStr);
      setDraftEnd((prev) => (dateStr > prev ? dateStr : prev));
      setPickerStep('end');
    } else {
      setDraftEnd(dateStr);
      setDraftStart((prev) => (dateStr < prev ? dateStr : prev));
    }
  };

  type DatePreset = { label: string; days?: number; kind?: 'today' | 'yesterday' | 'month' | 'year' };
  const presets: DatePreset[] = [
    { label: "Aujourd'hui", kind: 'today' },
    { label: 'Hier', kind: 'yesterday' },
    { label: '7 jours', days: 7 },
    { label: '30 jours', days: 30 },
    { label: '90 jours', days: 90 },
    { label: 'Ce mois', kind: 'month' },
    { label: '12 mois', kind: 'year' },
  ];

  const getPresetRange = (preset: DatePreset) => {
    const today = new Date();
    let start: Date = today;
    let end: Date = today;
    if (preset.kind === 'yesterday') {
      start = new Date(today);
      start.setDate(start.getDate() - 1);
      end = new Date(start);
    } else if (preset.kind === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (preset.kind === 'year') {
      start = new Date(today);
      start.setFullYear(start.getFullYear() - 1);
    } else if (preset.days) {
      start = new Date(today);
      start.setDate(start.getDate() - preset.days);
    }
    return { start, end };
  };

  const isPresetActive = (preset: DatePreset) => {
    const { start, end } = getPresetRange(preset);
    return getLocalYMD(start) === draftStart && getLocalYMD(end) === draftEnd;
  };

  const applyPreset = (start: Date, end: Date) => {
    const s = getLocalYMD(start);
    const e = getLocalYMD(end);
    setDraftStart(s);
    setDraftEnd(e);
    setStartDate(s);
    setEndDate(e);
    setIsPickerOpen(false);
  };

  const resetToDefault = () => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    setDraftStart(getLocalYMD(d));
    setDraftEnd(getLocalYMD(new Date()));
  };

  const handleChartLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width, height } = event.nativeEvent.layout;
      setChartSize({ width, height });
    },
    [],
  );

  const linePath = useMemo(() => {
    if (data.length === 0) return '';
    const denominator = data.length - 1 || 1;
    return data
      .map((d, i) => `${(i * (100 / denominator)).toFixed(2)},${(100 - d.normalized).toFixed(2)}`)
      .join(' L ');
  }, [data]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const todayStr = getLocalYMD(new Date());
  const monthLabel = viewDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const rangeLabel =
    startDate === endDate
      ? parseLocalDate(startDate).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : `${parseLocalDate(startDate).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
        })} — ${parseLocalDate(endDate).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}`;

  const pointCount = data.length;
  const gridCells: Array<{ key: string; day?: number }> = [];
  {
    const offset = (firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) + 6) % 7;
    for (let i = 0; i < offset; i++) gridCells.push({ key: `empty-${i}` });
    for (let d = 1; d <= daysInMonth(viewDate.getFullYear(), viewDate.getMonth()); d++) {
      gridCells.push({ key: `day-${d}`, day: d });
    }
  }

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View style={styles.chartTitleRow}>
          <View style={styles.chartIconPill}>
            <BarChart2 size={18} color={COLORS.brand} />
          </View>
          <View>
            <Text style={styles.chartTitle}>Comparaison des Performances</Text>
            <Text style={styles.chartSubtitle}>Analyse des revenus par période</Text>
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => (isPickerOpen ? closePicker(false) : openPicker())}
        style={styles.periodBtn}
      >
        <View style={styles.periodLeft}>
          <View style={styles.periodIconPill}>
            <Calendar size={14} color={COLORS.brand} />
          </View>
          <View>
            <Text style={styles.periodLabel}>{"Période d'analyse"}</Text>
            <Text style={styles.periodValue}>{rangeLabel}</Text>
          </View>
        </View>
        <ChevronRight
          size={14}
          color="#D1D5DB"
          style={isPickerOpen ? styles.periodChevronOpen : undefined}
        />
      </Pressable>

      {/* Graphique */}
      <View style={styles.chartArea}>
        <View pointerEvents="none" style={styles.gridLines}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.gridLine} />
          ))}
        </View>

        <Animated.View
          style={[
            styles.chartCanvas,
            {
              opacity: revealAnim,
              transform: [
                {
                  translateY: revealAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
          onLayout={handleChartLayout}
        >
          {chartSize.width > 0 && pointCount > 1 ? (
            <>
              <Svg
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={StyleSheet.absoluteFill}
              >
                <Defs>
                  <SvgLinearGradient id="shopifyGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                    <Stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </SvgLinearGradient>
                </Defs>
                <Path d={`M ${linePath} L 100,100 L 0,100 Z`} fill="url(#shopifyGradient)" />
                <Path
                  d={`M ${linePath}`}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>

              {data.map((item, index) => {
                const xPos = (index * (100 / (pointCount - 1)) / 100) * chartSize.width;
                const yPos = ((100 - item.normalized) / 100) * chartSize.height;
                const active = activeIndex === index;
                const dotProgress = staggered(dotsAnim, index, 300, 80);
                return (
                  <View
                    key={`${item.label}-${index}`}
                    style={[styles.pointWrap, { left: xPos - 40, top: yPos - 10 }]}
                  >
                    {active ? (
                      <View style={styles.tooltip}>
                        <Text style={styles.tooltipText}>
                          {formatCurrency(item.displayValue)}
                        </Text>
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() => setActiveIndex(active ? null : index)}
                      hitSlop={10}
                      style={styles.pointHit}
                    >
                      <Animated.View
                        style={{
                          opacity: dotProgress,
                          transform: [
                            {
                              scale: dotProgress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.5, 1],
                              }),
                            },
                            {
                              translateY: dotProgress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [10, 0],
                              }),
                            },
                          ],
                        }}
                      >
                        <View style={[styles.dot, active && styles.dotActive]} />
                      </Animated.View>
                    </Pressable>
                  </View>
                );
              })}
            </>
          ) : null}

          {/* Rideau : masque blanc qui se rétracte de gauche à droite pour
              révéler la courbe (équivalent du clipPath animé du web). */}
          {chartSize.width > 0 && pointCount > 1 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.chartCurtain,
                {
                  width: curtainAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [chartSize.width, 0],
                  }),
                },
              ]}
            />
          ) : null}
        </Animated.View>

        {/* Étiquettes X (mobile : 1re, dernière et index pairs) */}
        <View style={styles.labelsRow} pointerEvents="none">
          {data.map((item, index) => {
            const isFirst = index === 0;
            const isLast = index === pointCount - 1;
            const hidden = !isFirst && !isLast && index % 2 !== 0;
            if (hidden) return null;
            const xPct = index * (100 / (pointCount - 1 || 1));
            const labelProgress = staggered(labelsAnim, index, 700, 40);
            return (
              <Animated.Text
                key={`label-${item.label}-${index}`}
                numberOfLines={1}
                style={[
                  styles.axisLabel,
                  item.isMajor ? styles.axisLabelMajor : null,
                  isFirst
                    ? { left: 0 }
                    : isLast
                      ? { right: 0 }
                      : { left: `${xPct}%`, marginLeft: -20 },
                  { opacity: labelProgress, transform: [{ translateY: labelProgress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] },
                ]}
              >
                {item.label}
              </Animated.Text>
            );
          })}
        </View>
      </View>

      {/* Modale de période */}
      <Modal
        visible={isPickerOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => closePicker(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => closePicker(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {/* Étapes */}
            <View style={styles.stepsRow}>
              <View style={styles.stepsLeft}>
                <Pressable
                  onPress={() => setPickerStep('start')}
                  style={[
                    styles.stepChip,
                    pickerStep === 'start' ? styles.stepChipActive : styles.stepChipIdle,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepChipText,
                      pickerStep === 'start' ? styles.stepChipTextActive : styles.stepChipTextIdle,
                    ]}
                  >
                    1 · Début
                  </Text>
                </Pressable>
                <View style={styles.stepDivider} />
                <Pressable
                  onPress={() => setPickerStep('end')}
                  style={[
                    styles.stepChip,
                    pickerStep === 'end' ? styles.stepChipActive : styles.stepChipIdle,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepChipText,
                      pickerStep === 'end' ? styles.stepChipTextActive : styles.stepChipTextIdle,
                    ]}
                  >
                    2 · Fin
                  </Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => {
                  setDraftStart(startDate);
                  setDraftEnd(endDate);
                  setPickerStep('start');
                }}
              >
                <Text style={styles.restartText}>Recommencer</Text>
              </Pressable>
            </View>

            {/* Raccourcis */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.presetsScroll}
              contentContainerStyle={styles.presetsRow}
            >
              {presets.map((preset) => {
                const active = isPresetActive(preset);
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => {
                      const { start, end } = getPresetRange(preset);
                      applyPreset(start, end);
                    }}
                    style={[styles.presetBtn, active ? styles.presetBtnActive : styles.presetBtnIdle]}
                  >
                    <Text
                      style={[styles.presetText, active ? styles.presetTextActive : styles.presetTextIdle]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable onPress={resetToDefault} style={styles.resetPresetBtn}>
                <Text style={styles.resetPresetText}>Réinitialiser</Text>
              </Pressable>
            </ScrollView>

            {/* Navigation mois */}
            <View style={styles.monthRow}>
              <View style={styles.monthNavLeft}>
                <Pressable
                  onPress={() =>
                    setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1))
                  }
                  style={styles.monthNavBtn}
                >
                  <ChevronLeft size={14} color="#D1D5DB" />
                </Pressable>
                <Pressable
                  onPress={() =>
                    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
                  }
                  style={styles.monthNavBtn}
                >
                  <ChevronLeft size={16} color="#9CA3AF" />
                </Pressable>
              </View>
              <Pressable onPress={() => setViewDate(new Date())}>
                <Text style={styles.monthLabel}>{monthLabel}</Text>
              </Pressable>
              <View style={styles.monthNavLeft}>
                <Pressable
                  onPress={() =>
                    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
                  }
                  style={styles.monthNavBtn}
                >
                  <ChevronRight size={16} color="#9CA3AF" />
                </Pressable>
                <Pressable
                  onPress={() =>
                    setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1))
                  }
                  style={styles.monthNavBtn}
                >
                  <ChevronRight size={14} color="#D1D5DB" />
                </Pressable>
              </View>
            </View>

            {/* Calendrier */}
            <View style={styles.calendarGrid}>
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                <View key={d} style={styles.weekdayCell}>
                  <Text style={styles.weekdayText}>{d}</Text>
                </View>
              ))}
              {gridCells.map((cell) => {
                if (!cell.day) {
                  return <View key={cell.key} style={styles.dayCell} />;
                }
                const d = cell.day;
                const currentD = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
                const dateStr = getLocalYMD(currentD);
                const isStart = dateStr === draftStart;
                const isEnd = dateStr === draftEnd;
                const inRange = dateStr > draftStart && dateStr < draftEnd;
                const isToday = dateStr === todayStr;
                const isFuture = dateStr > todayStr;
                const stepInvalid = pickerStep === 'start' ? dateStr > draftEnd : dateStr < draftStart;
                const disabled = isFuture || stepInvalid;
                const isActiveStep =
                  (pickerStep === 'start' && isStart) || (pickerStep === 'end' && isEnd);

                return (
                  <Pressable
                    key={cell.key}
                    disabled={disabled}
                    onPress={() => handleDraftSelect(d)}
                    style={[
                      styles.dayCell,
                      isActiveStep ? styles.dayActive : null,
                      isStart && !isActiveStep ? styles.dayStart : null,
                      isEnd && !isActiveStep ? styles.dayEnd : null,
                      !isStart && !isEnd && inRange ? styles.dayInRange : null,
                      isToday && !isStart && !isEnd && !inRange && !disabled
                        ? styles.dayToday
                        : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isActiveStep || ((isStart || isEnd) && !isActiveStep)
                          ? styles.dayTextActive
                          : null,
                        !isStart && !isEnd && inRange ? styles.dayTextInRange : null,
                        !isStart && !isEnd && !inRange && !disabled ? styles.dayTextIdle : null,
                        disabled ? styles.dayTextDisabled : null,
                      ]}
                    >
                      {d}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Résumé + actions */}
            <View style={styles.footer}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryColLeft}>
                  <Text style={styles.summaryLabel}>Début</Text>
                  <Text style={styles.summaryDate}>
                    {draftStart
                      ? parseLocalDate(draftStart).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </Text>
                </View>
                <View style={styles.summaryColCenter}>
                  <Text style={styles.summaryDays}>
                    {diffDays === 0
                      ? draftStart
                        ? parseLocalDate(draftStart).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : "Aujourd'hui"
                      : `${diffDays} jour${diffDays > 1 ? 's' : ''}`}
                  </Text>
                  <Text style={styles.summaryPeriod}>période</Text>
                </View>
                <View style={styles.summaryColRight}>
                  <Text style={styles.summaryLabel}>Fin</Text>
                  <Text style={styles.summaryDate}>
                    {draftEnd
                      ? parseLocalDate(draftEnd).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
                <Pressable onPress={() => closePicker(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Annuler</Text>
                </Pressable>
                <Pressable onPress={() => closePicker(true)} style={styles.applyBtn}>
                  <Text style={styles.applyBtnText}>Appliquer</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 8,
    paddingBottom: 32,
  },

  // ── En-tête ─────────────────────────────────────────────────────
  header: {
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarBox: {
    width: 32,
    height: 32,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFF7ED',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  verticalScroll: {
    marginTop: 8,
  },
  verticalRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  verticalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
  },
  verticalBtnIdle: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F3F4F6',
  },
  verticalBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  verticalBtnTextActive: {
    color: '#FFFFFF',
  },

  // ── Statistiques ────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statIcon: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  trendUp: {
    backgroundColor: '#F0FDF4',
  },
  trendDown: {
    backgroundColor: '#FEF2F2',
  },
  trendText: {
    fontSize: 8,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },

  // ── Graphique ───────────────────────────────────────────────────
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 8,
    marginBottom: 8,
  },
  chartHeader: {
    marginBottom: 6,
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartIconPill: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  chartSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 2,
  },
  periodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  periodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  periodIconPill: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
  },
  periodLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    lineHeight: 10,
    marginBottom: 2,
  },
  periodValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
  },
  periodChevronOpen: {
    transform: [{ rotate: '90deg' }],
  },
  chartArea: {
    height: 192,
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 8,
    position: 'relative',
  },
  gridLines: {
    position: 'absolute',
    top: 40,
    bottom: 64,
    left: 24,
    right: 24,
    justifyContent: 'space-between',
  },
  gridLine: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#F3F4F6',
    height: 0,
  },
  chartCanvas: {
    flex: 1,
    marginBottom: 24,
    position: 'relative',
  },
  chartCurtain: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#FFFFFF',
    zIndex: 20,
  },
  pointWrap: {
    position: 'absolute',
    width: 80,
    alignItems: 'center',
  },
  pointHit: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#10B981',
  },
  dotActive: {
    transform: [{ scale: 1.4 }],
    backgroundColor: '#10B981',
    borderColor: '#FFFFFF',
  },
  tooltip: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tooltipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  labelsRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
  },
  axisLabel: {
    position: 'absolute',
    fontSize: 8,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  axisLabelMajor: {
    color: '#4B5563',
  },

  // ── Cartes listes ───────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  cardHint: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 6,
    marginBottom: 6,
    borderRadius: 12,
  },
  rankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  thumb: {
    width: 32,
    height: 32,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  rankTextCol: {
    flexShrink: 1,
    minWidth: 0,
  },
  rankName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#111827',
    maxWidth: 100,
  },
  rankSub: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  rankRight: {
    alignItems: 'flex-end',
  },
  rankValueBlue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
    lineHeight: 12,
  },
  rankValueOrange: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EA580C',
    lineHeight: 12,
  },
  rankUnit: {
    fontSize: 8,
    fontWeight: '700',
    color: '#D1D5DB',
    textTransform: 'uppercase',
    lineHeight: 10,
  },
  emptyText: {
    paddingVertical: 24,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    color: '#D1D5DB',
  },

  // ── Alertes stock ───────────────────────────────────────────────
  stockTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    minWidth: 0,
  },
  stockThumb: {
    width: 32,
    height: 32,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  stockBody: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  pausedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  pausedText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#EF4444',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  progressTrack: {
    flexGrow: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressValue: {
    fontSize: 9,
    fontWeight: '700',
  },
  stockEmpty: {
    paddingVertical: 24,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '400',
    color: '#9CA3AF',
  },

  // ── Modale période ──────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 12,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stepsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  stepChipActive: {
    backgroundColor: COLORS.brand,
  },
  stepChipIdle: {
    backgroundColor: '#F3F4F6',
  },
  stepChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  stepChipTextActive: {
    color: '#FFFFFF',
  },
  stepChipTextIdle: {
    color: '#6B7280',
  },
  stepDivider: {
    width: 16,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  restartText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  presetsScroll: {
    marginBottom: 20,
  },
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  presetBtnActive: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },
  presetBtnIdle: {
    backgroundColor: '#F9FAFB',
    borderColor: '#F3F4F6',
  },
  presetText: {
    fontSize: 11,
    fontWeight: '700',
  },
  presetTextActive: {
    color: '#FFFFFF',
  },
  presetTextIdle: {
    color: '#6B7280',
  },
  resetPresetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
  },
  resetPresetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  monthNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthNavBtn: {
    padding: 8,
    borderRadius: 12,
  },
  monthLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  weekdayCell: {
    width: '14.2857%',
    alignItems: 'center',
    marginBottom: 4,
  },
  weekdayText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#D1D5DB',
  },
  dayCell: {
    width: '14.2857%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayActive: {
    backgroundColor: COLORS.brand,
    borderRadius: 12,
  },
  dayStart: {
    backgroundColor: COLORS.brand,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  dayEnd: {
    backgroundColor: COLORS.brand,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  dayInRange: {
    backgroundColor: '#FFF7ED',
  },
  dayToday: {
    borderWidth: 2,
    borderColor: 'rgba(245,107,42,0.4)',
    borderRadius: 12,
  },
  dayText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dayTextActive: {
    color: '#FFFFFF',
  },
  dayTextInRange: {
    color: COLORS.brand,
  },
  dayTextIdle: {
    color: '#4B5563',
  },
  dayTextDisabled: {
    color: '#D1D5DB',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  summaryColLeft: {
    alignItems: 'flex-start',
  },
  summaryColCenter: {
    alignItems: 'center',
  },
  summaryColRight: {
    alignItems: 'flex-end',
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  summaryDate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
  },
  summaryDays: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.brand,
  },
  summaryPeriod: {
    fontSize: 8,
    fontWeight: '700',
    color: '#D1D5DB',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  applyBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#111827',
    borderRadius: 16,
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});
