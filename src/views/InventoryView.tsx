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
  Store,
  ShoppingBag,
  Star,
  Loader2,
  Award,
  Zap,
  Clock,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/supabase';
import { SUBSCRIPTION_PLANS } from '@/constants';
import { Product, StaffPermissions, StaffRole, UserSubscription } from '@/types';
import { MAIN_CATEGORIES, CATEGORY_MAPPING } from '@/constants';
import { formatCurrency } from '@/utils';
import ProductImage from '../components/ProductImage';
import Loader from '../components/Loader';
import Button from '../components/Button';
import { saveProductAction, deleteProductAction, bulkDeleteProductsAction, getProductsAction } from '@/app/actions/inventory';
import { useRouter } from '@/components/RouterPolyfill';
import { optimizeImage, fileToBase64 } from '@/utils/image-optimization';

interface InventoryViewProps {
  products: Product[];
  permissions: StaffPermissions;
  currentStoreId?: string;
  userRole?: StaffRole;
  subscription?: UserSubscription;
}

const InventoryView: React.FC<InventoryViewProps> = ({
  products: initialProducts,
  permissions,
  currentStoreId,
  userRole,
  subscription,
}) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewType, setViewType] = useState<'grid' | 'table'>('table');
  const [productType, setProductType] = useState<'all' | 'pos' | 'marketplace'>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedVertical, setSelectedVertical] = useState<'all' | 'shopping' | 'food' | 'stay'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [managingAvailability, setManagingAvailability] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination states
  const [localProducts, setLocalProducts] = useState<Product[]>(initialProducts || []);
  const [offset, setOffset] = useState(initialProducts?.length || 0);
  const [hasMore, setHasMore] = useState(initialProducts?.length === 10); // Assume more if we got a full first page
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);

  // Sync local state when props change (after router.refresh)
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
    businessType: 'shopping',
    amenities: [],
    maxGuests: undefined,
    bedrooms: undefined,
    location: '',
    options: [],
    variants: []
  });

  const filteredProducts = useMemo(() => {
    return localProducts.filter(p => {
      // Filter by Channel
      const channelMatch = productType === 'all' || 
        (productType === 'pos' && p.isOnline === false) || 
        (productType === 'marketplace' && p.isOnline !== false);
        
      if (!channelMatch) return false;

      // Filter by Vertical
      if (selectedVertical === 'all') return true;
      
      // Auto-matching based on category if businessType is not set
      if (!p.businessType) {
        if (p.mainCategory === 'Restauration & Livraison Rapide') return selectedVertical === 'food';
        if (p.mainCategory === 'Séjours, Expériences & Immobilier') return selectedVertical === 'stay';
        return selectedVertical === 'shopping';
      }

      return p.businessType === selectedVertical;
    });
  }, [localProducts, productType, selectedVertical]);

  // Handle Search with debounce or simple effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length >= 0) {
        setIsLoadingMore(true);
        const res = await getProductsAction(currentStoreId || '', 0, 10, searchTerm);
        if (res.success) {
          setLocalProducts(res.products as any);
          setOffset(res.products?.length || 0);
          setHasMore(res.hasMore || false);
        }
        setIsLoadingMore(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, currentStoreId]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const res = await getProductsAction(currentStoreId || '', offset, 10, searchTerm);
    if (res.success && res.products) {
      setLocalProducts(prev => [...prev, ...(res.products as any)]);
      setOffset(prev => prev + (res.products?.length || 0));
      setHasMore(res.hasMore || false);
    }
    setIsLoadingMore(false);
  };

  const [skipStepOne, setSkipStepOne] = useState(false);

  const handleOpenModal = (product?: Product, type?: 'pos' | 'store') => {
    // Check product limits for non-edit mode
    if (!product && subscription) {
      const plan = SUBSCRIPTION_PLANS[subscription.tier];
      const maxProducts = plan?.features.maxProducts || 6;
      if (localProducts.length >= maxProducts) {
        setShowLimitModal(true);
        return;
      }
    }
    
    if (product) {
      setEditingProduct(product);
      setSkipStepOne(false);
      setCurrentStep(1);
      const initialFormData: Partial<Product> & { isOnline: boolean, images: string[] } = {
        name: product.name || '',
        price: product.price ?? undefined,
        stock: product.stock ?? undefined,
        category: product.category || 'Général',
        mainCategory: product.mainCategory || CATEGORY_MAPPING[product.category || ''] || 'Divers',
        image: product.image || '',
        images: product.images || (product.image ? [product.image] : []),
        unit: product.unit || 'pièce',
        description: product.description || '',
        isOnline: product.isOnline ?? true,
        wholesalePrice: product.wholesalePrice,
        wholesaleMinQty: product.wholesaleMinQty,
        deliveryTime: product.deliveryTime || '',
        preparationTime: product.preparationTime || '',
        businessType: product.businessType || (product.mainCategory === 'Restauration & Livraison Rapide' ? 'food' : product.mainCategory === 'Séjours, Expériences & Immobilier' ? 'stay' : 'shopping'),
        amenities: product.amenities || [],
        maxGuests: product.maxGuests,
        bedrooms: product.bedrooms,
        location: product.location || '',
        options: product.options || [],
        variants: product.variants || []
      };
      setFormData(initialFormData);
    } else {
      setEditingProduct(null);
      const isOnline = type === 'store';
      setFormData({
        name: '',
        price: undefined,
        stock: undefined,
        category: 'Général',
        mainCategory: 'Divers',
        image: '',
        images: [],
        unit: 'pièce',
        description: '',
        isOnline: isOnline,
        deliveryTime: '',
        preparationTime: '',
        businessType: selectedVertical === 'all' ? 'shopping' : (selectedVertical as any),
        amenities: [],
        maxGuests: undefined,
        bedrooms: undefined,
        location: '',
        options: [],
        variants: []
      });

      if (type) {
        setSkipStepOne(true);
        setCurrentStep(2); // Start directly at info
      } else {
        setSkipStepOne(false);
        setCurrentStep(1);
      }
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Voulez-vous vraiment supprimer ce produit ?')) {
      const result = await deleteProductAction(id);
      if (result.success) {
        router.refresh();
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
        const result = await bulkDeleteProductsAction(Array.from(selectedIds));
        if (result.success) {
          router.refresh();
          setSelectedIds(new Set());
        }
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
    try {
      const result = await saveProductAction(editingProduct ? { ...editingProduct, ...formData } : formData, currentStoreId || '');
      if (result.success) {
        setShowSuccessToast(editingProduct ? 'Produit mis à jour avec succès !' : 'Produit ajouté avec succès !');
        setTimeout(() => setShowSuccessToast(null), 3000);
        router.refresh();
        setIsModalOpen(false);
      } else {
        alert('Erreur: ' + (result.error || 'Impossible d\'enregistrer le produit'));
      }
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
          <span className="font-black text-sm">{showSuccessToast}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-8 gap-3 md:gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight whitespace-nowrap">Inventaire</h1>
            <p className="text-gray-500 text-[11px] md:text-sm mt-0.5 md:mt-1 whitespace-nowrap">Gérez vos produits et vos stocks.</p>
          </div>
          {selectedIds.size > 0 && permissions.canManageInventory && (
            <div className="flex items-center gap-2 animate-in slide-in-from-left-4 duration-300">
              <div className="h-8 w-px bg-gray-200 mx-1 md:mx-2 hidden md:block" />
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-black border border-red-100 hover:bg-red-100 transition-all shadow-sm"
              >
                <Trash2 size={14} /> Supprimer ({selectedIds.size})
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <button className="hidden md:flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all bg-white">
            <Download size={18} /> Exporter
          </button>

          {permissions.canManageInventory && (
            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => handleOpenModal(undefined, 'pos')}
                className="flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-5 md:py-3 bg-[#3b82f6] text-white rounded-xl md:rounded-2xl text-[10px] md:text-sm font-black hover:bg-blue-600 transition-all shadow-lg shadow-blue-100 whitespace-nowrap"
              >
                <Monitor size={14} className="md:size-[18px]" /> + Point de Vente
              </button>
              <button
                onClick={() => handleOpenModal(undefined, 'store')}
                className="flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-5 md:py-3 bg-[#f56b2a] text-white rounded-xl md:rounded-2xl text-[10px] md:text-sm font-black hover:bg-[#d55a20] transition-all shadow-lg shadow-orange-100 whitespace-nowrap"
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
              { id: 'all', label: 'Tous les flux', icon: Package, color: 'gray' },
              { id: 'shopping', label: 'Shopping (Amazon)', icon: ShoppingBag, color: 'orange' },
              { id: 'food', label: 'Resto (UberEats)', icon: Zap, color: 'yellow' },
              { id: 'stay', label: 'Séjours (Airbnb)', icon: Store, color: 'blue' }
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedVertical(v.id as any)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs md:text-sm font-black transition-all whitespace-nowrap border-2
                  ${selectedVertical === v.id 
                    ? `bg-white border-${v.color}-500 text-${v.color}-600 shadow-lg shadow-${v.color}-100` 
                    : 'bg-white border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'}
                `}
              >
                <v.icon size={16} className={selectedVertical === v.id ? `text-${v.color}-500` : ''} />
                {v.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 bg-gray-100 p-0.5 md:p-1 rounded-lg md:rounded-xl w-fit">
            <button
              onClick={() => setProductType('all')}
              className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-6 md:py-2 rounded-md md:rounded-lg text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${productType === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Mode Mixte
            </button>
            <button
              onClick={() => setProductType('pos')}
              className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-6 md:py-2 rounded-md md:rounded-lg text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${productType === 'pos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              POS Uniquement
            </button>
            <button
              onClick={() => setProductType('marketplace')}
              className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-6 md:py-2 rounded-md md:rounded-lg text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${productType === 'marketplace' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
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
              <div className="hidden md:table-header-group bg-gray-50/80 backdrop-blur text-gray-400 uppercase text-[10px] font-bold tracking-widest sticky top-0 z-10">
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
                {filteredProducts.map(product => (
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
                              <span className="font-bold text-[10px] md:text-sm text-gray-900 truncate whitespace-nowrap max-w-[120px] md:max-w-[250px] inline-block">{product.name}</span>
                              <span className={`text-[7px] md:text-[8px] font-black px-1 md:px-1.5 py-0 md:py-0.5 rounded-full whitespace-nowrap ${product.isOnline !== false ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                {product.isOnline !== false ? 'MAR.' : 'POS'}
                              </span>
                            </div>
                            <div className="flex md:hidden items-center gap-2 mt-0.5 whitespace-nowrap">
                              <span className="text-[9px] font-black text-[#f56b2a]">
                                {formatCurrency(product.price)}
                              </span>
                              <span className="text-[9px] text-gray-300">|</span>
                              <div className="flex items-center gap-1">
                                <span className={`text-[9px] font-black ${product.stock < 10 ? 'text-red-500' : 'text-gray-500'}`}>
                                  {product.stock} {product.unit}
                                </span>
                                {product.stock < 10 && <AlertCircle size={9} className="text-red-500" />}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions for Mobile - integrated in the same line */}
                        <div className="flex md:hidden items-center gap-1.5 flex-shrink-0">
                          {permissions.canManageInventory && (
                            <button
                              onClick={() => handleOpenModal(product)}
                              className="p-2 text-[#f56b2a] bg-orange-50 rounded-lg active:scale-90"
                            >
                              <Edit size={14} />
                            </button>
                          )}
                          <ChevronRight size={14} className="text-gray-300" />
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:table-cell px-4 py-2.5">
                      <span className={`text-[8px] font-black px-1.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 w-fit ${
                        product.businessType === 'stay' ? 'bg-blue-100 text-blue-700' : 
                        product.isOnline !== false ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {product.businessType === 'stay' ? <Store size={8} /> : product.isOnline !== false ? <ShoppingBag size={8} /> : <Monitor size={8} />}
                        {product.businessType === 'stay' ? 'Séjour (Pro)' : product.isOnline !== false ? 'Marketplace' : 'POS'}
                      </span>
                    </div>

                    <div className="hidden md:table-cell px-4 py-2.5">
                      <span className="text-[9px] font-black px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-lg uppercase tracking-wider">{product.category}</span>
                    </div>

                    <div className="hidden md:table-cell px-4 py-2.5">
                      <div className="flex flex-col">
                        <div className="text-xs font-black text-[#f56b2a]">
                          {formatCurrency(product.price)}
                          {product.unit && product.unit !== 'pièce' && <span className="text-[10px] font-bold text-gray-500 ml-1">/{product.unit}</span>}
                        </div>
                        {product.wholesalePrice && (
                          <div className="flex items-center gap-1 mt-0.5 whitespace-nowrap">
                            <Zap size={8} className="text-[#f56b2a]" fill="currentColor" />
                            <span className="text-[8px] text-gray-500 font-black uppercase tracking-tighter">
                              Gros: {formatCurrency(product.wholesalePrice)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="hidden md:table-cell px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {product.businessType === 'stay' ? (
                          <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Calendrier</span>
                        ) : (
                          <>
                            <span className={`text-xs font-black ${product.stock < 10 ? 'text-red-500' : 'text-gray-700'}`}>{product.stock}</span>
                            {product.stock < 10 && <AlertCircle size={12} className="text-red-500" />}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="hidden md:table-cell px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <Star size={10} className={product.rating && product.rating > 0 ? "text-yellow-400 fill-current" : "text-gray-200"} />
                        <span className="text-xs font-black text-gray-700">{product.rating ? product.rating.toFixed(1) : '—'}</span>
                        <span className="text-[9px] text-gray-400">({product.reviewCount || 0})</span>
                      </div>
                    </div>

                    <div className="hidden md:table-cell px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1 text-right">
                          {product.businessType === 'stay' && (
                            <button
                              onClick={() => setManagingAvailability(product)}
                              className="p-2 text-blue-600 bg-blue-50 rounded-lg transition-all active:scale-90"
                              title="Gérer la disponibilité"
                            >
                              <Calendar size={12} />
                            </button>
                          )}
                          {permissions.canManageInventory && (
                            <>
                              <button
                                onClick={() => handleOpenModal(product)}
                                className="p-2 text-[#f56b2a] bg-orange-50 rounded-lg transition-all active:scale-90"
                              >
                                <Edit size={12} />
                              </button>
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="p-2 text-red-600 bg-red-50 rounded-lg transition-all active:scale-90"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 p-2">
              {filteredProducts.map(product => (
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
                    <span className={`absolute bottom-1 right-1 text-[7px] md:text-[8px] font-black px-1 md:px-1.5 py-0 md:py-0.5 rounded-full whitespace-nowrap ${product.isOnline !== false ? 'bg-green-100/90 text-green-600' : 'bg-blue-100/90 text-blue-600'}`}>
                      {product.isOnline !== false ? 'MAR.' : 'POS'}
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-[10px] md:text-sm truncate whitespace-nowrap w-full">{product.name}</h4>
                  <p className="text-[8px] md:text-[9px] text-gray-400 font-bold mt-0.5 uppercase tracking-wider whitespace-nowrap">{product.category}</p>
                  <div className="flex justify-between items-center mt-auto pt-1.5 md:pt-2">
                    <span className="text-xs md:text-sm font-black text-[#f56b2a] whitespace-nowrap">
                      {formatCurrency(product.price)}
                    </span>
                    <span className={`text-[8px] md:text-[9px] font-black px-1 py-0.5 rounded-full whitespace-nowrap ${product.stock < 10 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{product.stock}</span>
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
                className="flex items-center gap-2 px-8 py-3 bg-white border-2 border-gray-100 rounded-2xl shadow-sm text-sm font-black text-gray-600 hover:text-[#f56b2a] hover:border-orange-100 transition-all active:scale-95 disabled:opacity-50"
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
            <div className="p-8 text-center text-gray-400 text-[10px] font-black uppercase tracking-widest opacity-50 border-t border-gray-50 bg-gray-50/5">
              Fin de l'inventaire
            </div>
          )}
        </div>
      </div>

      {/* Modal Produit (Step Form) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header with Step Indicator */}
            <div className="px-3 md:px-8 pt-3 md:pt-8 pb-3 md:pb-4 border-b border-gray-100 bg-white sticky top-0 z-10">
              <div className="flex items-center justify-between mb-4 md:mb-8">
                <div>
                  <h2 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight whitespace-nowrap">
                    {editingProduct ? 'Modifier' : skipStepOne ? (formData.isOnline ? 'Nouveau (Store)' : 'Nouveau (POS)') : 'Nouveau Produit'}
                  </h2>
                  <p className="text-gray-400 text-[10px] md:text-xs font-bold mt-1 whitespace-nowrap">Étape {currentStep} sur 4</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 md:p-2 hover:bg-gray-50 rounded-full">
                  <X size={18} className="md:size-6" />
                </button>
              </div>

              {/* Step Progress Bar */}
              <div className="flex items-center justify-between relative px-1 md:px-2">
                <div className="absolute top-1/2 left-0 right-0 h-px md:h-0.5 bg-gray-100 -translate-y-1/2 z-0 mx-6 md:mx-8" />
                {[
                  { s: 1, icon: Globe, label: 'Canaux' },
                  { s: 2, icon: Tag, label: 'Infos' },
                  { s: 3, icon: DollarSign, label: 'Prix' },
                  { s: 4, icon: ImageIcon, label: 'Médias' }
                ].map((step) => (
                  <div key={step.s} className="relative z-10 flex flex-col items-center gap-1.5 md:gap-2">
                    <div className={`
                      w-6 h-6 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-300
                      ${currentStep === step.s ? 'bg-[#f56b2a] text-white shadow-lg shadow-orange-100 ring-4 ring-orange-50/50' :
                        currentStep > step.s ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-100 text-gray-300'}
                    `}>
                      {currentStep > step.s ? <Check size={12} className="md:size-[18px]" /> : <step.icon size={12} className="md:size-[18px]" />}
                    </div>
                    <span className={`text-[7px] md:text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${currentStep >= step.s ? 'text-gray-900' : 'text-gray-300'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-grow overflow-y-auto p-4 md:p-8 custom-scrollbar">
              {currentStep === 1 && (
                <div className="animate-in slide-in-from-right-4 duration-300">
                  <h3 className="text-sm md:text-lg font-bold text-gray-800 mb-4 md:mb-6">Type de Publication</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
                    {[
                      { id: 'shopping', label: 'Produit (Amazon)', icon: ShoppingBag, color: 'orange' },
                      { id: 'food', label: 'Plat (UberEats)', icon: Zap, color: 'yellow' },
                      { id: 'stay', label: 'Séjour (Airbnb)', icon: Store, color: 'blue' }
                    ].map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          const updates: any = { businessType: v.id };
                          if (v.id === 'stay') {
                            updates.unit = 'nuitée';
                            updates.mainCategory = 'Séjours, Expériences & Immobilier';
                            updates.stock = 1; // Stock is hidden but better set to 1
                          }
                          setFormData({ ...formData, ...updates });
                        }}
                        className={`p-4 rounded-2xl border-2 text-center transition-all ${formData.businessType === v.id ? `border-${v.color}-500 bg-${v.color}-50/30` : 'border-gray-100'}`}
                      >
                        <v.icon size={24} className={`mx-auto mb-2 ${formData.businessType === v.id ? `text-${v.color}-500` : 'text-gray-400'}`} />
                        <span className="text-[10px] font-black uppercase">{v.label}</span>
                      </button>
                    ))}
                  </div>

                  <h3 className="text-sm md:text-lg font-bold text-gray-800 mb-4 md:mb-6">Canaux de vente</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isOnline: false })}
                      className={`p-3.5 md:p-6 rounded-2xl md:rounded-[24px] border-2 text-left transition-all group ${!formData.isOnline ? 'border-[#f56b2a] bg-orange-50/30' : 'border-gray-100 hover:border-orange-200'}`}
                    >
                      <div className={`w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-4 transition-colors ${!formData.isOnline ? 'bg-[#f56b2a] text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-orange-100 group-hover:text-[#f56b2a]'}`}>
                        <Monitor size={18} className="md:size-6" />
                      </div>
                      <h4 className="font-black text-xs md:text-base text-gray-900 mb-0.5 md:mb-1 whitespace-nowrap">Point de Vente</h4>
                      <p className="text-[9px] md:text-xs text-gray-500 font-medium leading-tight">Vente physique uniquement.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isOnline: true })}
                      className={`p-3.5 md:p-6 rounded-2xl md:rounded-[24px] border-2 text-left transition-all group ${formData.isOnline ? 'border-[#f56b2a] bg-orange-50/30' : 'border-gray-100 hover:border-orange-200'}`}
                    >
                      <div className={`w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-4 transition-colors ${formData.isOnline ? 'bg-[#f56b2a] text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-orange-100 group-hover:text-[#f56b2a]'}`}>
                        <Globe size={18} className="md:size-6" />
                      </div>
                      <h4 className="font-black text-xs md:text-base text-gray-900 mb-0.5 md:mb-1 whitespace-nowrap">Store + POS</h4>
                      <p className="text-[9px] md:text-xs text-gray-500 font-medium leading-tight">Vente physique et en ligne.</p>
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4 md:space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 md:mb-2">Nom du Produit</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 md:px-5 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-sm font-bold focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 md:mb-2">Catégorie du Produit</label>
                    <select
                      value={formData.category}
                      onChange={e => {
                        const newSub = e.target.value;
                        setFormData({
                          ...formData,
                          category: newSub,
                          mainCategory: CATEGORY_MAPPING[newSub] || 'Divers'
                        });
                      }}
                      className="w-full px-4 md:px-5 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-sm font-bold focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none"
                    >
                      {MAIN_CATEGORIES.map(mainCat => {
                        const subCats = Object.keys(CATEGORY_MAPPING).filter(sub => CATEGORY_MAPPING[sub] === mainCat);
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
                  {formData.businessType !== 'stay' && (
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 md:mb-2 flex items-center gap-2">
                          <Clock size={12} className="text-[#f56b2a]" /> Durée de Livraison / Préparation
                      </label>
                      <select
                        value={formData.deliveryTime}
                        onChange={e => setFormData({ ...formData, deliveryTime: e.target.value })}
                        className="w-full px-4 md:px-5 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-sm font-bold focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none"
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
                      <p className="text-[9px] text-gray-500 mt-2 font-medium">Cette durée sera affichée sur votre boutique pour informer les clients.</p>
                    </div>
                  )}

                  {formData.businessType === 'food' && (
                    <div className="p-4 bg-yellow-50 rounded-2xl border border-yellow-100 space-y-4">
                      <h4 className="text-xs font-black text-yellow-700 uppercase">Infos Cuisine</h4>
                      <div>
                        <label className="block text-[10px] font-black text-yellow-600 uppercase mb-1">Temps de préparation</label>
                        <input 
                          type="text" 
                          placeholder="Ex: 15-20 min"
                          value={formData.preparationTime}
                          onChange={e => setFormData({...formData, preparationTime: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-yellow-200 rounded-xl text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {formData.businessType === 'stay' && (
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-blue-700 uppercase">Détails de l'hébergement</h4>
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-[8px] font-black rounded-full uppercase">Mode Pro</span>
                      </div>
                      


                      <div>
                        <label className="block text-[10px] font-black text-blue-600 uppercase mb-1">Localisation (Ville/Quartier)</label>
                        <input 
                          type="text" 
                          value={formData.location}
                          onChange={e => setFormData({...formData, location: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-blue-200 rounded-xl text-sm font-bold"
                          placeholder="Ex: Abidjan, Cocody"
                        />
                      </div>


                      <div>
                        <label className="block text-[10px] font-black text-blue-600 uppercase mb-2">Équipements (Amenities)</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'wifi', label: 'Wi-Fi', icon: '📶' },
                            { id: 'ac', label: 'Climatisation', icon: '❄️' },
                            { id: 'pool', label: 'Piscine', icon: '🏊' },
                            { id: 'generator', label: 'Groupe Électrogène', icon: '⚡' },
                            { id: 'kitchen', label: 'Cuisine', icon: '🍳' },
                            { id: 'security', label: 'Gardiennage', icon: '🛡️' },
                            { id: 'canalplus', label: 'Canal+', icon: '📡' },
                            { id: 'cleaning', label: 'Ménage inclus', icon: '🧹' }
                          ].map(amenity => (
                            <button
                              key={amenity.id}
                              type="button"
                              onClick={() => {
                                const current = formData.amenities || [];
                                const next = current.includes(amenity.id) 
                                  ? current.filter(id => id !== amenity.id)
                                  : [...current, amenity.id];
                                setFormData({ ...formData, amenities: next });
                              }}
                              className={`flex items-center gap-2 p-2 rounded-xl border text-[10px] font-bold transition-all ${
                                (formData.amenities || []).includes(amenity.id)
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                  : 'bg-white text-gray-600 border-blue-100 hover:border-blue-300'
                              }`}
                            >
                              <span>{amenity.icon}</span>
                              <span>{amenity.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4 md:space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 md:mb-2 flex items-center gap-2">
                        <Tag size={12} className="text-[#f56b2a]" /> Prix de Vente (Par Nuitée)
                      </label>
                      <div className="relative">
                        <input
                          required
                          type="number"
                          value={formData.price ?? ''}
                          onChange={e => setFormData({ ...formData, price: e.target.value ? Math.round(parseFloat(e.target.value)) : undefined })}
                          placeholder="0"
                          className="w-full pl-4 md:pl-5 pr-12 md:pr-16 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-base md:text-lg font-black text-[#f56b2a] focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none"
                        />
                        <span className="absolute right-4 md:right-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs md:text-sm">XOF</span>
                      </div>
                    </div>

                    {formData.businessType !== 'stay' ? (
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 md:mb-2">Stock Initial</label>
                        <input
                          required
                          type="number"
                          value={formData.stock ?? ''}
                          onChange={e => setFormData({ ...formData, stock: e.target.value ? parseFloat(e.target.value) : undefined })}
                          placeholder="0"
                          className="w-full px-4 md:px-5 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-base md:text-lg font-black text-gray-700 focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-blue-600 uppercase mb-1 flex items-center gap-2">
                             <Users size={12} /> Personnes max
                          </label>
                          <input 
                            type="number" 
                            value={formData.maxGuests ?? ''}
                            onChange={e => setFormData({...formData, maxGuests: e.target.value ? parseInt(e.target.value) : undefined})}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all"
                            placeholder="Ex: 4"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-blue-600 uppercase mb-1 flex items-center gap-2">
                             <Home size={12} /> Chambres
                          </label>
                          <input 
                            type="number" 
                            value={formData.bedrooms ?? ''}
                            onChange={e => setFormData({...formData, bedrooms: e.target.value ? parseInt(e.target.value) : undefined})}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all"
                            placeholder="Ex: 2"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {formData.businessType !== 'stay' && (
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 md:mb-2 flex items-center gap-2">
                          <Tag size={12} className="text-[#f56b2a]" /> Unité de vente
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
                            className="w-full px-4 md:px-5 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-sm font-bold focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none"
                          >
                              <optgroup label="Standard">
                                  <option value="pièce">Pièce (pcs)</option>
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
                              <option value="custom">✨ Autre (Saisie libre)...</option>
                          </select>

                          {(!['pièce', 'unité', 'paquet', 'carton', 'boîte', 'sac', 'bouteille', 'lot', 'douzaine', 'kg', 'g', 'tonne', 'L', 'ml', 'cl', 'm', 'cm', 'm²', 'nuitée', 'heure', 'jour', 'service', 'ticket'].includes(formData.unit || '') || formData.unit === '') && (
                              <div className="animate-in slide-in-from-top-2 duration-300">
                                  <input
                                      type="text"
                                      placeholder="Ex: Pack de 100, Fagot, Douzaine..."
                                      value={formData.unit}
                                      onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                      className="w-full px-4 md:px-5 py-3 md:py-4 bg-white border-2 border-orange-100 rounded-xl md:rounded-2xl text-sm font-bold focus:border-[#f56b2a] outline-none shadow-sm"
                                  />
                                  <p className="text-[9px] text-[#f56b2a] mt-1 font-black uppercase tracking-tighter">Saisie libre : tapez l'unité de votre choix</p>
                              </div>
                          )}
                      </div>
                    </div>
                  )}

                  {/* Variants & Options Section - AliExpress Style */}
                  {formData.businessType !== 'stay' && (
                  <div className="pt-4 md:pt-6 border-t border-gray-100 mt-4 md:mt-6">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                      <div>
                        <h4 className="text-[11px] md:text-sm font-black text-gray-900 leading-tight">Options & Variantes</h4>
                        <p className="text-[8px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider">Combinez Tailles, Couleurs, etc. (Matrix Mode)</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newOptions = [...(formData.options || [])];
                          newOptions.push({ id: Math.random().toString(36).substr(2, 9), name: '', values: [] });
                          setFormData({ ...formData, options: newOptions });
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[9px] font-black hover:bg-[#f56b2a] transition-all active:scale-95"
                      >
                        <Plus size={12} strokeWidth={3} /> AJOUTER UNE OPTION
                      </button>
                    </div>

                    {/* Options Management */}
                    <div className="space-y-4 mb-8">
                        {(formData.options || []).map((option, optIdx) => (
                            <div key={option.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group/option">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newOptions = formData.options?.filter((_, i) => i !== optIdx);
                                        setFormData({ ...formData, options: newOptions });
                                    }}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-white shadow-md border border-gray-100 rounded-full flex items-center justify-center text-red-400 opacity-0 group-hover/option:opacity-100 transition-all hover:bg-red-50"
                                >
                                    <Trash2 size={12} />
                                </button>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="col-span-1">
                                        <label className="block text-[8px] font-black text-gray-400 uppercase mb-1">Type d'Option</label>
                                        <select
                                            value={['Taille', 'Couleur', 'Pointure', 'Format', 'Modèle', 'Saveur', 'Matière', 'Poids'].includes(option.name) ? option.name : (option.name === '' && !(option as any).isCustom ? '' : 'custom')}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const newOptions = [...formData.options!];
                                                if (val === 'custom') {
                                                    newOptions[optIdx].name = '';
                                                    (newOptions[optIdx] as any).isCustom = true;
                                                } else {
                                                    newOptions[optIdx].name = val;
                                                    (newOptions[optIdx] as any).isCustom = false;
                                                }
                                                setFormData({ ...formData, options: newOptions });
                                            }}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:border-[#f56b2a] outline-none shadow-sm mb-2"
                                        >
                                            <option value="">Sélectionner...</option>
                                            <option value="Taille">Taille</option>
                                            <option value="Couleur">Couleur</option>
                                            <option value="Pointure">Pointure</option>
                                            <option value="Format">Format</option>
                                            <option value="Modèle">Modèle</option>
                                            <option value="Saveur">Saveur / Goût</option>
                                            <option value="Matière">Matière</option>
                                            <option value="Poids">Poids</option>
                                            <option value="custom">✨ Autre...</option>
                                        </select>
                                        
                                        {((option as any).isCustom || (!['Taille', 'Couleur', 'Pointure', 'Format', 'Modèle', 'Saveur', 'Matière', 'Poids', ''].includes(option.name))) ? (
                                            <input
                                                type="text"
                                                value={option.name}
                                                autoFocus
                                                onChange={e => {
                                                    const newOptions = [...formData.options!];
                                                    newOptions[optIdx].name = e.target.value;
                                                    setFormData({ ...formData, options: newOptions });
                                                }}
                                                className="w-full px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg text-xs font-bold focus:border-[#f56b2a] outline-none shadow-sm animate-in slide-in-from-top-1"
                                                placeholder="Nom de l'option..."
                                            />
                                        ) : null}
                                    </div>
                                    <div className="col-span-1 md:col-span-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-[8px] font-black text-gray-400 uppercase">Valeurs (Séparez par des virgules)</label>
                                            <span className="text-[7px] font-bold text-orange-400 uppercase tracking-tighter">Astuce: cliquez sur les suggestions</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={option.values.join(', ')}
                                            onChange={e => {
                                                const newOptions = [...formData.options!];
                                                newOptions[optIdx].values = e.target.value.split(',').map(v => v.trim()).filter(v => v !== '');
                                                setFormData({ ...formData, options: newOptions });
                                            }}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:border-[#f56b2a] outline-none shadow-sm mb-2"
                                            placeholder="Rouge, Bleu, Vert..."
                                        />
                                        
                                        {/* Suggestions de valeurs */}
                                        {(() => {
                                            const suggestions: Record<string, string[]> = {
                                                'Taille': ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'Taille Unique', 'Enfant', 'Adulte'],
                                                'Couleur': ['Noir', 'Blanc', 'Rouge', 'Bleu', 'Marine', 'Vert', 'Kaki', 'Jaune', 'Orange', 'Rose', 'Violet', 'Gris', 'Beige', 'Marron', 'Bordeaux', 'Corail', 'Menthe', 'Or', 'Argent'],
                                                'Pointure': ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
                                                'Format': ['Petit', 'Moyen', 'Grand', 'S', 'M', 'L', 'XL', 'Standard', 'Pack', 'Unité', 'Douzaine', '100ml', '250ml', '500ml', '1L', '2L', '5L'],
                                                'Modèle': ['Standard', 'Pro', 'Max', 'Mini', 'Lite', 'Slim', 'Luxe', 'Sport', 'Classic', 'Premium', 'Edition Limitée'],
                                                'Saveur': ['Vanille', 'Chocolat', 'Fraise', 'Citron', 'Caramel', 'Banane', 'Pistache', 'Menthe', 'Pimenté', 'Nature', 'Salé', 'Sucré', 'Épicé', 'Grillé'],
                                                'Matière': ['Coton', 'Cuir', 'Bois', 'Acier', 'Aluminium', 'Or', 'Argent', 'Plastique', 'Verre', 'Céramique', 'Soie', 'Laine', 'Nylon', 'Polyester'],
                                                'Poids': ['50g', '100g', '200g', '250g', '500g', '1kg', '2kg', '5kg', '10kg', '25kg', '50kg']
                                            };
                                            
                                            const currentName = option.name;
                                            if (!suggestions[currentName]) return null;
                                            
                                            return (
                                                <div className="flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-left-2 duration-300">
                                                    {suggestions[currentName].map(suggest => {
                                                        const isAlreadyAdded = option.values.includes(suggest);
                                                        return (
                                                            <button
                                                                key={suggest}
                                                                type="button"
                                                                onClick={() => {
                                                                    const newOptions = [...formData.options!];
                                                                    if (isAlreadyAdded) {
                                                                        newOptions[optIdx].values = option.values.filter(v => v !== suggest);
                                                                    } else {
                                                                        newOptions[optIdx].values = [...option.values, suggest];
                                                                    }
                                                                    setFormData({ ...formData, options: newOptions });
                                                                }}
                                                                className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter transition-all border ${
                                                                    isAlreadyAdded 
                                                                        ? 'bg-[#f56b2a] text-white border-[#f56b2a] shadow-sm' 
                                                                        : 'bg-white text-gray-400 border-gray-100 hover:border-orange-200 hover:text-orange-500'
                                                                }`}
                                                            >
                                                                {isAlreadyAdded ? '✓ ' : '+ '}{suggest}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Generate Button Logic */}
                    {(formData.options || []).length > 0 && formData.options?.every(o => o.name && o.values.length > 0) && (
                        <div className="mb-8 flex justify-center">
                            <button
                                type="button"
                                onClick={() => {
                                    // Cartesian product generator
                                    const options = formData.options!;
                                    const combinations: any[] = [];
                                    
                                    const combine = (optIdx: number, current: any) => {
                                        if (optIdx === options.length) {
                                            combinations.push(current);
                                            return;
                                        }
                                        const option = options[optIdx];
                                        option.values.forEach(val => {
                                            combine(optIdx + 1, { ...current, [option.id]: val });
                                        });
                                    };
                                    
                                    combine(0, {});
                                    
                                    const newVariants = combinations.map(combo => {
                                        const name = Object.values(combo).join(' / ');
                                        const existing = formData.variants?.find(v => JSON.stringify(v.optionValues) === JSON.stringify(combo));
                                        
                                        return {
                                            id: existing?.id || Math.random().toString(36).substr(2, 9),
                                            name,
                                            optionValues: combo,
                                            price: existing?.price || formData.price || 0,
                                            stock: existing?.stock || 0
                                        };
                                    });
                                    
                                    setFormData({ ...formData, variants: newVariants });
                                }}
                                className="px-6 py-2.5 bg-[#f56b2a] text-white rounded-xl text-[10px] font-black shadow-lg shadow-orange-100 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                            >
                                <Zap size={14} fill="currentColor" /> GÉNÉRER LES COMBINAISONS
                            </button>
                        </div>
                    )}

                    {/* Variants Grid */}
                    {(formData.variants || []).length > 0 && (
                        <div className="space-y-2.5 animate-in slide-in-from-top-4 duration-500">
                            <div className="hidden md:grid grid-cols-12 gap-4 px-2 mb-2">
                                <div className="col-span-5 text-[8px] font-black text-gray-400 uppercase">Combinaison</div>
                                <div className="col-span-3 text-[8px] font-black text-gray-400 uppercase">Prix (XOF)</div>
                                <div className="col-span-3 text-[8px] font-black text-gray-400 uppercase">Stock</div>
                                <div className="col-span-1"></div>
                            </div>
                            {formData.variants?.map((variant, idx) => (
                                <div key={variant.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-3 bg-white border border-gray-100 rounded-xl md:rounded-2xl shadow-sm hover:border-orange-100 transition-all group/variant">
                                    <div className="col-span-1 md:col-span-5 flex items-center">
                                        <div className="flex flex-wrap gap-1">
                                            {variant.name.split(' / ').map((val, i) => (
                                                <span key={i} className="text-[10px] font-bold text-gray-900 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">{val}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="col-span-1 md:col-span-3">
                                        <input
                                            type="number"
                                            value={variant.price}
                                            onChange={e => {
                                                const newVariants = [...formData.variants!];
                                                newVariants[idx].price = parseFloat(e.target.value) || 0;
                                                setFormData({ ...formData, variants: newVariants });
                                            }}
                                            className="w-full px-3 py-1.5 bg-gray-50 border border-transparent rounded-lg text-xs font-bold text-[#f56b2a] focus:bg-white focus:border-[#f56b2a] outline-none"
                                        />
                                    </div>
                                    <div className="col-span-1 md:col-span-3">
                                        <input
                                            type="number"
                                            value={variant.stock}
                                            onChange={e => {
                                                const newVariants = [...formData.variants!];
                                                newVariants[idx].stock = parseFloat(e.target.value) || 0;
                                                setFormData({ ...formData, variants: newVariants });
                                            }}
                                            className="w-full px-3 py-1.5 bg-gray-50 border border-transparent rounded-lg text-xs font-bold text-gray-700 focus:bg-white focus:border-[#f56b2a] outline-none"
                                        />
                                    </div>
                                    <div className="col-span-1 flex items-center justify-end">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newVariants = formData.variants?.filter((_, i) => i !== idx);
                                                setFormData({ ...formData, variants: newVariants });
                                            }}
                                            className="p-1 px-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                  </div>
                )}

                  {/* Wholesale Section */}
                  {formData.businessType !== 'stay' && (
                    <div className="pt-4 md:pt-6 border-t border-gray-100 mt-4 md:mt-6">
                      <div className="flex items-center justify-between mb-4 md:mb-6">
                        <div>
                          <h4 className="text-[11px] md:text-sm font-black text-gray-900 leading-tight">Vente en Gros</h4>
                          <p className="text-[8px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider">Prix réduit pour de grandes quantités</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.wholesalePrice !== undefined) {
                              setFormData({ ...formData, wholesalePrice: undefined, wholesaleMinQty: undefined });
                            } else {
                              setFormData({ ...formData, wholesalePrice: (formData.price || 0) * 0.8, wholesaleMinQty: 10 });
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${formData.wholesalePrice !== undefined ? 'bg-orange-50 text-[#f56b2a] border border-orange-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}
                        >
                          {formData.wholesalePrice !== undefined ? 'ACTIVÉ' : 'DÉSACTIVER'}
                        </button>
                      </div>

                      {formData.wholesalePrice !== undefined && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 animate-in slide-in-from-top-4 duration-300">
                          <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 md:mb-2">Prix de Gros (XOF)</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={formData.wholesalePrice ?? ''}
                                onChange={e => setFormData({ ...formData, wholesalePrice: e.target.value ? Math.round(parseFloat(e.target.value)) : 0 })}
                                placeholder="0"
                                className="w-full pl-4 md:pl-5 pr-12 md:pr-16 py-3 md:py-4 bg-orange-50/50 border border-orange-100 rounded-xl md:rounded-2xl text-base md:text-lg font-black text-[#f56b2a] focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none"
                              />
                              <span className="absolute right-4 md:right-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs md:text-sm">XOF</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 md:mb-2">Qté Minimale</label>
                            <input
                              type="number"
                              value={formData.wholesaleMinQty ?? ''}
                              onChange={e => setFormData({ ...formData, wholesaleMinQty: e.target.value ? parseInt(e.target.value) : 1 })}
                              placeholder="10"
                              className="w-full px-4 md:px-5 py-3 md:py-4 bg-orange-50/50 border border-orange-100 rounded-xl md:rounded-2xl text-base md:text-lg font-black text-gray-700 focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex flex-col gap-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Images du Produit</label>
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
                            <div className="absolute bottom-0 left-0 right-0 bg-[#f56b2a] text-[8px] text-white font-black text-center py-0.5 uppercase">Principale</div>
                          )}
                        </div>
                      ))}
                      <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl md:rounded-2xl hover:bg-orange-50 hover:border-orange-200 transition-all cursor-pointer group">
                        <Plus size={18} className="md:size-5 text-gray-300 group-hover:text-[#f56b2a]" />
                        <span className="text-[7px] md:text-[8px] font-black text-gray-400 mt-1 uppercase group-hover:text-[#f56b2a]">Ajouter</span>
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
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">La première image sera l'image principale du produit.</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 md:mb-2">Description</label>
                    <textarea
                      value={formData.description || ''}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 md:px-5 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-xs md:text-sm font-medium focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] transition-all outline-none min-h-[80px] md:min-h-[120px] resize-none"
                    />
                  </div>

                  {/* Manual Visibility Toggle */}
                  <div className="flex items-center justify-between p-3 md:p-4 bg-orange-50/50 rounded-xl md:rounded-2xl border border-orange-100">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="bg-[#f56b2a] p-1.5 md:p-2 rounded-lg text-white">
                        <Globe size={16} className="md:size-[18px]" />
                      </div>
                      <div>
                        <div className="text-[11px] md:text-sm font-black text-gray-900 leading-tight">Publier sur le Store</div>
                        <p className="text-[8px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider">Visibilité publique</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isOnline: !formData.isOnline })}
                      className={`w-10 md:w-12 h-5 md:h-6 rounded-full transition-colors relative ${formData.isOnline ? 'bg-[#f56b2a]' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${formData.isOnline ? 'left-5.5 md:left-7' : 'left-0.5 md:left-1'}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Navigation Footer */}
            <div className="p-3 md:p-8 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between gap-3 md:gap-4">
              <Button
                type="button"
                disabled={(skipStepOne ? currentStep === 2 : currentStep === 1) || isSubmitting}
                onClick={() => setCurrentStep(prev => prev - 1)}
                variant="ghost"
                size="md"
                className="text-gray-400 hover:text-gray-700 font-black text-[10px] md:text-sm"
                icon={<ChevronLeft size={16} className="md:size-5" />}
              >
                Retour
              </Button>

              <div className="flex gap-2 md:gap-3">
                {currentStep < 4 ? (
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(prev => prev + 1)}
                    variant="secondary"
                    size="md"
                    className="font-black text-[10px] md:text-sm"
                    icon={<ChevronRight size={14} className="md:size-[18px]" />}
                    iconPosition="right"
                  >
                    Suivant
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    loading={isSubmitting}
                    loadingText="Envoi..."
                    variant="primary"
                    size="md"
                    className="font-black text-[10px] md:text-sm"
                  >
                    Enregistrer
                  </Button>
                )}
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
              
              <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-2 leading-tight">
                Limite de produits atteinte !
              </h3>
              
              <p className="text-sm md:text-base text-slate-500 font-medium leading-relaxed mb-8">
                Vous avez atteint la limite de <span className="text-[#f56b2a] font-bold">{(subscription && SUBSCRIPTION_PLANS[subscription.tier]?.features.maxProducts) || 6} produits</span> pour votre abonnement actuel. 
                <br className="hidden md:block" />
                Passez à la formule <span className="font-bold text-slate-900 underline underline-offset-4 decoration-[#f56b2a]/30">Pro</span> pour continuer à développer votre inventaire.
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
                  className="w-full py-4 bg-[#f56b2a] text-white rounded-2xl font-black text-sm md:text-base hover:bg-[#d55a20] transition-all shadow-xl shadow-orange-100 active:scale-95 flex items-center justify-center gap-2"
                >
                  Découvrir les Tarifs <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => setShowLimitModal(false)}
                  className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
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
      {/* Availability Management Modal */}
      {managingAvailability && (
        <AvailabilityModal
          product={managingAvailability}
          onClose={() => setManagingAvailability(null)}
          onUpdate={() => router.refresh()}
        />
      )}
    </div>
  );
};

// Internal component for Availability Management
const AvailabilityModal: React.FC<{ 
  product: Product, 
  onClose: () => void,
  onUpdate: () => void 
}> = ({ product, onClose, onUpdate }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    fetchSlots();
  }, [product.id]);

  const fetchSlots = async () => {
    try {
      const { data } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('product_id', product.id)
        .order('date', { ascending: true });
      setSlots(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!startDate || !endDate) return;
    setIsSubmitting(true);
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const datesToUpdate = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        datesToUpdate.push(new Date(d).toISOString().split('T')[0]);
      }

      for (const dateStr of datesToUpdate) {
        const { error } = await supabase.from('availability_slots').upsert({
          product_id: product.id,
          date: dateStr,
          is_available: isAvailable,
        }, { onConflict: 'product_id,date' });
        
        if (error) throw error;
      }

      onUpdate();
      fetchSlots();
      setStartDate('');
      setEndDate('');
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDate = async (dateStr: string, currentStatus: boolean) => {
    const { error } = await supabase.from('availability_slots').upsert({
      product_id: product.id,
      date: dateStr,
      is_available: !currentStatus,
    }, { onConflict: 'product_id,date' });
    if (!error) {
      fetchSlots();
      onUpdate();
    }
  };

  // Calendar Logic
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  
  const monthData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = (firstDayOfMonth(year, month) + 6) % 7; // Adjust for Monday start
    
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const slot = slots.find(s => s.date === dateStr);
        days.push({
            day: i,
            date: dateStr,
            isAvailable: slot ? slot.is_available : true,
            isBlocked: slot ? !slot.is_available : false,
            hasBooking: slot?.booking_id ? true : false
        });
    }
    return days;
  }, [currentMonth, slots]);

  const monthName = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[95vh] border border-gray-100">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0">
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight">{product.name}</h3>
            <p className="text-[10px] font-black text-[#f56b2a] uppercase tracking-widest">Calendrier des Disponibilités</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 transition-colors bg-gray-50 rounded-xl">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
          {/* Pro Calendar Grid */}
          <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
                <h4 className="text-sm font-black text-gray-900 border-l-4 border-[#f56b2a] pl-3 capitalize">{monthName}</h4>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                        className="p-2 bg-white border border-gray-100 rounded-xl hover:text-[#f56b2a] transition-all"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button 
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                        className="p-2 bg-white border border-gray-100 rounded-xl hover:text-[#f56b2a] transition-all"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                    <div key={d} className="text-[9px] font-black text-gray-400 uppercase text-center pb-2 tracking-tighter">{d}</div>
                ))}
                {monthData.map((d, i) => (
                    <div key={i} className="aspect-square relative">
                        {d ? (
                            <button
                                onClick={() => toggleDate(d.date, d.isAvailable)}
                                className={`w-full h-full rounded-xl border flex flex-col items-center justify-center transition-all relative overflow-hidden group ${
                                    d.hasBooking ? 'bg-orange-50 border-orange-200 cursor-default' : 
                                    !d.isAvailable ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100 hover:border-[#f56b2a]/30'
                                }`}
                            >
                                <span className={`text-[11px] font-black ${d.hasBooking ? 'text-orange-700' : !d.isAvailable ? 'text-red-600' : 'text-gray-900'}`}>
                                    {d.day}
                                </span>
                                {!d.isAvailable && !d.hasBooking && <div className="w-1 h-1 bg-red-400 rounded-full mt-0.5" />}
                                {d.hasBooking && <span className="text-[6px] font-black uppercase text-orange-500 mt-0.5 leading-none">Occupe</span>}
                            </button>
                        ) : <div className="w-full h-full" />}
                    </div>
                ))}
            </div>
            
            <div className="flex items-center gap-4 mt-6 pt-4 border-t border-gray-100/50 justify-center">
                <div className="flex items-center gap-1.5 text-[8px] font-black text-gray-400 uppercase">
                    <div className="w-2.5 h-2.5 bg-white border border-gray-100 rounded-full" /> Disponible
                </div>
                <div className="flex items-center gap-1.5 text-[8px] font-black text-gray-400 uppercase">
                    <div className="w-2.5 h-2.5 bg-red-50 border border-red-100 rounded-full" /> Bloqué Manuel
                </div>
                <div className="flex items-center gap-1.5 text-[8px] font-black text-gray-400 uppercase">
                    <div className="w-2.5 h-2.5 bg-orange-50 border border-orange-200 rounded-full" /> Réservé (Client)
                </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Actions Rapides</h4>
            <div className="bg-white p-5 rounded-3xl border border-gray-100 space-y-5 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Blocage Du</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold" />
                    </div>
                    <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Au</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold" />
                    </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={() => setIsAvailable(true)} className={`flex-1 p-3 rounded-2xl border-2 flex items-center justify-center gap-2 transition-all ${isAvailable ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 text-gray-400'}`}>
                        <CheckCircle2 size={18} />
                        <span className="text-[9px] font-black uppercase">Ouvrir</span>
                    </button>
                    <button onClick={() => setIsAvailable(false)} className={`flex-1 p-3 rounded-2xl border-2 flex items-center justify-center gap-2 transition-all ${!isAvailable ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-100 text-gray-400'}`}>
                        <X size={18} />
                        <span className="text-[9px] font-black uppercase">Fermer</span>
                    </button>
                </div>

                <Button fullWidth onClick={handleSave} loading={isSubmitting} disabled={!startDate || !endDate}>
                    Appliquer le changement
                </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryView;
