/**
 * Commandes vendeur — copie fidèle de `src/views/OrdersView.tsx` du web
 * (rendu mobile < 768 px) : en-tête + pastilles verticale (Toutes/Shop/Resto),
 * recherche (débounce 500 ms), onglets de statut (compteurs sur le lot chargé),
 * barre de sélection groupée, liste des commandes (case à cocher, date/heure,
 * badge WEB/POS, total, statut), pagination « Voir plus », détail de commande
 * (client, articles, paiement) et bouton de progression du statut.
 *
 * Écarts assumés :
 * - la barre d'actions groupées est défilable horizontalement (le web la laisse
 *   déborder/clipper sur écran étroit) ;
 * - les toasts passent par le système global (`useToast`), comme le reste de
 *   l'app vendeur.
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
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Filter,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Zap,
} from 'lucide-react-native';
import { useToast } from '@/components/ToastProvider';
import ConfirmationModal from '@/components/ConfirmationModal';
import { SellerCheckbox } from '@/components/seller/ui';
import { COLORS } from '@/theme';
import { formatCurrency, getEffectiveWholesaleUnitPrice } from '@/utils';
import type { Product } from '@/types';
import { resolveImageUrl } from '@/api/client';
import {
  bulkDeleteSellerOrders,
  bulkUpdateSellerOrderStatus,
  deleteSellerOrder,
  fetchSellerOrderItems,
  fetchSellerOrders,
  updateSellerOrderStatus,
  type SellerOrderItemRow,
  type SellerOrderRow,
} from '@/api/seller';

const PAGE_SIZE = 10;

interface SellerOrdersViewProps {
  storeId: string;
  /** Session expirée (réponse `Unauthorized`) : purge la session côté contexte. */
  onUnauthorized: () => void;
}

const STATUS_STYLES: Record<string, { backgroundColor: string; color: string }> = {
  COMPLETED: { backgroundColor: '#22C55E', color: '#FFFFFF' },
  PENDING: { backgroundColor: '#F59E0B', color: '#FFFFFF' },
  READY: { backgroundColor: '#3B82F6', color: '#FFFFFF' },
};

const getStatusColor = (status?: string) =>
  STATUS_STYLES[status || ''] || { backgroundColor: '#F3F4F6', color: '#374151' };

const getStatusLabel = (status?: string) => {
  switch (status) {
    case 'COMPLETED':
      return 'Livrée';
    case 'PENDING':
      return 'Commandée';
    case 'READY':
      return 'En cours';
    default:
      return 'Payée';
  }
};

