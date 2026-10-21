/**
 * Espace client mobile — refonte épurée.
 *
 * Structure : en-tête → contenu contextuel.
 *  - Aperçu : raccourcis (Mes commandes, Mes avis, Boutiques suivies,
 *    Mon profil) puis dernières commandes (liste complète des produits).
 *  - Une section par onglet, avec un en-tête de section et un retour
 *    « Aperçu ».
 *
 * Adresses et Alertes restent masquées dans la navigation : elles sont
 * accessibles via `/account?tab=adresses` et `?tab=notifications`.
 *
 * Design : une seule couleur d'accent (COLORS.brand), le reste en neutres.
 * Échelle d'espacement 4/8/12/16/20, rayons 16 (carte) / 10 (élément),
 * typo 15 (titre) / 13 (texte) / 11 (méta) / 9 (micro).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  RefreshCcw,
  Star,
  Store,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useBuyerData } from '@/hooks/useBuyerData';
import { OrdersTab, type ReviewTargetProduct } from '@/components/buyer/OrdersTab';
import { AddressesTab } from '@/components/buyer/AddressesTab';
import { ReviewsTab } from '@/components/buyer/ReviewsTab';
import { StoresTab } from '@/components/buyer/StoresTab';
import { NotificationsTab } from '@/components/buyer/NotificationsTab';
import { ProfileTab } from '@/components/buyer/ProfileTab';
import { AddressModal, type SaveAddressPayload } from '@/components/buyer/AddressModal';
import { ReviewModal } from '@/components/buyer/ReviewModal';
import { SheetModal } from '@/components/buyer/SheetModal';
import {
  PanelSkeleton,
  ProductThumb,
  StatusBadge,
  formatShortDate,
} from '@/components/buyer/ui';
import ConfirmationModal from '@/components/ConfirmationModal';
import { Button } from '@/components/Button';
import { formatCurrency } from '@/utils';
import type { BuyerAddress, BuyerOrder, BuyerTabId } from '@/types';
import { COLORS } from '@/theme';

type AccountSection = 'overview' | BuyerTabId | 'stores';

interface SectionDef {
  id: AccountSection;
  label: string;
  desc: string;
  Icon: LucideIcon;
  /** Libellé utilisé par la tuile de raccourci. */
  tileLabel?: string;
}

const ALL_SECTIONS: SectionDef[] = [
  {
    id: 'overview',
    label: 'Aperçu',
    desc: 'Votre espace en un coup d’œil',
    Icon: LayoutDashboard,
  },
  {
    id: 'orders',
    label: 'Commandes',
    desc: 'Historique et suivi de vos achats',
    Icon: Package,
    tileLabel: 'Mes commandes',
  },
  {
    id: 'addresses',
    label: 'Adresses',
    desc: 'Vos contacts de livraison',
    Icon: MapPin,
  },
  {
    id: 'reviews',
    label: 'Avis',
    desc: 'Vos avis publiés',
    Icon: Star,
    tileLabel: 'Mes avis',
  },
  {
    id: 'stores',
    label: 'Boutiques',
    desc: 'Boutiques chez lesquelles vous avez commandé',
    Icon: Store,
    tileLabel: 'Boutiques suivies',
  },
  {
    id: 'notifications',
    label: 'Alertes',
    desc: 'WhatsApp et e-mail',
    Icon: BellRing,
  },
  {
    id: 'profile',
    label: 'Profil',
    desc: 'Vos informations et sécurité',
    Icon: User,
    tileLabel: 'Mon profil',
  },
];

/** Sections masquées dans la navigation : accessibles via deep link ?tab= */
const HIDDEN_SECTION_IDS: AccountSection[] = ['addresses', 'notifications'];

const SECTIONS = ALL_SECTIONS.filter((s) => !HIDDEN_SECTION_IDS.includes(s.id));

const SECTION_FROM_PARAM: Record<string, AccountSection> = {
  overview: 'overview',
  apercu: 'overview',
  commandes: 'orders',
  orders: 'orders',
  adresses: 'addresses',
  addresses: 'addresses',
  avis: 'reviews',
  reviews: 'reviews',
  boutiques: 'stores',
  stores: 'stores',
  notifications: 'notifications',
  profil: 'profile',
  profile: 'profile',
};

const HERO_GRADIENT = ['#002F34', '#0B4A50'] as const;

const orderStoreName = (order: BuyerOrder) => order.stores?.[0]?.name || 'Boutique';

