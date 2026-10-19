/**
 * Espace acheteur — copie mobile de `src/views/BuyerView.tsx` du web :
 * en-tête (retour, titre, rafraîchir), carte identité + statistiques, tuiles
 * d'onglets (Commandes / Avis / Profil — Livraison et Alertes restent
 * accessibles par `?tab=`), panneau actif et modales (adresse, avis,
 * déconnexion, suppression d'adresse).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  LogOut,
  MapPin,
  Package,
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
import { PanelSkeleton } from '@/components/buyer/ui';
import ConfirmationModal from '@/components/ConfirmationModal';
import { Button } from '@/components/Button';
import type { BuyerAddress, BuyerTabId } from '@/types';
import { COLORS } from '@/theme';

interface TabDef {
  id: BuyerTabId;
  path: string;
  label: string;
  desc: string;
  Icon: LucideIcon;
}

const ALL_TABS: TabDef[] = [
  { id: 'orders', path: 'commandes', label: 'Commandes', desc: 'Historique et suivi de vos achats', Icon: Package },
  { id: 'addresses', path: 'adresses', label: 'Livraison', desc: 'Vos contacts de livraison', Icon: MapPin },
  { id: 'reviews', path: 'avis', label: 'Avis', desc: 'Vos avis publiés', Icon: Star },
  { id: 'notifications', path: 'notifications', label: 'Alertes', desc: 'WhatsApp et e-mail', Icon: BellRing },
  { id: 'profile', path: 'profil', label: 'Profil', desc: 'Vos informations et sécurité', Icon: User },
];

/**
 * « Alertes » et « Livraison » masqués dans la navigation : les panneaux
 * restent accessibles via `/account?tab=adresses` et `?tab=notifications`.
 */
const HIDDEN_TAB_IDS: BuyerTabId[] = ['notifications', 'addresses'];
const TABS = ALL_TABS.filter((t) => !HIDDEN_TAB_IDS.includes(t.id));

