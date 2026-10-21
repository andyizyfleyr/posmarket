/**
 * Espace client mobile - refonte épurée.
 *
 * Identité compacte, actions rapides (Commandes, Avis, Profil) et dernières
 * commandes. Adresses et Alertes masqués dans la navigation : accessibles via
 * `/account?tab=adresses` et `?tab=notifications`.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Pencil,
  Plus,
  RefreshCcw,
  Star,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useBuyerData } from '@/hooks/useBuyerData';
import { OrdersTab, type ReviewTargetProduct } from '@/components/buyer/OrdersTab';
import { AddressesTab } from '@/components/buyer/AddressesTab';
import { ReviewsTab } from '@/components/buyer/ReviewsTab';
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
import { formatPhoneNumber } from '@/constants/countries';
import { API_BASE_URL } from '@/api/client';
import { formatCurrency } from '@/utils';
import type { BuyerAddress, BuyerOrder, BuyerTabId } from '@/types';
import { COLORS } from '@/theme';

type AccountSection = 'overview' | BuyerTabId;

interface SectionDef {
  id: AccountSection;
  label: string;
  desc: string;
  Icon: LucideIcon;
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
  },
];

/** Sections masquées dans la barre d'onglets : accessibles via deep link ?tab= */
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
  notifications: 'notifications',
  profil: 'profile',
  profile: 'profile',
};

type QuickActionId = Exclude<AccountSection, 'overview'>;

interface QuickAction {
  id: QuickActionId;
  label: string;
  hint: string;
  Icon: LucideIcon;
  color: string;
  tint: string;
  badge?: number;
}

const HERO_GRADIENT = ['#002F34', '#0B4A50'] as const;

const avatarInitial = (name: string) => (name || 'U').trim().charAt(0).toUpperCase();

const orderStoreName = (order: BuyerOrder) => order.stores?.[0]?.name || 'Boutique';

const orderBusinessType = (order: BuyerOrder): string | undefined =>
  order.stores?.[0]?.business_type ||
  order.order_items?.[0]?.products?.[0]?.business_type;

