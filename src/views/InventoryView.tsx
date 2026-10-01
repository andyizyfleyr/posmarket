'use client';
import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Tag,
  DollarSign,
  Check,
  ChevronRight,
  ChevronLeft,
  ShoppingBag,
  Star,
  Loader2,
  Award,
  Monitor,
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
import VariantMatrixEditor from '@/components/inventory/VariantMatrixEditor';
import ProductImagesStep from '@/components/inventory/ProductImagesStep';
import ProductEssentialsStep from '@/components/inventory/ProductEssentialsStep';
import ProductDescriptionStep from '@/components/inventory/ProductDescriptionStep';
import WholesaleTiersEditor from '@/components/inventory/WholesaleTiersEditor';
import type { ProductFormData } from '@/components/inventory/types';
import {
  normalizeOptions,
  normalizeVariants,
  type ProductOptionDef,
  type ProductVariantDef,
} from '@/utils/variants';

/**
 * Sérialisation de l'état du formulaire, pour détecter une saisie en cours.
 *
 * Comparer les objets par identité ne marcherait pas : `setFormData` crée un
 * nouvel objet à chaque frappe, y compris pour un retour à la valeur initiale.
 */
function serializeForm(form: ProductFormData): string {
  return JSON.stringify(form);
}

/** Étapes du formulaire. `s` sert au pilotage de `currentStep`. */
const STEPS = [
  { s: 1, label: 'Photos', icon: ImageIcon },
  { s: 2, label: 'Essentiels', icon: Tag },
  { s: 3, label: 'Compléments', icon: DollarSign },
] as const;

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
  const [submitError, setSubmitError] = useState<string | null>(null);
  // B8 : l'éditeur d'options porte déjà son propre bandeau de message. L'état
  // `variantNotice` en affichait un second, identique, sous la section.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  // Rappel de l'état initial pour détecter une saisie en cours (B7).
  const initialFormSnapshot = useRef<string>('');
  // B6 : la modale n'écoutait ni Escape ni la.tabulation. `ProductDetailsView`
  // le fait déjà pour sa feuille d'options — même exigence ici.
  const dialogRef = useRef<HTMLDivElement | null>(null);

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

  const [formData, setFormData] = useState<ProductFormData>({
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

  /** Ferme la modale et oublie la saisie courante. */
  const closeModal = () => {
    setIsModalOpen(false);
    setShowDiscardConfirm(false);
    setFieldErrors({});
    setSubmitError(null);
    setCurrentStep(1);
  };

  /**
   * Ferme seulement si rien n'a été saisi.
   *
   * Avant, la croix fermait immédiatement : sur l'étape 3 (matrice, paliers de
   * gros) tout le travail disparaissait sans confirmation.
   */
  const requestClose = () => {
    // Création et modification sont traitées de la même façon : l'instantané
    // est posé à chaque ouverture (fiche vide en création). Comparer la
    // sérialisation — et non l'identité des objets, qui change à chaque frappe.
    if (serializeForm(formData) !== initialFormSnapshot.current) {
      setShowDiscardConfirm(true);
      return;
    }
    closeModal();
  };

  // Refs miroir, pour que l'écouteur d'Escape — installé une seule fois à
  // l'ouverture — lise la valeur courante sans être réinstallé à chaque frappe.
  const latest = useRef({ formData, showDiscardConfirm, closeModal });
  useEffect(() => {
    latest.current = { formData, showDiscardConfirm, closeModal };
  });

  // B6 : Escape ferme, le défilement de l'arrière-plan est bloqué, et le focus
  // entre dans la modale à l'ouverture. Sans cela, la touche Échap ne faisait
  // rien et la page continuait de défiler dessous.
  useEffect(() => {
    if (!isModalOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();

      // La confirmation d'abandon a la priorité : Escape l'annule et rend la
      // main à la saisie. Sans ce cas, elle se rouvirait aussitôt et la
      // touche resterait sans effet.
      if (latest.current.showDiscardConfirm) {
        setShowDiscardConfirm(false);
        return;
      }

      const dirty =
        serializeForm(latest.current.formData) !== initialFormSnapshot.current;
      if (dirty) {
        setShowDiscardConfirm(true);
        return;
      }
      latest.current.closeModal();
    };
    window.addEventListener('keydown', onKeyDown);

    // Premier champ focalisé : sans cela la tabulation repart du début de la
    // page, derrière la modale.
    const focusTimer = window.setTimeout(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>('input, select, textarea, button')
        ?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isModalOpen]);

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
      setSubmitError(null);
      setFieldErrors({});
      // Nettoyage à l'ouverture : SKU et photo par variante sont conservés,
      // les orphelines sont écartées pour ne jamais casser la matrice.
      const safeOptions = normalizeOptions(product.options);
      const safeVariants = normalizeVariants(product.variants, safeOptions);
      const initialFormData: ProductFormData = {
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
      initialFormSnapshot.current = serializeForm(initialFormData);
    } else {
      setEditingProduct(null);
      setSubmitError(null);
      setFieldErrors({});
      const isOnline = type === 'store';
      const blankForm: ProductFormData = {
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
      };
      setFormData(blankForm);
      // creation : l'instantané est la fiche vide, pas `''`. Sans cela, fermer
      // une création à moitié remplie ne demandait aucune confirmation — alors
      // que c'est précisément la saisie la plus longue à refaire.
      initialFormSnapshot.current = serializeForm(blankForm);
      setCurrentStep(1);
    }
    setIsModalOpen(true);
  };

  /**
   * Change d'étape en validant celle qu'on quitte.
   *
   * Retourne `false` si la validation bloque : le pied de page s'en sert pour
   * ne pas avancer. Les messages d'erreur sont posés sur les champs (étape 2)
   * et non dans un bandeau global, pour que le vendeur voie quoi corriger.
   */
  const goToStep = (next: number) => {
    if (next > currentStep && !validateStep(currentStep)) return false;
    if (next < 1 || next > STEPS.length) return false;
    setCurrentStep(next);
    // Remonter en haut : sur l'étape 3 la matrice est plus haute que l'écran,
    // et le champ en erreur serait sinon hors champ de vision.
    dialogRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  };

  /** Valide l'étape courante. Retourne `false` et affiche les erreurs sinon. */
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      const images = formData.images || [];
      if (images.length === 0) {
        setFieldErrors({ images: 'Ajoutez au moins une photo.' });
        return false;
      }
      setFieldErrors((prev) => ({ ...prev, images: '' }));
      return true;
    }

    if (step === 2) {
      const errors: Record<string, string> = {};
      const name = (formData.name || '').trim();
      if (!name) errors.name = 'Le nom est obligatoire.';
      else if (name.length > 140) errors.name = '140 caractères maximum.';

      if (!(formData.category || '').trim()) errors.category = 'Choisissez une catégorie.';

      if (formData.price == null) errors.price = 'Le prix est obligatoire.';
      else if (Number(formData.price) <= 0) errors.price = 'Le prix doit être supérieur à 0.';

      // Le stock n'est obligatoire que sans variantes : avec des options,
      // `products.stock` est recalculé à partir des variantes et le champ
      // est désactivé (cf. ProductEssentialsStep).
      const hasVersions = (formData.options || []).length > 0;
      if (!hasVersions && formData.stock == null) errors.stock = 'Indiquez le stock.';

      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return false;
      return true;
    }

    return true;
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

  const handleSubmit = async () => {
    // Le pied de page est la seule porte de sortie : on valide tout d'un coup
    // plutôt que de laisser partir une fiche à prix 0.
    if (!validateStep(1) || !validateStep(2)) {
      const firstBroken = !formData.images?.length ? 1 : 2;
      setCurrentStep(firstBroken);
      return;
    }
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
        closeModal();
      } else if (result.success) {
        setShowSuccessToast(editingProduct ? 'Produit mis à jour avec succès !' : 'Produit ajouté avec succès !');
        setTimeout(() => setShowSuccessToast(null), 3000);
        closeModal();
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
{/* Modal Produit (Step Form) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
            className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header with Step Indicator */}
            <div className="px-3 md:px-8 pt-3 md:pt-6 pb-3 md:pb-4 border-b border-gray-100 bg-white sticky top-0 z-10">
              <div className="flex items-start justify-between gap-3 mb-4 md:mb-6">
                <div className="min-w-0">
                  {/* Fil d'Ariane : sans lui, la modale flottait sans dire
                      quel produit elle modifie ni d'où elle vient. */}
                  <p className="text-[11px] text-gray-400 font-semibold mb-0.5">
                    Boutique
                    {editingProduct?.name && (
                      <>
                        {' '}› Modifier{' '}
                        <span className="text-gray-600">« {editingProduct.name} »</span>
                      </>
                    )}
                    {!editingProduct && <> › Nouveau produit</>}
                  </p>
                  <h2
                    id="product-modal-title"
                    className="text-lg md:text-2xl font-bold text-gray-900 tracking-tight"
                  >
                    {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={requestClose}
                  aria-label="Fermer"
                  className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1.5 md:p-2 hover:bg-gray-50 rounded-full"
                >
                  <X size={18} className="md:size-6" />
                </button>
              </div>

              {/* Step Progress Bar — cliquable sur les étapes déjà visitées */}
              <div className="flex items-center justify-between relative px-1 md:px-2">
                <div className="absolute top-1/2 left-0 right-0 h-px md:h-0.5 bg-gray-100 -translate-y-1/2 z-0 mx-6 md:mx-8" />
                {STEPS.map((step) => {
                  const isCurrent = currentStep === step.s;
                  const isDone = currentStep > step.s;
                  // On ne peut revenir que sur une étape franchie : sur une
                  // étape à venir, cela promettrait de la valider sans l'avoir vue.
                  const canGoBack = isDone;
                  const badge = (
                    <>
                      <span
                        className={`
                          w-6 h-6 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-300
                          ${isCurrent ? 'bg-[#f56b2a] text-white shadow-lg shadow-orange-100 ring-4 ring-orange-50/50' :
                            isDone ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-100 text-gray-300'}
                        `}
                      >
                        {isDone ? <Check size={12} className="md:size-[18px]" /> : <step.icon size={12} className="md:size-[18px]" />}
                      </span>
                      <span className={`text-[10px] md:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap ${currentStep >= step.s ? 'text-gray-900' : 'text-gray-300'}`}>
                        {step.label}
                      </span>
                    </>
                  );

                  return (
                    <div key={step.s} className="relative z-10 flex flex-col items-center gap-1.5 md:gap-2">
                      {canGoBack ? (
                        <button
                          type="button"
                          onClick={() => setCurrentStep(step.s)}
                          aria-current={isCurrent ? 'step' : undefined}
                          aria-label={`Revenir à l'étape ${step.s} : ${step.label}`}
                          className="flex flex-col items-center gap-1.5 md:gap-2 group"
                        >
                          {badge}
                        </button>
                      ) : (
                        <div aria-current={isCurrent ? 'step' : undefined}>{badge}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* <form> : rend `<form onSubmit>`, la validation native et le
                raccourci Entrée actifs. `handleSubmit` n'était qu'un onClick,
                donc les `required` posés sur les champs n'étaient jamais
                évalués. */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (currentStep < 3) goToStep(currentStep + 1);
                else void handleSubmit();
              }}
              className="contents"
            >
              <div className="flex-grow overflow-y-auto p-4 md:p-8 custom-scrollbar">
                {currentStep === 1 && (
                  <div className="animate-in slide-in-from-right-4 duration-300">
                    <ProductImagesStep
                      formData={formData}
                      setFormData={setFormData}
                      errors={fieldErrors}
                    />
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="animate-in slide-in-from-right-4 duration-300">
                    <ProductEssentialsStep
                      formData={formData}
                      setFormData={setFormData}
                      mainCategories={filteredMainCategories}
                      categoryMapping={filteredCategoryMapping}
                      errors={fieldErrors}
                    />
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    {/* F1 : la description passe devant. C'est le texte le plus
                        lu sur la fiche, il était enterré sous la matrice. */}
                    <ProductDescriptionStep formData={formData} setFormData={setFormData} />

                    {formData.businessType === 'shopping' && (
                      <div className="pt-5 border-t border-gray-100">
                        <VariantMatrixEditor
                          options={(formData.options || []) as ProductOptionDef[]}
                          variants={(formData.variants || []) as ProductVariantDef[]}
                          basePrice={Number(formData.price) || 0}
                          images={formData.images || []}
                          onChange={(options, variants) => {
                            setFormData((prev) => ({ ...prev, options, variants }));
                          }}
                        />
                      </div>
                    )}

                    {formData.businessType === 'shopping' && (
                      <div className="pt-5 border-t border-gray-100">
                        <WholesaleTiersEditor formData={formData} setFormData={setFormData} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pied : toujours présent (à l'étape 1 c'est le seul moyen de
                  continuer, le fil d'Ariane n'étant cliquable que vers l'arrière),
                  erreurs lisibles, rappel du nombre de variantes avant de valider. */}
              <div className="p-3 md:px-8 py-4 border-t border-gray-100 bg-gray-50/50 flex flex-col gap-3">
                  {submitError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 px-3.5 py-3 bg-rose-50 border border-rose-100 rounded-xl text-sm font-bold text-rose-600"
                    >
                      <AlertCircle size={16} className="shrink-0 mt-px" />
                      <span className="min-w-0 break-words">{submitError}</span>
                      <button
                        type="button"
                        onClick={() => setSubmitError(null)}
                        aria-label="Fermer le message"
                        className="ml-auto p-1 text-rose-300 hover:text-rose-600 shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 md:gap-4">
                    {/* Pas de « Retour » à l'étape 1 : la croix et Échap
                       permettent déjà de sortir, un retour serait un retour au vide. */}
                    {currentStep > 1 && (
                      <Button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => goToStep(currentStep - 1)}
                        variant="ghost"
                        size="md"
                        className="text-gray-500 hover:text-gray-800 font-bold text-sm"
                        icon={<ChevronLeft size={18} />}
                      >
                        Retour
                      </Button>
                    )}

                    <div className={`flex flex-col items-end gap-1.5 ${currentStep === 1 ? 'ml-auto' : ''}`}>
                      {currentStep === 3 && (formData.variants?.length || 0) > 0 && (
                        <p className="text-[11px] font-semibold text-gray-400">
                          {formData.variants?.length} variante(s) seront enregistrées
                        </p>
                      )}
                      {currentStep < 3 ? (
                        <Button
                          type="submit"
                          variant="primary"
                          size="md"
                          className="font-bold text-sm"
                          icon={<ChevronRight size={18} />}
                          iconPosition="right"
                        >
                          {currentStep === 2 ? 'Vérifier la fiche' : 'Continuer'}
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          loading={isSubmitting}
                          loadingText="Envoi..."
                          variant="primary"
                          size="md"
                          className="font-bold text-sm"
                        >
                          Enregistrer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation de fermeture — pas de `window.confirm` : cf. AGENTS.md */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-title"
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
          >
            <div className="p-6 text-center">
              <div className="w-14 h-14 mx-auto bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                <AlertCircle size={26} />
              </div>
              <h3 id="discard-title" className="text-lg font-bold text-gray-900 mb-2">
                Abandonner la saisie ?
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Vos modifications ne sont pas enregistrées. Le produit{' '}
                {editingProduct ? 'gardera sa version précédente' : 'ne sera pas créé'}.
              </p>
              <div className="flex flex-col gap-2.5 mt-6">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="w-full py-3.5 bg-[#f56b2a] text-white rounded-2xl font-bold text-sm hover:bg-[#d55a20] transition-colors active:scale-[0.98]"
                >
                  Continuer la saisie
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full py-3.5 text-gray-500 font-bold text-sm hover:bg-gray-50 rounded-2xl transition-colors"
                >
                  Abandonner
                </button>
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