export function SellerOrdersView({ storeId, onUnauthorized }: SellerOrdersViewProps) {
  const { notify } = useToast();
  const insets = useSafeAreaInsets();

  const [searchTerm, setSearchTerm] = useState('');
  const [localOrders, setLocalOrders] = useState<SellerOrderRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'COMPLETED' | 'PENDING' | 'READY'>(
    'ALL',
  );
  const [selectedVertical, setSelectedVertical] = useState<'all' | 'shopping' | 'food'>('all');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkUpdatingStatus, setBulkUpdatingStatus] = useState<string | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<SellerOrderRow | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<SellerOrderRow | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<SellerOrderItemRow[]>([]);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);

  const expiredRef = useRef(false);

  const handleUnauthorized = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    onUnauthorized();
  }, [onUnauthorized]);

  // Recherche + filtre : le web relance une requête serveur après 500 ms de
  // calme, y compris au montage (la liste initiale est remplacée par la 1re
  // page serveur).
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetchSellerOrders(storeId, 0, PAGE_SIZE, searchTerm, filterStatus);
        if (!active) return;
        if (res.success && res.orders) {
          setLocalOrders(res.orders);
          setOffset(res.orders.length);
          setHasMore(Boolean(res.hasMore));
          setSelectedOrderIds([]);
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
  }, [searchTerm, filterStatus, storeId, notify, handleUnauthorized]);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetchSellerOrders(storeId, offset, PAGE_SIZE, searchTerm, filterStatus);
      if (res.success && res.orders) {
        setLocalOrders((prev) => [...prev, ...res.orders!]);
        setOffset((prev) => prev + (res.orders?.length || 0));
        setHasMore(Boolean(res.hasMore));
      } else if (res.error === 'Unauthorized') {
        handleUnauthorized();
      } else if (res.error && res.error !== 'Forbidden') {
        notify(res.error, 'error');
      }
    } catch {
      notify('Erreur lors du chargement', 'error');
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    hasMore,
    offset,
    searchTerm,
    filterStatus,
    storeId,
    notify,
    handleUnauthorized,
  ]);

  // Articles du détail : repli sur les lignes déjà chargées, puis version
  // enrichie de la route `/orders/items` (comme `fetchOrderItems` au web).
  const selectedOrderId = selectedOrder?.id;
  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedOrderItems([]);
      return;
    }
    let cancelled = false;
    const fallback =
      (selectedOrder as unknown as { items?: SellerOrderItemRow[] } | null)?.items || [];
    setSelectedOrderItems(fallback);
    setLoadingOrderItems(fallback.length === 0);
    fetchSellerOrderItems(selectedOrderId)
      .then((res) => {
        if (cancelled) return;
        setSelectedOrderItems(res.items && res.items.length > 0 ? res.items : fallback);
      })
      .catch(() => {
        if (!cancelled) setSelectedOrderItems(fallback);
      })
      .finally(() => {
        if (!cancelled) setLoadingOrderItems(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrderId]);

  const filteredOrders = useMemo(
    () =>
      localOrders.filter((order) => {
        if (selectedVertical === 'all') return true;
        const items = order.items || [];
        if (items.length === 0) return true;
        const vertical =
          items[0]?.product?.businessType ||
          (items[0]?.product?.mainCategory === 'Restauration & Livraison Rapide'
            ? 'food'
            : 'shopping');
        return vertical === selectedVertical;
      }),
    [localOrders, selectedVertical],
  );

  const handleUpdateStatus = useCallback(
    async (orderId: string, status?: string) => {
      if (!status || updatingOrderId) return;
      setUpdatingOrderId(orderId);
      try {
        const result = await updateSellerOrderStatus(orderId, status);
        if (result.success) {
          notify(`Statut mis à jour en "${getStatusLabel(status)}"`, 'success');
          setLocalOrders((prev) =>
            prev.map((order) => (order.id === orderId ? { ...order, status } : order)),
          );
          if (selectedOrder?.id === orderId) {
            setSelectedOrder((prev) => (prev ? { ...prev, status } : null));
          }
        } else if (result.error === 'Unauthorized') {
          handleUnauthorized();
        } else {
          notify(result.error || 'Erreur de mise à jour', 'error');
        }
      } catch {
        notify('Erreur de mise à jour du statut', 'error');
      } finally {
        setUpdatingOrderId(null);
      }
    },
    [updatingOrderId, notify, selectedOrder?.id, handleUnauthorized],
  );

  const confirmDeleteSingleOrder = async () => {
    if (!orderToDelete) return;
    setIsDeletingSingle(true);
    try {
      const result = await deleteSellerOrder(orderToDelete.id);
      if (result.success) {
        notify('Commande supprimée', 'info');
        setLocalOrders((prev) => prev.filter((order) => order.id !== orderToDelete.id));
        if (selectedOrder?.id === orderToDelete.id) setSelectedOrder(null);
      } else if (result.error === 'Unauthorized') {
        handleUnauthorized();
      } else {
        notify(result.error || 'Erreur de suppression', 'error');
      }
    } catch {
      notify('Erreur de suppression de la commande', 'error');
    } finally {
      setIsDeletingSingle(false);
      setOrderToDelete(null);
    }
  };

  const handleBulkUpdateStatus = async (status: string) => {
    if (bulkUpdatingStatus) return;
    setBulkUpdatingStatus(status);
    try {
      const result = await bulkUpdateSellerOrderStatus(selectedOrderIds, status);
      if (result.success) {
        notify(`${selectedOrderIds.length} commandes mises à jour`, 'success');
        setLocalOrders((prev) =>
          prev.map((order) =>
            selectedOrderIds.includes(order.id) ? { ...order, status } : order,
          ),
        );
        setSelectedOrderIds([]);
      } else if (result.error === 'Unauthorized') {
        handleUnauthorized();
      } else {
        notify(result.error || 'Erreur lors de la mise à jour groupée', 'error');
      }
    } catch {
      notify('Erreur lors de la mise à jour groupée', 'error');
    } finally {
      setBulkUpdatingStatus(null);
    }
  };

  const confirmBulkDelete = async () => {
    setIsDeletingBulk(true);
    try {
      const result = await bulkDeleteSellerOrders(selectedOrderIds);
      if (result.success) {
        notify(`${selectedOrderIds.length} commandes supprimées`, 'info');
        setLocalOrders((prev) => prev.filter((order) => !selectedOrderIds.includes(order.id)));
        setSelectedOrderIds([]);
      } else if (result.error === 'Unauthorized') {
        handleUnauthorized();
      } else {
        notify(result.error || 'Erreur lors de la suppression groupée', 'error');
      }
    } catch {
      notify('Erreur lors de la suppression groupée', 'error');
    } finally {
      setIsDeletingBulk(false);
      setIsBulkDeleteModalOpen(false);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedOrderIds(filteredOrders.map((order) => order.id));
    else setSelectedOrderIds([]);
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedOrderIds((prev) =>
      checked ? [...prev, id] : prev.filter((orderId) => orderId !== id),
    );
  };

  const allSelected =
    filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Commandes</Text>
          <View style={styles.verticalsRow}>
            {(
              [
                { id: 'all' as const, label: 'Toutes', Icon: Package, color: '#6B7280' },
                { id: 'shopping' as const, label: 'Shop', Icon: ShoppingBag, color: '#F97316' },
                { id: 'food' as const, label: 'Resto', Icon: Zap, color: '#EAB308' },
              ] as const
            ).map((v) => {
              const active = selectedVertical === v.id;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => setSelectedVertical(v.id)}
                  style={[
                    styles.verticalPill,
                    active
                      ? { backgroundColor: v.color, borderColor: v.color }
                      : styles.verticalPillIdle,
                  ]}
                >
                  <v.Icon size={12} color={active ? '#FFFFFF' : '#9CA3AF'} />
                  <Text
                    style={[
                      styles.verticalPillText,
                      active ? styles.verticalPillTextActive : null,
                    ]}
                  >
                    {v.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <View pointerEvents="none" style={styles.searchIcon}>
              <Search size={14} color="#9CA3AF" />
            </View>
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Chercher une commande..."
              placeholderTextColor="#C4C9D1"
              autoCapitalize="none"
              style={styles.searchInput}
            />
          </View>
          <View style={styles.filterBtn}>
            {isSearching ? (
              <ActivityIndicator size="small" color={COLORS.brand} />
            ) : (
              <Filter size={18} color="#9CA3AF" />
            )}
          </View>
        </View>
      </View>

      {/* Carte liste */}
      <View style={styles.card}>
        {/* Onglets de statut */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statusTabsScroll}
          contentContainerStyle={styles.statusTabs}
        >
          {(
            [
              { id: 'ALL' as const, label: 'Toutes', color: COLORS.brand },
              { id: 'PENDING' as const, label: 'Commandées', color: '#F59E0B' },
              { id: 'READY' as const, label: 'En cours', color: '#3B82F6' },
              { id: 'COMPLETED' as const, label: 'Livrées', color: '#22C55E' },
            ] as const
          ).map((tab) => {
            const active = filterStatus === tab.id;
            const count =
              tab.id === 'ALL'
                ? localOrders.length
                : localOrders.filter((order) => order.status === tab.id).length;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setFilterStatus(tab.id)}
                style={[styles.statusTab, active ? { backgroundColor: tab.color } : null]}
              >
                <Text
                  style={[styles.statusTabText, active ? styles.statusTabTextActive : null]}
                >
                  {tab.label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Barre de sélection groupée */}
        <View style={styles.bulkBar}>
          <View style={styles.bulkBarLeft}>
            <SellerCheckbox
              checked={allSelected}
              onToggle={() => toggleSelectAll(!allSelected)}
            />
            <Text style={styles.bulkBarLabel}>
              {selectedOrderIds.length > 0
                ? `${selectedOrderIds.length} sélectionnés`
                : 'Tout choisir'}
            </Text>
          </View>

          {selectedOrderIds.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bulkActions}
            >
              {(
                [
                  { status: 'PENDING', label: 'Commandées', color: '#F59E0B' },
                  { status: 'READY', label: 'En cours', color: '#3B82F6' },
                  { status: 'COMPLETED', label: 'Livrées', color: '#22C55E' },
                ] as const
              ).map((action) => (
                <Pressable
                  key={action.status}
                  onPress={() => handleBulkUpdateStatus(action.status)}
                  disabled={Boolean(bulkUpdatingStatus)}
                  style={[
                    styles.bulkActionBtn,
                    { backgroundColor: action.color },
                    bulkUpdatingStatus ? styles.disabled : null,
                  ]}
                >
                  {bulkUpdatingStatus === action.status ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : null}
                  <Text style={styles.bulkActionText}>{action.label}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setIsBulkDeleteModalOpen(true)}
                disabled={Boolean(bulkUpdatingStatus)}
                style={[
                  styles.bulkActionBtn,
                  styles.bulkDeleteBtn,
                  bulkUpdatingStatus ? styles.disabled : null,
                ]}
              >
                <Trash2 size={12} color="#DC2626" />
                <Text style={styles.bulkDeleteText}>Supprimer</Text>
              </Pressable>
            </ScrollView>
          ) : null}
        </View>

        {/* Liste */}
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filteredOrders.length > 0 ? (
            <>
              {filteredOrders.map((order, index) => (
                <Pressable
                  key={order.id}
                  onPress={() => setSelectedOrder(order)}
                  style={[
                    styles.orderRow,
                    index < filteredOrders.length - 1 ? styles.orderRowBorder : null,
                    selectedOrderIds.includes(order.id) ? styles.orderRowSelected : null,
                  ]}
                >
                  <View style={styles.orderRowLeft}>
                    <SellerCheckbox
                      checked={selectedOrderIds.includes(order.id)}
                      onToggle={() =>
                        toggleSelect(order.id, !selectedOrderIds.includes(order.id))
                      }
                    />
                  </View>

                  <View style={styles.orderIconBox}>
                    <ShoppingBag size={14} color={COLORS.brand} />
                  </View>

                  <View style={styles.orderBody}>
                    <View style={styles.orderBodyLeft}>
                      <View style={styles.orderIdRow}>
                        <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
                        <Text style={styles.orderCustomer} numberOfLines={1}>
                          {order.customer?.name || 'Passage'}
                        </Text>
                        <View
                          style={[
                            styles.orderTypeBadge,
                            order.type === 'PICKUP' ? styles.orderTypeWeb : styles.orderTypePos,
                          ]}
                        >
                          <Text
                            style={
                              order.type === 'PICKUP'
                                ? styles.orderTypeWebText
                                : styles.orderTypePosText
                            }
                          >
                            {order.type === 'PICKUP' ? 'WEB' : 'POS'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.orderMetaRow}>
                        <View style={styles.orderMetaItem}>
                          <Calendar size={10} color={COLORS.brand} />
                          <Text style={styles.orderMetaText}>
                            {new Date(order.date).toLocaleDateString('fr-FR')}
                          </Text>
                        </View>
                        <View style={styles.orderMetaItem}>
                          <Clock size={10} color="#9CA3AF" />
                          <Text style={styles.orderMetaText}>
                            {new Date(order.date).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.orderRight}>
                      <View style={styles.orderRightText}>
                        <Text style={styles.orderTotal}>
                          {formatCurrency(order.total || 0)}
                        </Text>
                        <View
                          style={[styles.statusPill, getStatusColor(order.status || 'READY')]}
                        >
                          <Text style={styles.statusPillText}>
                            {getStatusLabel(order.status || 'READY')}
                          </Text>
                        </View>
                      </View>
                      <ChevronRight size={14} color="#D1D5DB" />
                    </View>
                  </View>
                </Pressable>
              ))}

              {hasMore ? (
                <View style={styles.loadMoreWrap}>
                  <Pressable
                    onPress={handleLoadMore}
                    disabled={isLoadingMore}
                    style={[styles.loadMoreBtn, isLoadingMore ? styles.disabled : null]}
                  >
                    {isLoadingMore ? (
                      <ActivityIndicator size="small" color={COLORS.brand} />
                    ) : (
                      <Plus size={14} color={COLORS.brand} />
                    )}
                    <Text style={styles.loadMoreText}>
                      {isLoadingMore ? 'Chargement...' : 'Voir plus de commandes'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {!hasMore && localOrders.length > 5 ? (
                <View style={styles.endOfList}>
                  <Text style={styles.endOfListText}>Fin de liste</Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.emptyState}>
              {isSearching ? (
                <>
                  <ActivityIndicator size="large" color={COLORS.brand} />
                  <View style={styles.emptyStateTextWrap}>
                    <Text style={styles.emptyStateTitle}>Recherche en cours…</Text>
                    <Text style={styles.emptyStateHint}>Chargement de vos commandes.</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.emptyStateIcon}>
                    <ShoppingBag size={40} color="#E5E7EB" />
                  </View>
                  <View style={styles.emptyStateTextWrap}>
                    <Text style={styles.emptyStateTitle}>Aucune commande trouvée</Text>
                    <Text style={styles.emptyStateHint}>
                      Ajustez vos filtres ou effectuez une nouvelle recherche.
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Détail de commande */}
      <Modal
        visible={selectedOrder !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.detailRoot}>
          {selectedOrder ? (
            <View style={styles.detailSheet}>
              {/* En-tête */}
              <View style={[styles.detailHeader, { paddingTop: 16 + insets.top }]}>
                <View style={styles.detailHandle} />
                <View style={styles.detailHeaderRow}>
                  <View style={styles.detailHeaderLeft}>
                    <Pressable
                      onPress={() => setSelectedOrder(null)}
                      hitSlop={8}
                      style={styles.detailBack}
                      accessibilityLabel="Retour"
                    >
                      <ArrowLeft size={20} color="#9CA3AF" />
                    </Pressable>
                    <View style={styles.detailHeaderBody}>
                      <Text style={styles.detailTitle} numberOfLines={1}>
                        Commande #{selectedOrder.id.slice(-6).toUpperCase()}
                      </Text>
                      <View style={styles.detailBadgesRow}>
                        <View
                          style={[
                            styles.detailStatusBadge,
                            getStatusColor(selectedOrder.status || 'READY'),
                          ]}
                        >
                          <Text style={styles.detailStatusBadgeText}>
                            {getStatusLabel(selectedOrder.status || 'READY')}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.detailTypeBadge,
                            selectedOrder.type === 'PICKUP'
                              ? styles.orderTypeWeb
                              : styles.orderTypePos,
                          ]}
                        >
                          <Text
                            style={
                              selectedOrder.type === 'PICKUP'
                                ? styles.orderTypeWebText
                                : styles.orderTypePosText
                            }
                          >
                            {selectedOrder.type === 'PICKUP' ? 'Marketplace' : 'Boutique'}
                          </Text>
                        </View>
                        <View style={styles.detailDateWrap}>
                          <Clock size={10} color="#6B7280" />
                          <Text style={styles.detailDate} numberOfLines={1}>
                            {new Date(selectedOrder.date).toLocaleDateString('fr-FR')} à{' '}
                            {new Date(selectedOrder.date).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setOrderToDelete(selectedOrder)}
                    hitSlop={8}
                    style={styles.detailTrash}
                    accessibilityLabel="Supprimer cette commande"
                  >
                    <Trash2 size={20} color="#9CA3AF" />
                  </Pressable>
                </View>
              </View>

              {/* Corps */}
              <ScrollView
                style={styles.detailBody}
                contentContainerStyle={styles.detailBodyContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Client */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Client</Text>
                  <View style={styles.customerCard}>
                    <View style={styles.customerAvatar}>
                      <Text style={styles.customerAvatarText}>
                        {selectedOrder.customer?.name?.charAt(0) || '?'}
                      </Text>
                    </View>
                    <View style={styles.customerBody}>
                      <Text style={styles.customerName} numberOfLines={1}>
                        {selectedOrder.customer?.name || 'Client de passage'}
                      </Text>
                      <Text style={styles.customerMeta} numberOfLines={1}>
                        {selectedOrder.customer?.email || 'Sans email'}
                      </Text>
                      {selectedOrder.customer?.phone ? (
                        <Text style={styles.customerPhone}>{selectedOrder.customer.phone}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Articles */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>
                    Articles ({loadingOrderItems ? '...' : selectedOrderItems.length})
                  </Text>
                  {loadingOrderItems ? (
                    <View style={styles.itemsLoader}>
                      <ActivityIndicator size="small" color={COLORS.brand} />
                    </View>
                  ) : (
                    <View style={styles.itemsList}>
                      {selectedOrderItems.map((item, idx) => {
                        const product = item.product;
                        const baseUnit = Number(product?.price || 0);
                        const unitQty = Number(item.quantity || 1);
                        const effUnit = product
                          ? getEffectiveWholesaleUnitPrice(
                              product as unknown as Product,
                              unitQty,
                            )
                          : baseUnit;
                        const isWholesale = effUnit > 0 && effUnit < baseUnit;
                        const lineTotal = effUnit * unitQty;
                        const image = resolveImageUrl(product?.image);
                        return (
                          <View key={idx} style={styles.itemRow}>
                            <View style={styles.itemThumb}>
                              {image ? (
                                <Image
                                  source={{ uri: image }}
                                  style={styles.itemImage}
                                  contentFit="cover"
                                  alt=""
                                />
                              ) : (
                                <View style={styles.itemThumbFallback} />
                              )}
                            </View>
                            <View style={styles.itemBody}>
                              <Text style={styles.itemName} numberOfLines={1}>
                                {product?.name || 'Article'}
                              </Text>
                              {item.variantLabel ? (
                                <Text style={styles.itemVariant} numberOfLines={1}>
                                  {item.variantLabel}
                                  {item.variantSku ? ` · SKU ${item.variantSku}` : ''}
                                </Text>
                              ) : null}
                              <View style={styles.itemUnitsRow}>
                                <Text style={styles.itemUnits}>
                                  {unitQty} {product?.unit || 'unité(s)'}
                                </Text>
                                {isWholesale ? (
                                  <View style={styles.wholesaleBadge}>
                                    <Text style={styles.wholesaleBadgeText}>Gros</Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={styles.itemUnitPrice}>
                                {formatCurrency(effUnit)} / {product?.unit || 'unité'}
                              </Text>
                            </View>
                            <View style={styles.itemRight}>
                              <Text style={styles.itemTotal}>{formatCurrency(lineTotal)}</Text>
                              {isWholesale ? (
                                <Text style={styles.itemBaseTotal}>
                                  {formatCurrency(baseUnit * unitQty)}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Paiement */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Paiement</Text>
                  <View style={styles.paymentCard}>
                    <View style={styles.paymentTotalRow}>
                      <Text style={styles.paymentTotalLabel}>Total</Text>
                      <Text style={styles.paymentTotalValue}>
                        {formatCurrency(selectedOrder.total || 0)}
                      </Text>
                    </View>
                    {(selectedOrder.discountAmount || 0) > 0 ? (
                      <View style={styles.paymentDiscountRow}>
                        <Text style={styles.paymentDiscountLabel}>Remise appliquée</Text>
                        <Text style={styles.paymentDiscountValue}>
                          -{formatCurrency(selectedOrder.discountAmount || 0)}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.paymentModeRow}>
                      <CreditCard size={12} color="#9CA3AF" />
                      <Text style={styles.paymentModeLabel}>
                        Mode:{' '}
                        <Text style={styles.paymentModeValue}>{selectedOrder.paymentMethod}</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Pied */}
              <View style={[styles.detailFooter, { paddingBottom: 16 + insets.bottom }]}>
                <Pressable onPress={() => setSelectedOrder(null)} style={styles.detailCloseBtn}>
                  <AlertCircle size={16} color="#4B5563" />
                  <Text style={styles.detailCloseText}>Fermer</Text>
                </Pressable>
                <Pressable
                  disabled={
                    selectedOrder.status === 'COMPLETED' ||
                    updatingOrderId === selectedOrder.id
                  }
                  onPress={() => {
                    const nextStatus = selectedOrder.status === 'PENDING' ? 'READY' : 'COMPLETED';
                    handleUpdateStatus(selectedOrder.id, nextStatus);
                    if (nextStatus === 'COMPLETED') setSelectedOrder(null);
                  }}
                  style={[
                    styles.detailStatusBtn,
                    selectedOrder.status === 'PENDING'
                      ? styles.detailStatusBtnPending
                      : selectedOrder.status === 'READY'
                        ? styles.detailStatusBtnReady
                        : styles.detailStatusBtnDone,
                  ]}
                >
                  {updatingOrderId === selectedOrder.id ? (
                    <ActivityIndicator
                      size="small"
                      color={selectedOrder.status === 'COMPLETED' ? '#9CA3AF' : '#FFFFFF'}
                    />
                  ) : (
                    <CheckCircle2
                      size={16}
                      color={selectedOrder.status === 'COMPLETED' ? '#9CA3AF' : '#FFFFFF'}
                    />
                  )}
                  <Text
                    style={[
                      styles.detailStatusText,
                      selectedOrder.status === 'COMPLETED' ? styles.detailStatusTextDone : null,
                    ]}
                  >
                    {updatingOrderId === selectedOrder.id
                      ? 'Mise à jour...'
                      : selectedOrder.status === 'PENDING'
                        ? 'Passer en cours'
                        : selectedOrder.status === 'READY'
                          ? 'Marquer livrée'
                          : 'Livrée'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <ConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={confirmBulkDelete}
        isLoading={isDeletingBulk}
        title="Supprimer les commandes"
        message={`Êtes-vous sûr de vouloir supprimer définitivement ${selectedOrderIds.length} commande${
          selectedOrderIds.length > 1 ? 's' : ''
        } ? Cette action est irréversible.`}
        confirmText={`Supprimer (${selectedOrderIds.length})`}
        cancelText="Annuler"
        type="danger"
      />

      <ConfirmationModal
        isOpen={orderToDelete !== null}
        onClose={() => setOrderToDelete(null)}
        onConfirm={confirmDeleteSingleOrder}
        isLoading={isDeletingSingle}
        title="Supprimer la commande"
        message={`Êtes-vous sûr de vouloir supprimer définitivement la commande #${orderToDelete?.id
          .slice(-6)
          .toUpperCase()} ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
      />
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

  // ── En-tête ─────────────────────────────────────────────────────
  header: {
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.4,
  },
  verticalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  verticalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 2,
  },
  verticalPillIdle: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F3F4F6',
  },
  verticalPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  verticalPillTextActive: {
    color: '#FFFFFF',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchWrap: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  searchInput: {
    paddingLeft: 36,
    paddingRight: 16,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  filterBtn: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },

  // ── Carte liste ─────────────────────────────────────────────────
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
  statusTabsScroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  statusTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  statusTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusTabText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  statusTabTextActive: {
    color: '#FFFFFF',
  },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bulkBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulkBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  bulkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
  },
  bulkActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bulkActionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bulkDeleteBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  bulkDeleteText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },

  // ── Lignes ──────────────────────────────────────────────────────
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  orderRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  orderRowSelected: {
    backgroundColor: 'rgba(255,247,237,0.3)',
  },
  orderRowLeft: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBody: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orderBodyLeft: {
    flexShrink: 1,
    minWidth: 0,
    gap: 6,
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderId: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  orderCustomer: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6B7280',
    maxWidth: 120,
  },
  orderTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  orderTypeWeb: {
    backgroundColor: '#DBEAFE',
  },
  orderTypeWebText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#1D4ED8',
    letterSpacing: 0.7,
  },
  orderTypePos: {
    backgroundColor: '#F3F4F6',
  },
  orderTypePosText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#4B5563',
    letterSpacing: 0.7,
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderMetaText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  orderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  orderRightText: {
    alignItems: 'flex-end',
  },
  orderTotal: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.brand,
  },
  statusPill: {
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },

  // ── Pagination / états ──────────────────────────────────────────
  loadMoreWrap: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
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
    color: '#6B7280',
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 80,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTextWrap: {
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 22,
  },
  emptyStateHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },

  // ── Détail ──────────────────────────────────────────────────────
  detailRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.4)',
  },
  detailSheet: {
    height: '85%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  detailHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  detailHandle: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  detailHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flexShrink: 1,
  },
  detailBack: {
    padding: 6,
    marginLeft: -4,
    marginTop: -4,
  },
  detailHeaderBody: {
    flexShrink: 1,
    minWidth: 0,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.4,
  },
  detailBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  detailStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  detailStatusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  detailDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailDate: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  detailTrash: {
    padding: 8,
  },
  detailBody: {
    flex: 1,
  },
  detailBodyContent: {
    padding: 16,
    gap: 24,
  },
  detailSection: {
    gap: 12,
  },
  detailSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customerBody: {
    flexShrink: 1,
    minWidth: 0,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  customerMeta: {
    fontSize: 10,
    color: '#6B7280',
  },
  customerPhone: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  itemsLoader: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F9FAFB',
    borderRadius: 12,
  },
  itemThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#F3F4F6',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemThumbFallback: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  itemVariant: {
    fontSize: 9,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  itemUnitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  itemUnits: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  wholesaleBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  wholesaleBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#92400E',
    textTransform: 'uppercase',
  },
  itemUnitPrice: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemTotal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  itemBaseTotal: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  paymentCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 12,
  },
  paymentTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  paymentTotalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  paymentTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.brand,
  },
  paymentDiscountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(240,253,244,0.5)',
    padding: 8,
    borderRadius: 8,
  },
  paymentDiscountLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16A34A',
    textTransform: 'uppercase',
  },
  paymentDiscountValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  paymentModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  paymentModeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  paymentModeValue: {
    color: '#111827',
  },
  detailFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  detailCloseBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  detailCloseText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  detailStatusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  detailStatusBtnPending: {
    backgroundColor: '#3B82F6',
  },
  detailStatusBtnReady: {
    backgroundColor: COLORS.brand,
  },
  detailStatusBtnDone: {
    backgroundColor: '#F3F4F6',
  },
  detailStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  detailStatusTextDone: {
    color: '#9CA3AF',
  },
  disabled: {
    opacity: 0.5,
  },
});