const orderItemCount = (order: BuyerOrder) =>
  (order.order_items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

const orderReference = (order: BuyerOrder) =>
  order.id ? `#${order.id.slice(-6).toUpperCase()}` : 'Commande';

const orderProgressStep = (status: string) => {
  if (status === 'PENDING') return 0;
  if (status === 'READY' || status === 'SHIPPED') return 1;
  if (status === 'COMPLETED') return 2;
  return -1;
};

const PROGRESS_LABELS = ['Confirmée', 'En cours', 'Livrée'];

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
  const [showHelpModal, setShowHelpModal] = useState(false);
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

  const counts = useMemo(
    () => ({
      orders: data.totalOrders,
      reviews: data.reviews.length,
    }),
    [data.reviews.length, data.totalOrders],
  );

  const sortedOrders = useMemo(
    () =>
      [...data.orders].sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        return bTime - aTime;
      }),
    [data.orders],
  );

  const activeOrder = useMemo(
    () =>
      sortedOrders.find(
        (order) => order.status !== 'COMPLETED' && order.status !== 'CANCELLED',
      ),
    [sortedOrders],
  );

  const recentOrders = useMemo(
    () =>
      sortedOrders
        .filter((order) => order.id !== activeOrder?.id)
        .slice(0, 2),
    [activeOrder?.id, sortedOrders],
  );

  const activeSectionDef =
    ALL_SECTIONS.find((section) => section.id === activeSection) || ALL_SECTIONS[0];

  const quickActions: QuickAction[] = useMemo(
    () =>
      (SECTIONS.filter((s) => s.id !== 'overview') as Array<SectionDef & { id: QuickActionId }>).map((section) => ({
        id: section.id,
        label: section.label,
        hint: section.id === 'orders'
          ? `${counts.orders} au total`
          : section.id === 'reviews'
            ? `${counts.reviews} publié${counts.reviews > 1 ? 's' : ''}`
            : 'Infos et sécurité',
        Icon: section.Icon,
        color: COLORS.brand,
        tint: COLORS.brandSoft,
        badge: section.id === 'orders' ? counts.orders : section.id === 'reviews' ? counts.reviews : undefined,
      })),
    [counts.orders, counts.reviews],
  );

  const renderError = () => {
    if (!showError) return null;
    return (
      <View style={styles.errorCard}>
        <View style={styles.errorIcon}>
          <AlertTriangle size={18} color="#DC2626" />
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

  const renderQuickActions = () => (
    <View style={styles.quickGrid}>
      {quickActions.map((action) => {
        const Icon = action.Icon;
        return (
          <Pressable
            key={action.id}
            onPress={() => openSection(action.id)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [
              styles.quickCard,
              pressed && styles.pressed,
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
          >
            <View style={[styles.quickIcon, { backgroundColor: action.tint }]}>
              <Icon size={18} color={action.color} />
            </View>
            <View style={styles.quickText}>
              <Text style={styles.quickLabel} numberOfLines={1}>
                {action.label}
              </Text>
              <Text style={styles.quickHint} numberOfLines={1}>
                {action.hint}
              </Text>
            </View>
            {typeof action.badge === 'number' && action.badge > 0 ? (
              <View style={styles.quickBadge}>
                <Text style={styles.quickBadgeText}>
                  {action.badge > 99 ? '99+' : action.badge}
                </Text>
              </View>
            ) : (
              <ChevronRight size={15} color="#D1D5DB" />
            )}
          </Pressable>
        );
      })}
    </View>
  );

  const renderRecentOrders = () => {
    if (data.loading && sortedOrders.length === 0) {
      return <PanelSkeleton rows={1} />;
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
            <ChevronRight size={14} color={COLORS.brand} />
          </Pressable>
        </View>

        {recentOrders.length === 0 ? (
          <View style={styles.emptyListCard}>
            <View style={styles.emptyListIcon}>
              <Package size={24} color={COLORS.brand} />
            </View>
            <Text style={styles.emptyListText}>
              Vos commandes terminées ou annulées apparaîtront ici.
            </Text>
            <Pressable
              onPress={() => router.replace('/')}
              style={({ pressed }) => [styles.emptyListBtn, pressed && styles.pressed]}
            >
              <Text style={styles.emptyListBtnText}>Découvrir les boutiques</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.orderList}>
            {recentOrders.map((order) => {
              const firstItem = order.order_items?.[0];
              return (
                <Pressable
                  key={order.id}
                  onPress={() => openSection('orders')}
                  style={({ pressed }) => [
                    styles.orderRow,
                    pressed && styles.pressed,
                    pressed && { transform: [{ scale: 0.99 }] },
                  ]}
                >
                  <ProductThumb
                    src={firstItem?.products?.[0]?.image}
                    size={44}
                    iconSize={18}
                  />
                  <View style={styles.orderRowText}>
                    <Text style={styles.orderRowStore} numberOfLines={1}>
                      {orderStoreName(order)}
                    </Text>
                    <Text style={styles.orderRowMeta} numberOfLines={1}>
                      {orderReference(order)} · {formatShortDate(order.date)}
                    </Text>
                  </View>
                  <View style={styles.orderRowRight}>
                    <Text style={styles.orderRowTotal}>{formatCurrency(order.total)}</Text>
                    <StatusBadge
                      status={order.status}
                      businessType={orderBusinessType(order)}
                    />
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
      {renderQuickActions()}
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
        <View style={styles.guestGlow} />
        <View style={styles.guestIcon}>
          <User size={30} color={COLORS.brand} />
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
          <View key={title} style={styles.guestBenefitRow}>
            <View style={styles.guestBenefitIcon}>
              <Icon size={18} color={COLORS.brand} />
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

  const version = Constants.expoConfig?.version || '1.0.0';

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerBtn}
            hitSlop={8}
            accessibilityLabel="Retour"
          >
            <ArrowLeft size={22} color="#9CA3AF" />
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
                size={20}
                color={data.refreshing ? COLORS.brand : '#9CA3AF'}
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
          <View style={styles.identityRow}>
            <View style={styles.identityAvatar}>
              {user.avatarUrl ? (
                <Image
                  source={{ uri: user.avatarUrl }}
                  style={styles.identityAvatarImage}
                  contentFit="cover"
                  alt=""
                />
              ) : (
                <Text style={styles.identityAvatarInitial}>{avatarInitial(user.name)}</Text>
              )}
            </View>
            <View style={styles.identityText}>
              <Text style={styles.identityName} numberOfLines={1}>
                {user.name}
              </Text>
              <Text style={styles.identityEmail} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            <Pressable
              onPress={() => openSection('profile')}
              style={({ pressed }) => [styles.identityEdit, pressed && styles.pressed]}
              accessibilityLabel="Modifier mon profil"
            >
              <Pencil size={16} color={COLORS.brand} />
            </Pressable>
          </View>



          {renderError()}

          {activeSection === 'overview' ? (
            renderOverview()
          ) : (
            <View style={styles.sectionBody}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionHeadIcon}>
                  <activeSectionDef.Icon size={20} color={COLORS.brand} />
                </View>
                <View style={styles.sectionHeadText}>
                  <Text style={styles.sectionTitle}>{activeSectionDef.label}</Text>
                  <Text style={styles.sectionDesc}>{activeSectionDef.desc}</Text>
                </View>
                <Pressable
                  onPress={() => openSection('overview')}
                  style={({ pressed }) => [styles.overviewBtn, pressed && styles.pressed]}
                >
                  <LayoutDashboard size={13} color="#6B7280" />
                  <Text style={styles.overviewBtnText}>Aperçu</Text>
                </Pressable>
              </View>

              {data.loading ? <PanelSkeleton rows={3} /> : renderPanel()}
            </View>
          )}

          <View style={styles.footer}>
            <View style={styles.footerBrand}>
              <Text style={styles.footerName}>PosMarket</Text>
              <Text style={styles.footerVersion}>Espace client · v{version}</Text>
            </View>
            <Pressable
              onPress={() => setShowLogoutModal(true)}
              style={({ pressed }) => [styles.footerLogout, pressed && styles.pressed]}
            >
              <LogOut size={15} color="#F43F5E" />
              <Text style={styles.footerLogoutText}>Déconnexion</Text>
            </Pressable>
          </View>
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
        icon={<LogOut size={20} color={COLORS.brand} />}
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
    backgroundColor: '#F6F7F9',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  identityAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  identityAvatarImage: {
    width: '100%',
    height: '100%',
  },
  identityAvatarInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.brand,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  identityName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.3,
  },
  identityEmail: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  identityEdit: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F3',
  },
  headerRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  headerCenter: {
    alignItems: 'center',
    gap: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  guestWrap: {
    padding: 16,
    gap: 16,
  },
  guestHero: {
    borderRadius: 28,
    padding: 24,
    minHeight: 210,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  guestGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(245,107,42,0.22)',
    top: -90,
    right: -70,
  },
  guestIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  guestText: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: '500',
    marginTop: 6,
    maxWidth: 300,
  },
  guestBenefits: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 18,
    gap: 16,
  },
  guestBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guestBenefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBenefitText: {
    flex: 1,
    minWidth: 0,
  },
  guestBenefitTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.ink,
  },
  guestBenefitDesc: {
    fontSize: 11,
    lineHeight: 16,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 1,
  },
  guestActions: {
    gap: 10,
  },
  hero: {
    borderRadius: 28,
    padding: 20,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(245,107,42,0.24)',
    top: -120,
    right: -70,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 24,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  avatar: {
    flex: 1,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  heroIdentity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginBottom: 2,
  },
  memberBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FDBA74',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  heroEmail: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
    fontWeight: '500',
  },
  refreshingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  refreshingText: {
    fontSize: 9,
    color: '#FDBA74',
    fontWeight: '700',
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroStatValue: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  heroStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tabsWrap: {
    marginHorizontal: -16,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  tabActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  tabCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountActive: {
    backgroundColor: COLORS.brand,
  },
  tabCountText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#6B7280',
    fontVariant: ['tabular-nums'],
  },
  tabCountTextActive: {
    color: '#FFFFFF',
  },
  overview: {
    gap: 14,
  },
  activeOrderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  activeOrderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  activeOrderIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeOrderHeading: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.brand,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  activeOrderRef: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.ink,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 18,
  },
  progressStep: {
    width: 76,
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotDone: {
    backgroundColor: COLORS.brand,
  },
  progressDotText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  progressLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  progressLabelDone: {
    color: COLORS.ink,
  },
  progressLine: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#F3F4F6',
    marginTop: 10,
    marginHorizontal: -6,
  },
  progressLineDone: {
    backgroundColor: COLORS.brand,
  },
  cancelledRow: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
  },
  cancelledText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  activeOrderFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  metaLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  activeOrderTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  activeOrderMeta: {
    flex: 1,
    gap: 2,
  },
  activeOrderDate: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginRight: -8,
    borderRadius: 10,
  },
  linkBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.brand,
  },
  emptyOrderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 16,
  },
  emptyOrderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyOrderTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  emptyOrderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.ink,
  },
  emptyOrderText: {
    fontSize: 9,
    lineHeight: 14,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 1,
  },
  emptyOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: COLORS.brand,
  },
  emptyOrderBtnText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: -0.1,
  },
  quickHint: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  quickBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.brand,
    fontVariant: ['tabular-nums'],
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 16,
  },
  infoCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoHeading: {
    flex: 1,
    minWidth: 0,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.ink,
  },
  infoSubtitle: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 1,
  },
  addressBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 2,
  },
  addressName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  addressLine: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    lineHeight: 16,
  },
  addressPhone: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  addressEmpty: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
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
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.3,
  },
  emptyListCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyListIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyListText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 260,
  },
  emptyListBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: COLORS.brand,
    marginTop: 4,
  },
  emptyListBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  orderList: {
    gap: 8,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  orderRowText: {
    flex: 1,
    minWidth: 0,
  },
  orderRowStore: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.ink,
  },
  orderRowMeta: {
    fontSize: 8,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 2,
  },
  orderRowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  orderRowTotal: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
  },
  helpIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  helpTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.ink,
  },
  helpText: {
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 1,
  },
  sectionBody: {
    gap: 14,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 2,
  },
  sectionHeadIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeadText: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.4,
  },
  sectionDesc: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 1,
  },
  overviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  overviewBtnText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#6B7280',
  },
  errorCard: {
    flexDirection: 'row',
    gap: 11,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 18,
    padding: 14,
  },
  errorIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBody: {
    flex: 1,
    minWidth: 0,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B91C1C',
  },
  errorMessage: {
    fontSize: 10,
    lineHeight: 15,
    color: '#DC2626',
    fontWeight: '500',
    marginTop: 2,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#DC2626',
    borderRadius: 10,
  },
  retryText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dismissBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dismissText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E9EBEE',
  },
  footerBrand: {
    gap: 1,
  },
  footerName: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.ink,
  },
  footerVersion: {
    fontSize: 8,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  footerLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  footerLogoutText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F43F5E',
  },
  helpBody: {
    padding: 16,
    gap: 4,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  helpRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpRowText: {
    flex: 1,
    minWidth: 0,
  },
  helpRowTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.ink,
  },
  helpRowSubtitle: {
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 1,
  },
  helpSite: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  helpSiteText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.brand,
  },
  logoutBody: {
    padding: 20,
  },
  logoutQuestion: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4B5563',
    fontWeight: '500',
  },
  logoutActions: {
    gap: 10,
    marginTop: 20,
  },
  logoutConfirm: {
    paddingVertical: 14,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    alignItems: 'center',
  },
  logoutConfirmText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  logoutCancel: {
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  logoutCancelText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4B5563',
  },
  pressed: {
    opacity: 0.85,
  },
});
