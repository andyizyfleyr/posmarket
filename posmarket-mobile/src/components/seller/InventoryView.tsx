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
  RefreshControl,
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
  Layers,
  Loader2,
  Monitor,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Upload,
  X,
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
  const [refreshing, setRefreshing] = useState(false);
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

  /** Tirer vers le bas pour recharger la 1re page de l'inventaire. */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshProducts();
    } finally {
      setRefreshing(false);
    }
  }, [refreshProducts]);

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

  /** Toutes les lignes affichées sont-elles sélectionnées ? */
  const allSelected =
    filteredProducts.length > 0 && selectedIds.length === filteredProducts.length;

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
      {/* ── Actions : création puis outils (fixes en haut) ── */}
        <View style={styles.actionsBlock}>
          {canManageInventory ? (
            <View style={styles.createRow}>
              <Pressable
                onPress={() => handleOpenModal(undefined, 'pos')}
                style={styles.posBtn}
                accessibilityLabel="Ajouter un produit Point de Vente uniquement"
              >
                <Monitor size={18} color="#FFFFFF" />
                <Text style={styles.createText}>+ POS</Text>
              </Pressable>
              <Pressable
                onPress={() => handleOpenModal(undefined, 'store')}
                style={styles.storeBtn}
                accessibilityLabel="Ajouter un produit en ligne (Marketplace + Point de Vente)"
              >
                <ShoppingBag size={18} color="#FFFFFF" />
                <Text style={styles.createText}>+ Store & POS</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.toolRow}>
            <Pressable
              onPress={() => setIsExportModalOpen(true)}
              style={styles.toolBtn}
              accessibilityLabel="Exporter vos produits"
            >
              <Download size={16} color="#4B5563" />
              <Text style={styles.toolText}>Exporter</Text>
            </Pressable>
            {canManageInventory ? (
              <>
                <Pressable
                  onPress={() => setIsImportModalOpen(true)}
                  style={styles.toolBtn}
                  accessibilityLabel="Importer des produits"
                >
                  <Upload size={16} color="#4B5563" />
                  <Text style={styles.toolText}>Importer</Text>
                </Pressable>
                <Pressable
                  onPress={() => setIsTransferModalOpen(true)}
                  style={styles.toolBtn}
                  accessibilityLabel="Transférer des produits"
                >
                  <ArrowRightLeft size={16} color="#2563EB" />
                  <Text style={[styles.toolText, { color: '#1D4ED8' }]}>Transférer</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>

        {/* ── Barre collante : sélection multiple ou recherche + filtre de canal ── */}
        <View style={styles.stickyWrap}>
          {selectedIds.length > 0 && canManageInventory ? (
            <View style={styles.selectionBar}>
              <View style={styles.selectionCount}>
                <Pressable
                  onPress={() => setSelectedIds([])}
                  style={styles.selectionClear}
                  accessibilityLabel="Annuler la sélection"
                >
                  <X size={14} color="#6B7280" />
                </Pressable>
                <Text style={styles.selectionText}>
                  {selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.selectionActions}>
                <Pressable
                  onPress={() => setIsExportModalOpen(true)}
                  style={styles.selectionBtn}
                  accessibilityLabel={`Exporter ${selectedIds.length} produits`}
                >
                  <Download size={16} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  onPress={() => setIsTransferModalOpen(true)}
                  style={styles.selectionBtn}
                  accessibilityLabel={`Transférer ${selectedIds.length} produits`}
                >
                  <ArrowRightLeft size={16} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  onPress={handleBulkDelete}
                  style={[styles.selectionBtn, styles.selectionBtnDanger]}
                  accessibilityLabel={`Supprimer ${selectedIds.length} produits`}
                >
                  <Trash2 size={14} color="#DC2626" />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.filterBlock}>
              {/* Recherche */}
              <View style={styles.searchWrap}>
                <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder="Rechercher un produit..."
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  style={styles.searchInput}
                />
                {isSearching || isLoadingMore ? (
                  <Loader2 size={18} color={COLORS.brand} style={styles.searchAccessory} />
                ) : searchTerm.length > 0 ? (
                  <Pressable
                    onPress={() => setSearchTerm('')}
                    style={styles.searchClear}
                    accessibilityLabel="Effacer la recherche"
                  >
                    <X size={16} color="#6B7280" />
                  </Pressable>
                ) : null}
              </View>

              {/* Filtre de canal */}
              <View style={styles.segmented}>
                {[
                  { id: 'all' as const, label: 'Mixte' },
                  { id: 'pos' as const, label: 'POS' },
                  { id: 'marketplace' as const, label: 'En ligne' },
                ].map((option) => {
                  const active = productType === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setProductType(option.id)}
                      style={[styles.segment, active && styles.segmentActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>
        {/* ── Liste ── */}
        <View style={styles.listCard}>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
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
          {isSearching && localProducts.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={`skel-${i}`} />)
          ) : filteredProducts.length === 0 ? (
            localProducts.length === 0 && !searchTerm ? (
              <View style={styles.emptyBox}>
                <View style={styles.emptyIcon}>
                  <Package size={30} color="#9CA3AF" />
                </View>
                <Text style={styles.emptyTitle}>Votre inventaire est vide</Text>
                <Text style={styles.emptyText}>
                  Ajoutez votre premier produit pour le vendre en boutique et en ligne.
                </Text>
                {canManageInventory ? (
                  <Pressable
                    onPress={() => handleOpenModal(undefined, 'pos')}
                    style={styles.emptyCta}
                  >
                    <Plus size={16} color="#FFFFFF" />
                    <Text style={styles.emptyCtaText}>Ajouter un produit</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <View style={styles.emptyIcon}>
                  <Search size={26} color="#9CA3AF" />
                </View>
                <Text style={styles.emptyTitle}>Aucun produit trouvé</Text>
                <Text style={styles.emptyText}>
                  Aucun produit ne correspond à « {searchTerm || 'ces filtres'} ».
                </Text>
                <Pressable
                  onPress={() => {
                    setSearchTerm('');
                    setProductType('all');
                    setSelectedVertical('all');
                  }}
                  style={styles.emptySecondaryCta}
                >
                  <Text style={styles.emptySecondaryCtaText}>Réinitialiser les filtres</Text>
                </Pressable>
              </View>
            )
          ) : (
            <>
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>
                  {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''}
                  {totalProductsCount > filteredProducts.length
                    ? ` sur ${totalProductsCount}`
                    : ''}
                </Text>
                <Pressable
                  onPress={() => setSelectedIds(allSelected ? [] : filteredProducts.map((p) => p.id))}
                  style={styles.selectAllBtn}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: allSelected }}
                  accessibilityLabel={allSelected ? 'Tout désélectionner' : 'Tout choisir'}
                >
                  <SellerCheckbox
                    checked={allSelected}
                    onToggle={() =>
                      setSelectedIds(allSelected ? [] : filteredProducts.map((p) => p.id))
                    }
                    size={18}
                  />
                  <Text style={styles.selectAllText}>
                    {allSelected ? 'Tout désélectionner' : 'Tout choisir'}
                  </Text>
                </Pressable>
              </View>

              {filteredProducts.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  selected={selectedIds.includes(product.id)}
                  canManage={canManageInventory}
                  onToggle={() => toggleSelect(product.id)}
                  onOpen={() => handleOpenModal(product)}
                />
              ))}
            </>
          )}

          {/* Pagination */}
          {filteredProducts.length > 0 && hasMore ? (
            <View style={styles.loadMoreWrap}>
              <Pressable
                onPress={handleLoadMore}
                disabled={isLoadingMore}
                style={[styles.loadMoreBtn, isLoadingMore && { opacity: 0.6 }]}
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

          {filteredProducts.length > 0 && !hasMore ? (
            <View style={styles.endWrap}>
              <Text style={styles.endText}>
                Fin de l&apos;inventaire · {totalProductsCount} produit
                {totalProductsCount > 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}
          </ScrollView>
        </View>

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
              <Text style={styles.limitStrong}>{maxProducts} produits</Text> pour votre
              abonnement actuel. Passez à la formule{' '}
              <Text style={styles.limitUnderlined}>Pro</Text> pour continuer à développer
              votre inventaire.
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

/* ── Ligne produit ────────────────────────────────────────────────── */

function ProductRow({
  product,
  selected,
  canManage,
  onToggle,
  onOpen,
}: {
  product: Product;
  selected: boolean;
  canManage: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  // Même règle que le POS : un produit à variantes est stocké par variante.
  const stock =
    variants.length > 0
      ? variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0)
      : Number(product.stock) || 0;
  const online = product.isOnline !== false;
  const stockTone = stock === 0 ? 'out' : stock <= 10 ? 'low' : 'ok';

  return (
    <Pressable
      onPress={canManage ? onOpen : undefined}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && canManage ? styles.rowPressed : null,
      ]}
    >
      <Pressable
        onPress={onToggle}
        style={styles.checkboxHit}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`Sélectionner ${product.name}`}
      >
        <SellerCheckbox checked={selected} onToggle={onToggle} size={22} />
      </Pressable>

      <View style={styles.rowThumb}>
        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.rowThumbImg} contentFit="cover" />
        ) : (
          <ImageIcon size={20} color="#9CA3AF" />
        )}
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={styles.rowPrice}>{formatCurrency(product.price)}</Text>
          <View
            style={[
              styles.stockPill,
              stockTone === 'out'
                ? styles.stockPillOut
                : stockTone === 'low'
                  ? styles.stockPillLow
                  : styles.stockPillOk,
            ]}
          >
            {stock === 0 ? <AlertCircle size={10} color="#DC2626" /> : null}
            <Text style={styles.stockPillText}>
              {stock} {product.unit}
            </Text>
          </View>
        </View>
        {variants.length > 0 ? (
          <View style={styles.rowVariantsRow}>
            <Layers size={10} color="#9CA3AF" />
            <Text style={styles.rowVariantsText}>
              {variants.length} variante{variants.length > 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.rowRight}>
        <View style={[styles.channelBadge, online ? styles.channelBadgeOnline : styles.channelBadgePos]}>
          <Text style={[styles.channelBadgeText, { color: online ? '#15803D' : '#1D4ED8' }]}>
            {online ? 'MAR.' : 'POS'}
          </Text>
        </View>
        {canManage ? (
          <Pressable
            onPress={onOpen}
            style={styles.editBtn}
            hitSlop={6}
            accessibilityLabel={`Modifier ${product.name}`}
          >
            <Edit size={16} color={COLORS.brand} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

/* ── Squelette de chargement ──────────────────────────────────────── */

function SkeletonRow() {
  return (
    <View style={styles.skeletonRow}>
      <View style={styles.skeletonBox} />
      <View style={styles.skeletonThumb} />
      <View style={styles.skeletonBody}>
        <View style={styles.skeletonLineWide} />
        <View style={styles.skeletonLineShort} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FDFDFE', paddingHorizontal: 12, paddingTop: 12 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  list: { flex: 1 },
  listContent: { flexGrow: 1, paddingBottom: 24 },

  /* Barre collante (tailles alignées sur la page Commandes) */
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
  filterBlock: { gap: 8 },
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

  segmented: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 10, fontWeight: '700', color: '#9CA3AF' },
  segmentTextActive: { color: '#111827' },

  /* Barre de sélection (mêmes proportions que la barre groupée de Commandes) */
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  selectionCount: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectionClear: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionText: { color: '#6B7280', fontSize: 10, fontWeight: '600' },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F56B2A',
  },
  selectionBtnDanger: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2' },

  /* Actions */
  actionsBlock: { paddingTop: 2, gap: 8 },
  toolRow: { flexDirection: 'row', gap: 6 },
  toolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  toolText: { fontSize: 11, fontWeight: '700', color: '#4B5563' },
  createRow: { flexDirection: 'row', gap: 8 },
  posBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#2563EB',
  },
  storeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.brand,
    shadowColor: COLORS.brand,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  createText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  /* Liste */
  listCard: {
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
  listHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  listHeaderText: { fontSize: 10, fontWeight: '600', color: '#6B7280' },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectAllText: { fontSize: 10, fontWeight: '600', color: '#6B7280' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  rowSelected: { backgroundColor: 'rgba(255,247,237,0.3)' },
  rowPressed: { backgroundColor: '#F9FAFB' },
  checkboxHit: { width: 26, alignItems: 'center' },
  rowThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowThumbImg: { width: '100%', height: '100%' },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  rowName: { fontSize: 11, fontWeight: '700', color: '#111827' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowPrice: { fontSize: 11, fontWeight: '700', color: COLORS.brand },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  stockPillOk: { backgroundColor: '#F0FDF4' },
  stockPillLow: { backgroundColor: '#FFFBEB' },
  stockPillOut: { backgroundColor: '#FEF2F2' },
  stockPillText: { fontSize: 9, fontWeight: '600', color: '#6B7280' },
  rowVariantsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rowVariantsText: { fontSize: 9, fontWeight: '600', color: '#9CA3AF' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  channelBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  channelBadgeOnline: { backgroundColor: '#DBEAFE' },
  channelBadgePos: { backgroundColor: '#F3F4F6' },
  channelBadgeText: { fontSize: 7, fontWeight: '700', letterSpacing: 0.7 },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
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
  skeletonBox: { width: 20, height: 20, borderRadius: 6, backgroundColor: '#F3F4F6' },
  skeletonThumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#F3F4F6' },
  skeletonBody: { flex: 1, gap: 6 },
  skeletonLineWide: { width: '65%', height: 10, borderRadius: 5, backgroundColor: '#F3F4F6' },
  skeletonLineShort: { width: '35%', height: 8, borderRadius: 4, backgroundColor: '#F9FAFB' },

  /* États vides */
  emptyBox: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 40, gap: 8 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  emptyText: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 16 },
  emptyCta: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.brand,
  },
  emptyCtaText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  emptySecondaryCta: { marginTop: 6, paddingHorizontal: 12, paddingVertical: 8 },
  emptySecondaryCtaText: { fontSize: 11, fontWeight: '700', color: COLORS.brand },

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
  endWrap: {
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  endText: { fontSize: 9, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 },

  /* Modale de limite */
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
    padding: 28,
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
    marginBottom: 20,
  },
  limitTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  limitText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  limitStrong: { color: COLORS.brand, fontWeight: '700' },
  limitUnderlined: { fontWeight: '700', color: '#0F172A', textDecorationLine: 'underline' },
  limitPrimary: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    backgroundColor: COLORS.brand,
    borderRadius: 16,
  },
  limitPrimaryText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  limitSecondary: { paddingVertical: 12, marginTop: 4 },
  limitSecondaryText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
});
