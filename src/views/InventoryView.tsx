'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Package,
  Search,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  ArrowRightLeft,
  AlertCircle,
  List,
  LayoutGrid,
  X,
  Image as ImageIcon,
  Globe,
  Monitor,
  Tag,
  DollarSign,
  Check,
  ChevronRight,
  ChevronLeft,
  ShoppingBag,
  Star,
  Loader2,
  Award,
  Zap,
  Clock,
  Layers,
  Sparkles,
  Info,
  CheckCircle2
} from 'lucide-react';
import { getSubscriptionPlan, MAIN_CATEGORIES, CATEGORY_MAPPING } from '@/constants';
import { getProductCategoryTree } from '@/app/actions/categories';
import type { ProductCategoryNode } from '@/app/actions/categories';
import { Product, StaffPermissions, StaffRole, UserSubscription, BusinessVertical } from '@/types';
import { formatCurrency, formatNumber } from '@/utils';
import { Skeleton, ProductSkeleton } from '../components/Skeleton';
import ProductImage from '../components/ProductImage';
import Button from '../components/Button';
import { saveProductAction, deleteProductAction, bulkDeleteProductsAction, getProductsAction } from '@/app/actions/inventory';
import { optimizeImage, fileToBase64 } from '@/utils/image-optimization';
import VariantMatrixEditor from '@/components/inventory/VariantMatrixEditor';
import ExportProductsModal from '@/components/inventory/ExportProductsModal';
import ImportProductsModal from '@/components/inventory/ImportProductsModal';
import TransferProductsModal from '@/components/inventory/TransferProductsModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import {
  normalizeOptions,
  normalizeVariants,
  type ProductOptionDef,
  type ProductVariantDef,
} from '@/utils/variants';

interface InventoryViewProps {
  products: Product[];
  permissions: StaffPermissions;
  currentStoreId?: string;
  userRole?: StaffRole;
  subscription?: UserSubscription;
  businessType?: BusinessVertical;
  storeName?: string;
}

