/**
 * Barre supérieure de l'espace vendeur — copie fidèle de
 * `src/components/Navbar.tsx` du web (rendu mobile) : sélecteur de boutique,
 * badge d'abonnement, bouton vitrine, avatar et menus déroulants.
 */

import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import {
  ChevronDown,
  Clock,
  Globe,
  LogOut,
  Maximize2,
  Monitor,
  Plus,
  Store,
  Trash2,
  User as UserIcon,
} from 'lucide-react-native';
import { COLORS } from '@/theme';
import type { SellerPlan, SellerRole, SellerStore, SellerSubscription } from '@/api/seller';

function getDaysRemaining(end: string): number {
  const endDate = new Date(end);
  const now = new Date();
  const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

interface SellerNavbarProps {
  stores: SellerStore[];
  currentStore: SellerStore | null;
  currentPlan: SellerPlan | null;
  userSubscription: SellerSubscription | null;
  userEmail: string;
  userAvatarUrl?: string | null;
  userRole?: SellerRole;
  isOnline?: boolean;
  isSwitching?: boolean;
  onStoreChange: (id: string) => void;
  onDeleteStore?: (id: string) => void;
  onCreateStore: () => void;
  onViewChange: (view: 'dashboard' | 'settings' | 'subscription') => void;
  onOpenStorefront: () => void;
  onLogout: () => void;
}

export function SellerNavbar({
  stores,
  currentStore,
  currentPlan,
  userSubscription,
  userEmail,
  userAvatarUrl,
  userRole,
  isOnline = true,
  onStoreChange,
  onDeleteStore,
  onCreateStore,
  onViewChange,
  onOpenStorefront,
  onLogout,
}: SellerNavbarProps) {
  const isSeller = userRole === 'SELLER';
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const avatarUrl =
    userAvatarUrl ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userEmail || 'user')}`;

  const handleStorePick = useCallback(
    (id: string) => {
      setShowStoreDropdown(false);
      onStoreChange(id);
    },
    [onStoreChange],
  );

  // Badge d'abonnement (masqué pour les vendeurs, comme le web).
  const subscriptionBadge = (() => {
    if (isSeller || !userSubscription) return null;
    const daysLeft = getDaysRemaining(userSubscription.endDate);
    const isExpired = new Date(userSubscription.endDate) < new Date();
    const isUrgent = daysLeft <= 7 && !isExpired;
    const hasNoPlan =
      userSubscription.status === 'NONE' ||
      !userSubscription.tier ||
      userSubscription.tier === 'NONE' ||
      userSubscription.tier === 'UNKNOWN';

    const palette = hasNoPlan
      ? { bg: '#FFF7ED', border: '#FFEDD5', text: '#EA580C' }
      : isExpired
        ? { bg: '#FEF2F2', border: '#FEE2E2', text: '#DC2626' }
        : isUrgent
          ? { bg: '#FFFBEB', border: '#FEF3C7', text: '#D97706' }
          : { bg: '#F0FDF4', border: '#DCFCE7', text: '#15803D' };

    return (
      <Pressable
        onPress={() => onViewChange('subscription')}
        accessibilityLabel="Gérer l'abonnement"
        style={[
          styles.subBadge,
          { backgroundColor: palette.bg, borderColor: palette.border },
        ]}
      >
        <Clock size={16} color={palette.text} />
        <Text style={[styles.subBadgeText, { color: palette.text }]}>
          {hasNoPlan ? "S'abonner" : isExpired ? 'Expiré' : `-${daysLeft}J`}
        </Text>
      </Pressable>
    );
  })();

  const noPlan =
    !userSubscription ||
    userSubscription.status === 'NONE' ||
    userSubscription.tier === 'NONE';

  return (
    <>
      <View style={styles.nav}>
        {/* Sélecteur de boutique */}
        {stores.length > 0 && currentStore ? (
          isSeller && stores.length === 1 ? (
            <View style={styles.storeStatic}>
              <Store size={18} color={COLORS.brand} />
              <Text style={styles.storeStaticText} numberOfLines={1}>
                {currentStore.settings?.name || 'Boutique'}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowStoreDropdown(true)}
              style={styles.storeButton}
              accessibilityLabel="Changer de boutique"
            >
              <View style={styles.storeIconBox}>
                <Store size={18} color={COLORS.brand} />
              </View>
              <Text style={styles.storeName} numberOfLines={1}>
                {currentStore.settings?.name || 'Ma Boutique'}
              </Text>
              <ChevronDown
                size={14}
                color="#9CA3AF"
                style={showStoreDropdown ? styles.chevronOpen : undefined}
              />
            </Pressable>
          )
        ) : (
          <View />
        )}

        <View style={styles.rightGroup}>
          {subscriptionBadge}

          <Pressable
            onPress={onOpenStorefront}
            accessibilityLabel="Voir la boutique"
            style={styles.globeBtn}
          >
            <Globe size={16} color="#9CA3AF" />
          </Pressable>

          <Pressable
            onPress={() => setShowProfileDropdown(true)}
            accessibilityLabel="Profil"
            style={styles.avatarBtn}
          >
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatarImg}
              contentFit="cover"
              transition={120}
            />
          </Pressable>
        </View>
      </View>

      {/* Menu boutiques */}
      <Modal
        visible={showStoreDropdown}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowStoreDropdown(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setShowStoreDropdown(false)}
          accessibilityLabel="Fermer le menu"
        >
          <Pressable style={styles.dropdown} onPress={() => {}}>
            <View style={styles.storeDropdownHeader}>
              <Text style={styles.dropdownLabel}>
                Boutiques ({stores.length}/{currentPlan?.features?.maxStores || 3})
              </Text>
              <View style={styles.storeIconCircle}>
                <Store size={14} color={COLORS.brand} />
              </View>
            </View>

            <ScrollView style={styles.storeList} showsVerticalScrollIndicator={false}>
              {stores.map((store) => {
                const active = currentStore?.id === store.id;
                return (
                  <View key={store.id} style={styles.storeRow}>
                    <Pressable
                      onPress={() => handleStorePick(store.id)}
                      style={[styles.storeRowBtn, active && styles.storeRowBtnActive]}
                    >
                      <View style={styles.storeRowLeft}>
                        <View
                          style={[
                            styles.storeRowIcon,
                            active ? styles.storeRowIconActive : styles.storeRowIconIdle,
                          ]}
                        >
                          <Store size={14} color={active ? COLORS.brand : '#4B5563'} />
                        </View>
                        <Text
                          style={[styles.storeRowName, active && styles.storeRowNameActive]}
                          numberOfLines={1}
                        >
                          {store.settings?.name || 'Boutique'}
                        </Text>
                      </View>
                      {active ? <View style={styles.storeActiveDot} /> : null}
                    </Pressable>

                    {stores.length > 1 && !isSeller && onDeleteStore ? (
                      <Pressable
                        onPress={() => {
                          setShowStoreDropdown(false);
                          onDeleteStore(store.id);
                        }}
                        style={styles.storeDeleteBtn}
                        accessibilityLabel="Supprimer la boutique"
                      >
                        <Trash2 size={16} color="#D1D5DB" />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>

            {stores.length < (currentPlan?.features?.maxStores || 0) && !isSeller ? (
              <View style={styles.newStoreWrap}>
                <Pressable
                  onPress={() => {
                    setShowStoreDropdown(false);
                    onCreateStore();
                  }}
                  style={styles.newStoreBtn}
                >
                  <Plus size={18} color="#FFFFFF" />
                  <Text style={styles.newStoreText}>Nouveau Magasin</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Menu profil */}
      <Modal
        visible={showProfileDropdown}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowProfileDropdown(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setShowProfileDropdown(false)}
          accessibilityLabel="Fermer le menu"
        >
          <Pressable style={styles.dropdown} onPress={() => {}}>
            <View style={styles.profileHeader}>
              <View style={styles.profileTop}>
                <View style={styles.profileAvatarBox}>
                  <Image
                    source={{ uri: avatarUrl }}
                    style={styles.profileAvatarImg}
                    contentFit="cover"
                  />
                </View>
                <View style={styles.profileIdentity}>
                  <Text style={styles.profileEmail} numberOfLines={1}>
                    {userEmail ? userEmail.split('@')[0] : ''}
                  </Text>
                  <View style={styles.profileStatusRow}>
                    <View
                      style={[
                        styles.profileStatusDot,
                        { backgroundColor: isOnline ? '#22C55E' : '#EF4444' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.profileStatusText,
                        { color: isOnline ? '#16A34A' : '#EF4444' },
                      ]}
                    >
                      {isOnline ? 'En ligne' : 'Hors-ligne'}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.profilePlanLabel}>
                {noPlan ? "Pas d'abonnement" : 'Abonnement Actif'}
              </Text>
              <View style={styles.profilePlanRow}>
                <Maximize2 size={12} color={COLORS.brand} />
                <Text style={styles.profilePlanValue}>
                  {noPlan ? 'Souscrire' : currentPlan?.name}
                </Text>
              </View>
            </View>

            <View style={styles.profileMenu}>
              <Pressable
                onPress={() => {
                  setShowProfileDropdown(false);
                  onViewChange('dashboard');
                }}
                style={styles.profileMenuItem}
              >
                <Monitor size={18} color="#9CA3AF" />
                <Text style={styles.profileMenuText}>Tableau de bord</Text>
              </Pressable>

              {!isSeller ? (
                <Pressable
                  onPress={() => {
                    setShowProfileDropdown(false);
                    onViewChange('settings');
                  }}
                  style={styles.profileMenuItem}
                >
                  <UserIcon size={18} color="#9CA3AF" />
                  <Text style={styles.profileMenuText}>Modifier le Profil</Text>
                </Pressable>
              ) : null}

              <View style={styles.profileDivider} />

              <Pressable
                onPress={() => {
                  setShowProfileDropdown(false);
                  onLogout();
                }}
                style={styles.profileLogout}
              >
                <LogOut size={18} color="#EF4444" />
                <Text style={styles.profileLogoutText}>Déconnexion</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  nav: {
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    zIndex: 100,
  },

  // Boutique (statique pour un vendeur à boutique unique)
  storeStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  storeStaticText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    maxWidth: 120,
  },

  // Boutique (sélecteur)
  storeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 22,
  },
  storeIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    maxWidth: 120,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },

  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  subBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  subBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  globeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },

  // Menus déroulants
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  dropdown: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
  },
  storeDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  dropdownLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  storeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeList: {
    maxHeight: 320,
    paddingHorizontal: 16,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  storeRowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
  },
  storeRowBtnActive: {
    backgroundColor: '#FFF7ED',
  },
  storeRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  storeRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeRowIconActive: {
    backgroundColor: '#FFFFFF',
  },
  storeRowIconIdle: {
    backgroundColor: '#F3F4F6',
  },
  storeRowName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    flexShrink: 1,
  },
  storeRowNameActive: {
    color: COLORS.brand,
  },
  storeActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.brand,
  },
  storeDeleteBtn: {
    padding: 12,
    borderRadius: 12,
  },
  newStoreWrap: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  newStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: COLORS.brand,
  },
  newStoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Profil
  profileHeader: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
    backgroundColor: 'rgba(249,250,251,0.3)',
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  profileAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileAvatarImg: {
    width: '100%',
    height: '100%',
  },
  profileIdentity: {
    flexShrink: 1,
  },
  profileEmail: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    maxWidth: 160,
  },
  profileStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  profileStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  profileStatusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  profilePlanLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    opacity: 0.6,
    marginBottom: 4,
  },
  profilePlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profilePlanValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.brand,
  },
  profileMenu: {
    padding: 8,
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
  },
  profileMenuText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  profileDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
    marginHorizontal: 8,
  },
  profileLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
  },
  profileLogoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
});
