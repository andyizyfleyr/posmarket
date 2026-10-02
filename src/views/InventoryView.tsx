'use client';
import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  Search,
  Plus,
  Edit,
  Trash2,
  Download,
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
  Clock
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
}

const InventoryView: React.FC<InventoryViewProps> = ({
  products: initialProducts,
  permissions,
  currentStoreId,
  subscription,
  businessType = 'shopping',
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
  const [variantNotice, setVariantNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Taxonomie produit : lue en base (geree depuis /pam/categories), avec
  // repli sur les constantes historiques si la table est vide ou inaccessible.
  const [categoryTree, setCategoryTree] = useState<ProductCategoryNode[]>([]);
  const [useLiveCategories, setUseLiveCategories] = useState(false);

  useEffect(() => {
    let active = true;
    getProductCategoryTree()
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
  }, []);

  // Pagination states
  const [localProducts, setLocalProducts] = useState<Product[]>(initialProducts || []);
  const [offset, setOffset] = useState(initialProducts?.length || 0);
  const [hasMore, setHasMore] = useState(initialProducts?.length === 10); // Assume more if we got a full first page
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);

  // Sync local state when props change (after server re-render)
  useEffect(() => {
    setLocalProducts(initialProducts || []);
    setOffset(initialProducts?.length || 0);
    setHasMore(initialProducts?.length === 10);
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
        businessType: product.businessType || (product.mainCategory === 'Restauration & Livraison Rapide' ? 'food' : 'shopping'),
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

  const handleDelete = async (id: string) => {
    if (confirm('Voulez-vous vraiment supprimer ce produit ?')) {
      const result = await deleteProductAction(id, currentStoreId || '');
      if (result.success) {
        setLocalProducts(prev => prev.filter(p => p.id !== id));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Voulez-vous vraiment supprimer les ${selectedIds.size} produits sélectionnés ?`)) {
      setIsSubmitting(true);
      try {
        const result = await bulkDeleteProductsAction(Array.from(selectedIds), currentStoreId || '');
        if (result.success) {
          setLocalProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
          setSelectedIds(new Set());
        }
      } catch {
        // silent
      } finally {
        setIsSubmitting(false);
      }
    }
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

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-8 gap-3 md:gap-4">
        <div className="flex items-center gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight truncate">
                Inventaire
              </h1>
              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                businessType === 'food' ? 'bg-yellow-100 text-yellow-700' : 
                'bg-orange-100 text-orange-700'
              }`}>
                Flux {businessType === 'food' ? 'Resto' : 'Shop'}
              </span>
            </div>
            <p className="text-gray-500 text-[10px] md:text-sm mt-0.5 md:mt-1 truncate">
              Gérez vos produits et vos stocks.
            </p>
          </div>
          {selectedIds.size > 0 && permissions.canManageInventory && (
            <div className="flex items-center gap-2 animate-in slide-in-from-left-4 duration-300">
              <div className="h-8 w-px bg-gray-200 mx-1 md:mx-2 hidden md:block" />
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 hover:bg-red-100 transition-all shadow-sm"
              >
                <Trash2 size={14} /> Supprimer ({selectedIds.size})
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <button className="hidden md:flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all bg-white">
            <Download size={18} /> Exporter
          </button>

          {permissions.canManageInventory && (
            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => handleOpenModal(undefined, 'pos')}
                className="flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-5 md:py-3 bg-[#3b82f6] text-white rounded-xl md:rounded-2xl text-[10px] md:text-sm font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-100 whitespace-nowrap"
              >
                <Monitor size={14} className="md:size-[18px]" /> + Point de Vente
              </button>
              <button
                onClick={() => handleOpenModal(undefined, 'store')}
                className="flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-5 md:py-3 bg-[#f56b2a] text-white rounded-xl md:rounded-2xl text-[10px] md:text-sm font-bold hover:bg-[#d55a20] transition-all shadow-lg shadow-orange-100 whitespace-nowrap"
              >
                <ShoppingBag size={14} className="md:size-[18px]" /> + Store + POS
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
              className="w-full pl-9 md:pl-10 pr-4 py-2 md:py-2.5 bg-gray-50 border border-gray-100 rounded-lg md:rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20"
            />
          </div>
          <div className="hidden md:flex items-center border border-gray-100 rounded-xl p-1 bg-gray-50">
            <button
              onClick={() => setViewType('table')}
              className={`p-1.5 rounded-lg transition-all ${viewType === 'table' ? 'bg-white shadow-sm text-[#f56b2a]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewType('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewType === 'grid' ? 'bg-white shadow-sm text-[#f56b2a]' : 'text-gray-400 hover:text-gray-600'}`}
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
                      className="w-4 h-4 rounded border-gray-300 text-[#f56b2a] focus:ring-[#f56b2a]"
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
                        className="w-4 h-4 rounded border-gray-300 text-[#f56b2a] focus:ring-[#f56b2a]"
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
                              className="w-4 h-4 rounded border-gray-300 text-[#f56b2a] focus:ring-[#f56b2a]"
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
                              <span className="text-[9px] font-bold text-[#f56b2a]">
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
                              className="p-2.5 text-[#f56b2a] bg-orange-50 rounded-xl active:scale-90 shadow-sm"
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
                        <div className="text-xs font-bold text-[#f56b2a]">
                          {formatCurrency(product.price)}
                          {product.unit && product.unit !== 'pièce' && <span className="text-[10px] font-semibold text-gray-500 ml-1">/{product.unit}</span>}
                        </div>
                        {product.wholesalePrice && (
                          <div className="flex items-center gap-1 mt-0.5 whitespace-nowrap">
                            <Zap size={8} className="text-[#f56b2a]" fill="currentColor" />
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
                            className="p-2.5 text-[#f56b2a] bg-orange-50 rounded-xl transition-all active:scale-90 hover:bg-orange-100"
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
                  className={`bg-white rounded-lg md:rounded-xl p-1.5 md:p-2 border shadow-sm hover:shadow-lg transition-all group relative flex flex-col min-w-0 cursor-pointer ${selectedIds.has(product.id) ? 'border-[#f56b2a] ring-2 ring-orange-100' : 'border-gray-100'}`}
                >
                  <div className="absolute top-1 left-1 z-20">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded border-gray-300 text-[#f56b2a] focus:ring-[#f56b2a] shadow-sm"
                      checked={selectedIds.has(product.id)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(product.id); }}
                    />
                  </div>
                  {permissions.canManageInventory && !selectedIds.has(product.id) && (
                    <div className="absolute top-1 right-1 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button onClick={(e) => { e.stopPropagation(); handleOpenModal(product); }} className="bg-white/90 backdrop-blur p-1 rounded-full shadow-md text-[#f56b2a] hover:bg-[#f56b2a] hover:text-white transition-colors"><Edit size={10} /></button>
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
                    <span className="text-xs md:text-sm font-bold text-[#f56b2a] whitespace-nowrap">
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
                className="flex items-center gap-2 px-8 py-3 bg-white border-2 border-gray-100 rounded-2xl shadow-sm text-sm font-bold text-gray-600 hover:text-[#f56b2a] hover:border-orange-100 transition-all active:scale-95 disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <Loader2 size={16} className="animate-spin text-[#f56b2a]" />
                ) : (
                  <Plus size={16} className="text-[#f56b2a]" />
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header with Step Indicator */}
            <div className="px-3 md:px-8 pt-3 md:pt-8 pb-3 md:pb-4 border-b border-gray-100 bg-white sticky top-0 z-10">
              <div className="flex items-center justify-between mb-4 md:mb-8">
                <div>
                  <h2 className="text-lg md:text-2xl font-bold text-gray-900 tracking-tight whitespace-nowrap">
                    {editingProduct ? 'Modifier le produit' : (formData.isOnline ? '✨ Nouveau produit (Store)' : '🖥️ Nouveau produit (POS)')}
                  </h2>
                  <p className="text-gray-400 text-xs font-semibold mt-1 whitespace-nowrap">Étape {currentStep} sur 3</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 md:p-2 hover:bg-gray-50 rounded-full">
                  <X size={18} className="md:size-6" />
                </button>
              </div>

              {/* Step Progress Bar */}
              <div className="flex items-center justify-between relative px-1 md:px-2">
                <div className="absolute top-1/2 left-0 right-0 h-px md:h-0.5 bg-gray-100 -translate-y-1/2 z-0 mx-6 md:mx-8" />
                {[
                  { s: 1, icon: ImageIcon, label: 'Photos' },
                  { s: 2, icon: Tag, label: 'Essentiels' },
                  { s: 3, icon: DollarSign, label: 'Compléments' }
                ].map((step) => (
                  <div key={step.s} className="relative z-10 flex flex-col items-center gap-1.5 md:gap-2">
                    <div className={`
                      w-8 h-8 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-300
                      ${currentStep === step.s ? 'bg-[#f56b2a] text-white shadow-lg shadow-orange-200/60 ring-4 ring-orange-50' :
                        currentStep > step.s ? 'bg-green-500 text-white shadow-sm' : 'bg-white border-2 border-gray-200 text-gray-300'}
                    `}>
                      {currentStep > step.s ? <Check size={14} className="md:size-5" /> : <step.icon size={14} className="md:size-5" />}
                    </div>
                    <span className={`text-[10px] md:text-xs font-bold uppercase tracking-wide whitespace-nowrap ${currentStep >= step.s ? 'text-gray-900' : 'text-gray-300'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-grow overflow-y-auto p-4 md:p-8 custom-scrollbar">
              {currentStep === 1 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex flex-col gap-4">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Images du Produit</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {(formData.images || []).map((img, idx) => (
                        <div key={idx} className="relative group aspect-square rounded-xl md:rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
                          <img src={img} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              const newImages = formData.images.filter((_, i) => i !== idx);
                              setFormData({ ...formData, images: newImages, image: newImages[0] || '' });
                            }}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          >
                            <Trash2 size={10} />
                          </button>
                          {idx === 0 && (
                            <div className="absolute bottom-0 left-0 right-0 bg-[#f56b2a] text-[8px] text-white font-bold text-center py-0.5 uppercase">Principale</div>
                          )}
                        </div>
                      ))}
                      <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl md:rounded-2xl hover:bg-orange-50 hover:border-orange-200 transition-all cursor-pointer group">
                        <Plus size={18} className="md:size-5 text-gray-300 group-hover:text-[#f56b2a]" />
                        <span className="text-[7px] md:text-[8px] font-bold text-gray-400 mt-1 uppercase group-hover:text-[#f56b2a]">Ajouter</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []) as File[];

                            for (const file of files) {
                              try {
                                // Optimisation : Compression + Resolution + WebP
                                const optimizedFile = await optimizeImage(file);
                                // Conversion en Base64 pour le stockage actuel
                                const base64 = await fileToBase64(optimizedFile);

                                setFormData(prev => {
                                  const newImages = [...prev.images, base64];
                                  return {
                                    ...prev,
                                    images: newImages,
                                    image: prev.image || newImages[0]
                                  };
                                });
                              } catch (err) {
                                console.error("Erreur lors de l'optimisation:", err);
                              }
                            }
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">La première image sera l&apos;image principale du produit.</p>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4 md:space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Nom du Produit</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex : T-shirt Premium, Burger Classique…"
                      className="w-full px-4 md:px-5 py-3 md:py-4 bg-gray-50 border-2 border-gray-100 rounded-xl md:rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none placeholder:text-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Description</label>
                    <textarea
                      value={formData.description || ''}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Décrivez votre produit : matière, utilisation, points forts…"
                      rows={3}
                      className="w-full px-4 md:px-5 py-3 md:py-4 bg-gray-50 border-2 border-gray-100 rounded-xl md:rounded-2xl text-sm font-normal text-gray-700 focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none resize-none placeholder:text-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Catégorie du Produit</label>
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
                      className="w-full px-4 md:px-5 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none"
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
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Clock size={13} className="text-[#f56b2a]" /> Durée de Livraison / Préparation
                      </label>
                      <select
                        value={formData.deliveryTime}
                        onChange={e => setFormData({ ...formData, deliveryTime: e.target.value })}
                        className="w-full px-4 md:px-5 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none"
                      >
                        <option value="">Sélectionnez une durée...</option>
                        <optgroup label="Restauration / Immédiat">
                          <option value="15 min">15 minutes</option>
                          <option value="30 min">30 minutes</option>
                          <option value="45 min">45 minutes</option>
                          <option value="1h">1 heure</option>
                        </optgroup>
                        <optgroup label="Livraison Courte">
                          <option value="24h">24 heures</option>
                          <option value="48h">48 heures</option>
                          <option value="72h">72 heures</option>
                        </optgroup>
                        <optgroup label="Livraison Longue">
                          <option value="3-5 jours">3 à 5 jours</option>
                          <option value="1 semaine">1 semaine</option>
                          <option value="2 semaines">2 semaines</option>
                          <option value="Sur commande">Sur commande/Mesure</option>
                        </optgroup>
                      </select>
                      <p className="text-[9px] text-gray-500 mt-2 font-normal">Cette durée sera affichée sur votre boutique pour informer les clients.</p>
                    </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Tag size={13} className="text-[#f56b2a]" /> Prix de Vente
                      </label>
                      <div className="relative">
                        <input
                          required
                          type="number"
                          value={formData.price ?? ''}
                          onChange={e => setFormData({ ...formData, price: e.target.value ? parseInt(e.target.value) || 0 : undefined })}
                          placeholder="0"
                          className="w-full pl-4 md:pl-5 pr-12 md:pr-16 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-base md:text-lg font-bold text-[#f56b2a] focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none"
                        />
                        <span className="absolute right-4 md:right-5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-xs md:text-sm">XOF</span>
                      </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Stock Initial</label>
                        <input
                          type="number"
                          value={formData.stock ?? ''}
                          onChange={e => setFormData({ ...formData, stock: e.target.value ? parseInt(e.target.value) || 0 : undefined })}
                          placeholder="0"
                          className="w-full px-4 md:px-5 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-base md:text-lg font-bold text-gray-700 focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none"
                        />
                    </div>
                  </div>
                  {formData.businessType === 'shopping' && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Tag size={13} className="text-[#f56b2a]" /> Unité de vente
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
                          className="w-full px-4 md:px-5 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none"
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
                          <optgroup label="Services">
                            <option value="nuitée">Nuitée</option>
                            <option value="service">Service / Forfait</option>
                          </optgroup>
                          <option value="custom">Autre (Saisie libre)...</option>
                        </select>

                        {(!['pièce', 'unité', 'paquet', 'carton', 'boîte', 'sac', 'bouteille', 'lot', 'douzaine', 'kg', 'g', 'tonne', 'L', 'ml', 'cl', 'm', 'cm', 'm²', 'nuitée', 'heure', 'jour', 'service', 'ticket'].includes(formData.unit || '') || formData.unit === '') && (
                          <div className="animate-in slide-in-from-top-2 duration-300">
                            <input
                              type="text"
                              placeholder="Ex: Pack de 100, Fagot, Douzaine..."
                              value={formData.unit}
                              onChange={e => setFormData({ ...formData, unit: e.target.value })}
                              className="w-full px-4 md:px-5 py-3 md:py-4 bg-white border-2 border-orange-100 rounded-xl md:rounded-2xl text-sm font-semibold focus:border-[#f56b2a] outline-none shadow-sm"
                            />
                            <p className="text-[9px] text-[#f56b2a] mt-1 font-bold uppercase tracking-tighter">Saisie libre : tapez l&apos;unité de votre choix</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4 md:space-y-6 animate-in slide-in-from-right-4 duration-300">
                  {formData.businessType === 'shopping' && (
                    <div className="rounded-2xl border-2 border-gray-100 bg-gray-50/30 p-4 md:p-6">
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
                  )}


                  {/* Wholesale Section */}
                  {formData.businessType === 'shopping' && (
                    <div className="pt-4 md:pt-6 border-t border-gray-100 mt-4 md:mt-6">
                      <div className="flex items-center justify-between mb-4 md:mb-6">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-[11px] md:text-sm font-bold text-gray-900 leading-tight">Vente en Gros & B2B</h4>
                            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#f56b2a] text-[9px] font-bold uppercase">Grossiste</span>
                          </div>
                          <p className="text-[8px] md:text-[10px] text-gray-500 font-semibold mt-0.5">
                            Définissez vos prix de gros par quantité (ex : 400 000 FCFA dès 100 unités)
                          </p>
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
                                minQty: 100,
                                price: baseP > 0 ? Math.round(baseP * 100 * 0.8) : 0,
                                unitPrice: baseP > 0 ? Math.round(baseP * 0.8) : 0
                              };
                              setFormData({
                                ...formData,
                                wholesalePrice: initialTier.price,
                                wholesaleMinQty: initialTier.minQty,
                                wholesaleTiers: [initialTier]
                              });
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all ${((formData.wholesaleTiers && formData.wholesaleTiers.length > 0) || formData.wholesalePrice !== undefined) ? 'bg-[#f56b2a] text-white shadow-md shadow-orange-200/50' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >
                          {((formData.wholesaleTiers && formData.wholesaleTiers.length > 0) || formData.wholesalePrice !== undefined) ? 'ACTIVÉ' : 'DÉSACTIVER'}
                        </button>
                      </div>

                      {(((formData.wholesaleTiers && formData.wholesaleTiers.length > 0) || formData.wholesalePrice !== undefined)) && (
                        <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                              Prix de gros configurés ({(formData.wholesaleTiers || []).length})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const tiers = [...(formData.wholesaleTiers || [])];
                                const baseP = Number(formData.price) || 0;
                                const lastMinQty = tiers.length > 0 ? tiers[tiers.length - 1].minQty : 100;
                                const nextQty = lastMinQty >= 100 ? lastMinQty + 100 : lastMinQty * 2;
                                const unitRatio = tiers.length > 0 ? 0.75 : 0.8;
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
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 text-[#f56b2a] border border-orange-100 text-[10px] font-bold hover:bg-orange-100 transition-all active:scale-95"
                            >
                              <Plus size={13} strokeWidth={3} /> Ajouter un prix de gros
                            </button>
                          </div>

                          {(formData.wholesaleTiers || []).length === 0 ? (
                            <div className="p-4 bg-orange-50/40 border border-orange-100 rounded-2xl text-center">
                              <p className="text-xs font-semibold text-gray-600 mb-2">Aucun palier de gros défini pour l&apos;instant</p>
                              <button
                                type="button"
                                onClick={() => {
                                  const baseP = Number(formData.price) || 0;
                                  const t = { minQty: 100, price: baseP > 0 ? Math.round(baseP * 100 * 0.8) : 0, unitPrice: baseP > 0 ? Math.round(baseP * 0.8) : 0 };
                                  setFormData({ ...formData, wholesaleTiers: [t], wholesaleMinQty: t.minQty, wholesalePrice: t.price });
                                }}
                                className="px-3 py-1.5 bg-[#f56b2a] text-white rounded-xl text-xs font-bold"
                              >
                                + Ajouter le 1er prix de gros
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {(formData.wholesaleTiers || []).map((tier, idx) => {
                                const baseUnitPrice = Number(formData.price) || 0;
                                const minQty = Math.max(1, Number(tier.minQty) || 1);
                                const tierPrice = Number(tier.price) || 0;
                                
                                // Calcul automatique de l'unité et de l'avantage
                                const effectiveUnit = tierPrice >= baseUnitPrice && minQty > 1
                                  ? Math.round(tierPrice / minQty)
                                  : (tierPrice > 0 ? tierPrice : baseUnitPrice);
                                const normalTotal = baseUnitPrice * minQty;
                                const packageTotal = tierPrice >= baseUnitPrice && minQty > 1 ? tierPrice : tierPrice * minQty;
                                const savings = normalTotal > packageTotal ? normalTotal - packageTotal : 0;
                                const savingsPct = normalTotal > 0 && savings > 0 ? Math.round((savings / normalTotal) * 100) : 0;

                                return (
                                  <div key={idx} className="bg-orange-50/40 border border-orange-100/80 rounded-2xl p-3 md:p-4 space-y-2">
                                    <div className="flex items-center gap-2 md:gap-3">
                                      <div className="w-6 h-6 rounded-lg bg-orange-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                        {idx + 1}
                                      </div>
                                      <div className="w-32 md:w-36 shrink-0">
                                        <label className="block text-[8px] font-bold text-gray-500 uppercase mb-1">Dès (quantité)</label>
                                        <div className="relative">
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
                                            className="w-full px-3 py-2 bg-white border border-orange-100 rounded-xl text-xs md:text-sm font-bold text-gray-800 focus:ring-2 focus:ring-orange-200 outline-none"
                                            placeholder="100"
                                          />
                                        </div>
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <label className="block text-[8px] font-bold text-gray-500 uppercase mb-1">Prix de Gros total (XOF)</label>
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
                                            className="w-full pl-3 pr-10 py-2 bg-white border border-orange-100 rounded-xl text-xs md:text-sm font-bold text-[#f56b2a] focus:ring-2 focus:ring-orange-200 outline-none"
                                            placeholder="400000"
                                          />
                                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">XOF</span>
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
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all self-end"
                                        title="Supprimer ce prix de gros"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>

                                    {/* Calculated feedback bar */}
                                    <div className="flex flex-wrap items-center justify-between text-[9px] md:text-[10px] font-semibold px-1 pt-1 border-t border-orange-100/60 text-gray-500">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-gray-400">Soit:</span>
                                        <span className="text-gray-900 font-bold">{formatCurrency(effectiveUnit)} / unité</span>
                                        {baseUnitPrice > 0 && (
                                          <span className="text-gray-400 line-through">({formatCurrency(baseUnitPrice)})</span>
                                        )}
                                      </div>
                                      {savings > 0 && (
                                        <div className="flex items-center gap-1 text-emerald-600 font-bold">
                                          <span>Économie : −{formatCurrency(savings)}</span>
                                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[8px]">−{savingsPct}%</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              <p className="text-[9px] text-gray-400 font-semibold px-1">
                                💡 Le client bénéficie automatiquement du prix de gros dès qu&apos;il atteint la quantité minimale dans son panier.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  {/* Visibility Toggle */}
                  <div className="flex items-center justify-between p-4 md:p-5 bg-gradient-to-r from-orange-50 to-orange-50/30 rounded-2xl border border-orange-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#f56b2a] rounded-xl flex items-center justify-center text-white shadow-md shadow-orange-200/50">
                        <Globe size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 leading-tight">Publier sur le Store</div>
                        <p className="text-xs text-gray-500 font-semibold mt-0.5">Visible publiquement sur votre boutique en ligne</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isOnline: !formData.isOnline })}
                      className={`w-12 h-6 rounded-full transition-all duration-300 relative shadow-inner ${formData.isOnline ? 'bg-[#f56b2a]' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm ${formData.isOnline ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Navigation Footer */}
            <div className="p-3 md:p-8 border-t border-gray-100 bg-gray-50/30 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {submitError && (
                <div className="flex items-start gap-2 w-full md:w-auto px-3 py-2.5 bg-rose-50 border border-rose-100 rounded-xl text-[10px] md:text-xs font-bold text-rose-600">
                  <AlertCircle size={14} className="shrink-0 mt-px" />
                  <span className="min-w-0 break-words">{submitError}</span>
                  <button
                    type="button"
                    onClick={() => setSubmitError(null)}
                    className="ml-auto p-0.5 text-rose-300 hover:text-rose-600 shrink-0"
                    aria-label="Fermer le message"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 md:gap-4 w-full md:w-auto">
              <Button
                type="button"
                disabled={currentStep === 1 || isSubmitting}
                onClick={() => setCurrentStep(prev => prev - 1)}
                variant="ghost"
                size="md"
                className="text-gray-400 hover:text-gray-700 font-bold text-[10px] md:text-sm"
                icon={<ChevronLeft size={16} className="md:size-5" />}
              >
                Retour
              </Button>

              <div className="flex gap-2 md:gap-3">
                {currentStep < 3 ? (
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(prev => prev + 1)}
                    variant="secondary"
                    size="md"
                    className="font-bold text-[10px] md:text-sm"
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
                    loadingText="Envoi..."
                    variant="primary"
                    size="md"
                    className="font-bold text-[10px] md:text-sm"
                  >
                    Enregistrer
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
              <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center text-[#f56b2a] mb-6 shadow-sm border border-orange-100 rotate-3">
                <Award size={40} className="-rotate-3" />
              </div>

              <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2 leading-tight">
                Limite de produits atteinte !
              </h3>

              <p className="text-sm md:text-base text-slate-500 font-normal leading-relaxed mb-8">
                Vous avez atteint la limite de <span className="text-[#f56b2a] font-semibold">{(subscription && getSubscriptionPlan(subscription.tier)?.features.maxProducts) || 6} produits</span> pour votre abonnement actuel.
                <br className="hidden md:block" />
                Passez à la formule <span className="font-semibold text-slate-900 underline underline-offset-4 decoration-[#f56b2a]/30">Pro</span> pour continuer à développer votre inventaire.
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
                  className="w-full py-4 bg-[#f56b2a] text-white rounded-2xl font-bold text-sm md:text-base hover:bg-[#d55a20] transition-all shadow-xl shadow-orange-100 active:scale-95 flex items-center justify-center gap-2"
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
    </div>
  );
};

export default InventoryView;
