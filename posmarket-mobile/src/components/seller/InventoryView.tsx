/**
 * Stocks (Inventaire) — copie fidèle de `src/views/InventoryView.tsx` du web
 * (rendu mobile < 768 px).
 *
 * Écarts assumés (adaptations mobile, signalés à l'audit 04) :
 * - les toasts (succès vert / erreur rouge) passent par le système global
 *   (`useToast`), mêmes textes et mêmes durées utiles ;
 * - la vue grille et la bascule liste/grille sont desktop-only au web → non
 *   portées (la liste mobile est toujours en lignes empilées) ;
 * - le plafond de produits utilise le total renvoyé par le serveur (le web
 *   n'a que les 200 produits locaux) ;
 * - la barre d'actions groupées est posée au-dessus de la barre d'onglets
 *   (safe-area) au lieu de `bottom-6` fixe ;
 * - « Découvrir les Tarifs » ouvre l'écran Abonnement mobile.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  AlertCircle,
  ArrowRightLeft,
  Award,
  ChevronRight,
  Download,
  Edit,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react-native';
import { useToast } from '@/components/ToastProvider';
import ConfirmationModal from '@/components/ConfirmationModal';
import { SellerCheckbox } from '@/components/seller/ui';
import { COLORS } from '@/theme';
import { formatCurrency } from '@/utils';
import type { BusinessVertical, Product } from '@/types';
import {
  bulkDeleteSellerProducts,
  fetchSellerProductCategories,
  fetchSellerProducts,
  type SellerCategoryNode,
  type SellerProductTypeFilter,
  type SellerProductVerticalFilter,
} from '@/api/seller';
import { ProductFormModal } from './inventory/ProductFormModal';
import { ExportProductsModal } from './inventory/ExportProductsModal';
import { ImportProductsModal } from './inventory/ImportProductsModal';
import { TransferProductsModal } from './inventory/TransferProductsModal';

const PAGE_SIZE = 10;

interface SellerInventoryViewProps {
  storeId: string;
  businessType: BusinessVertical;
  storeName: string;
  canManageInventory: boolean;
  /** Plafond de produits de l'abonnement (plan.features.maxProducts || 6). */
  maxProducts: number;
  onUnauthorized: () => void;
  /** « Découvrir les Tarifs » de la modale de limite → écran Abonnement. */
  onDiscoverPlans: () => void;
}

