/**
 * Clients vendeur — copie fidèle de `src/views/CustomersView.tsx` du web
 * (rendu mobile < 768 px) : en-tête (compteur + bouton « Nouveau Client »),
 * segments Tous/VIP/Inactifs, barre de tri mobile, recherche (débounce 500 ms),
 * liste (case à cocher, avatar initiales, étoile VIP, badge Inactif, actions
 * Appeler/Modifier), pagination « Voir plus », modale client et confirmations.
 *
 * Écarts assumés :
 * - segment « Inactifs » jamais alimenté (`lastOrderDate` absent de la requête,
 *   comme au web : compteur 0 et filtre vide) ;
 * - les toasts passent par le système global (`useToast`).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  ChevronDown,
  Loader2,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';
import { WhatsAppIcon } from '@/components/seller/WhatsAppIcon';
import { useToast } from '@/components/ToastProvider';
import ConfirmationModal from '@/components/ConfirmationModal';
import { PhoneField } from '@/components/PhoneField';
import { SellerCheckbox } from '@/components/seller/ui';
import { COLORS } from '@/theme';
import { formatCurrency } from '@/utils';
import { parsePhoneNumber } from '@/constants/countries';
import {
  bulkDeleteSellerCustomers,
  deleteSellerCustomer,
  fetchSellerCustomers,
  saveSellerCustomer,
  type SellerCustomer,
} from '@/api/seller';

const PAGE_SIZE = 10;

interface SellerCustomersViewProps {
  storeId: string;
  canManageCustomers: boolean;
  isSeller: boolean;
  onUnauthorized: () => void;
}

interface CustomerForm {
  id?: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  totalSpent: number;
  ordersCount: number;
}

const emptyForm: CustomerForm = {
  name: '',
  phone: '',
  totalSpent: 0,
  ordersCount: 0,
};

export function SellerCustomersView({
  storeId,
  canManageCustomers,
  isSeller,
  onUnauthorized,
}: SellerCustomersViewProps) {
  const { notify } = useToast();
  const insets = useSafeAreaInsets();

  const [searchTerm, setSearchTerm] = useState('');
  const [localCustomers, setLocalCustomers] = useState<SellerCustomer[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(true);
  const [activeSegment, setActiveSegment] = useState<'all' | 'vip' | 'inactive'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: 'totalSpent' | 'ordersCount' | 'name';
    direction: 'asc' | 'desc';
  }>({ key: 'totalSpent', direction: 'desc' });

  // Menus déroulants (segments de clients / tri), ouverts un par un.
  const [segmentMenuOpen, setSegmentMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<SellerCustomer | null>(null);
  const [formData, setFormData] = useState<CustomerForm>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    id?: string;
    name?: string;
    isBulk?: boolean;
    count?: number;
    isLoading?: boolean;
  }>({ isOpen: false });

  const expiredRef = useRef(false);
  const handleUnauthorized = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    onUnauthorized();
  }, [onUnauthorized]);

  // Recherche : requête serveur après 500 ms (y compris au montage).
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetchSellerCustomers(storeId, 0, PAGE_SIZE, searchTerm);
        if (!active) return;
        if (res.success && res.customers) {
          setLocalCustomers(res.customers);
          setOffset(res.customers.length);
          setHasMore(Boolean(res.hasMore));
        } else if (res.error === 'Unauthorized') {
          handleUnauthorized();
        } else if (res.error && res.error !== 'Forbidden') {
          notify(res.error, 'error');
        }
      } catch {
        if (active) notify('Erreur lors de la recherche', 'error');
      } finally {
        if (active) setIsSearching(false);
      }
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchTerm, storeId, notify, handleUnauthorized]);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetchSellerCustomers(storeId, offset, PAGE_SIZE, searchTerm);
      if (res.success && res.customers) {
        setLocalCustomers((prev) => [...prev, ...res.customers!]);
        setOffset((prev) => prev + (res.customers?.length || 0));
        setHasMore(Boolean(res.hasMore));
      } else if (res.error === 'Unauthorized') {
        handleUnauthorized();
      }
    } catch {
      notify('Erreur lors du chargement', 'error');
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, offset, searchTerm, storeId, notify, handleUnauthorized]);

  /** Recharge la 1re page après une écriture (équivaut au `router.refresh()` web). */
  const reloadCustomers = useCallback(async () => {
    const res = await fetchSellerCustomers(storeId, 0, PAGE_SIZE, searchTerm).catch(() => null);
    if (res?.success && res.customers) {
      setLocalCustomers(res.customers);
      setOffset(res.customers.length);
      setHasMore(Boolean(res.hasMore));
    }
  }, [storeId, searchTerm]);

  /** Tirer vers le bas pour recharger (équivalent du rechargement de page). */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadCustomers();
    } finally {
      setRefreshing(false);
    }
  }, [reloadCustomers]);

  const getSegment = (customer: SellerCustomer) => {
    const isVIP = (Number(customer.totalSpent) || 0) >= 500000;
    const lastOrder = customer.lastOrderDate ? new Date(customer.lastOrderDate) : null;
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const isInactive = Boolean(lastOrder && lastOrder < oneMonthAgo);
    return { isVIP, isInactive };
  };

  const filteredCustomers = useMemo(() => {
    const result = [...localCustomers].filter((customer) => {
      if (activeSegment === 'all') return true;
      const { isVIP, isInactive } = getSegment(customer);
      if (activeSegment === 'vip') return isVIP;
      if (activeSegment === 'inactive') return isInactive;
      return true;
    });

    result.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue === undefined || bValue === undefined) return 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      const numA = Number(aValue) || 0;
      const numB = Number(bValue) || 0;
      return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
    });

    return result;
  }, [localCustomers, activeSegment, sortConfig]);

  const handleSort = (key: 'totalSpent' | 'ordersCount' | 'name') => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };


  const handleOpenModal = (customer?: SellerCustomer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        id: customer.id,
        name: customer.name,
        phone: customer.phone || '',
        email: customer.email,
        address: customer.address,
        totalSpent: Number(customer.totalSpent) || 0,
        ordersCount: Number(customer.ordersCount) || 0,
      });
    } else {
      setEditingCustomer(null);
      setFormData(emptyForm);
    }
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.isOpen) return;
    setDeleteConfirm((prev) => ({ ...prev, isLoading: true }));
    try {
      if (deleteConfirm.isBulk) {
        const res = await bulkDeleteSellerCustomers(selectedIds);
        if (!res.success) {
          if (res.error === 'Unauthorized') handleUnauthorized();
          else notify(res.error || 'Erreur lors de la suppression', 'error');
          return;
        }
        notify(`${selectedIds.length} clients supprimés`, 'info');
        setLocalCustomers((prev) => prev.filter((customer) => !selectedIds.includes(customer.id)));
        setSelectedIds([]);
      } else if (deleteConfirm.id) {
        const id = deleteConfirm.id;
        const res = await deleteSellerCustomer(id);
        if (!res.success) {
          if (res.error === 'Unauthorized') handleUnauthorized();
          else notify(res.error || 'Erreur lors de la suppression', 'error');
          return;
        }
        notify('Client supprimé', 'info');
        setLocalCustomers((prev) => prev.filter((customer) => customer.id !== id));
        setSelectedIds((prev) => prev.filter((customerId) => customerId !== id));
      }
    } catch {
      notify('Erreur lors de la suppression', 'error');
    } finally {
      setDeleteConfirm({ isOpen: false });
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!formData.name.trim()) {
      notify('Le nom du client est obligatoire', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await saveSellerCustomer(storeId, {
        id: formData.id,
        name: formData.name,
        phone: formData.phone,
        email: formData.email ?? undefined,
        address: formData.address ?? undefined,
        totalSpent: formData.totalSpent,
        ordersCount: formData.ordersCount,
      });
      if (!res.success) {
        if (res.error === 'Unauthorized') handleUnauthorized();
        else notify(res.error || "Erreur lors de l'enregistrement", 'error');
        return;
      }
      notify(editingCustomer ? 'Client mis à jour' : 'Client ajouté', 'success');
      setIsModalOpen(false);
      void reloadCustomers();
    } catch {
      notify("Erreur lors de l'enregistrement", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCustomers.length) setSelectedIds([]);
    else setSelectedIds(filteredCustomers.map((customer) => customer.id));
  };


  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((customerId) => customerId !== id) : [...prev, id],
    );
  };

  /** Lien WhatsApp du client (numéro international sans « + »). */
  const whatsappLink = (phone?: string | null): string | null => {
    const e164 = parsePhoneNumber(phone || '').e164.replace(/\D/g, '');
    if (!e164) return null;
    return `https://wa.me/${e164}`;
  };

  /** Ouvre l'application d'appel du système. */
  const callCustomer = (phone?: string | null) => {
    const e164 = parsePhoneNumber(phone || '').e164.replace(/\D/g, '');
    if (!e164) {
      notify('Numéro de téléphone manquant', 'error');
      return;
    }
    // Le « + » est obligatoire sinon le composeur lance un appel local invalide.
    void Linking.openURL(`tel:+${e164}`).catch(() => {
      notify("Impossible d'ouvrir le téléphone", 'error');
    });
  };

  /** Ouvre WhatsApp avec un message pré-rempli pour le client. */
  const openWhatsApp = (phone?: string | null, name?: string) => {
    const link = whatsappLink(phone);
    if (!link) {
      notify('Numéro de téléphone manquant', 'error');
      return;
    }
    const message = encodeURIComponent(
      `Bonjour ${(name || '').split(' ')[0]} ! Merci pour votre visite. Comment pouvons-nous vous aider ?`,
    );
    void Linking.openURL(`${link}?text=${message}`).catch(() => {
      notify("Impossible d'ouvrir WhatsApp", 'error');
    });
  };