const InventoryView: React.FC<InventoryViewProps> = ({
  products: initialProducts,
  permissions,
  currentStoreId,
  subscription,
  businessType = 'shopping',
  storeName = 'Boutique',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewType, setViewType] = useState<'grid' | 'table'>('table');
  const [productType, setProductType] = useState<'all' | 'pos' | 'marketplace'>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedVertical, setSelectedVertical] = useState<'all' | 'shopping' | 'food'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [_variantNotice, setVariantNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Taxonomie produit : lue en base (geree depuis /pam/categories), avec
  // repli sur les constantes historiques si la table est vide ou inaccessible.
  const [categoryTree, setCategoryTree] = useState<ProductCategoryNode[]>([]);
  const [useLiveCategories, setUseLiveCategories] = useState(false);

  useEffect(() => {
    let active = true;
    // La taxonomie dépend de la verticale : un resto ne doit voir que les
    // catégories de restauration, un shop seulement celles du commerce.
    getProductCategoryTree(businessType)
      .then((tree) => {
        if (active && tree.length > 0) {
          setCategoryTree(tree);
          setUseLiveCategories(true);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [businessType]);

  // Pagination states
  const [localProducts, setLocalProducts] = useState<Product[]>(initialProducts || []);
  const [offset, setOffset] = useState(initialProducts?.length || 0);
  const [hasMore, setHasMore] = useState(initialProducts?.length === 10); // Assume more if we got a full first page
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);

  // Modals state for export, import, transfer
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [totalProductsCount, setTotalProductsCount] = useState(initialProducts?.length || 0);

  // Sync local state when props change (after server re-render)
  useEffect(() => {
    setLocalProducts(initialProducts || []);
    setOffset(initialProducts?.length || 0);
    setHasMore(initialProducts?.length === 10);
    if (initialProducts?.length) {
      setTotalProductsCount((prev) => Math.max(prev, initialProducts.length));
    }
  }, [initialProducts]);

  const [formData, setFormData] = useState<Partial<Product> & { isOnline: boolean, images: string[] }>({
    name: '',
    price: undefined,
    stock: undefined,
    category: 'Général',
    mainCategory: 'Divers',
    image: '',
    images: [],
    unit: 'pièce',
    isOnline: true,
    wholesalePrice: undefined,
    wholesaleMinQty: undefined,
    deliveryTime: '',
    preparationTime: '',
    businessType: businessType || 'shopping',
    options: [],
    variants: []
  });

  const filteredMainCategories = useMemo(() => {
    if (useLiveCategories) {
      return categoryTree
        .filter((n) => (businessType === 'food' ? n.businessType === 'food' : n.businessType !== 'food'))
        .map((n) => n.name);
    }
    if (businessType === 'food') return ['Restauration & Livraison Rapide'];
    return MAIN_CATEGORIES.filter(
      (c) => c !== 'Restauration & Livraison Rapide' && c !== 'Séjours, Expériences & Immobilier' && c !== 'Produits Digitaux & Services'
    );
  }, [businessType, categoryTree, useLiveCategories]);

  const filteredCategoryMapping = useMemo(() => {
    if (useLiveCategories) {
      const mapping: Record<string, string> = {};
      categoryTree.forEach((parent) => {
        parent.children.forEach((child) => {
          mapping[child.name] = parent.name;
        });
      });
      return mapping;
    }
    const mapping: Record<string, string> = {};
    Object.entries(CATEGORY_MAPPING).forEach(([sub, main]) => {
      if (filteredMainCategories.includes(main)) {
        mapping[sub] = main;
      }
    });
    return mapping;
  }, [filteredMainCategories, categoryTree, useLiveCategories]);

  const filteredProducts = useMemo(() => {
    return localProducts.filter(p => {
      // Filter by Channel
      const channelMatch = productType === 'all' ||
        (productType === 'pos' && p.isOnline === false) ||
        (productType === 'marketplace' && p.isOnline !== false);

      if (!channelMatch) return false;

      // Filter by Vertical
      const mainCat = p.mainCategory || '';
      const isFood = p.businessType === 'food' || mainCat.includes('Resto') || mainCat.includes('Alimentation');
      
      // Final categorization to prevent overlaps
      const actualVertical = isFood ? 'food' : 'shopping';

      if (selectedVertical === 'all') return true;
      return selectedVertical === actualVertical;
    });
  }, [localProducts, productType, selectedVertical]);

  const refreshProducts = useCallback(async () => {
    if (!currentStoreId) return;
    setIsLoadingMore(true);
    const res = await getProductsAction(currentStoreId, 0, 10, searchTerm, {
      productType,
      businessType: selectedVertical as 'all' | 'shopping' | 'food'
    });
    if (res.success && res.products) {
      setLocalProducts(res.products as unknown as Product[]);
      setOffset(res.products.length);
      setHasMore(res.hasMore || false);
      if (typeof res.total === 'number') {
        setTotalProductsCount(res.total);
      }
    }
    setIsLoadingMore(false);
  }, [currentStoreId, searchTerm, productType, selectedVertical]);

  const handleImportSuccess = (summary: { createdCount: number; updatedCount: number; skippedCount: number }) => {
    setShowSuccessToast(`Import terminé : ${summary.createdCount} crés, ${summary.updatedCount} mis à jour, ${summary.skippedCount} ignorés.`);
    setTimeout(() => setShowSuccessToast(null), 4500);
    refreshProducts();
  };

  const handleTransferSuccess = (summary: { createdCount: number; updatedCount: number; skippedCount: number }) => {
    setShowSuccessToast(`Transfert terminé : ${summary.createdCount} crés, ${summary.updatedCount} mis à jour.`);
    setTimeout(() => setShowSuccessToast(null), 4500);
  };

  // Handle Search with debounce or simple effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      setIsLoadingMore(true);
      const res = await getProductsAction(currentStoreId || '', 0, 10, searchTerm, { 
        productType,
        businessType: selectedVertical as 'all' | 'shopping' | 'food'
      });
      if (res.success) {
        setLocalProducts(res.products as unknown as Product[]);
        setOffset(res.products?.length || 0);
        setHasMore(res.hasMore || false);
        if (typeof res.total === 'number') {
          setTotalProductsCount(res.total);
        }
      }
      setIsLoadingMore(false);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, currentStoreId, productType, selectedVertical]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const res = await getProductsAction(currentStoreId || '', offset, 10, searchTerm, { 
      productType,
      businessType: selectedVertical as 'all' | 'shopping' | 'food'
    });
    if (res.success && res.products) {
      setLocalProducts(prev => [...prev, ...(res.products as unknown as Product[])]);
      setOffset(prev => prev + (res.products?.length || 0));
      setHasMore(res.hasMore || false);
    }
    setIsLoadingMore(false);
  };

  const handleOpenModal = (product?: Product, type?: 'pos' | 'store') => {
    // Check product limits for non-edit mode
    if (!product && subscription) {
      const plan = getSubscriptionPlan(subscription.tier);
      const maxProducts = plan?.features.maxProducts || 6;
      if (localProducts.length >= maxProducts) {
        setShowLimitModal(true);
        return;
      }
    }

    if (product) {
      setEditingProduct(product);
      setCurrentStep(1);
      setVariantNotice(null);
      setSubmitError(null);
      // Nettoyage à l'ouverture : SKU et photo par variante sont conservés,
      // les orphelines sont écartées pour ne jamais casser la matrice.
      const safeOptions = normalizeOptions(product.options);
      const safeVariants = normalizeVariants(product.variants, safeOptions);
      const initialFormData: Partial<Product> & { isOnline: boolean, images: string[] } = {
        name: product.name || '',
        price: product.price ?? undefined,
        stock: product.stock ?? undefined,
        category: product.category || 'Général',
        mainCategory: product.mainCategory || CATEGORY_MAPPING[product.category || ''] || 'Divers',
        image: product.image || '',
        images: (Array.isArray(product.images) && product.images.length > 0)
          ? product.images
          : (product.image ? [product.image] : []),
        unit: product.unit || 'pièce',
        description: product.description || '',
        isOnline: product.isOnline ?? true,
        wholesalePrice: product.wholesalePrice,
        wholesaleMinQty: product.wholesaleMinQty,
        wholesaleTiers: product.wholesaleTiers && product.wholesaleTiers.length > 0
          ? product.wholesaleTiers
          : (product.wholesalePrice && product.wholesaleMinQty ? [{ minQty: Number(product.wholesaleMinQty), price: Number(product.wholesalePrice) }] : []),
        deliveryTime: product.deliveryTime || '',
        preparationTime: product.preparationTime || '',
        // La verticale vient de la boutique, jamais du produit : c'est elle qui
        // decide des libelles (section « Vente en gros », categories). Le
        // serveur impose de toute facon le type de la boutique a l'ecriture.
        businessType,
        options: safeOptions,
        variants: safeVariants
      };
      setFormData(initialFormData);
    } else {
      setEditingProduct(null);
      setVariantNotice(null);
      setSubmitError(null);
      const isOnline = type === 'store';
      setFormData({
        name: '',
        price: undefined,
        stock: undefined,
        category: businessType === 'food' ? 'Plats Cuisinés' : 'Général',
        mainCategory: businessType === 'food' ? 'Restauration & Livraison Rapide' : 'Divers',
        image: '',
        images: [],
        unit: 'pièce',
        description: '',
        isOnline: isOnline,
        wholesalePrice: undefined,
        wholesaleMinQty: undefined,
        wholesaleTiers: [],
        deliveryTime: '',
        preparationTime: '',
        businessType: businessType,
        options: [],
        variants: []
      });

      setCurrentStep(1);
    }
    setIsModalOpen(true);
  };

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
  });

  const handleDelete = (id: string, name?: string) => {
    setDeleteConfirmation({
      isOpen: true,
      title: 'Supprimer ce produit ?',
      message: `Êtes-vous sûr de vouloir supprimer définitivement ${name ? `"${name}"` : 'ce produit'} ? Cette action est irréversible.`,
      onConfirm: async () => {
        setIsSubmitting(true);
        try {
          const result = await deleteProductAction(id, currentStoreId || '');
          if (result.success) {
            setLocalProducts(prev => prev.filter(p => p.id !== id));
            setSelectedIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            setShowSuccessToast('Produit supprimé avec succès.');
            setTimeout(() => setShowSuccessToast(null), 3000);
          }
        } finally {
          setIsSubmitting(false);
          setDeleteConfirmation(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    setDeleteConfirmation({
      isOpen: true,
      title: `Supprimer ${count} produit${count > 1 ? 's' : ''} ?`,
      message: `Êtes-vous sûr de vouloir supprimer définitivement les ${count} produits sélectionnés ? Cette action est irréversible.`,
      onConfirm: async () => {
        setIsSubmitting(true);
        try {
          const result = await bulkDeleteProductsAction(Array.from(selectedIds), currentStoreId || '');
          if (result.success) {
            setLocalProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
            setSelectedIds(new Set());
            setShowSuccessToast(`${count} produit${count > 1 ? 's' : ''} supprimé${count > 1 ? 's' : ''} avec succès.`);
            setTimeout(() => setShowSuccessToast(null), 3000);
          }
        } finally {
          setIsSubmitting(false);
          setDeleteConfirmation(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await saveProductAction(editingProduct ? { ...editingProduct, ...formData } : formData, currentStoreId || '');
      if (result.success && result.product) {
        const saved = { ...result.product, price: Number(result.product.price) || 0, originalPrice: result.product.originalPrice ? Number(result.product.originalPrice) : undefined } as unknown as Product;
        setLocalProducts(prev => {
          if (editingProduct?.id) {
            return prev.map(p => p.id === editingProduct.id ? { ...p, ...saved, id: p.id } : p);
          }
          return [saved, ...prev];
        });
        const warning = Array.isArray(result.warnings) ? result.warnings[0] : null;
        setShowSuccessToast(warning || (editingProduct ? 'Produit mis à jour avec succès !' : 'Produit ajouté avec succès !'));
        setTimeout(() => setShowSuccessToast(null), 3000);
        setIsModalOpen(false);
      } else if (result.success) {
        setShowSuccessToast(editingProduct ? 'Produit mis à jour avec succès !' : 'Produit ajouté avec succès !');
        setTimeout(() => setShowSuccessToast(null), 3000);
        setIsModalOpen(false);
      } else {
        setSubmitError(result.error || 'Impossible d\'enregistrer le produit');
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-grow overflow-hidden flex flex-col p-3 md:p-8 bg-gray-50/30 relative">
      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-[200] bg-green-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-white/20 p-1 rounded-full">
            <Check size={20} />
          </div>
          <span className="font-bold text-sm">{showSuccessToast}</span>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && permissions.canManageInventory && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-auto max-w-[95vw] animate-in fade-in slide-in-from-bottom-6 duration-300">
          <div className="bg-slate-900/95 text-white backdrop-blur-xl px-4 py-2.5 md:px-5 md:py-3 rounded-2xl md:rounded-3xl shadow-2xl ring-1 ring-white/15 flex items-center gap-2 md:gap-4 flex-wrap sm:flex-nowrap">
            {/* Selection info & Clear */}
            <div className="flex items-center gap-2 pr-2 border-r border-white/10">
              <div className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center text-xs font-black">
                {selectedIds.size}
              </div>
              <span className="text-xs font-bold text-slate-200 hidden sm:inline">
                sélectionné{selectedIds.size > 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="Désélectionner tout"
              >
                <X size={14} />
              </button>
            </div>

            {/* Bulk actions */}
            <div className="flex items-center gap-1.5 md:gap-2">
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
              >
                <Download size={14} className="text-orange-400" />
                <span>Exporter ({selectedIds.size})</span>
              </button>

              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
              >
                <ArrowRightLeft size={14} className="text-blue-400" />
                <span>Transférer ({selectedIds.size})</span>
              </button>

              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 border border-red-500/30 rounded-xl text-xs font-bold transition-all"
              >
                <Trash2 size={14} />
                <span>Supprimer ({selectedIds.size})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 md:mb-6 gap-3 md:gap-4">
        {/* Left: Title + Badges */}
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight truncate">
                Inventaire
              </h1>
              <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
                businessType === 'food' ? 'bg-amber-100 text-amber-800' : 'bg-orange-100 text-brand'
              }`}>
                Flux {businessType === 'food' ? 'Resto' : 'Shop'}
              </span>
              <span className="text-xs text-gray-400 font-medium hidden sm:inline">
                • {totalProductsCount} référence{totalProductsCount > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-gray-500 text-xs mt-0.5 hidden sm:block">
              Gérez vos produits, vos stocks et vos transferts inter-boutiques.
            </p>
          </div>
        </div>

        {/* Right: Clean, Structured Action Group */}
        <div className="flex items-center gap-2 md:gap-3 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
          {/* Catalogue Actions (Export / Import / Transfer) */}
          <div className="flex items-center bg-white border border-gray-200/80 p-1 rounded-2xl shadow-sm">
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 md:py-2 text-xs font-bold text-gray-700 hover:text-gray-900 hover:bg-gray-100/80 rounded-xl transition-all"
              title="Exporter vos produits au format JSON ou CSV"
            >
              <Download size={14} className="text-gray-500" />
              <span>Exporter</span>
            </button>

            {permissions.canManageInventory && (
              <>
                <div className="h-4 w-px bg-gray-200 my-auto" />
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 md:py-2 text-xs font-bold text-gray-700 hover:text-gray-900 hover:bg-gray-100/80 rounded-xl transition-all"
                  title="Importer des produits depuis un fichier CSV ou JSON"
                >
                  <Upload size={14} className="text-gray-500" />
                  <span>Importer</span>
                </button>

                <div className="h-4 w-px bg-gray-200 my-auto" />
                <button
                  onClick={() => setIsTransferModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 md:py-2 text-xs font-bold text-blue-700 hover:text-blue-900 hover:bg-blue-50/80 rounded-xl transition-all"
                  title="Copier ou transférer vers une autre boutique"
                >
                  <ArrowRightLeft size={14} className="text-blue-600" />
                  <span>Transférer</span>
                </button>
              </>
            )}
          </div>

          {/* Create Product Buttons */}
          {permissions.canManageInventory && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenModal(undefined, 'pos')}
                className="flex items-center gap-1.5 px-3.5 py-2 md:px-4 md:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs md:text-sm font-bold transition-all shadow-md shadow-blue-100 active:scale-95 whitespace-nowrap"
                title="Ajouter un produit Point de Vente uniquement"
              >
                <Monitor size={15} />
                <span>+ POS</span>
              </button>
              <button
                onClick={() => handleOpenModal(undefined, 'store')}
                className="flex items-center gap-1.5 px-3.5 py-2 md:px-4 md:py-2.5 bg-brand hover:bg-[#d55a20] text-white rounded-2xl text-xs md:text-sm font-bold transition-all shadow-md shadow-orange-100 active:scale-95 whitespace-nowrap"
                title="Ajouter un produit en ligne (Marketplace + Point de Vente)"
              >
                <ShoppingBag size={15} />
                <span>+ Store & POS</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl shadow-sm flex-grow overflow-hidden flex flex-col">
        {/* Verticals Tabs - The core request separator */}
        <div className="px-3 md:px-4 pt-4 md:pt-6 pb-0 flex flex-col gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'all', label: 'Tous les flux', icon: Package, color: 'gray', border: 'border-gray-500', text: 'text-gray-600', shadow: 'shadow-gray-100' },
              { id: 'shopping', label: 'Shop', icon: ShoppingBag, color: 'orange', border: 'border-orange-500', text: 'text-orange-600', shadow: 'shadow-orange-100' },
              { id: 'food', label: 'Resto', icon: Zap, color: 'yellow', border: 'border-yellow-500', text: 'text-yellow-600', shadow: 'shadow-yellow-100' },
            ].filter(v => v.id === 'all' || v.id === businessType).map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedVertical(v.id as 'all' | 'shopping' | 'food')}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition-all whitespace-nowrap border-2
                  ${selectedVertical === v.id
                    ? `bg-white ${v.border} ${v.text} shadow-lg ${v.shadow}`
                    : 'bg-white border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'}
                `}
              >
                <v.icon size={16} />
                {v.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 bg-gray-100 p-0.5 md:p-1 rounded-lg md:rounded-xl w-fit">
            <button
              onClick={() => setProductType('all')}
              className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-6 md:py-2 rounded-md md:rounded-lg text-[10px] md:text-xs font-semibold transition-all whitespace-nowrap ${productType === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Mode Mixte
            </button>
            <button
              onClick={() => setProductType('pos')}
              className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-6 md:py-2 rounded-md md:rounded-lg text-[10px] md:text-xs font-semibold transition-all whitespace-nowrap ${productType === 'pos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              POS Uniquement
            </button>
            <button
              onClick={() => setProductType('marketplace')}
              className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-6 md:py-2 rounded-md md:rounded-lg text-[10px] md:text-xs font-semibold transition-all whitespace-nowrap ${productType === 'marketplace' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              En ligne (Store)
            </button>
          </div>
        </div>

        <div className="p-3 md:p-4 border-b border-gray-100 flex items-center justify-between gap-3 md:gap-4">
          <div className="relative flex-grow max-w-md">
            <Search size={16} className="absolute left-3 top-2.5 md:top-3 text-gray-400 md:w-[18px] md:h-[18px]" />
            <input
              type="text"
              value={searchTerm}
              placeholder="Rechercher..."
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2 md:py-2.5 bg-gray-50 border border-gray-100 rounded-lg md:rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div className="hidden md:flex items-center border border-gray-100 rounded-xl p-1 bg-gray-50">
            <button
              onClick={() => setViewType('table')}
              className={`p-1.5 rounded-lg transition-all ${viewType === 'table' ? 'bg-white shadow-sm text-brand' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewType('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewType === 'grid' ? 'bg-white shadow-sm text-brand' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-grow custom-scrollbar">
          {viewType === 'table' ? (
            <div className="block md:table w-full">
              <div className="hidden md:table-header-group bg-gray-50/80 backdrop-blur text-gray-400 uppercase text-[10px] font-semibold tracking-widest sticky top-0 z-10">
                <div className="table-row">
                  <div className="table-cell px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                      checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                      onChange={toggleSelectAll}
                    />
                  </div>
                  <div className="table-cell px-4 py-3">Produit</div>
                  <div className="table-cell px-4 py-3">Type</div>
                  <div className="table-cell px-4 py-3">Catégorie</div>
                  <div className="table-cell px-4 py-3">Prix</div>
                  <div className="table-cell px-4 py-3">Stock</div>
                  <div className="table-cell px-4 py-3">Avis</div>
                  <div className="table-cell px-4 py-3 text-right">Actions</div>
                </div>
              </div>
              <div className="block md:table-row-group divide-y divide-gray-100">
                {isLoadingMore && localProducts.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={`skel-${i}`} className="table-row">
                      <div className="table-cell px-4 py-3"><Skeleton className="h-4 w-4" /></div>
                      <div className="table-cell px-4 py-3"><Skeleton className="h-10 w-40" /></div>
                      <div className="table-cell px-4 py-3"><Skeleton className="h-6 w-20" /></div>
                      <div className="table-cell px-4 py-3"><Skeleton className="h-6 w-24" /></div>
                      <div className="table-cell px-4 py-3"><Skeleton className="h-6 w-16" /></div>
                      <div className="table-cell px-4 py-3"><Skeleton className="h-6 w-16" /></div>
                      <div className="table-cell px-4 py-3"><Skeleton className="h-6 w-20" /></div>
                      <div className="table-cell px-4 py-3 text-right"><Skeleton className="h-8 w-16 ml-auto" /></div>
                    </div>
                  ))
                ) : filteredProducts.map(product => (
                  <div key={product.id} className={`block md:table-row transition-colors group ${selectedIds.has(product.id) ? 'bg-orange-50/60' : 'hover:bg-orange-50/10'}`}>
                    <div className="hidden md:table-cell px-4 py-2.5 w-10">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                      />
                    </div>
                    <div className="block md:table-cell px-2 md:px-4 py-1.5 md:py-2.5">
                      <div className="flex items-center justify-between gap-2 md:gap-3">
                        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-grow">
                          <div className="md:hidden">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                              checked={selectedIds.has(product.id)}
                              onChange={() => toggleSelect(product.id)}
                            />
                          </div>
                          <div className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0">
                            <ProductImage
                              src={product.image}
                              alt={product.name}
                              containerClassName="rounded-md md:rounded-lg border border-gray-100 shadow-sm"
                              showZoomEffect={false}
                            />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 md:gap-2">
                              <span className="font-semibold text-[10px] md:text-sm text-gray-900 truncate whitespace-nowrap max-w-[120px] md:max-w-[250px] inline-block">{product.name}</span>
                              <span className={`text-[7px] md:text-[8px] font-bold px-1 md:px-1.5 py-0 md:py-0.5 rounded-full whitespace-nowrap ${product.isOnline !== false ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                {product.isOnline !== false ? 'MAR.' : 'POS'}
                              </span>
                            </div>
                            <div className="flex md:hidden items-center gap-2 mt-0.5 whitespace-nowrap">
                              <span className="text-[9px] font-bold text-brand">
                                {formatCurrency(product.price)}
                              </span>
                              <span className="text-[9px] text-gray-300">|</span>
                              <div className="flex items-center gap-1">
                                <span className={`text-[9px] font-bold ${product.stock < 10 ? 'text-red-500' : 'text-gray-500'}`}>
                                  {product.stock} {product.unit}
                                </span>
                                {product.stock < 10 && <AlertCircle size={9} className="text-red-500" />}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions for Mobile - integrated in the same line */}
                        <div className="flex md:hidden items-center gap-2 flex-shrink-0">
                          {permissions.canManageInventory && (
                            <button
                              onClick={() => handleOpenModal(product)}
                              className="p-2.5 text-brand bg-orange-50 rounded-xl active:scale-90 shadow-sm"
                            >
                              <Edit size={16} />
                            </button>
                          )}
                          <ChevronRight size={18} className="text-gray-300" />
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:table-cell px-4 py-2.5">
                      <span className={`text-[8px] font-bold px-1.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 w-fit ${product.businessType === 'food' ? 'bg-yellow-100 text-yellow-700' :
                          product.isOnline !== false ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                        {product.businessType === 'food' ? <Clock size={8} /> : product.isOnline !== false ? <ShoppingBag size={8} /> : <Monitor size={8} />}
                        {product.businessType === 'food' ? 'Food' : product.isOnline !== false ? 'Marketplace' : 'POS'}
                      </span>
                    </div>

                    <div className="hidden md:table-cell px-4 py-2.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-lg uppercase tracking-wider">{product.category}</span>
                    </div>

                    <div className="hidden md:table-cell px-4 py-2.5">
                      <div className="flex flex-col">
                        <div className="text-xs font-bold text-brand">
                          {formatCurrency(product.price)}
                          {product.unit && product.unit !== 'pièce' && <span className="text-[10px] font-semibold text-gray-500 ml-1">/{product.unit}</span>}
                        </div>
                        {product.wholesalePrice && (
                          <div className="flex items-center gap-1 mt-0.5 whitespace-nowrap">
                            <Zap size={8} className="text-brand" fill="currentColor" />
                            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">
                              Gros: {formatCurrency(product.wholesalePrice)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="hidden md:table-cell px-4 py-2.5">
                      <div className="flex items-center gap-2">
                          <>
                            <span className={`text-xs font-bold ${product.stock < 10 ? 'text-red-500' : 'text-gray-700'}`}>{product.stock}</span>
                            {product.stock < 10 && <AlertCircle size={12} className="text-red-500" />}
                          </>
                      </div>
                    </div>

                    <div className="hidden md:table-cell px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <Star size={10} className={product.rating && product.rating > 0 ? "text-yellow-400 fill-current" : "text-gray-200"} />
                        <span className="text-xs font-bold text-gray-700">{product.rating ? product.rating.toFixed(1) : '—'}</span>
                        <span className="text-[9px] text-gray-400">({formatNumber(product.reviewCount || 0)})</span>
                      </div>
                    </div>

                    <div className="hidden md:table-cell px-4 py-2.5 text-right">
                      {permissions.canManageInventory && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(product)}
                            className="p-2.5 text-brand bg-orange-50 rounded-xl transition-all active:scale-90 hover:bg-orange-100"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-2.5 text-red-600 bg-red-50 rounded-xl transition-all active:scale-90 hover:bg-red-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 p-2">
              {isLoadingMore && localProducts.length === 0 ? (
                Array.from({ length: 12 }).map((_, i) => <ProductSkeleton key={`skel-grid-${i}`} />)
              ) : filteredProducts.map(product => (
                <div
                  key={product.id}
                  onClick={() => toggleSelect(product.id)}
                  className={`bg-white rounded-lg md:rounded-xl p-1.5 md:p-2 border shadow-sm hover:shadow-lg transition-all group relative flex flex-col min-w-0 cursor-pointer ${selectedIds.has(product.id) ? 'border-brand ring-2 ring-orange-100' : 'border-gray-100'}`}
                >
                  <div className="absolute top-1 left-1 z-20">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded border-gray-300 text-brand focus:ring-brand shadow-sm"
                      checked={selectedIds.has(product.id)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(product.id); }}
                    />
                  </div>
                  {permissions.canManageInventory && !selectedIds.has(product.id) && (
                    <div className="absolute top-1 right-1 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button onClick={(e) => { e.stopPropagation(); handleOpenModal(product); }} className="bg-white/90 backdrop-blur p-1 rounded-full shadow-md text-brand hover:bg-brand hover:text-white transition-colors"><Edit size={10} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }} className="bg-white/90 backdrop-blur p-1 rounded-full shadow-md text-red-600 hover:bg-red-600 hover:text-white transition-colors"><Trash2 size={10} /></button>
                    </div>
                  )}
                  <div className="aspect-square mb-1.5 md:mb-2 relative">
                    <ProductImage
                      src={product.image}
                      alt={product.name}
                      containerClassName="rounded-md md:rounded-lg border border-gray-50 bg-white"
                    />
                    <span className={`absolute bottom-1 right-1 text-[7px] md:text-[8px] font-bold px-1 md:px-1.5 py-0 md:py-0.5 rounded-full whitespace-nowrap ${product.isOnline !== false ? 'bg-green-100/90 text-green-600' : 'bg-blue-100/90 text-blue-600'}`}>
                      {product.isOnline !== false ? 'MAR.' : 'POS'}
                    </span>
                  </div>
                  <h4 className="font-semibold text-gray-900 text-[11px] md:text-sm truncate whitespace-nowrap w-full">{product.name}</h4>
                  <p className="text-[9px] text-gray-400 font-semibold mt-0.5 uppercase tracking-wider whitespace-nowrap">{product.category}</p>
                  <div className="flex justify-between items-center mt-auto pt-1.5 md:pt-2">
                    <span className="text-xs md:text-sm font-bold text-brand whitespace-nowrap">
                      {formatCurrency(product.price)}
                    </span>
                    <span className={`text-[8px] md:text-[9px] font-bold px-1 py-0.5 rounded-full whitespace-nowrap ${product.stock < 10 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{product.stock}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Load More */}
          {hasMore && (
            <div className="p-6 md:p-10 flex justify-center border-t border-gray-100 bg-gray-50/10">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="flex items-center gap-2 px-8 py-3 bg-white border-2 border-gray-100 rounded-2xl shadow-sm text-sm font-bold text-gray-600 hover:text-brand hover:border-orange-100 transition-all active:scale-95 disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <Loader2 size={16} className="animate-spin text-brand" />
                ) : (
                  <Plus size={16} className="text-brand" />
                )}
                {isLoadingMore ? 'Chargement...' : 'Voir plus de produits'}
              </button>
            </div>
          )}

          {!hasMore && localProducts.length > 5 && (
            <div className="p-8 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest opacity-50 border-t border-gray-50 bg-gray-50/5">
              Fin de l&apos;inventaire
            </div>
          )}
        </div>
      </div>

      {/* Modal Produit (Step Form) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[28px] md:rounded-[32px] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-100">
            {/* Header with Step Indicator */}
            <div className="px-4 md:px-8 pt-4 md:pt-6 pb-4 md:pb-5 border-b border-gray-100 bg-white sticky top-0 z-20">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-orange-100 text-brand">
                      {editingProduct ? 'Modification' : 'Création'}
                    </span>
                    <span className="text-gray-400 text-xs font-semibold">
                      Étape {currentStep} sur 3
                    </span>
                  </div>
                  <h2 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight mt-1">
                    {editingProduct ? (editingProduct.name || 'Modifier le produit') : (formData.isOnline ? 'Nouveau produit (boutique)' : 'Nouveau produit (caisse)')}
                  </h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-full"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Step Progress Bar */}
              <div className="flex items-center justify-between relative px-2 md:px-6">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-100 -translate-y-1/2 z-0 mx-8 md:mx-14" />
                {[
                  { s: 1, icon: Package, label: '1. Identité & Médias' },
                  { s: 2, icon: DollarSign, label: '2. Tarifs & Stock' },
                  { s: 3, icon: Layers, label: '3. Variantes' }
                ].map((step) => {
                  const isActive = currentStep === step.s;
                  const isCompleted = currentStep > step.s;
                  return (
                    <button
                      key={step.s}
                      type="button"
                      onClick={() => {
                        // Allow clicking past or current steps, or next if current is valid
                        if (step.s < currentStep) {
                          setCurrentStep(step.s);
                          setSubmitError(null);
                        } else if (step.s === 2 && formData.name?.trim()) {
                          setCurrentStep(2);
                          setSubmitError(null);
                        } else if (step.s === 3 && formData.name?.trim() && formData.price !== undefined) {
                          setCurrentStep(3);
                          setSubmitError(null);
                        }
                      }}
                      className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none group cursor-pointer"
                    >
                      <div className={`
                        w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-300 font-bold
                        ${isActive ? 'bg-brand text-white shadow-lg shadow-orange-200 ring-4 ring-orange-50 scale-105' :
                          isCompleted ? 'bg-emerald-500 text-white shadow-xs' : 'bg-white border-2 border-gray-200 text-gray-400 group-hover:border-gray-300'}
                      `}>
                        {isCompleted ? <Check size={16} strokeWidth={3} className="md:size-5" /> : <step.icon size={16} className="md:size-5" />}
                      </div>
                      <span className={`text-[10px] md:text-xs font-bold whitespace-nowrap transition-colors ${isActive ? 'text-gray-900 font-extrabold' : isCompleted ? 'text-emerald-700' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-grow overflow-y-auto p-4 md:p-8 custom-scrollbar space-y-6">
              {/* ============================================================ */}
              {/* STEP 1: IDENTITÉ & MÉDIAS                                    */}
              {/* ============================================================ */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  {/* Nom du produit */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Package size={14} className="text-brand" />
                        Nom du Produit <span className="text-brand">*</span>
                      </label>
                      <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-full">Requis</span>
                    </div>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={e => {
                        setFormData({ ...formData, name: e.target.value });
                        if (submitError) setSubmitError(null);
                      }}
                      placeholder="Ex : T-shirt Oversize Bio, Burger Double Fromage, Robe d'été…"
                      className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-gray-50/80 border-2 border-gray-200 rounded-2xl text-sm md:text-base font-semibold text-gray-900 focus:bg-white focus:ring-4 focus:ring-orange-100 focus:border-brand transition-all outline-none placeholder:text-gray-400"
                    />
                  </div>

                  {/* Catégorie */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Tag size={14} className="text-brand" />
                      Catégorie & Rayon
                    </label>
                    <select
                      value={formData.category}
                      onChange={e => {
                        const newSub = e.target.value;
                        setFormData({
                          ...formData,
                          category: newSub,
                          mainCategory: filteredCategoryMapping[newSub] || filteredMainCategories[0] || 'Divers'
                        });
                      }}
                      className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-gray-50/80 border-2 border-gray-200 rounded-2xl text-sm font-semibold text-gray-900 focus:bg-white focus:ring-4 focus:ring-orange-100 focus:border-brand transition-all outline-none cursor-pointer"
                    >
                      {filteredMainCategories.map(mainCat => {
                        const subCats = Object.keys(filteredCategoryMapping).filter(sub => filteredCategoryMapping[sub] === mainCat);
                        if (subCats.length === 0) return <option key={mainCat} value={mainCat}>{mainCat}</option>;
                        return (
                          <optgroup key={mainCat} label={mainCat}>
                            {subCats.map(sub => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Description détaillée
                      </label>
                      <span className="text-[10px] text-gray-400 font-medium">Recommandé pour la boutique</span>
                    </div>
                    <textarea
                      value={formData.description || ''}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Décrivez votre produit : matière, caractéristiques, ingrédients, conseils d'utilisation…"
                      rows={3}
                      className="w-full px-4 md:px-5 py-3 bg-gray-50/80 border-2 border-gray-200 rounded-2xl text-sm text-gray-800 focus:bg-white focus:ring-4 focus:ring-orange-100 focus:border-brand transition-all outline-none resize-none placeholder:text-gray-400 leading-relaxed"
                    />
                  </div>

                  {/* Photos du produit */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon size={14} className="text-brand" />
                        Photos du Produit
                      </label>
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {(formData.images || []).length} photo{(formData.images || []).length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="p-4 bg-gray-50/70 border-2 border-dashed border-gray-200 rounded-2xl space-y-3">
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {(formData.images || []).map((img, idx) => (
                          <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-gray-200 bg-white shadow-xs">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt={`Image ${idx + 1} du produit`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                const newImages = formData.images.filter((_, i) => i !== idx);
                                setFormData({ ...formData, images: newImages, image: newImages[0] || '' });
                              }}
                              className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-lg opacity-90 md:opacity-0 group-hover:opacity-100 hover:scale-110 transition-all shadow-md"
                              title="Supprimer la photo"
                            >
                              <Trash2 size={12} />
                            </button>
                            {idx === 0 && (
                              <div className="absolute bottom-0 left-0 right-0 bg-brand text-[9px] text-white font-bold text-center py-0.5 tracking-wider uppercase">
                                Principale
                              </div>
                            )}
                          </div>
                        ))}
                        <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-orange-200 bg-orange-50/40 hover:bg-orange-50 rounded-xl transition-all cursor-pointer group hover:border-brand">
                          <div className="p-2 bg-white rounded-xl shadow-xs text-brand group-hover:scale-110 transition-transform">
                            <Plus size={18} strokeWidth={2.5} />
                          </div>
                          <span className="text-[9px] font-bold text-orange-950 mt-1.5 uppercase tracking-tight">Ajouter</span>
<input
    type="file"
    multiple
    accept="image/*"
    className="hidden"
    onChange={async (e) => {
      const files = Array.from(e.target.files || []) as File[];
      let added = 0;
      for (const file of files) {
if (formData.images.length >= 8) {
  setSubmitError("Vous ne pouvez pas ajouter plus de 8 images.");
  break;
}
        try {
          const optimizedFile = await optimizeImage(file);
          const base64 = await fileToBase64(optimizedFile);
          setFormData(prev => {
            const newImages = [...prev.images, base64];
            return {
              ...prev,
              images: newImages,
              image: prev.image || newImages[0]
            };
          });
          added++;
        } catch (err) {
          console.error("Erreur lors de l'optimisation:", err);
        }
      }
      if (added > 0) {
        setSubmitError(null);
      }
    }}
  />
                        </label>
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium flex items-center gap-1.5 pt-1">
                        <Info size={12} className="text-brand shrink-0" />
                        La première photo est l&apos;image principale. Vous pourrez aussi assigner des photos par variante à l&apos;étape 3.
                      </p>
                    </div>
                  </div>

                  {/* Canal & Visibilité */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50/70 to-amber-50/40 rounded-2xl border border-orange-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white transition-colors ${formData.isOnline ? 'bg-brand shadow-md shadow-orange-200' : 'bg-gray-400'}`}>
                        {formData.isOnline ? <Globe size={20} /> : <Monitor size={20} />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 leading-tight">
                          {formData.isOnline ? 'Publier sur la boutique en ligne' : 'Disponible uniquement en Caisse (POS)'}
                        </div>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                          {formData.isOnline ? 'Visible publiquement par vos clients sur votre catalogue web' : 'Usage interne : encaissement sur place uniquement'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isOnline: !formData.isOnline })}
                      className={`w-12 h-6 rounded-full transition-all duration-300 relative shadow-inner shrink-0 ${formData.isOnline ? 'bg-brand' : 'bg-gray-300'}`}
                      aria-label="Basculer la visibilité boutique"
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm ${formData.isOnline ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* STEP 2: TARIFS & STOCK                                       */}
              {/* ============================================================ */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  {/* Prix & Stock Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Tag size={14} className="text-brand" /> Prix de Vente <span className="text-brand">*</span>
                      </label>
                      <div className="relative">
                        <input
                          required
                          type="number"
                          value={formData.price ?? ''}
                          onChange={e => {
                            setFormData({ ...formData, price: e.target.value ? parseInt(e.target.value) || 0 : undefined });
                            if (submitError) setSubmitError(null);
                          }}
                          placeholder="0"
                          className="w-full pl-4 md:pl-5 pr-14 py-3 md:py-3.5 bg-gray-50/80 border-2 border-gray-200 rounded-2xl text-base md:text-lg font-black text-brand focus:bg-white focus:ring-4 focus:ring-orange-100 focus:border-brand transition-all outline-none"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs md:text-sm">XOF</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium">Prix de base unitaire standard</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Package size={14} className="text-brand" /> Stock Initial Disponible
                      </label>
                      <input
                        type="number"
                        value={formData.stock ?? ''}
                        onChange={e => setFormData({ ...formData, stock: e.target.value ? parseInt(e.target.value) || 0 : undefined })}
                        placeholder="0"
                        className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-gray-50/80 border-2 border-gray-200 rounded-2xl text-base md:text-lg font-bold text-gray-800 focus:bg-white focus:ring-4 focus:ring-orange-100 focus:border-brand transition-all outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1.5 font-medium">
                        {(formData.variants || []).length > 0
                          ? 'Des variantes existent : le stock total sera calculé depuis vos déclinaisons.'
                          : 'Quantité totale disponible en réserve ou rayon.'}
                      </p>
                    </div>
                  </div>

                  {/* Unité de vente */}
                  {formData.businessType === 'shopping' && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Tag size={14} className="text-brand" /> Unité de vente
                      </label>
                      <div className="space-y-3">
                        <select
                          value={['pièce', 'unité', 'paquet', 'carton', 'boîte', 'sac', 'bouteille', 'lot', 'douzaine', 'kg', 'g', 'tonne', 'L', 'ml', 'cl', 'm', 'cm', 'm²', 'nuitée', 'heure', 'jour', 'service', 'ticket'].includes(formData.unit || '') ? formData.unit : (formData.unit ? 'custom' : 'pièce')}
                          onChange={e => {
                            if (e.target.value === 'custom') {
                              setFormData({ ...formData, unit: '' });
                            } else {
                              setFormData({ ...formData, unit: e.target.value });
                            }
                          }}
                          className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-gray-50/80 border-2 border-gray-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-4 focus:ring-orange-100 focus:border-brand transition-all outline-none cursor-pointer"
                        >
                          <optgroup label="Standard">
                            <option value="pièce">Pièce</option>
                            <option value="unité">Unité (u)</option>
                            <option value="douzaine">Douzaine</option>
                            <option value="paquet">Paquet</option>
                            <option value="carton">Carton</option>
                            <option value="boîte">Boîte / Box</option>
                            <option value="sac">Sac</option>
                            <option value="bouteille">Bouteille</option>
                            <option value="lot">Lot</option>
                          </optgroup>
                          <optgroup label="Poids & Mesures">
                            <option value="kg">Kilogramme (kg)</option>
                            <option value="g">Gramme (g)</option>
                            <option value="L">Litre (L)</option>
                            <option value="m">Mètre (m)</option>
                            <option value="m²">Mètre Carré (m²)</option>
                          </optgroup>
                          <optgroup label="Services & Événements">
                            <option value="service">Service / Forfait</option>
                            <option value="ticket">Ticket / Entrée</option>
                            <option value="heure">Heure</option>
                            <option value="jour">Jour</option>
                          </optgroup>
                          <option value="custom">Autre (Saisie libre)...</option>
                        </select>

                        {(!['pièce', 'unité', 'paquet', 'carton', 'boîte', 'sac', 'bouteille', 'lot', 'douzaine', 'kg', 'g', 'tonne', 'L', 'ml', 'cl', 'm', 'cm', 'm²', 'nuitée', 'heure', 'jour', 'service', 'ticket'].includes(formData.unit || '') || formData.unit === '') && (
                          <div className="animate-in slide-in-from-top-2 duration-300">
                            <input
                              type="text"
                              placeholder="Ex: Pack de 100, Fagot, Palette, Flacon..."
                              value={formData.unit}
                              onChange={e => setFormData({ ...formData, unit: e.target.value })}
                              className="w-full px-4 md:px-5 py-3 bg-white border-2 border-orange-200 rounded-2xl text-sm font-semibold focus:border-brand outline-none shadow-xs"
                            />
                            <p className="text-[10px] text-brand mt-1 font-bold">Tapez l&apos;unité personnalisée de votre choix</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Délai de livraison / préparation */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Clock size={14} className="text-brand" /> Durée de Livraison / Préparation
                    </label>
                    <select
                      value={formData.deliveryTime}
                      onChange={e => setFormData({ ...formData, deliveryTime: e.target.value })}
                      className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-gray-50/80 border-2 border-gray-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-4 focus:ring-orange-100 focus:border-brand transition-all outline-none cursor-pointer"
                    >
                      <option value="">Sélectionnez une durée indicative...</option>
                      <optgroup label="Restauration & Immédiat">
                        <option value="15 min">15 minutes</option>
                        <option value="30 min">30 minutes</option>
                        <option value="45 min">45 minutes</option>
                        <option value="1h">1 heure</option>
                      </optgroup>
                      <optgroup label="Livraison Express & Rapide">
                        <option value="24h">24 heures (1 jour)</option>
                        <option value="48h">48 heures (2 jours)</option>
                        <option value="72h">72 heures (3 jours)</option>
                      </optgroup>
                      <optgroup label="Livraison Standard & Sur-Mesure">
                        <option value="3-5 jours">3 à 5 jours</option>
                        <option value="1 semaine">1 semaine</option>
                        <option value="2 semaines">2 semaines</option>
                        <option value="Sur commande">Sur commande / Fabrication sur-mesure</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Wholesale Section (Vente en gros) */}
                  {formData.businessType === 'shopping' && (
                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between p-4 bg-orange-50/50 rounded-2xl border border-orange-100 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            B2B
                          </div>
                          <div>
                            <h4 className="text-xs md:text-sm font-bold text-gray-900 leading-tight">
                              Tarifs de Gros & Vente B2B
                            </h4>
                            <p className="text-[10px] md:text-xs text-gray-500 font-medium">
                              Remises automatiques par quantité pour vos clients grossistes
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const isCurrentlyEnabled = (formData.wholesaleTiers && formData.wholesaleTiers.length > 0) || formData.wholesalePrice !== undefined;
                            if (isCurrentlyEnabled) {
                              setFormData({
                                ...formData,
                                wholesalePrice: undefined,
                                wholesaleMinQty: undefined,
                                wholesaleTiers: []
                              });
                            } else {
                              const baseP = Number(formData.price) || 0;
                              const initialTier = {
                                minQty: 50,
                                price: baseP > 0 ? Math.round(baseP * 50 * 0.85) : 0,
                                unitPrice: baseP > 0 ? Math.round(baseP * 0.85) : 0
                              };
                              setFormData({
                                ...formData,
                                wholesalePrice: initialTier.price,
                                wholesaleMinQty: initialTier.minQty,
                                wholesaleTiers: [initialTier]
                              });
                            }
                          }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${((formData.wholesaleTiers && formData.wholesaleTiers.length > 0) || formData.wholesalePrice !== undefined) ? 'bg-brand text-white shadow-xs' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                          {((formData.wholesaleTiers && formData.wholesaleTiers.length > 0) || formData.wholesalePrice !== undefined) ? 'Actif' : 'Activer'}
                        </button>
                      </div>

                      {(((formData.wholesaleTiers && formData.wholesaleTiers.length > 0) || formData.wholesalePrice !== undefined)) && (
                        <div className="space-y-3 animate-in slide-in-from-top-3 duration-300 p-3 bg-gray-50/60 rounded-2xl border border-gray-200/80">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                              Paliers de gros configurés ({(formData.wholesaleTiers || []).length})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const tiers = [...(formData.wholesaleTiers || [])];
                                const baseP = Number(formData.price) || 0;
                                const lastMinQty = tiers.length > 0 ? tiers[tiers.length - 1].minQty : 50;
                                const nextQty = lastMinQty >= 50 ? lastMinQty + 50 : lastMinQty * 2;
                                const unitRatio = tiers.length > 0 ? 0.75 : 0.85;
                                const nextPrice = baseP > 0 ? Math.round(baseP * nextQty * unitRatio) : 0;
                                
                                tiers.push({ minQty: nextQty, price: nextPrice, unitPrice: nextQty > 0 ? Math.round(nextPrice / nextQty) : 0 });
                                const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
                                setFormData({
                                  ...formData,
                                  wholesaleTiers: sorted,
                                  wholesaleMinQty: sorted[0]?.minQty,
                                  wholesalePrice: sorted[0]?.price
                                });
                              }}
                              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-50 text-brand border border-orange-200 text-[11px] font-bold hover:bg-orange-100 transition-all"
                            >
                              <Plus size={12} strokeWidth={3} /> Ajouter un palier
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(formData.wholesaleTiers || []).map((tier, idx) => {
                              const baseUnitPrice = Number(formData.price) || 0;
                              const minQty = Math.max(1, Number(tier.minQty) || 1);
                              const tierPrice = Number(tier.price) || 0;
                              
                              const effectiveUnit = tierPrice >= baseUnitPrice && minQty > 1
                                ? Math.round(tierPrice / minQty)
                                : (tierPrice > 0 ? tierPrice : baseUnitPrice);
                              const normalTotal = baseUnitPrice * minQty;
                              const packageTotal = tierPrice >= baseUnitPrice && minQty > 1 ? tierPrice : tierPrice * minQty;
                              const savings = normalTotal > packageTotal ? normalTotal - packageTotal : 0;
                              const savingsPct = normalTotal > 0 && savings > 0 ? Math.round((savings / normalTotal) * 100) : 0;

                              return (
                                <div key={idx} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2 shadow-xs">
                                  <div className="flex items-center gap-2 md:gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center shrink-0">
                                      #{idx + 1}
                                    </div>
                                    <div className="w-28 md:w-36 shrink-0">
                                      <label className="block text-[8px] font-bold text-gray-500 uppercase mb-0.5">Dès (qté min)</label>
                                      <input
                                        type="number"
                                        min="2"
                                        value={tier.minQty}
                                        onChange={e => {
                                          const tiers = [...(formData.wholesaleTiers || [])];
                                          const newQty = parseInt(e.target.value) || 1;
                                          tiers[idx] = {
                                            ...tiers[idx],
                                            minQty: newQty,
                                            unitPrice: newQty > 0 ? Math.round((tiers[idx].price || 0) / newQty) : 0
                                          };
                                          setFormData({
                                            ...formData,
                                            wholesaleTiers: tiers,
                                            wholesaleMinQty: tiers[0]?.minQty,
                                            wholesalePrice: tiers[0]?.price
                                          });
                                        }}
                                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs md:text-sm font-bold text-gray-800 focus:bg-white outline-none"
                                        placeholder="50"
                                      />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <label className="block text-[8px] font-bold text-gray-500 uppercase mb-0.5">Prix total du lot (XOF)</label>
                                      <div className="relative">
                                        <input
                                          type="number"
                                          min="0"
                                          value={tier.price}
                                          onChange={e => {
                                            const tiers = [...(formData.wholesaleTiers || [])];
                                            const newPrice = parseInt(e.target.value) || 0;
                                            const q = Math.max(1, tiers[idx].minQty || 1);
                                            tiers[idx] = {
                                              ...tiers[idx],
                                              price: newPrice,
                                              unitPrice: q > 0 ? Math.round(newPrice / q) : 0
                                            };
                                            setFormData({
                                              ...formData,
                                              wholesaleTiers: tiers,
                                              wholesaleMinQty: tiers[0]?.minQty,
                                              wholesalePrice: tiers[0]?.price
                                            });
                                          }}
                                          className="w-full pl-2.5 pr-8 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs md:text-sm font-bold text-brand focus:bg-white outline-none"
                                          placeholder="100000"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">XOF</span>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const tiers = (formData.wholesaleTiers || []).filter((_, i) => i !== idx);
                                        setFormData({
                                          ...formData,
                                          wholesaleTiers: tiers,
                                          wholesaleMinQty: tiers[0]?.minQty,
                                          wholesalePrice: tiers[0]?.price
                                        });
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all self-end"
                                      title="Supprimer ce palier"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>

                                  <div className="flex flex-wrap items-center justify-between text-[10px] font-semibold px-1 pt-1.5 border-t border-gray-100 text-gray-500">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-gray-400">Soit :</span>
                                      <span className="text-gray-900 font-bold">{formatCurrency(effectiveUnit)} / unité</span>
                                    </div>
                                    {savings > 0 && (
                                      <div className="flex items-center gap-1 text-emerald-600 font-bold">
                                        <span>Économie : −{formatCurrency(savings)}</span>
                                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 text-[9px]">−{savingsPct}%</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================ */}
              {/* STEP 3: VARIANTES & DÉCLINAISONS                             */}
              {/* ============================================================ */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  {/* Bannière d'introduction */}
                  <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-orange-50 via-amber-50/60 to-orange-50/30 rounded-2xl border border-orange-100/80">
                    <div className="w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 leading-tight">
                        Options & Déclinaisons du Produit
                      </h4>
                      <p className="text-xs text-gray-600 font-normal mt-0.5 leading-relaxed">
                        Ajoutez des options (ex : <span className="font-semibold text-gray-900">Taille</span>, <span className="font-semibold text-gray-900">Couleur</span>, <span className="font-semibold text-gray-900">Format</span>) pour générer automatiquement vos variantes avec leur propre prix, stock et photo.
                      </p>
                    </div>
                  </div>

                  {/* Éditeur de Variantes — ouvert à tous les verticaux :
                      en restauration on peut décliner par format ou portion,
                      le réglage des cuissons/suppléments restant lui aussi
                      exprimé en options de produit. */}
                    <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 md:p-6 shadow-xs">
                      <VariantMatrixEditor
                        options={(formData.options || []) as ProductOptionDef[]}
                        variants={(formData.variants || []) as ProductVariantDef[]}
                        basePrice={Number(formData.price) || 0}
                        images={formData.images || []}
                        onChange={(options, variants, notice) => {
                          setFormData((prev) => ({ ...prev, options, variants }));
                          if (notice) setVariantNotice(notice);
                        }}
                      />
                    </div>

                  {/* Summary Card before saving */}
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        Aperçu avant enregistrement
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Prêt
                      </span>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 shrink-0">
                        {formData.images && formData.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={formData.images[0]} alt="Aperçu" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Package size={20} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-bold text-gray-900 truncate">
                          {formData.name || 'Sans titre'}
                        </h5>
                        <p className="text-xs text-gray-400 font-medium">
                          {formData.category} • {formData.isOnline ? 'En ligne' : 'Caisse seule'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-brand">
                          {(() => {
                            const variantPrices = (formData.variants || []).map(v => Number(v.price) || 0).filter(p => p > 0);
                            if (variantPrices.length > 0) {
                              const min = Math.min(...variantPrices);
                              const max = Math.max(...variantPrices);
                              return min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`;
                            }
                            return formData.price !== undefined ? formatCurrency(formData.price) : '0 FCFA';
                          })()}
                        </div>
                        <div className="text-[10px] font-bold text-gray-500">
                          {(() => {
                            const count = (formData.variants || []).length;
                            if (count > 0) {
                              const totalStock = (formData.variants || []).reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
                              return `${count} variante${count > 1 ? 's' : ''} (${totalStock} en stock)`;
                            }
                            return `${formData.stock ?? 0} en stock`;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Navigation Footer */}
            <div className="p-3 md:p-6 border-t border-gray-100 bg-gray-50/50 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {submitError && (
                <div className="flex items-start gap-2 w-full md:w-auto px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-600">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span className="min-w-0 break-words">{submitError}</span>
                  <button
                    type="button"
                    onClick={() => setSubmitError(null)}
                    className="ml-auto p-0.5 text-rose-400 hover:text-rose-700 shrink-0"
                    aria-label="Fermer"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 md:gap-4 w-full md:w-auto ml-auto">
                <Button
                  type="button"
                  disabled={currentStep === 1 || isSubmitting}
                  onClick={() => {
                    setCurrentStep(prev => Math.max(1, prev - 1));
                    setSubmitError(null);
                  }}
                  variant="ghost"
                  size="md"
                  className="text-gray-500 hover:text-gray-900 font-bold text-xs md:text-sm"
                  icon={<ChevronLeft size={16} className="md:size-5" />}
                >
                  Précédent
                </Button>

                <div className="flex gap-2 md:gap-3">
                  {currentStep < 3 ? (
                    <Button
                      type="button"
                      onClick={() => {
                        if (currentStep === 1) {
                          if (!formData.name || !formData.name.trim()) {
                            setSubmitError('Veuillez renseigner le nom du produit avant de continuer.');
                            return;
                          }
                        } else if (currentStep === 2) {
                          if (formData.price === undefined || formData.price === null || isNaN(Number(formData.price)) || Number(formData.price) < 0) {
                            setSubmitError('Veuillez renseigner un prix de vente valide.');
                            return;
                          }
                        }
                        setSubmitError(null);
                        setCurrentStep(prev => prev + 1);
                      }}
                      variant="secondary"
                      size="md"
                      className="font-bold text-xs md:text-sm"
                      icon={<ChevronRight size={14} className="md:size-[18px]" />}
                      iconPosition="right"
                    >
                      Suivant
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      loading={isSubmitting}
                      loadingText="Enregistrement..."
                      variant="primary"
                      size="md"
                      className="font-bold text-xs md:text-sm shadow-md shadow-orange-200"
                    >
                      Enregistrer le produit
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Custom Product Limit Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 ring-1 ring-black/5">
            <div className="p-8 md:p-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center text-brand mb-6 shadow-sm border border-orange-100 rotate-3">
                <Award size={40} className="-rotate-3" />
              </div>

              <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2 leading-tight">
                Limite de produits atteinte !
              </h3>

              <p className="text-sm md:text-base text-slate-500 font-normal leading-relaxed mb-8">
                Vous avez atteint la limite de <span className="text-brand font-semibold">{(subscription && getSubscriptionPlan(subscription.tier)?.features.maxProducts) || 6} produits</span> pour votre abonnement actuel.
                <br className="hidden md:block" />
                Passez à la formule <span className="font-semibold text-slate-900 underline underline-offset-4 decoration-brand/30">Pro</span> pour continuer à développer votre inventaire.
              </p>

              <div className="flex flex-col w-full gap-3">
                <button
                  onClick={() => {
                    // Navigate to subscription page
                    const subLink = document.querySelector('[data-view-id="subscription"]');
                    if (subLink) (subLink as HTMLElement).click();
                    else window.location.href = '/dashboard?view=subscription';
                    setShowLimitModal(false);
                  }}
                  className="w-full py-4 bg-brand text-white rounded-2xl font-bold text-sm md:text-base hover:bg-[#d55a20] transition-all shadow-xl shadow-orange-100 active:scale-95 flex items-center justify-center gap-2"
                >
                  Découvrir les Tarifs <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => setShowLimitModal(false)}
                  className="w-full py-3 text-slate-400 font-semibold text-sm hover:text-slate-600 transition-colors"
                >
                  Plus tard
                </button>
              </div>
            </div>

            {/* Minimal Background Decoration */}
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-orange-50 rounded-full blur-3xl opacity-50 -z-10" />
            <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-48 h-48 bg-purple-50 rounded-full blur-3xl opacity-50 -z-10" />
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportProductsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        currentStoreId={currentStoreId || ''}
        storeName={storeName}
        businessType={businessType}
        selectedProductsCount={selectedIds.size}
        selectedProductIds={Array.from(selectedIds)}
        totalProductsCount={totalProductsCount || localProducts.length}
        localProducts={localProducts}
      />

      {/* Import Modal */}
      <ImportProductsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        targetStoreId={currentStoreId || ''}
        targetStoreName={storeName}
        businessType={businessType}
        onImportSuccess={handleImportSuccess}
      />

      {/* Inter-Store Transfer Modal */}
      <TransferProductsModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        sourceStoreId={currentStoreId || ''}
        sourceStoreName={storeName}
        businessType={businessType}
        selectedProductIds={Array.from(selectedIds)}
        selectedProductsCount={selectedIds.size}
        totalProductsCount={totalProductsCount || localProducts.length}
        localProducts={localProducts}
        onTransferSuccess={handleTransferSuccess}
      />

      {/* Delete Product Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation(prev => ({ ...prev, isOpen: false }))}
        onConfirm={deleteConfirmation.onConfirm}
        title={deleteConfirmation.title}
        message={deleteConfirmation.message}
        confirmText="Supprimer définitivement"
        type="danger"
        isLoading={isSubmitting}
      />
    </div>
  );
};

export default InventoryView;