const TAB_FROM_PARAM: Record<string, BuyerTabId> = {
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

const avatarInitial = (name: string) => (name || 'U')[0].toUpperCase();

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { user, isReady, openAuth, logout } = useAuth();
  const data = useBuyerData();

  const [activeTab, setActiveTab] = useState<BuyerTabId>(
    () => TAB_FROM_PARAM[params.tab || 'commandes'] || 'orders',
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

  // Synchronise l'onglet si le paramètre d'URL change (comme le web).
  useEffect(() => {
    const target = TAB_FROM_PARAM[params.tab || 'commandes'];
    if (target && target !== activeTab) setActiveTab(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tab]);

  const showError = !!data.error && data.error !== dismissedError;

  const handleRetry = useCallback(() => {
    setDismissedError(null);
    void data.refreshAll();
  }, [data]);

  const handleTabChange = useCallback((tab: BuyerTabId) => {
    setActiveTab(tab);
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

  const activeTabDef = ALL_TABS.find((t) => t.id === activeTab) || ALL_TABS[0];

  const counts: Record<BuyerTabId, number> = useMemo(
    () => ({
      orders: data.totalOrders,
      addresses: data.addresses.length,
      reviews: data.reviews.length,
      notifications: 0,
      profile: 0,
    }),
    [data.addresses.length, data.reviews.length, data.totalOrders],
  );

  const renderPanel = () => {
    if (showError) {
      return (
        <View style={styles.errorCard}>
          <AlertTriangle size={18} color="#DC2626" style={styles.errorIcon} />
          <View style={styles.errorBody}>
            <Text style={styles.errorTitle}>Une erreur est survenue</Text>
            <Text style={styles.errorMessage}>{data.error}</Text>
            <View style={styles.errorActions}>
              <Pressable onPress={handleRetry} style={styles.retryBtn}>
                <Text style={styles.retryText}>Réessayer</Text>
              </Pressable>
              <Pressable
                onPress={() => setDismissedError(data.error ?? null)}
                style={styles.dismissBtn}
              >
                <Text style={styles.dismissText}>Fermer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      );
    }

    switch (activeTab) {
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
        return (
          <ProfileTab
            onLogout={() => setShowLogoutModal(true)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.screen}>
      {/* En-tête sticky */}
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
          <Text style={styles.headerTitle}>Mon compte</Text>
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
        </View>
      </View>

      {!isReady ? null : !user ? (
        <View style={styles.guestWrap}>
          <View style={styles.guestCard}>
            <Text style={styles.guestTitle}>Connexion requise</Text>
            <Text style={styles.guestText}>
              Connectez-vous pour retrouver vos commandes, vos adresses et vos avis.
            </Text>
            <Button size="md" fullWidth onPress={() => openAuth('login')} style={styles.guestBtn}>
              Se connecter
            </Button>
          </View>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 16) + 48 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={Boolean(data?.refreshing)}
              onRefresh={() => void data?.refreshAll()}
              tintColor={COLORS.brand}
              colors={[COLORS.brand]}
            />
          }
        >
          {/* ---- Carte identité ---- */}
          <View style={styles.identityCard}>
            <View style={styles.identityRow}>
              <LinearGradient
                colors={[COLORS.brand, '#FB923C']}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={styles.avatar}
              >
                {user.avatarUrl ? (
                  <Image
                    source={{ uri: user.avatarUrl }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    alt=""
                  />
                ) : (
                  <Text style={styles.avatarInitial}>{avatarInitial(user.name)}</Text>
                )}
              </LinearGradient>
              <View style={styles.identityText}>
                <Text style={styles.identityName} numberOfLines={1}>
                  {user.name}
                </Text>
                <Text style={styles.identityEmail} numberOfLines={1}>
                  {user.email}
                </Text>
                {data.refreshing ? (
                  <View style={styles.refreshingRow}>
                    <RefreshCcw size={12} color={COLORS.brand} />
                    <Text style={styles.refreshingText}>Synchronisation…</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.statsRow}>
              {[
                { value: counts.orders, label: 'Commandes' },
                { value: counts.reviews, label: 'Avis' },
                { value: counts.addresses, label: 'Adresses' },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 ? <View style={styles.statDivider} /> : null}
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{data.loading ? '–' : s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* ---- Tuiles d'onglets ---- */}
          <View style={styles.tiles}>
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab;
              const Icon = tab.Icon;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => handleTabChange(tab.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  style={[styles.tile, isActive ? styles.tileActive : styles.tileIdle]}
                >
                  <Icon size={20} color={isActive ? COLORS.brand : '#6B7280'} />
                  <Text style={[styles.tileLabel, isActive && styles.tileLabelActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ---- Titre de section ---- */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{activeTabDef.label}</Text>
            <Text style={styles.sectionDesc}>{activeTabDef.desc}</Text>
          </View>

          {/* ---- Panneau ---- */}
          {data.loading ? <PanelSkeleton rows={3} /> : renderPanel()}
        </ScrollView>
      )}

      {/* ---- Modales ---- */}
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
            Voulez-vous vraiment vous déconnecter ?
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
  },
  content: {
    padding: 16,
  },
  guestWrap: {
    padding: 16,
  },
  guestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 24,
    gap: 12,
  },
  guestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
  },
  guestText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  guestBtn: {
    marginTop: 8,
  },
  identityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  identityName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
  },
  identityEmail: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  refreshingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  refreshingText: {
    fontSize: 12,
    color: COLORS.brand,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.line,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  tiles: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  tileActive: {
    backgroundColor: COLORS.brandSoft,
    borderColor: 'rgba(245,107,42,0.2)',
  },
  tileIdle: {
    backgroundColor: '#FFFFFF',
    borderColor: COLORS.line,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  tileLabelActive: {
    color: COLORS.brand,
  },
  sectionHead: {
    marginTop: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.ink,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  errorCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 16,
  },
  errorIcon: {
    marginTop: 2,
  },
  errorBody: {
    flex: 1,
    minWidth: 0,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B91C1C',
  },
  errorMessage: {
    fontSize: 14,
    color: '#DC2626',
    marginTop: 2,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#DC2626',
    borderRadius: 12,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dismissBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dismissText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  logoutBody: {
    padding: 24,
  },
  logoutQuestion: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 21,
  },
  logoutActions: {
    gap: 12,
    marginTop: 24,
  },
  logoutConfirm: {
    paddingVertical: 16,
    backgroundColor: '#DC2626',
    borderRadius: 16,
    alignItems: 'center',
  },
  logoutConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  logoutCancel: {
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    alignItems: 'center',
  },
  logoutCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
});