return (
    <View style={styles.root}>
      {/* ── Action principale (fixe en haut) ── */}
      {canManageCustomers ? (
        <Pressable onPress={() => handleOpenModal()} style={styles.newCustomerBtn}>
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.newCustomerText}>Nouveau Client</Text>
        </Pressable>
      ) : null}

      {/* ── Barre de recherche + menus déroulants ── */}
      <View style={[styles.stickyWrap, { zIndex: segmentMenuOpen || sortMenuOpen ? 40 : 0 }]}>
        <View>
          {/* Recherche */}
          <View style={styles.searchWrap}>
            <Search size={16} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Rechercher un client..."
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {isSearching || isLoadingMore ? (
              <Loader2 size={16} color={COLORS.brand} style={styles.searchAccessory} />
            ) : searchTerm.length > 0 ? (
              <Pressable
                onPress={() => setSearchTerm('')}
                style={styles.searchClear}
                accessibilityLabel="Effacer la recherche"
              >
                <X size={14} color="#6B7280" />
              </Pressable>
            ) : null}
          </View>

          {/* Segments + tri : deux menus déroulants côte à côte */}
          <View style={styles.menuRow}>
            <View style={styles.menuSlot}>
              <Pressable
                onPress={() => {
                  setSortMenuOpen(false);
                  setSegmentMenuOpen((open) => !open);
                }}
                style={[styles.menuBtn, segmentMenuOpen ? styles.menuBtnOpen : null]}
                accessibilityRole="button"
                accessibilityState={{ expanded: segmentMenuOpen }}
                accessibilityLabel="Filtrer les clients"
              >
                <Text style={styles.menuBtnText} numberOfLines={1}>
                  Clients · {activeSegment === 'all' ? 'Tous' : activeSegment === 'vip' ? 'VIP' : 'Inactifs'}
                </Text>
                <ChevronDown size={14} color={segmentMenuOpen ? COLORS.brand : '#6B7280'} />
              </Pressable>

              {segmentMenuOpen ? (
                <View style={styles.menuPanel}>
                  {(
                    [
                      { id: 'all' as const, label: 'Tous', count: localCustomers.length },
                      {
                        id: 'vip' as const,
                        label: 'VIP',
                        count: localCustomers.filter((customer) => getSegment(customer).isVIP)
                          .length,
                      },
                      {
                        id: 'inactive' as const,
                        label: 'Inactifs',
                        count: localCustomers.filter((customer) => getSegment(customer).isInactive)
                          .length,
                      },
                    ] as const
                  ).map((segment) => {
                    const active = activeSegment === segment.id;
                    return (
                      <Pressable
                        key={segment.id}
                        onPress={() => {
                          setActiveSegment(segment.id);
                          setSelectedIds([]);
                          setSegmentMenuOpen(false);
                        }}
                        style={styles.menuOption}
                        accessibilityRole="menuitem"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.menuOptionText, active ? styles.menuOptionActive : null]}>
                          {segment.label}
                        </Text>
                        <Text style={styles.menuOptionCount}>{segment.count}</Text>
                        {active ? <Check size={14} color={COLORS.brand} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>

            <View style={styles.menuSlot}>
              <Pressable
                onPress={() => {
                  setSegmentMenuOpen(false);
                  setSortMenuOpen((open) => !open);
                }}
                style={[styles.menuBtn, sortMenuOpen ? styles.menuBtnOpen : null]}
                accessibilityRole="button"
                accessibilityState={{ expanded: sortMenuOpen }}
                accessibilityLabel="Trier les clients"
              >
                <Text style={styles.menuBtnText} numberOfLines={1}>
                  Tri ·{' '}
                  {sortConfig.key === 'totalSpent'
                    ? 'Dépensé'
                    : sortConfig.key === 'ordersCount'
                      ? 'Commandes'
                      : 'Nom'}
                </Text>
                <ChevronDown size={14} color={sortMenuOpen ? COLORS.brand : '#6B7280'} />
              </Pressable>

              {sortMenuOpen ? (
                <View style={styles.menuPanel}>
                  {(
                    [
                      { id: 'totalSpent' as const, label: 'Dépensé' },
                      { id: 'ordersCount' as const, label: 'Commandes' },
                      { id: 'name' as const, label: 'Nom' },
                    ] as const
                  ).map((option) => {
                    const active = sortConfig.key === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => {
                          handleSort(option.id);
                          setSortMenuOpen(false);
                        }}
                        style={styles.menuOption}
                        accessibilityRole="menuitem"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.menuOptionText, active ? styles.menuOptionActive : null]}>
                          {option.label}
                        </Text>
                        {active ? (
                          <Text style={styles.menuOptionDirection}>
                            {sortConfig.direction === 'asc' ? 'croissant' : 'décroissant'}
                          </Text>
                        ) : null}
                        {active ? <Check size={14} color={COLORS.brand} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {(segmentMenuOpen || sortMenuOpen) ? (
        <Pressable
          style={styles.menuCloser}
          onPress={() => {
            setSegmentMenuOpen(false);
            setSortMenuOpen(false);
          }}
          accessibilityLabel="Fermer les menus"
        />
      ) : null}

      {/* ── Carte liste ── */}
      <View style={styles.card}>
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.brand}
              colors={[COLORS.brand]}
            />
          }
        >
          {filteredCustomers.length > 0 ? (
            <>
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>
                  {filteredCustomers.length} client{filteredCustomers.length > 1 ? 's' : ''}
                  {hasMore ? ' chargés' : ''}
                </Text>
              </View>

              {/* En-tête de tableau : Nom | Dépensé | N Cmd | Action */}
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeadNom}>Nom</Text>
                <Text style={styles.tableHeadSpent}>Dépensé</Text>
                <Text style={styles.tableHeadCmd}>N Cmd</Text>
                <Text style={styles.tableHeadAction}>Action</Text>
              </View>

              {filteredCustomers.map((customer, index) => {
                return (
                  <Pressable
                    key={customer.id}
                    onPress={() => handleOpenModal(customer)}
                    style={({ pressed }) => [
                      styles.customerRow,
                      index < filteredCustomers.length - 1 ? styles.customerRowBorder : null,
                      pressed ? styles.customerRowPressed : null,
                    ]}
                  >
                    <Text style={styles.customerName} numberOfLines={1}>
                      {customer.name}
                    </Text>

                    <Text
                      style={styles.customerTotal}
                      numberOfLines={1}
                      accessibilityLabel={`${customer.name} a dépensé ${formatCurrency(
                        Number(customer.totalSpent) || 0,
                      )}`}
                    >
                      {formatCurrency(Number(customer.totalSpent) || 0)}
                    </Text>

                    <Text
                      style={styles.customerOrders}
                      accessibilityLabel={`${customer.ordersCount || 0} commandes`}
                    >
                      {customer.ordersCount || 0}
                    </Text>

                    <View style={styles.customerActions}>
                      {whatsappLink(customer.phone) ? (
                        <Pressable
                          onPress={() => openWhatsApp(customer.phone, customer.name)}
                          style={styles.whatsappBtn}
                          hitSlop={4}
                          accessibilityLabel={`Envoyer un message WhatsApp à ${customer.name}`}
                        >
                          <WhatsAppIcon size={15} />
                        </Pressable>
                      ) : null}
                      {customer.phone ? (
                        <Pressable
                          onPress={() => callCustomer(customer.phone)}
                          style={styles.callBtn}
                          hitSlop={4}
                          accessibilityLabel={`Appeler ${customer.name}`}
                        >
                          <Phone size={13} color="#111827" />
                        </Pressable>
                      ) : null}
                      {!customer.phone ? (
                        <Text style={styles.actionDash}>—</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </>
          ) : isSearching ? (
            Array.from({ length: 6 }).map((_, i) => (
              <View key={`skel-${i}`} style={styles.skeletonRow}>
                <View style={styles.skeletonBox} />
                <View style={styles.skeletonAvatar} />
                <View style={styles.skeletonBody}>
                  <View style={styles.skeletonLineWide} />
                  <View style={styles.skeletonLineShort} />
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIcon}>
                {searchTerm ? (
                  <Search size={24} color="#9CA3AF" />
                ) : (
                  <Users size={26} color="#9CA3AF" />
                )}
              </View>
              <Text style={styles.emptyStateTitle}>
                {searchTerm ? 'Aucun client trouvé' : 'Aucun client'}
              </Text>
              <Text style={styles.emptyStateHint}>
                {searchTerm
                  ? `Aucun client ne correspond à « ${searchTerm} ».`
                  : 'Vos clients enregistrés apparaîtront ici.'}
              </Text>
              {searchTerm ? (
                <Pressable onPress={() => setSearchTerm('')} style={styles.emptyCta}>
                  <Text style={styles.emptyCtaText}>Effacer la recherche</Text>
                </Pressable>
              ) : null}
            </View>
          )}

          {filteredCustomers.length > 0 && hasMore ? (
            <View style={styles.loadMoreWrap}>
              <Pressable
                onPress={handleLoadMore}
                disabled={isLoadingMore}
                style={[styles.loadMoreBtn, isLoadingMore ? styles.disabled : null]}
              >
                {isLoadingMore ? (
                  <Loader2 size={14} color={COLORS.brand} />
                ) : (
                  <Plus size={14} color={COLORS.brand} />
                )}
                <Text style={styles.loadMoreText}>
                  {isLoadingMore ? 'Chargement...' : 'Voir plus de clients'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {filteredCustomers.length > 0 && !hasMore && localCustomers.length > 5 ? (
            <View style={styles.endOfList}>
              <Text style={styles.endOfListText}>Fin de liste</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
      {/* Modale client */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCustomer ? 'Modifier Client' : 'Nouveau Client'}
              </Text>
              <Pressable
                onPress={() => setIsModalOpen(false)}
                hitSlop={8}
                style={styles.modalClose}
                accessibilityLabel="Fermer"
              >
                <X size={18} color="#9CA3AF" />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <View>
                <Text style={styles.fieldLabel}>Nom Complet</Text>
                <TextInput
                  value={formData.name}
                  onChangeText={(value) => setFormData({ ...formData, name: value })}
                  placeholderTextColor="#C4C9D1"
                  style={styles.textField}
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Téléphone</Text>
                <PhoneField
                  value={formData.phone}
                  onChange={(value) => setFormData({ ...formData, phone: value })}
                />
              </View>

              <View style={styles.modalActions}>
                {editingCustomer && canManageCustomers && !isSeller ? (
                  <Pressable
                    onPress={() =>
                      setDeleteConfirm({
                        isOpen: true,
                        id: editingCustomer.id,
                        name: editingCustomer.name,
                      })
                    }
                    disabled={isSubmitting}
                    style={[styles.deleteBtn, isSubmitting ? styles.disabled : null]}
                    accessibilityLabel="Supprimer ce client"
                  >
                    <Trash2 size={14} color="#DC2626" />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  style={[styles.cancelBtn, isSubmitting ? styles.disabled : null]}
                >
                  <Text style={styles.cancelText}>Annuler</Text>
                </Pressable>
                <Pressable
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  style={[styles.saveBtn, isSubmitting ? styles.disabled : null]}
                >
                  {isSubmitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                  <Text style={styles.saveText}>
                    {isSubmitting
                      ? 'Enregistrement...'
                      : editingCustomer
                        ? 'Actualiser'
                        : 'Enregistrer'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmationModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false })}
        onConfirm={confirmDelete}
        isLoading={deleteConfirm.isLoading}
        title={deleteConfirm.isBulk ? 'Supprimer les clients' : 'Supprimer ce client'}
        message={
          deleteConfirm.isBulk
            ? `Êtes-vous sûr de vouloir supprimer définitivement ${
                deleteConfirm.count || selectedIds.length
              } client${(deleteConfirm.count || selectedIds.length) > 1 ? 's' : ''} ? Cette action est irréversible.`
            : `Êtes-vous sûr de vouloir supprimer ${deleteConfirm.name || 'ce client'} ? Toutes les informations associées seront effacées.`
        }
        confirmText={
          deleteConfirm.isBulk
            ? `Supprimer (${deleteConfirm.count || selectedIds.length})`
            : 'Supprimer'
        }
        cancelText="Annuler"
        type="danger"
      />
      {/* Marge basse sûre sous la liste (barre de navigation de la coquille). */}
      <View style={{ height: insets.bottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FDFDFE',
    paddingHorizontal: 12,
    paddingTop: 12,
  },

  /* Action principale */
  newCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    backgroundColor: COLORS.brand,
    borderRadius: 14,
    shadowColor: COLORS.brand,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  newCustomerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Barre de recherche + segments + tri */
  stickyWrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 0,
  },
  searchAccessory: { marginLeft: 8 },
  searchClear: {
    marginLeft: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Menus déroulants (segments / tri) côte à côte */
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  menuSlot: {
    flex: 1,
    minWidth: 0,
  },
  menuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  menuBtnOpen: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  menuBtnText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  menuPanel: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
    zIndex: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  menuCloser: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 35,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 12,
  },
  menuOptionText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  menuOptionActive: {
    color: COLORS.brand,
    fontWeight: '700',
  },
  menuOptionCount: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  menuOptionDirection: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
  },

  /* Carte liste */
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  listHeaderText: { fontSize: 10, fontWeight: '600', color: '#6B7280' },

  /* En-tête de tableau : Nom | Dépensé | N Cmd | Action */
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#FCFCFD',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableHeadNom: {
    flex: 1,
    minWidth: 0,
    fontSize: 8,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tableHeadSpent: {
    width: 92,
    flexShrink: 0,
    fontSize: 8,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'right',
  },
  tableHeadCmd: {
    width: 34,
    flexShrink: 0,
    fontSize: 8,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'right',
  },
  tableHeadAction: {
    width: 68,
    flexShrink: 0,
    fontSize: 8,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },

  /* Lignes clients */
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
  },
  customerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  customerRowPressed: {
    backgroundColor: '#F9FAFB',
  },
  customerName: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  customerTotal: {
    width: 92,
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.brand,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  customerOrders: {
    width: 34,
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  customerActions: {
    width: 68,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
  },
  actionDash: {
    flex: 1,
    fontSize: 10,
    color: '#E5E7EB',
    textAlign: 'center',
  },
  callBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Squelettes */
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  skeletonBox: { width: 20, height: 20, borderRadius: 5, backgroundColor: '#F3F4F6' },
  skeletonAvatar: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3F4F6' },
  skeletonBody: { flex: 1, gap: 6 },
  skeletonLineWide: { width: '50%', height: 10, borderRadius: 5, backgroundColor: '#F3F4F6' },
  skeletonLineShort: { width: '30%', height: 8, borderRadius: 4, backgroundColor: '#F9FAFB' },

  /* États vides */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyStateIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyStateTitle: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  emptyStateHint: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
  },
  emptyCta: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  emptyCtaText: { fontSize: 11, fontWeight: '700', color: COLORS.brand },

  /* Pagination */
  loadMoreWrap: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  loadMoreText: { fontSize: 11, fontWeight: '700', color: '#4B5563' },
  endOfList: {
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  endOfListText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  /* Modale client */
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 448,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  modalClose: {
    padding: 6,
  },
  modalBody: {
    padding: 12,
    gap: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  textField: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    fontSize: 12,
    color: '#111827',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteBtn: {
    width: 40,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },
  cancelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    shadowColor: '#FFEDD5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  saveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.5,
  },
});
