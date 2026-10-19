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
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Edit,
  Loader2,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';
import { useToast } from '@/components/ToastProvider';
import ConfirmationModal from '@/components/ConfirmationModal';
import { PhoneField } from '@/components/PhoneField';
import { SellerCheckbox } from '@/components/seller/ui';
import { COLORS } from '@/theme';
import { formatCurrency } from '@/utils';
import { formatPhoneNumber } from '@/constants/countries';
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

  const gameSortArrow = (key: 'totalSpent' | 'ordersCount' | 'name') =>
    sortConfig.key === key ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '';

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

  const allSelected =
    filteredCustomers.length > 0 && selectedIds.length === filteredCustomers.length;

  const renderSortButton = (
    key: 'totalSpent' | 'ordersCount' | 'name',
    label: string,
  ) => {
    const active = sortConfig.key === key;
    return (
      <Pressable
        onPress={() => handleSort(key)}
        style={[styles.sortBtn, active ? styles.sortBtnActive : null]}
      >
        <Text style={[styles.sortBtnText, active ? styles.sortBtnTextActive : null]}>
          {label} {gameSortArrow(key)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.title}>Clients</Text>
            <Text style={styles.subtitle}>{localCustomers.length} clients enregistrés.</Text>
          </View>
          {selectedIds.length > 0 && canManageCustomers && !isSeller ? (
            <Pressable
              onPress={() =>
                setDeleteConfirm({ isOpen: true, count: selectedIds.length, isBulk: true })
              }
              style={styles.bulkDeleteBtn}
            >
              <Trash2 size={14} color="#DC2626" />
              <Text style={styles.bulkDeleteText}>Supprimer ({selectedIds.length})</Text>
            </Pressable>
          ) : null}
        </View>
        {canManageCustomers ? (
          <Pressable onPress={() => handleOpenModal()} style={styles.newCustomerBtn}>
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.newCustomerText}>Nouveau Client</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Segments */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.segmentsScroll}
        contentContainerStyle={styles.segments}
      >
        {(
          [
            { id: 'all' as const, label: 'Tous', count: localCustomers.length },
            {
              id: 'vip' as const,
              label: 'VIP',
              count: localCustomers.filter((customer) => getSegment(customer).isVIP).length,
            },
            {
              id: 'inactive' as const,
              label: 'Inactifs',
              count: localCustomers.filter((customer) => getSegment(customer).isInactive).length,
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
              }}
              style={[styles.segment, active ? styles.segmentActive : styles.segmentIdle]}
            >
              <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>
                {segment.label} ({segment.count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Tri mobile */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sortRowScroll}
        contentContainerStyle={styles.sortRow}
      >
        <Text style={styles.sortLabel}>Trier par:</Text>
        {renderSortButton('totalSpent', 'Dépensé')}
        {renderSortButton('ordersCount', 'Commandes')}
        {renderSortButton('name', 'Nom')}
      </ScrollView>

      {/* Carte liste */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.searchWrap}>
            <View pointerEvents="none" style={styles.searchIcon}>
              <Search size={16} color="#9CA3AF" />
            </View>
            {isSearching ? (
              <View pointerEvents="none" style={styles.searchSpinner}>
                <Loader2 size={16} color={COLORS.brand} />
              </View>
            ) : null}
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Rechercher..."
              placeholderTextColor="#C4C9D1"
              autoCapitalize="none"
              style={styles.searchInput}
            />
          </View>
          <View style={styles.selectAllWrap}>
            <SellerCheckbox checked={allSelected} onToggle={toggleSelectAll} size={16} />
            <Text style={styles.selectAllText}>Tout</Text>
          </View>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filteredCustomers.map((customer, index) => {
            const { isVIP, isInactive } = getSegment(customer);
            const initials = customer.name
              .split(' ')
              .map((part) => part[0])
              .join('');
            return (
              <View
                key={customer.id}
                style={[
                  styles.customerRow,
                  index < filteredCustomers.length - 1 ? styles.customerRowBorder : null,
                  selectedIds.includes(customer.id) ? styles.customerRowSelected : null,
                ]}
              >
                <View style={styles.customerRowTop}>
                  <View style={styles.customerRowLeft}>
                    <SellerCheckbox
                      checked={selectedIds.includes(customer.id)}
                      onToggle={() => toggleSelect(customer.id)}
                    />
                    <View style={styles.customerAvatar}>
                      <Text style={styles.customerAvatarText}>{initials}</Text>
                    </View>
                    <View style={styles.customerBody}>
                      <View style={styles.customerNameRow}>
                        <Text style={styles.customerName} numberOfLines={1}>
                          {customer.name}
                        </Text>
                        {isVIP ? <Star size={10} color="#EAB308" fill="#EAB308" /> : null}
                        {isInactive ? (
                          <View style={styles.inactiveBadge}>
                            <Text style={styles.inactiveBadgeText}>Inactif</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.customerMetaRow}>
                        <Text style={styles.customerMeta} numberOfLines={1}>
                          {formatPhoneNumber(customer.phone || '')}
                        </Text>
                        <Text style={styles.customerMetaDivider}>|</Text>
                        <Text style={styles.customerTotal}>
                          {formatCurrency(Number(customer.totalSpent) || 0)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.customerActions}>
                    <Pressable style={styles.callBtn} accessibilityLabel="Appeler">
                      <Phone size={12} color="#16A34A" />
                    </Pressable>
                    {canManageCustomers && !isSeller ? (
                      <Pressable
                        onPress={() => handleOpenModal(customer)}
                        style={styles.editBtn}
                        accessibilityLabel="Modifier"
                      >
                        <Edit size={12} color={COLORS.brand} />
                      </Pressable>
                    ) : null}
                    <ChevronRight size={12} color="#D1D5DB" />
                  </View>
                </View>
              </View>
            );
          })}

          {hasMore ? (
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

          {!hasMore && localCustomers.length > 5 ? (
            <View style={styles.endOfList}>
              <Text style={styles.endOfListText}>Fin de liste</Text>
            </View>
          ) : null}

          {filteredCustomers.length === 0 ? (
            <View style={styles.emptyState}>
              {isSearching ? (
                <>
                  <Loader2 size={48} color={COLORS.brand} />
                  <Text style={styles.emptyStateText}>Recherche en cours…</Text>
                </>
              ) : (
                <>
                  <Users size={64} color="#E5E7EB" />
                  <Text style={styles.emptyStateText}>Aucun client trouvé</Text>
                </>
              )}
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
  header: {
    gap: 12,
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerTitleBlock: {
    flexShrink: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  bulkDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  bulkDeleteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  newCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    shadowColor: '#FFEDD5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  newCustomerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  segmentsScroll: {
    flexGrow: 0,
    marginBottom: 16,
  },
  segments: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  segmentActive: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
    shadowColor: '#FFEDD5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  segmentIdle: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F3F4F6',
  },
  segmentText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  sortRowScroll: {
    flexGrow: 0,
    marginBottom: 16,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#F3F4F6',
  },
  sortBtnActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  sortBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
  },
  sortBtnTextActive: {
    color: COLORS.brand,
  },
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchWrap: {
    flex: 1,
    maxWidth: 448,
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  searchSpinner: {
    position: 'absolute',
    right: 12,
    zIndex: 1,
  },
  searchInput: {
    paddingLeft: 36,
    paddingRight: 34,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 10,
    fontSize: 12,
    color: '#111827',
  },
  selectAllWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  customerRow: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  customerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  customerRowSelected: {
    backgroundColor: 'rgba(255,247,237,0.6)',
  },
  customerRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  customerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  customerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  customerAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customerBody: {
    minWidth: 0,
    flexShrink: 1,
  },
  customerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customerName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#111827',
    flexShrink: 1,
  },
  inactiveBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveBadgeText: {
    fontSize: 6,
    fontWeight: '700',
    color: '#DC2626',
    textTransform: 'uppercase',
  },
  customerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  customerMeta: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
    flexShrink: 1,
  },
  customerMetaDivider: {
    fontSize: 9,
    color: '#E5E7EB',
  },
  customerTotal: {
    fontSize: 9,
    fontWeight: '700',
    color: '#16A34A',
  },
  customerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  callBtn: {
    padding: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
  },
  editBtn: {
    padding: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
  },
  loadMoreWrap: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  endOfList: {
    padding: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  endOfListText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 2,
    opacity: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 80,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
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