const orderBusinessType = (order: BuyerOrder): string | undefined =>
  order.stores?.[0]?.business_type ||
  order.order_items?.[0]?.products?.[0]?.business_type;

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { user, isReady, openAuth, logout } = useAuth();
  const data = useBuyerData();

  const scrollRef = useRef<ScrollView>(null);
  const [activeSection, setActiveSection] = useState<AccountSection>(
    () => SECTION_FROM_PARAM[params.tab || ''] || 'overview',
  );
  const [addressModal, setAddressModal] = useState<{
    open: boolean;
    editing: BuyerAddress | null;
  }>({ open: false, editing: null });
  const [reviewTarget, setReviewTarget] = useState<
    (ReviewTargetProduct & { store_id: string }) | null
  >(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [addressPendingDelete, setAddressPendingDelete] = useState<BuyerAddress | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  // Synchronise la section si le paramètre d'URL change (deep link).
  useEffect(() => {
    const target = SECTION_FROM_PARAM[params.tab || ''];
    if (target && target !== activeSection) setActiveSection(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tab]);

  const showError = !!data.error && data.error !== dismissedError;

  const handleRetry = useCallback(() => {
    setDismissedError(null);
    void data.refreshAll();
  }, [data]);

  const openSection = useCallback((section: AccountSection) => {
    setActiveSection(section);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  /**
   * Retour hiérarchique : ferme d'abord les surcouches ouvertes, puis revient
   * à l'aperçu, et ne quitte l'espace client qu'en dernier recours.
   */
  const handleBack = useCallback((): boolean => {
    if (addressModal.open) {
      setAddressModal({ open: false, editing: null });
      return true;
    }
    if (reviewTarget) {
      setReviewTarget(null);
      return true;
    }
    if (showLogoutModal) {
      setShowLogoutModal(false);
      return true;
    }
    if (addressPendingDelete) {
      setAddressPendingDelete(null);
      return true;
    }
    if (activeSection !== 'overview') {
      setActiveSection('overview');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return true;
    }
    return false;
  }, [
    activeSection,
    addressModal.open,
    addressPendingDelete,
    reviewTarget,
    showLogoutModal,
  ]);

  // Bouton retour Android : on revient à l'aperçu avant de quitter l'écran.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () =>
        handleBack(),
      );
      return () => subscription.remove();
    }, [handleBack]),
  );

  const handleDeleteAddress = useCallback(async () => {
    if (!addressPendingDelete) return;
    setIsDeleting(true);
    const ok = await data.deleteAddress(addressPendingDelete.id);
    setIsDeleting(false);
    if (ok) setAddressPendingDelete(null);
  }, [addressPendingDelete, data]);

  const handleSaveAddress = useCallback(
    async (payload: SaveAddressPayload) => data.saveAddress(payload),
    [data],
  );

  const handleReviewSubmit = useCallback(
    async (rating: number, comment: string) => {
      if (!reviewTarget) return false;
      return data.submitReview(reviewTarget.store_id, reviewTarget.id, {
        rating,
        comment,
        author: user?.name,
      });
    },
    [data, reviewTarget, user?.name],
  );

  const counts = useMemo(() => {
    const storeIds = new Set(
      data.orders.map((o) => o.store_id || o.stores?.[0]?.name || '').filter(Boolean),
    );
    return {
      orders: data.totalOrders,
      reviews: data.reviews.length,
      stores: storeIds.size,
    };
  }, [data.orders, data.reviews.length, data.totalOrders]);

  const sortedOrders = useMemo(
    () =>
      [...data.orders].sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        return bTime - aTime;
      }),
    [data.orders],
  );

  const recentOrders = useMemo(() => sortedOrders.slice(0, 8), [sortedOrders]);

  const activeSectionDef =
    ALL_SECTIONS.find((section) => section.id === activeSection) || ALL_SECTIONS[0];

  /** Tuiles de raccourci de l'aperçu. */
  const tiles = useMemo(
    () =>
      SECTIONS.filter((s) => s.id !== 'overview').map((section) => {
        const hint =
          section.id === 'orders'
            ? `${counts.orders} au total`
            : section.id === 'reviews'
              ? `${counts.reviews} publié${counts.reviews > 1 ? 's' : ''}`
              : section.id === 'stores'
                ? `${counts.stores} boutique${counts.stores > 1 ? 's' : ''}`
                : 'Infos et sécurité';
        return {
          id: section.id,
          label: section.tileLabel || section.label,
          hint,
          Icon: section.Icon,
        };
      }),
    [counts.orders, counts.reviews, counts.stores],
  );

  const renderError = () => {
    if (!showError) return null;
    return (
      <View style={styles.errorCard}>
        <View style={styles.errorIcon}>
          <AlertTriangle size={14} color={COLORS.danger} />
        </View>
        <View style={styles.errorBody}>
          <Text style={styles.errorTitle}>Impossible de charger vos données</Text>
          <Text style={styles.errorMessage}>{data.error}</Text>
          <View style={styles.errorActions}>
            <Pressable onPress={handleRetry} style={styles.retryBtn}>
              <Text style={styles.retryText}>Réessayer</Text>
            </Pressable>
            <Pressable
              onPress={() => setDismissedError(data.error ?? null)}
              style={styles.dismissBtn}
            >
              <Text style={styles.dismissText}>Plus tard</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  const renderTiles = () => (
    <View style={styles.tileGrid}>
      {tiles.map((tile) => {
        const Icon = tile.Icon;
        return (
          <Pressable
            key={tile.id}
            onPress={() => openSection(tile.id)}
            accessibilityRole="button"
            accessibilityLabel={tile.label}
            style={({ pressed }) => [
              styles.tile,
              pressed && styles.pressed,
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
          >
            <View style={styles.tileIcon}>
              <Icon size={15} color={COLORS.brand} />
            </View>
            <Text style={styles.tileLabel} numberOfLines={1}>
              {tile.label}
            </Text>
            <Text style={styles.tileHint} numberOfLines={1}>
              {tile.hint}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderRecentOrders = () => {
    if (data.loading && sortedOrders.length === 0) {
      return <PanelSkeleton rows={2} />;
    }

    return (
      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Text style={styles.blockTitle}>Dernières commandes</Text>
          <Pressable
            onPress={() => openSection('orders')}
            style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
          >
            <Text style={styles.linkBtnText}>Tout voir</Text>
            <ChevronRight size={13} color={COLORS.brand} />
          </Pressable>
        </View>

        {recentOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Package size={20} color={COLORS.brand} />
            </View>
            <Text style={styles.emptyText}>
              Vos commandes terminées ou annulées apparaîtront ici.
            </Text>
            <Pressable
              onPress={() => router.replace('/')}
              style={({ pressed }) => [styles.emptyBtn, pressed && styles.pressed]}
            >
              <Text style={styles.emptyBtnText}>Découvrir les boutiques</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.orderList}>
            {recentOrders.map((order) => {
              const items = order.order_items || [];
              const articleCount = items.reduce(
                (sum, item) => sum + (item.quantity || 0),
                0,
              );
              return (
                <Pressable
                  key={order.id}
                  onPress={() => openSection('orders')}
                  style={({ pressed }) => [
                    styles.orderCard,
                    pressed && styles.pressed,
                    pressed && { transform: [{ scale: 0.99 }] },
                  ]}
                >
                  <View style={styles.orderCardHead}>
                    <Text style={styles.orderStore} numberOfLines={1}>
                      {orderStoreName(order)}
                    </Text>
                    <Text style={styles.orderTotal}>{formatCurrency(order.total)}</Text>
                  </View>

                  <View style={styles.orderCardMeta}>
                    <Text style={styles.orderMeta} numberOfLines={1}>
                      {articleCount} article{articleCount > 1 ? 's' : ''} ·{' '}
                      {formatShortDate(order.date)}
                    </Text>
                    <StatusBadge
                      status={order.status}
                      businessType={orderBusinessType(order)}
                    />
                  </View>

                  <View style={styles.orderItems}>
                    {items.map((item, idx) => {
                      const product = item.products?.[0];
                      return (
                        <View
                          key={item.id || `${order.id}-unit-${idx}`}
                          style={styles.orderItem}
                        >
                          <ProductThumb
                            src={product?.image}
                            size={28}
                            iconSize={12}
                          />
                          <Text style={styles.orderItemName} numberOfLines={1}>
                            {product?.name || 'Produit'}
                          </Text>
                          <Text style={styles.orderItemMeta}>
                            {item.quantity} × {formatCurrency(item.price)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const renderOverview = () => (
    <View style={styles.overview}>
      {renderTiles()}
      {renderRecentOrders()}
    </View>
  );

  const renderPanel = () => {
    switch (activeSection) {
      case 'orders':
        return (
          <OrdersTab
            orders={data.orders}
            loading={data.loading}
            loadingMore={data.loadingMore}
            hasMoreOrders={data.hasMoreOrders}
            onLoadMore={data.loadMoreOrders}
            onReviewProduct={(product, storeId) =>
              setReviewTarget({ ...product, store_id: storeId })
            }
            onBrowse={() => router.replace('/')}
          />
        );
      case 'addresses':
        return (
          <AddressesTab
            addresses={data.addresses}
            loading={data.loading}
            onAdd={() => setAddressModal({ open: true, editing: null })}
            onEdit={(addr) => setAddressModal({ open: true, editing: addr })}
            onDelete={(addr) => setAddressPendingDelete(addr)}
            deletingId={isDeleting ? addressPendingDelete?.id : null}
          />
        );
      case 'reviews':
        return <ReviewsTab reviews={data.reviews} loading={data.loading} />;
      case 'stores':
        return <StoresTab orders={data.orders} loading={data.loading} />;
      case 'notifications':
        return <NotificationsTab />;
      case 'profile':
        return <ProfileTab onLogout={() => setShowLogoutModal(true)} />;
      default:
        return null;
    }
  };

  const renderGuest = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.guestWrap,
        { paddingBottom: Math.max(insets.bottom, 16) + 32 },
      ]}
    >
      <LinearGradient colors={HERO_GRADIENT} style={styles.guestHero}>
        <View style={styles.guestIcon}>
          <User size={26} color={COLORS.brand} />
        </View>
        <Text style={styles.guestTitle}>Votre espace client</Text>
        <Text style={styles.guestText}>
          Retrouvez vos commandes, vos adresses et vos avis en un seul endroit.
        </Text>
      </LinearGradient>

      <View style={styles.guestBenefits}>
        {[
          {
            Icon: Package,
            title: 'Suivez vos commandes',
            text: 'Statut, historique et détails de vos achats.',
          },
          {
            Icon: MapPin,
            title: 'Gérez vos adresses',
            text: 'Une livraison plus rapide à chaque commande.',
          },
          {
            Icon: Star,
            title: 'Partagez vos avis',
            text: 'Aidez les autres acheteurs et les boutiques.',
          },
        ].map(({ Icon, title, text }) => (
          <View key={title} style={styles.guestBenefit}>
            <View style={styles.guestBenefitIcon}>
              <Icon size={15} color={COLORS.brand} />
            </View>
            <View style={styles.guestBenefitText}>
              <Text style={styles.guestBenefitTitle}>{title}</Text>
              <Text style={styles.guestBenefitDesc}>{text}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.guestActions}>
        <Button size="lg" fullWidth onPress={() => openAuth('login')}>
          Se connecter
        </Button>
        <Button
          size="lg"
          fullWidth
          variant="outline"
          onPress={() => openAuth('register')}
        >
          Créer un compte
        </Button>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              if (!handleBack()) router.back();
            }}
            style={styles.headerBtn}
            hitSlop={8}
            accessibilityLabel="Retour"
          >
            <ArrowLeft size={20} color={COLORS.textFaint} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Mon compte</Text>
            <Text style={styles.headerSubtitle}>Espace client</Text>
          </View>
          {user ? (
            <Pressable
              onPress={() => void data.refreshAll()}
              style={styles.headerBtn}
              hitSlop={8}
              accessibilityLabel="Rafraîchir"
            >
              <RefreshCcw
                size={18}
                color={data.refreshing ? COLORS.brand : COLORS.textFaint}
              />
            </Pressable>
          ) : (
            <View style={styles.headerBtn} />
          )}
        </View>
      </View>

      {!isReady ? null : !user ? (
        renderGuest()
      ) : (
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 16) + 32 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={Boolean(data.refreshing)}
              onRefresh={() => void data.refreshAll()}
              tintColor={COLORS.brand}
              colors={[COLORS.brand]}
            />
          }
        >
          {renderError()}

          {activeSection === 'overview' ? (
            renderOverview()
          ) : (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionHeadIcon}>
                  <activeSectionDef.Icon size={16} color={COLORS.brand} />
                </View>
                <View style={styles.sectionHeadText}>
                  <Text style={styles.sectionTitle}>{activeSectionDef.label}</Text>
                  <Text style={styles.sectionDesc}>{activeSectionDef.desc}</Text>
                </View>
                <Pressable
                  onPress={() => openSection('overview')}
                  style={({ pressed }) => [styles.sectionBack, pressed && styles.pressed]}
                >
                  <LayoutDashboard size={13} color={COLORS.textMuted} />
                  <Text style={styles.sectionBackText}>Aperçu</Text>
                </Pressable>
              </View>

              {data.loading ? <PanelSkeleton rows={3} /> : renderPanel()}
            </View>
          )}
        </ScrollView>
      )}

      <AddressModal
        visible={addressModal.open}
        address={addressModal.editing}
        onClose={() => setAddressModal({ open: false, editing: null })}
        onSave={handleSaveAddress}
      />

      <ReviewModal
        visible={!!reviewTarget}
        product={reviewTarget}
        onClose={() => setReviewTarget(null)}
        onSubmit={handleReviewSubmit}
      />

      <SheetModal
        visible={showLogoutModal}
        title="Déconnexion"
        subtitle="Vous quittez votre compte"
        icon={<LogOut size={18} color={COLORS.brand} />}
        onClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.logoutBody}>
          <Text style={styles.logoutQuestion}>
            Voulez-vous vraiment vous déconnecter de votre espace client ?
          </Text>
          <View style={styles.logoutActions}>
            <Pressable
              onPress={async () => {
                setShowLogoutModal(false);
                await logout();
                router.replace('/');
              }}
              style={styles.logoutConfirm}
            >
              <Text style={styles.logoutConfirmText}>Oui, me déconnecter</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowLogoutModal(false)}
              style={styles.logoutCancel}
            >
              <Text style={styles.logoutCancelText}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </SheetModal>

      <ConfirmationModal
        isOpen={!!addressPendingDelete}
        onClose={() => !isDeleting && setAddressPendingDelete(null)}
        onConfirm={handleDeleteAddress}
        title="Supprimer cette adresse"
        message={
          addressPendingDelete
            ? `« ${addressPendingDelete.name} » sera définitivement retirée de vos adresses de livraison.`
            : ''
        }
        confirmText="Supprimer"
        type="danger"
        isLoading={isDeleting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── En-tête ──────────────────────────────────────────────
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  headerRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  headerCenter: {
    alignItems: 'center',
    gap: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textFaint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // ── Contenu ──────────────────────────────────────────────
  content: {
    padding: 16,
    gap: 20,
  },
  overview: {
    gap: 20,
  },
  block: {
    gap: 10,
  },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.2,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginRight: -8,
    borderRadius: 10,
  },
  linkBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.brand,
  },

  // ── Tuiles de raccourci ──────────────────────────────────
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '48%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  tileIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: -0.1,
  },
  tileHint: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textFaint,
  },

  // ── Cartes de commande ───────────────────────────────────
  orderList: {
    gap: 10,
  },
  orderCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  orderCardHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  orderCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  orderStore: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: -0.1,
  },
  orderTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
  },
  orderMeta: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textFaint,
  },
  orderItems: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    gap: 8,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderItemName: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  orderItemMeta: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textFaint,
    fontVariant: ['tabular-nums'],
  },

  // ── En-tête de section ───────────────────────────────────
  section: {
    gap: 14,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionHeadIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeadText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.2,
  },
  sectionDesc: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  sectionBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  sectionBackText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },

  // ── État vide ────────────────────────────────────────────
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    padding: 24,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    color: COLORS.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  emptyBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.brand,
  },
  emptyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.surface,
  },

  // ── Erreur ───────────────────────────────────────────────
  errorCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  errorIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  errorMessage: {
    fontSize: 11,
    lineHeight: 16,
    color: '#B91C1C',
  },
  errorActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: COLORS.danger,
  },
  retryText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.surface,
  },
  dismissBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dismissText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B91C1C',
  },

  // ── Invité (non connecté) ────────────────────────────────
  guestWrap: {
    padding: 16,
    gap: 16,
  },
  guestHero: {
    borderRadius: 20,
    padding: 20,
    gap: 6,
    backgroundColor: COLORS.ink,
  },
  guestIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.surface,
    letterSpacing: -0.4,
  },
  guestText: {
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.70)',
    fontWeight: '500',
    maxWidth: 300,
  },
  guestBenefits: {
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  guestBenefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guestBenefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBenefitText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  guestBenefitTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
  },
  guestBenefitDesc: {
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  guestActions: {
    gap: 10,
  },

  // ── Déconnexion ──────────────────────────────────────────
  logoutBody: {
    gap: 16,
  },
  logoutQuestion: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  logoutActions: {
    flexDirection: 'row',
    gap: 10,
  },
  logoutConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.danger,
  },
  logoutConfirmText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.surface,
  },
  logoutCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  logoutCancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },

  pressed: {
    opacity: 0.85,
  },
});