export function SellerInventoryView({
  storeId,
  businessType,
  storeName,
  canManageInventory,
  maxProducts,
  onUnauthorized,
  onDiscoverPlans,
}: SellerInventoryViewProps) {
  const { notify } = useToast();
  const insets = useSafeAreaInsets();

  const [searchTerm, setSearchTerm] = useState('');
  const [productType, setProductType] = useState<SellerProductTypeFilter>('all');
  const [selectedVertical, setSelectedVertical] =
    useState<SellerProductVerticalFilter>('all');

  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalProductsCount, setTotalProductsCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(true);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showLimitModal, setShowLimitModal] = useState(false);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  const [productModal, setProductModal] = useState<{
    isOpen: boolean;
    editing: Product | null;
    channel: 'pos' | 'store';
  }>({ isOpen: false, editing: null, channel: 'pos' });

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({ isOpen: false, title: '', message: '', onConfirm: async () => {} });
  const [isDeleting, setIsDeleting] = useState(false);

  // Taxonomie produit : lue en base (gérée depuis /pam/categories), repli sur
  // les constantes historiques si la table est vide ou inaccessible.
  const [categoryTree, setCategoryTree] = useState<SellerCategoryNode[]>([]);
  const [useLiveCategories, setUseLiveCategories] = useState(false);

  const expiredRef = useRef(false);
  const handleUnauthorized = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    onUnauthorized();
  }, [onUnauthorized]);

  const notifyError = useCallback(
    (message: string) => {
      notify(message, 'error');
    },
    [notify],
  );

  useEffect(() => {
    let active = true;
    fetchSellerProductCategories(businessType === 'food' ? 'food' : 'shopping')
      .then((res) => {
        if (active && res.success && res.tree && res.tree.length > 0) {
          setCategoryTree(res.tree);
          setUseLiveCategories(true);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [businessType]);

  // Recherche / filtres : requête serveur après 500 ms, retour page 1.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetchSellerProducts(
          storeId,
          0,
          PAGE_SIZE,
          searchTerm,
          productType,
          selectedVertical,
        );
        if (!active) return;
        if (res.success && res.products) {
          setLocalProducts(res.products);
          setOffset(res.products.length);
          setHasMore(Boolean(res.hasMore));
          if (typeof res.total === 'number') setTotalProductsCount(res.total);
        } else if (res.error === 'Unauthorized') {
          handleUnauthorized();
        } else if (res.error === 'NoStore') {
          handleUnauthorized();
        } else if (res.error && res.error !== 'Forbidden') {
          notifyError(res.error);
        }
      } catch {
        if (active) notifyError('Erreur lors de la recherche');
      } finally {
        if (active) setIsSearching(false);
      }
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchTerm, productType, selectedVertical, storeId, notifyError, handleUnauthorized]);

  const refreshProducts = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const res = await fetchSellerProducts(
        storeId,
        0,
        PAGE_SIZE,
        searchTerm,
        productType,
        selectedVertical,
      );
      if (res.success && res.products) {
        setLocalProducts(res.products);
        setOffset(res.products.length);
        setHasMore(Boolean(res.hasMore));
        if (typeof res.total === 'number') setTotalProductsCount(res.total);
      } else if (res.error === 'Unauthorized') {
        handleUnauthorized();
      } else if (res.error && res.error !== 'Forbidden') {
        notifyError(res.error);
      }
    } catch {
      notifyError('Erreur lors du chargement des produits');
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    storeId,
    searchTerm,
    productType,
    selectedVertical,
    notifyError,
    handleUnauthorized,
  ]);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetchSellerProducts(
        storeId,
        offset,
        PAGE_SIZE,
        searchTerm,
        productType,
        selectedVertical,
      );
      if (res.success && res.products) {
        setLocalProducts((prev) => [...prev, ...res.products!]);
        setOffset((prev) => prev + res.products!.length);
        setHasMore(Boolean(res.hasMore));
      } else if (res.error === 'Unauthorized') {
        handleUnauthorized();
      } else if (res.error && res.error !== 'Forbidden') {
        notifyError(res.error);
      }
    } catch {
      notifyError('Erreur lors du chargement');
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    hasMore,
    offset,
    storeId,
    searchTerm,
    productType,
    selectedVertical,
    notifyError,
    handleUnauthorized,
  ]);

  /** Filtre vertical client (en plus du filtre serveur), comme au web. */
  const filteredProducts = useMemo(() => {
    return localProducts.filter((p) => {
      const channelMatch =
        productType === 'all' ||
        (productType === 'pos' && p.isOnline === false) ||
        (productType === 'marketplace' && p.isOnline !== false);
      if (!channelMatch) return false;

      const mainCat = p.mainCategory || '';
      const isFood =
        p.businessType === 'food' || mainCat.includes('Resto') || mainCat.includes('Alimentation');
      const actualVertical = isFood ? 'food' : 'shopping';

      if (selectedVertical === 'all') return true;
      return selectedVertical === actualVertical;
    });
  }, [localProducts, productType, selectedVertical]);

  const handleImportSuccess = (summary: {
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
  }) => {
    notify(
      `Import terminé : ${summary.createdCount} crés, ${summary.updatedCount} mis à jour, ${summary.skippedCount} ignorés.`,
      'success',
    );
    void refreshProducts();
  };

  const handleTransferSuccess = (summary: {
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
  }) => {
    notify(
      `Transfert terminé : ${summary.createdCount} crés, ${summary.updatedCount} mis à jour.`,
      'success',
    );
  };

  const handleOpenModal = (product?: Product, type?: 'pos' | 'store') => {
    // Plafond de produits (création uniquement).
    const loadedCount = Math.max(localProducts.length, totalProductsCount);
    if (!product && loadedCount >= maxProducts) {
      setShowLimitModal(true);
      return;
    }
    setProductModal({ isOpen: true, editing: product || null, channel: type || 'pos' });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    setDeleteConfirmation({
      isOpen: true,
      title: `Supprimer ${count} produit${count > 1 ? 's' : ''} ?`,
      message: `Êtes-vous sûr de vouloir supprimer définitivement les ${count} produits sélectionnés ? Cette action est irréversible.`,
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          const result = await bulkDeleteSellerProducts(storeId, selectedIds);
          if (result.success) {
            setLocalProducts((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
            setSelectedIds([]);
            notify(`${count} produit${count > 1 ? 's' : ''} supprimé${count > 1 ? 's' : ''} avec succès.`, 'success');
          } else if (result.error === 'Unauthorized') {
            handleUnauthorized();
          } else {
            notifyError(result.error || 'Erreur lors de la suppression');
          }
        } catch {
          notifyError('Erreur lors de la suppression');
        } finally {
          setIsDeleting(false);
          setDeleteConfirmation((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSavedProduct = (saved: Product, isEdit: boolean, warnings?: string[]) => {
    setLocalProducts((prev) => {
      if (isEdit) {
        return prev.map((p) => (p.id === saved.id ? saved : p));
      }
      setTotalProductsCount((count) => count + 1);
      return [saved, ...prev];
    });
    const warning = Array.isArray(warnings) ? warnings[0] : null;
    notify(
      warning || (isEdit ? 'Produit mis à jour avec succès !' : 'Produit ajouté avec succès !'),
      'success',
    );
  };

  return (
    <View style={styles.root}>
      {/* Barre d'actions groupées flottante */}
      {selectedIds.length > 0 && canManageInventory ? (
        <View style={[styles.bulkBarWrap, { bottom: 12 }]}>
          <View style={styles.bulkBar}>
            <View style={styles.bulkCountRow}>
              <View style={styles.bulkCountBadge}>
                <Text style={styles.bulkCountText}>{selectedIds.length}</Text>
              </View>
              <Pressable
                onPress={() => setSelectedIds([])}
                style={styles.bulkClearBtn}
                accessibilityLabel="Désélectionner tout"
              >
                <X size={14} color="#94A3B8" />
              </Pressable>
              <View style={styles.bulkSeparator} />
            </View>
            <View style={styles.bulkActions}>
              <Pressable onPress={() => setIsExportModalOpen(true)} style={styles.bulkBtn}>
                <Download size={14} color="#FB923C" />
                <Text style={styles.bulkBtnText}>Exporter ({selectedIds.length})</Text>
              </Pressable>
              <Pressable onPress={() => setIsTransferModalOpen(true)} style={styles.bulkBtn}>
                <ArrowRightLeft size={14} color="#60A5FA" />
                <Text style={styles.bulkBtnText}>Transférer ({selectedIds.length})</Text>
              </Pressable>
              <Pressable onPress={handleBulkDelete} style={styles.bulkDangerBtn}>
                <Trash2 size={14} color="#FCA5A5" />
                <Text style={styles.bulkDangerText}>Supprimer ({selectedIds.length})</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* En-tête */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Inventaire</Text>
            <View
              style={[
                styles.flowBadge,
                businessType === 'food' ? styles.flowBadgeFood : styles.flowBadgeShopping,
              ]}
            >
              <Text
                style={[
                  styles.flowBadgeText,
                  { color: businessType === 'food' ? '#92400E' : COLORS.brand },
                ]}
              >
                Flux {businessType === 'food' ? 'Resto' : 'Shop'}
              </Text>
            </View>
          </View>
        </View>

        {/* Groupe d'actions */}
        <View style={styles.actionsBlock}>
          <View style={styles.catalogActions}>
            <Pressable
              onPress={() => setIsExportModalOpen(true)}
              style={styles.catalogBtn}
              accessibilityLabel="Exporter vos produits"
            >
              <Download size={14} color="#6B7280" />
              <Text style={styles.catalogBtnText}>Exporter</Text>
            </Pressable>
            {canManageInventory ? (
              <>
                <View style={styles.catalogDivider} />
                <Pressable onPress={() => setIsImportModalOpen(true)} style={styles.catalogBtn}>
                  <Upload size={14} color="#6B7280" />
                  <Text style={styles.catalogBtnText}>Importer</Text>
                </Pressable>
                <View style={styles.catalogDivider} />
                <Pressable onPress={() => setIsTransferModalOpen(true)} style={styles.catalogBtn}>
                  <ArrowRightLeft size={14} color="#2563EB" />
                  <Text style={[styles.catalogBtnText, { color: '#1D4ED8' }]}>Transférer</Text>
                </Pressable>
              </>
            ) : null}
          </View>

          {canManageInventory ? (
            <View style={styles.createRow}>
              <Pressable
                onPress={() => handleOpenModal(undefined, 'pos')}
                style={styles.posBtn}
                accessibilityLabel="Ajouter un produit Point de Vente uniquement"
              >
                <Monitor size={15} color="#FFFFFF" />
                <Text style={styles.createBtnText}>+ POS</Text>
              </Pressable>
              <Pressable
                onPress={() => handleOpenModal(undefined, 'store')}
                style={styles.storeBtn}
                accessibilityLabel="Ajouter un produit en ligne (Marketplace + Point de Vente)"
              >
                <ShoppingBag size={15} color="#FFFFFF" />
                <Text style={styles.createBtnText}>+ Store & POS</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Conteneur de liste */}
        <View style={styles.listCard}>
          {/* Onglets de flux */}
          <View style={styles.tabsBlock}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsRow}
            >
              {[
                {
                  id: 'all' as const,
                  label: 'Tous les flux',
                  Icon: Package,
                  border: '#6B7280',
                  text: '#4B5563',
                },
                {
                  id: 'shopping' as const,
                  label: 'Shop',
                  Icon: ShoppingBag,
                  border: '#F97316',
                  text: '#EA580C',
                },
                {
                  id: 'food' as const,
                  label: 'Resto',
                  Icon: Zap,
                  border: '#EAB308',
                  text: '#CA8A04',
                },
              ]
                .filter((v) => v.id === 'all' || v.id === businessType)
                .map((v) => {
                  const active = selectedVertical === v.id;
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => setSelectedVertical(v.id)}
                      style={[
                        styles.flowTab,
                        { borderColor: active ? v.border : 'transparent' },
                        active && styles.flowTabActive,
                      ]}
                    >
                      <v.Icon size={16} color={active ? v.text : '#9CA3AF'} />
                      <Text
                        style={[styles.flowTabText, { color: active ? v.text : '#9CA3AF' }]}
                      >
                        {v.label}
                      </Text>
                    </Pressable>
                  );
                })}
            </ScrollView>

            {/* Sélecteur de canal */}
            <View style={styles.segmented}>
              {[
                { id: 'all' as const, label: 'Mode Mixte' },
                { id: 'pos' as const, label: 'POS Uniquement' },
                { id: 'marketplace' as const, label: 'En ligne (Store)' },
              ].map((option) => {
                const active = productType === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setProductType(option.id)}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  >
                    <Text
                      style={[styles.segmentText, active && styles.segmentTextActive]}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Recherche */}
          <View style={styles.searchBar}>
            <View style={styles.searchWrap}>
              <View pointerEvents="none" style={styles.searchIcon}>
                <Search size={16} color="#9CA3AF" />
              </View>
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Rechercher..."
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.searchInput}
              />
              {isSearching || isLoadingMore ? (
                <View style={styles.searchAccessory}>
                  <Loader2 size={16} color={COLORS.brand} />
                </View>
              ) : null}
            </View>
          </View>

          {/* Liste */}
          <View style={styles.listBody}>
            {isSearching && localProducts.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <View key={`skel-${i}`} style={styles.skeletonRow}>
                  <View style={styles.skeletonCheckbox} />
                  <View style={styles.skeletonThumb} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={styles.skeletonLineWide} />
                    <View style={styles.skeletonLineNarrow} />
                  </View>
                </View>
              ))
            ) : filteredProducts.length === 0 ? (
              <View style={styles.emptyBox}>
                <Package size={40} color="#9CA3AF" style={{ opacity: 0.2 }} />
                <Text style={styles.emptyTitle}>Aucun produit trouvé</Text>
                <Text style={styles.emptyText}>
                  Essayez un autre terme ou élargissez vos filtres.
                </Text>
              </View>
            ) : (
              filteredProducts.map((product) => {
                const selected = selectedIds.includes(product.id);
                const lowStock = Number(product.stock) < 10;
                return (
                  <View
                    key={product.id}
                    style={[styles.productRow, selected && styles.productRowSelected]}
                  >
                    <SellerCheckbox
                      checked={selected}
                      onToggle={() => toggleSelect(product.id)}
                      size={16}
                    />
                    <View style={styles.productThumb}>
                      {product.image ? (
                        <Image
                          source={{ uri: product.image }}
                          style={styles.productThumbImg}
                          contentFit="cover"
                        />
                      ) : (
                        <ImageIcon size={16} color="#9CA3AF" />
                      )}
                    </View>
                    <View style={styles.productInfo}>
                      <View style={styles.productNameRow}>
                        <Text style={styles.productName} numberOfLines={1}>
                          {product.name}
                        </Text>
                        <View
                          style={[
                            styles.channelBadge,
                            product.isOnline !== false
                              ? styles.channelBadgeOnline
                              : styles.channelBadgePos,
                          ]}
                        >
                          <Text
                            style={[
                              styles.channelBadgeText,
                              {
                                color: product.isOnline !== false ? '#16A34A' : '#2563EB',
                              },
                            ]}
                          >
                            {product.isOnline !== false ? 'MAR.' : 'POS'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.productMetaRow}>
                        <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
                        <Text style={styles.productMetaSeparator}>|</Text>
                        <View style={styles.productStockRow}>
                          <Text
                            style={[
                              styles.productStock,
                              lowStock && styles.productStockLow,
                            ]}
                          >
                            {product.stock} {product.unit}
                          </Text>
                          {lowStock ? <AlertCircle size={9} color="#EF4444" /> : null}
                        </View>
                      </View>
                    </View>
                    <View style={styles.productActions}>
                      {canManageInventory ? (
                        <Pressable
                          onPress={() => handleOpenModal(product)}
                          style={styles.editBtn}
                          accessibilityLabel={`Modifier ${product.name}`}
                        >
                          <Edit size={16} color={COLORS.brand} />
                        </Pressable>
                      ) : null}
                      <ChevronRight size={18} color="#D1D5DB" />
                    </View>
                  </View>
                );
              })
            )}

            {/* Pagination */}
            {hasMore ? (
              <View style={styles.loadMoreWrap}>
                <Pressable
                  onPress={handleLoadMore}
                  disabled={isLoadingMore}
                  style={[styles.loadMoreBtn, isLoadingMore && { opacity: 0.5 }]}
                >
                  {isLoadingMore ? (
                    <Loader2 size={16} color={COLORS.brand} />
                  ) : (
                    <Plus size={16} color={COLORS.brand} />
                  )}
                  <Text style={styles.loadMoreText}>
                    {isLoadingMore ? 'Chargement...' : 'Voir plus de produits'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {!hasMore && localProducts.length > 5 ? (
              <View style={styles.endWrap}>
                <Text style={styles.endText}>Fin de l&apos;inventaire</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Modale produit */}
      <ProductFormModal
        visible={productModal.isOpen}
        editingProduct={productModal.editing}
        initialChannel={productModal.channel}
        businessType={businessType}
        storeId={storeId}
        categoryTree={categoryTree}
        useLiveCategories={useLiveCategories}
        onClose={() => setProductModal((prev) => ({ ...prev, isOpen: false }))}
        onSaved={handleSavedProduct}
      />

      {/* Modale de limite de produits */}
      {showLimitModal ? (
        <View style={styles.limitOverlay}>
          <View style={styles.limitCard}>
            <View style={styles.limitIcon}>
              <Award size={40} color={COLORS.brand} />
            </View>
            <Text style={styles.limitTitle}>Limite de produits atteinte !</Text>
            <Text style={styles.limitText}>
              Vous avez atteint la limite de{' '}
              <Text style={styles.limitStrong}>{maxProducts} produits</Text> pour votre abonnement
              actuel. Passez à la formule{' '}
              <Text style={styles.limitUnderlined}>Pro</Text> pour continuer à développer votre
              inventaire.
            </Text>
            <Pressable
              onPress={() => {
                setShowLimitModal(false);
                onDiscoverPlans();
              }}
              style={styles.limitPrimary}
            >
              <Text style={styles.limitPrimaryText}>Découvrir les Tarifs</Text>
              <ChevronRight size={18} color="#FFFFFF" />
            </Pressable>
            <Pressable onPress={() => setShowLimitModal(false)} style={styles.limitSecondary}>
              <Text style={styles.limitSecondaryText}>Plus tard</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Modales export / import / transfert */}
      <ExportProductsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        storeId={storeId}
        storeName={storeName}
        businessType={businessType}
        selectedProductsCount={selectedIds.length}
        selectedProductIds={selectedIds}
        totalProductsCount={totalProductsCount || localProducts.length}
        localProducts={localProducts}
      />
      <ImportProductsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        targetStoreId={storeId}
        targetStoreName={storeName}
        businessType={businessType}
        onImportSuccess={handleImportSuccess}
      />
      <TransferProductsModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        sourceStoreId={storeId}
        sourceStoreName={storeName}
        selectedProductIds={selectedIds}
        selectedProductsCount={selectedIds.length}
        totalProductsCount={totalProductsCount || localProducts.length}
        localProducts={localProducts}
        onTransferSuccess={handleTransferSuccess}
      />

      {/* Confirmation de suppression */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={deleteConfirmation.onConfirm}
        title={deleteConfirmation.title}
        message={deleteConfirmation.message}
        confirmText="Supprimer définitivement"
        type="danger"
        isLoading={isDeleting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(249,250,251,0.3)' },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 32 },

  bulkBarWrap: { position: 'absolute', left: 0, right: 0, zIndex: 100, alignItems: 'center' },
  bulkBar: {
    maxWidth: '95%',
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  bulkCountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulkCountBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkCountText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  bulkClearBtn: { padding: 4 },
  bulkSeparator: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  bulkActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  bulkBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  bulkDangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 12,
  },
  bulkDangerText: { color: '#FCA5A5', fontSize: 12, fontWeight: '700' },

  header: { marginBottom: 12 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#111827', letterSpacing: -0.3 },
  flowBadge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 8 },
  flowBadgeShopping: { backgroundColor: '#FFEDD5' },
  flowBadgeFood: { backgroundColor: '#FEF3C7' },
  flowBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  actionsBlock: { gap: 10, marginBottom: 12 },
  catalogActions: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(229,231,235,0.8)',
    borderRadius: 16,
    padding: 4,
  },
  catalogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  catalogBtnText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  catalogDivider: { width: 1, height: 16, backgroundColor: '#E5E7EB' },
  createRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  posBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#2563EB',
    borderRadius: 16,
  },
  storeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.brand,
    borderRadius: 16,
  },
  createBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  listCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 24,
    overflow: 'hidden',
  },
  tabsBlock: { paddingHorizontal: 12, paddingTop: 16, gap: 14 },
  tabsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
  flowTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  flowTabActive: {
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  flowTabText: { fontSize: 12, fontWeight: '700' },
  segmented: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    backgroundColor: '#F3F4F6',
    padding: 2,
    borderRadius: 8,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  segmentBtnActive: { backgroundColor: '#FFFFFF' },
  segmentText: { fontSize: 10, fontWeight: '600', color: '#6B7280' },
  segmentTextActive: { color: '#111827' },

  searchBar: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchWrap: {
    position: 'relative',
    justifyContent: 'center',
    maxWidth: 448,
  },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  searchAccessory: { position: 'absolute', right: 12, zIndex: 1 },
  searchInput: {
    paddingLeft: 36,
    paddingRight: 40,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 8,
    fontSize: 12,
    color: '#111827',
  },

  listBody: { paddingBottom: 4 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
    backgroundColor: '#FFFFFF',
  },
  productRowSelected: { backgroundColor: 'rgba(255,237,213,0.6)' },
  productThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productThumbImg: { width: '100%', height: '100%' },
  productInfo: { flex: 1, minWidth: 0 },
  productNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  productName: { fontSize: 10, fontWeight: '600', color: '#111827', maxWidth: 120 },
  channelBadge: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 999 },
  channelBadgeOnline: { backgroundColor: '#DCFCE7' },
  channelBadgePos: { backgroundColor: '#DBEAFE' },
  channelBadgeText: { fontSize: 7, fontWeight: '700' },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    flexWrap: 'nowrap',
  },
  productPrice: { fontSize: 9, fontWeight: '700', color: COLORS.brand },
  productMetaSeparator: { fontSize: 9, color: '#D1D5DB' },
  productStockRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  productStock: { fontSize: 9, fontWeight: '700', color: '#6B7280' },
  productStockLow: { color: '#EF4444' },
  productActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editBtn: {
    padding: 10,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
  },

  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  skeletonCheckbox: { width: 16, height: 16, borderRadius: 4, backgroundColor: '#F3F4F6' },
  skeletonThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F3F4F6' },
  skeletonLineWide: { width: 140, height: 12, borderRadius: 6, backgroundColor: '#F3F4F6' },
  skeletonLineNarrow: { width: 90, height: 10, borderRadius: 5, backgroundColor: '#F9FAFB' },

  emptyBox: { alignItems: 'center', padding: 48, gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  emptyText: { fontSize: 12, color: '#9CA3AF' },

  loadMoreWrap: {
    padding: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderRadius: 16,
  },
  loadMoreText: { fontSize: 14, fontWeight: '700', color: '#4B5563' },
  endWrap: { padding: 32, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  endText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    opacity: 0.5,
  },

  limitOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 300,
  },
  limitCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
  },
  limitIcon: {
    width: 80,
    height: 80,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    transform: [{ rotate: '3deg' }],
  },
  limitTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  limitText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 32,
  },
  limitStrong: { color: COLORS.brand, fontWeight: '600' },
  limitUnderlined: { fontWeight: '600', color: '#0F172A', textDecorationLine: 'underline' },
  limitPrimary: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: COLORS.brand,
    borderRadius: 16,
  },
  limitPrimaryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  limitSecondary: { paddingVertical: 12, marginTop: 4 },
  limitSecondaryText: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
});
