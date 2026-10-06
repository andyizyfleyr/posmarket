import React from "react";
import Image from "next/image";
import { Package, ArrowRight, ChevronRight, Maximize2, Zap, Clock, Star, ShoppingBag, ShoppingCart, AlertCircle, Check, MessageCircle, ShieldCheck, RotateCcw, Truck, ChevronLeft, Loader2, Store, CheckCircle2, X, ChevronDown, Eye } from "lucide-react";
import Button from "@/components/Button";
import ProductCard from "@/components/ProductCard";
import { formatCurrency, formatNumber } from "@/utils";
import { getNormalizedWholesaleTiers } from "@/utils/wholesale";
import { RichDescription, AutoHighlights, AutoBadgesRow, AutoSpecsGrid } from "@/components/storefront/RichDescription";
import { extractDescriptionHighlights, buildAutoSpecs, buildAutoBadges } from "@/utils/product-description";
import { generateProductSlug } from "@/utils/slug";
import { needsNoOptimization } from "@/lib/imageOptimizer";
import {
  findVariantByOptions,
  optionValueAvailability,
  totalVariantStock,
  variantIsInStock,
} from "@/utils/variants";
import { Link } from "@/components/RouterPolyfill";
import type { NotificationType, Product, ProductOption, ProductVariant, Review, StoreData } from "@/types";
import type { StorefrontProduct } from "../StorefrontView";

/**
 * Props de la fiche produit.
 *
 * Le composant est monté par `StorefrontView` via `next/dynamic` : le contrat
 * est figé ici pour que la couche de présentation reste typée de bout en bout
 * (les `any` laissés auparavant masquaient les erreurs de props).
 */
type ProductDetailsProps = {
  selectedProductDetails: StorefrontProduct | null;
  isInitialLoading: boolean;
  allProducts: StorefrontProduct[];
  isNavigating: boolean;
  selectedOptions: Record<string, string>;
  setSelectedOptions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  sameSelectedOptions: (
    a: Record<string, string> | null | undefined,
    b: Record<string, string> | null | undefined,
  ) => boolean;
  selectedDetailImage: string | null;
  setSelectedDetailImage: React.Dispatch<React.SetStateAction<string | null>>;
  setProductSwipeIdx: React.Dispatch<React.SetStateAction<number>>;
  productSwipeIdx: number;
  setCurrentZoomImage: React.Dispatch<React.SetStateAction<string | null>>;
  setZoomGallery: React.Dispatch<React.SetStateAction<string[]>>;
  setIsImageModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  lastVisitedStoreRef?: React.MutableRefObject<string | null>;
  user?: { name?: string | null; email?: string | null } | null;
  setAuthMode?: (mode: "login" | "register") => void;
  setShowAuthModal?: (open: boolean) => void;
  handleGoBack: (path: string) => void;
  addToCart: (product: StorefrontProduct, variantId?: string) => void;
  buyNow: (
    product: StorefrontProduct,
    variantId?: string,
    selectedOptions?: Record<string, string>,
  ) => void;
  localNotify: (
    message: string,
    type?: NotificationType,
    title?: string,
  ) => void;
  loadingReviews: Record<string, boolean>;
  selectedProductId: string | null;
  showAllProductReviews: boolean;
  setShowAllProductReviews: React.Dispatch<React.SetStateAction<boolean>>;
  handleCardAddToCart: (product: Product) => void;
  handleCardBuyNow: (product: Product) => void;
  warmProduct: (product: { id: string; image?: string }) => void;
  safeNavigate: (path: string, options?: { action?: () => void }) => void;
  setSelectedCategory: (category: string) => void;
  addWholesaleToCart: (product: StorefrontProduct, minQty?: number, variantId?: string | null) => void;
  isDescriptionExpanded: boolean;
  setIsDescriptionExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  stores?: StoreData[];
  cartItemsCount: number;
  /**
   * Le couple (produit, variante, options) affiché est-il déjà au panier ?
   * Sert à ne pas reproposer un ajout qui ne ferait qu'incrémenter en double.
   */
  isVariantInCart: (
    variantId?: string | null,
    options?: Record<string, string>,
  ) => boolean;
  cartTotal: number;
};

function OptionSelectionHint({
  allSelected,
  outOfStock,
  hasMatrix,
  variantName,
  variantStock,
  price,
}: {
  allSelected: boolean;
  outOfStock: boolean;
  hasMatrix: boolean;
  variantName?: string;
  variantStock: number | null;
  price: number | null;
}) {
  if (!allSelected) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200/60 px-2.5 py-1.5 rounded-lg">
        <AlertCircle size={11} className="flex-shrink-0" />
        Sélectionnez les options pour commander
      </p>
    );
  }

  if (!hasMatrix) return null;

  if (outOfStock) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-red-700 bg-red-50 border border-red-200/60 px-2.5 py-1.5 rounded-lg">
        <AlertCircle size={11} className="flex-shrink-0" />
        Cette combinaison est indisponible pour le moment
      </p>
    );
  }

  if (variantStock == null) return null;

  return (
    <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-semibold bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-lg">
      <span className="flex items-center gap-1.5 text-emerald-800 truncate">
        <CheckCircle2 size={11} className="flex-shrink-0" />
        {variantName}
      </span>
      <span className="flex items-center gap-2 flex-shrink-0">
        {price != null && price > 0 && (
          <span className="text-emerald-700">{formatCurrency(price)}</span>
        )}
        <span className={variantStock <= 5 ? "text-amber-600" : "text-emerald-600"}>
          {variantStock <= 5
            ? `Plus que ${formatNumber(variantStock)}`
            : `${formatNumber(variantStock)} en stock`}
        </span>
      </span>
    </div>
  );
}

/**
 * En-tête de la fiche produit, dans l'ordre de lecture d'un acheteur :
 * vendeur -> titre -> preuve sociale -> prix -> stock -> logistique.
 *
 * Les deux points de rupture (`lg:hidden` / `hidden lg:block`) partagent le
 * même contenu : un seul jeu de composants évite que le desktop et le mobile
 * ne dérivent l'un de l'autre. L'exemplaire masqué par `display:none` sort du
 * tree d'accessibilité, donc un seul `<h1>` reste exposé à la fois.
 */

/** Fil du vendeur : logo réel, nom vérifié, catégorie. */
function ProductSeller({
  product,
  logo,
  category,
  onCategoryClick,
}: {
  product: StorefrontProduct;
  logo?: string;
  category: string;
  onCategoryClick: () => void;
}) {
  // Le bloc est centré : un nom long déborde des deux côtés du bloc, la ligne se
  // remplit donc de gauche à droite et se termine par « … » (truncate).
  return (
    <div className="flex items-center justify-center gap-2.5 min-w-0">
      <Link
        to={`/store/${product.storeSlug || product.storeId}`}
        tabIndex={-1}
        aria-hidden="true"
        className="relative w-9 h-9 lg:w-10 lg:h-10 flex-shrink-0 rounded-full overflow-hidden bg-gray-50 border border-gray-200/80 ring-1 ring-gray-900/[0.04] group/vendor active:opacity-80 transition-opacity"
      >
        {logo ? (
          <Image
            src={logo}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
            unoptimized={needsNoOptimization(logo)}
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center">
            <Store size={16} className="text-gray-300" />
          </span>
        )}
      </Link>

      <div className="min-w-0 max-w-full">
        <Link
          to={`/store/${product.storeSlug || product.storeId}`}
          className="flex items-center gap-1 min-w-0 justify-center group/vendor"
        >
          <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
            Vendu par
          </span>
          <span className="text-[13px] font-semibold text-gray-800 truncate min-w-0 group-hover/vendor:text-brand transition-colors">
            {product.storeName}
          </span>
          <CheckCircle2
            size={13}
            role="img"
            aria-label="Boutique vérifiée"
            className="text-brand flex-shrink-0"
          />
        </Link>
        {category && (
          <button
            type="button"
            onClick={onCategoryClick}
            className="mt-0.5 flex items-center justify-center gap-0.5 text-[11px] text-gray-400 hover:text-brand transition-colors cursor-pointer min-w-0 max-w-full"
          >
            <span className="truncate">{category}</span>
            <ChevronRight size={11} className="flex-shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Titre du produit.
 *
 * L'unité n'apparaît volontairement pas ici : le badge orange collé au `h1`
 * faisait doublon avec le `/ {unit}` du bloc prix et décalait la ligne de base
 * du titre.
 */
function ProductTitle({ product }: { product: StorefrontProduct }) {
  return (
    <h1 className="text-[17px] lg:text-[22px] font-bold text-gray-950 leading-[1.25] tracking-[-0.01em]">
      {product.name}
    </h1>
  );
}

/**
 * Preuve sociale : note, avis, ventes, vues.
 *
 * Les cinq étoiles restent visibles — réduire la note à un nombre encadré
 * jetait l'information la plus lue d'une fiche produit. Le tout tient sur une
 * ligne, avec des séparateurs `·` qui ne peuvent pas se retrouver orphelins
 * comme ceux d'un `flex-wrap`.
 */
function ProductSocialProof({
  rating,
  reviewTotal,
  salesCount,
  viewCount,
  isFood,
  onReviewsClick,
}: {
  rating: number;
  reviewTotal: number;
  salesCount: number;
  viewCount: number;
  isFood: boolean;
  onReviewsClick: () => void;
}) {
  // Ventes et vues ne s'affichent qu'au-dessus de zéro : « 0 vendus » est un
  // signal négatif, et un « 0 · 0 » sur une fiche neuve n'aide personne.
  const counters = [
    salesCount > 0 && {
      icon: <ShoppingBag size={11} className="flex-shrink-0" />,
      label: `${formatNumber(salesCount)} ${isFood ? "commandes" : "vendus"}`,
    },
    viewCount > 0 && {
      icon: <Eye size={11} className="flex-shrink-0" />,
      label: `${formatNumber(viewCount)} vues`,
    },
  ].filter(Boolean) as { icon: React.ReactNode; label: string }[];

  return (
    <div className="flex items-center gap-2 text-[11px] text-gray-400">
      <button
        type="button"
        onClick={onReviewsClick}
        aria-label={`Voir les ${reviewTotal} avis`}
        className="flex items-center gap-1.5 min-w-0 rounded-md hover:opacity-70 active:opacity-60 transition-opacity cursor-pointer"
      >
        <span className="flex text-amber-400 gap-px flex-shrink-0">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              size={12}
              strokeWidth={1.5}
              fill={s <= Math.round(rating) ? "currentColor" : "none"}
            />
          ))}
        </span>
        <span className="font-semibold text-gray-700">{rating.toFixed(1)}</span>
        <span className="truncate">({formatNumber(reviewTotal)} avis)</span>
      </button>

      {counters.map((c) => (
        <span key={c.label} className="flex items-center gap-2 min-w-0">
          <span className="text-gray-300 flex-shrink-0">·</span>
          <span className="flex items-center gap-1 min-w-0 truncate">
            {c.icon}
            {c.label}
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Disponibilité et délais, sur une seule rangée.
 *
 * Le stock est un signal d'achat, pas une statistique : il vit sous le prix, à
 * côté du bouton, et non dans la rangée de preuve sociale. Les deux
 * informations se lisent ensemble — « en stock » sans délai n'aide pas à
 * décider — d'où une rangée unique plutôt que deux lignes empilées.
 */
function ProductStockRow({
  isOutOfStock,
  isLowStock,
  stockValue,
  isSelectedOutOfStock,
  isFood,
  deliveryTime,
  preparationTime,
}: {
  isOutOfStock: boolean;
  isLowStock: boolean;
  stockValue: number | null;
  isSelectedOutOfStock: boolean;
  isFood: boolean;
  deliveryTime?: string;
  preparationTime?: string;
}) {
  const unavailable = isOutOfStock || isSelectedOutOfStock;
  const hasCount = stockValue !== null && !unavailable;

  // Préparation et livraison partagent le même champ côté vendeur : en food on
  // retombe sur le délai de livraison quand le délai de préparation est vide.
  const prepTime = isFood ? preparationTime || deliveryTime : undefined;
  const delays = [
    prepTime && {
      icon: <Clock size={13} className="text-green-600 flex-shrink-0" />,
      label: "Préparation",
      value: prepTime,
    },
    deliveryTime && {
      icon: <Truck size={13} className="text-blue-500 flex-shrink-0" />,
      label: "Livraison",
      value: deliveryTime,
    },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string }[];

  return (
    <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap">
      <p
        className={`flex items-center gap-1.5 text-[12px] font-medium min-w-0 ${
          unavailable
            ? "text-red-600"
            : isLowStock
              ? "text-amber-600"
              : "text-emerald-700"
        }`}
      >
        {unavailable || isLowStock ? (
          <AlertCircle size={13} className="flex-shrink-0" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
        )}

        {isSelectedOutOfStock && !isOutOfStock ? (
          "Combinaison indisponible"
        ) : isOutOfStock ? (
          "Rupture de stock"
        ) : isLowStock ? (
          <>Plus que {formatNumber(stockValue ?? 0)} disponibles</>
        ) : (
          <>
            {hasCount && formatNumber(stockValue)}
            {hasCount ? " en stock" : "En stock"}
          </>
        )}
      </p>

      {delays.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-gray-500">
          {delays.map((item, i) => (
            <span key={item.label} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <span className="text-gray-300">·</span>}
              {item.icon}
              <span className="truncate">
                {item.label}{" "}
                <b className="font-semibold text-gray-800">{item.value}</b>
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Corps du sélecteur d'options : rappels de sélection, groupes de valeurs,
 * indice de disponibilité.
 *
 * Partagé entre l'accordéon de la carte mobile et la feuille modale qui
 * s'ouvre au clic sur « Choisir les options » : le même sélecteur ne peut pas
 * avoir deux implémentations qui divergent.
 */
/**
 * Carte de couleurs pour l'affichage nuancier (D1) : une option nommée
 * « couleur » se choisit avec des pastilles plutôt que des boutons texte.
 */
const COLOR_HEX: Record<string, string> = {
  noir: '#111111', blanc: '#ffffff', rouge: '#dc2626', bleu: '#2563eb',
  marine: '#1e3a8a', vert: '#16a34a', kaki: '#6b7280', jaune: '#eab308',
  orange: '#f97316', rose: '#ec4899', violet: '#7c3aed', gris: '#9ca3af',
  beige: '#d6c7a1', marron: '#795548', bordeaux: '#6b1226', or: '#f59e0b',
  argent: '#cbd5e1', 'bleu ciel': '#38bdf8', menthe: '#2dd4bf',
  ecru: '#efeae2', turquoise: '#14b8a6', magenta: '#d946ef', cyan: '#22d3ee',
  lavande: '#a78bfa', corail: '#fb7185', saumon: '#fda4af', champagne: '#f7e7ce',
};

function colorHexFor(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  if (COLOR_HEX[v]) return COLOR_HEX[v];
  // Hex / rgb direct ("#FF0000", "rgb(...)") collé comme valeur d'option.
  if (/^#?[0-9a-f]{3,8}$/i.test(v)) return v.startsWith('#') ? v : `#${v}`;
  return undefined;
}

function OptionsPicker({
  options,
  selectedOptions,
  onSelect,
  onRemove,
  isValueDisabled,
  allSelected,
  outOfStock,
  hasMatrix,
  variantName,
  variantStock,
  price,
}: {
  options: ProductOption[];
  selectedOptions: Record<string, string>;
  onSelect: (optionId: string, val: string) => void;
  onRemove: (optionId: string) => void;
  isValueDisabled: (optionId: string, val: string) => boolean;
  allSelected: boolean;
  outOfStock: boolean;
  hasMatrix: boolean;
  variantName?: string;
  variantStock: number | null;
  price: number | null;
}) {
  const selectedCount = options.filter((o) => selectedOptions[o.id]).length;

  return (
    <>
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3 bg-gray-50 border border-gray-100 rounded-xl px-2 py-1.5">
          <span className="text-[8px] font-bold uppercase tracking-wider text-gray-400">Sélection :</span>
          {options.map((o) => {
            const v = selectedOptions[o.id];
            if (!v) return null;
            return (
              <span
                key={o.id}
                className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full pl-2 pr-0.5 py-0.5 text-[10px] font-semibold text-gray-800"
              >
                {o.name}: {v}
                <button
                  type="button"
                  aria-label={`Retirer ${o.name}`}
                  onClick={() => onRemove(o.id)}
                  className="w-4 h-4 rounded-full bg-gray-100 hover:bg-brand hover:text-white flex items-center justify-center transition-colors"
                >
                  <X size={9} strokeWidth={3} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="space-y-3.5">
        {options.map((option) => {
          const selectedVal = selectedOptions[option.id];
          return (
            <div key={option.id}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-900">{option.name}</span>
                {selectedVal ? (
                  <span className="text-[11px] font-semibold text-brand">{selectedVal}</span>
                ) : (
                  <span className="text-[9px] font-medium text-gray-300">Choisissez...</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {option.values.map((val: string) => {
                  const isSelected = selectedVal === val;
                  const isDisabled = isValueDisabled(option.id, val);
                  const isSwatch = /couleur|color/i.test(option.name);
                  const hex = isSwatch ? colorHexFor(val) : undefined;
                  if (isSwatch && hex) {
                    return (
                      <button
                        key={val}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => onSelect(option.id, val)}
                        aria-pressed={isSelected}
                        title={isDisabled ? `Indisponible : ${val}` : val}
                        className={`relative w-10 h-10 rounded-full transition-all active:scale-90 border-2 ${
                          isSelected
                            ? "border-brand ring-2 ring-orange-100 scale-110"
                            : isDisabled
                              ? "border-gray-200 opacity-35 cursor-not-allowed"
                              : "border-gray-200 hover:border-gray-300"
                        }`}
                        style={{ backgroundColor: hex }}
                      >
                        {isSelected && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <Check
                              size={14}
                              strokeWidth={3.5}
                              className={COLOR_HEX[val.trim().toLowerCase()] === '#ffffff' && val.trim() !== '' ? 'text-gray-800' : 'text-white'}
                            />
                          </span>
                        )}
                        {isDisabled && <span className="absolute inset-0 flex items-center justify-center"><X size={12} className="text-gray-400" /></span>}
                      </button>
                    );
                  }
                  return (
                    <button
                      key={val}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => onSelect(option.id, val)}
                      aria-pressed={isSelected}
                      title={isDisabled ? "Indisponible" : undefined}
                      className={`relative min-w-[44px] px-2.5 py-1.5 rounded-md text-[10.5px] font-semibold transition-all border active:brightness-95 transition-colors ${
                        isDisabled
                          ? "bg-gray-50 text-gray-300 border-gray-100 line-through cursor-not-allowed"
                          : isSelected
                            ? "bg-brand text-white border-brand shadow-md shadow-orange-100"
                            : "bg-white text-gray-600 border-gray-200 active:border-brand"
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-brand rounded-full flex items-center justify-center ring-2 ring-white">
                          <Check size={9} strokeWidth={3.5} className="text-white" />
                        </span>
                      )}
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <OptionSelectionHint
        allSelected={allSelected}
        outOfStock={outOfStock}
        hasMatrix={hasMatrix}
        variantName={variantName}
        variantStock={variantStock}
        price={price}
      />
    </>
  );
}

/**
 * Résumé des options affiché dans la page.
 *
 * Le sélecteur n'existe qu'en un seul endroit — la feuille modale — sinon il
 * était dupliqué (accordéon desktop + carte mobile) et pouvait diverger. Cette
 * ligne ne le reproduit pas : elle rappelle la sélection courante et sert de
 * bouton pour rouvrir la feuille. C'est indispensable une fois la sélection
 * complète, car le libellé du CTA passe alors de « Choisir les options » à
 * « Ajouter au panier » : sans ce rappel, la modification devient inaccessible.
 */
function OptionsSummaryRow({
  options,
  selectedOptions,
  onOpen,
}: {
  options: ProductOption[];
  selectedOptions: Record<string, string>;
  onOpen: () => void;
}) {
  const selectedCount = options.filter((o) => !!selectedOptions[o.id]).length;
  const allSelected = selectedCount === options.length;
  const summary = options
    .filter((o) => !!selectedOptions[o.id])
    .map((o) => `${o.name}: ${selectedOptions[o.id]}`)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Choisir les options"
      className="w-full flex items-center gap-2 bg-white border border-gray-100 rounded-2xl px-3 py-2.5 text-left shadow-sm active:bg-gray-50 transition-colors cursor-pointer"
    >
      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand/10 text-brand shrink-0">
        <Package size={13} strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold text-gray-900 leading-tight">
          Options &amp; Variantes
        </span>
        <span className="block text-[10px] font-medium text-gray-500 truncate">
          {summary || "Touchez pour choisir"}
        </span>
      </span>
      {allSelected ? (
        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full shrink-0">
          <CheckCircle2 size={10} strokeWidth={3} /> Prêt
        </span>
      ) : (
        <span className="text-[10px] font-semibold text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-full shrink-0">
          {selectedCount}/{options.length}
        </span>
      )}
      <ChevronRight size={15} className="shrink-0 text-gray-400" />
    </button>
  );
}

export function ProductDetailsView(props: ProductDetailsProps) {
  const product = props.selectedProductDetails;
  const { isInitialLoading, allProducts, handleGoBack, isNavigating } = props;
  // Garde-fous AVANT tout hook : le composant interne déclare ses propres
  // hooks, aucun retour anticipé n'est autorisé au-dessus de cette limite.
  if (!product) {
    // Catalogue chargé mais produit introuvable -> 404 explicite
    if (!isInitialLoading && allProducts.length > 0) {
      return (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-400">
            <Package size={30} />
          </div>
          <p className="text-base font-bold text-gray-900">Produit introuvable</p>
          <p className="text-xs text-gray-500 font-semibold mt-1 max-w-[280px]">
            Ce produit n&apos;existe plus ou n&apos;est pas disponible actuellement.
          </p>
          <Button
            onClick={() => handleGoBack("/")}
            loading={isNavigating}
            loadingText="Chargement..."
            variant="primary"
            size="md"
            className="mt-6"
            icon={<ArrowRight size={14} />}
            iconPosition="right"
          >
            Retour à l&apos;accueil
          </Button>
        </div>
      );
    }
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 pb-28 lg:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="aspect-square rounded-[24px] skeleton" />
          <div className="space-y-4">
            <div className="h-4 w-1/3 skeleton rounded" />
            <div className="h-7 w-3/4 skeleton rounded" />
            <div className="h-24 w-full skeleton rounded-2xl" />
            <div className="h-12 w-full skeleton rounded-full" />
          </div>
        </div>
      </div>
    );
  }
  return <ProductDetailsContent {...props} selectedProductDetails={product} />;
}

/** Corps de la fiche produit : le produit est garanti non nul ici. */
function ProductDetailsContent(props: ProductDetailsProps & { selectedProductDetails: StorefrontProduct }) {
  const {
    selectedProductDetails,
    allProducts,
    selectedOptions,
    setSelectedOptions,
    selectedDetailImage,
    setSelectedDetailImage,
    setProductSwipeIdx,
    productSwipeIdx,
    setCurrentZoomImage,
    setZoomGallery,
    setIsImageModalOpen,
    addToCart,
    buyNow,
    localNotify,
    loadingReviews,
    selectedProductId,
    showAllProductReviews,
    setShowAllProductReviews,
    handleCardAddToCart,
    warmProduct,
    safeNavigate,
    setSelectedCategory,
    addWholesaleToCart,
    isDescriptionExpanded,
    setIsDescriptionExpanded,
  cartItemsCount,
  isVariantInCart,
} = props;
  const product = selectedProductDetails;
  const safeAllProducts = Array.isArray(allProducts) ? allProducts : [];
    const relatedProducts = safeAllProducts
      .filter(
        (p: StorefrontProduct) =>
          ((p.category && p.category === product.category) ||
            p.storeId === product.storeId) &&
          p.id !== product.id &&
          p.isOnline !== false,
      )
      .slice(0, 10);

    const mainCat = product.mainCategory || product.category || "Boutique";
    // Le breadcrumb ne montre que la vraie catégorie : le fallback "Boutique"
    // de `mainCat` ferait afficher « Boutique › » comme un lien de navigation.
    const realCategory = product.mainCategory || product.category || "";
    const isFood =
      product.businessType === "food" ||
      mainCat === "Restauration & Livraison Rapide";
    // Pas de texte de repli : une description absente ne doit pas inventer un
    // argumentaire commercial qui n'a pas été saisi par le vendeur.
    const descriptionText = product.description || "";

    // --- Pricing & variants ---
    const options = Array.isArray(product.options) ? product.options : [];
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const reviews: Review[] = Array.isArray(product.reviews) ? product.reviews : [];

    const renderReviewCard = (review: Review, idx: number) => (
      <div key={idx} className="flex gap-3 py-4 first:pt-1 last:pb-0">
        <div
          className={`w-10 h-10 md:w-9 md:h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold overflow-hidden ${
            review.avatarUrl
              ? "bg-gray-100"
              : [
                  "bg-gradient-to-br from-orange-100 to-orange-200 text-[#d55a20]",
                  "bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700",
                  "bg-gradient-to-br from-rose-100 to-rose-200 text-rose-600",
                ][idx % 3]
          }`}
        >
          {review.avatarUrl ? (
            <img
              src={review.avatarUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            review.author?.[0]?.toUpperCase() || "A"
          )}
        </div>
        <div className="flex-grow min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="text-xs font-bold text-gray-900 truncate">
              {review.author?.split(' ')[0] || review.author}
            </h4>
            <span className="text-[10px] font-medium text-gray-400 flex-shrink-0">
              {new Date(review.date).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium mb-1.5">
            <CheckCircle2 size={10} className="text-emerald-500" />
            <span>Avis vérifié</span>
          </div>
          <div className="flex items-center gap-0.5 mb-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={11}
                className="text-amber-400"
                fill={s <= review.rating ? "currentColor" : "none"}
              />
            ))}
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            {review.comment}
          </p>
        </div>
      </div>
    );
    const hasOptions = options.length > 0;
    const allSelected =
      !hasOptions || options.every((o) => !!selectedOptions[o.id]);
    const selectedOptionCount = options.filter(
      (o) => !!selectedOptions[o.id],
    ).length;
    const typedVariants: ProductVariant[] = variants;
    const matchedVariant = hasOptions
      ? findVariantByOptions(typedVariants, selectedOptions)
      : undefined;

    // Stock affiché : celui de la combinaison choisie, sinon le total des
    // variantes, sinon le stock simple du produit.
    const selectedStock = hasOptions && variants.length > 0
      ? matchedVariant
        ? Math.max(0, Number(matchedVariant.stock) || 0)
        : totalVariantStock(typedVariants)
      : product.stock != null
        ? (product.stock as number)
        : null;
    const isSelectedOutOfStock =
      hasOptions &&
      variants.length > 0 &&
      allSelected &&
      (!matchedVariant || !variantIsInStock(matchedVariant));

    const basePrice = matchedVariant ? matchedVariant.price : product.price;
    const discountPct =
      product.originalPrice && product.originalPrice > basePrice
        ? Math.round(
            ((product.originalPrice - basePrice) / product.originalPrice) *
              100,
          )
        : 0;

    const wholesaleTiers = React.useMemo(() => {
      return getNormalizedWholesaleTiers(product);
    }, [product]);

    const hasWholesale = wholesaleTiers.length > 0 && !isFood;

    const [addingWholesaleIdx, setAddingWholesaleIdx] = React.useState<number | null>(null);
    const [addedWholesaleIdx, setAddedWholesaleIdx] = React.useState<number | null>(null);
  // Le selecteur d'options n'existe qu'en feuille modale, sur toutes les
  // tailles d'ecran : un second bloc dans la page dupliquait les memes
  // controles et pouvait diverger du premier.
  const [isOptionsSheetOpen, setIsOptionsSheetOpen] = React.useState(false);

  // L'arrière-plan ne doit pas défiler sous la feuille, et Escape doit
  // fermer : sans cela le geste de fermer fait remonter la page.
  React.useEffect(() => {
    if (!isOptionsSheetOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOptionsSheetOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOptionsSheetOpen]);
    const [isWholesaleExpanded, setIsWholesaleExpanded] = React.useState(false);

    const handleWholesaleAdd = (idx: number, minQty: number) => {
      if (addingWholesaleIdx === idx || addedWholesaleIdx === idx) return;
      if (hasOptions && variants.length > 0 && !matchedVariant) {
        // Un produit à matrice ne se vend pas « au hasard » : on ouvre le
        // sélecteur plutôt que d'ajouter une ligne sans variante.
        guardSelection();
        return;
      }
      if (stockValue !== null && stockValue < minQty) {
        localNotify(
          `Stock insuffisant (${stockValue} disponibles) pour la quantité en gros de ${minQty}`,
          "warning",
        );
        return;
      }
      setAddingWholesaleIdx(idx);
      addWholesaleToCart(product, minQty, matchedVariant?.id ?? null);
      setTimeout(() => {
        setAddingWholesaleIdx(null);
        setAddedWholesaleIdx(idx);
      }, 700);
      setTimeout(() => {
        setAddedWholesaleIdx((prev) => (prev === idx ? null : prev));
      }, 1900);
    };

    const productStore = React.useMemo(() => {
      if (!props.stores) return null;
      return props.stores.find((s) => s.id === product.storeId);
    }, [props.stores, product.storeId]);

    const storePhone = productStore?.phone || productStore?.settings?.phone;
    const waDigits = storePhone ? String(storePhone).replace(/\D/g, "") : null;
    // Le logo est injecte par le serveur sous forme d'URL deja resolue
    // (`/api/image/s<uuid>`), cf. src/app/actions/marketplace.ts.
    const storeLogo = productStore?.settings?.logo;

    // --- Stock ---
    // Dès qu'une combinaison est sélectionnée, on affiche SON stock : le
    // total du produit masque sinon les ruptures de variante.
    const stockValue = selectedStock;
    const isOutOfStock = stockValue === 0;
    const isBuyDisabled = isOutOfStock || isSelectedOutOfStock;
    const isLowStock =
      stockValue !== null && stockValue > 0 && stockValue <= 5;

    // Le libellé annonce l'action réellement possible : proposer « Ajouter »
    // alors qu'il manque une option ne fait qu'un clic perdu.
    const hasVariantMatrix = hasOptions && variants.length > 0;
    const primaryActionLabel =
      isOutOfStock || isSelectedOutOfStock
        ? "Rupture"
        : hasVariantMatrix && !allSelected
          ? "Choisir les options"
          : isFood
            ? "Commander"
            : "Ajouter au panier";

    // --- Description enrichie (auto, sans action du vendeur) ---
    const autoHighlights = extractDescriptionHighlights(descriptionText);
    const autoSpecs = buildAutoSpecs(product, {
      mainCategory: mainCat,
      storeName: product.storeName,
      isFood,
      isOutOfStock,
      stock: stockValue,
    });
    const autoBadges = buildAutoBadges(product);
    const hasMoreContent =
      descriptionText.length > 180 ||
      autoSpecs.length > 0 ||
      autoHighlights.length > 0 ||
      autoBadges.length > 0;

    // --- Gallery ---
    const galleryImages = [
      ...(product.image ? [product.image] : []),
      ...(Array.isArray(product.images) ? product.images : []),
    ].filter((img, i, arr) => !!img && arr.indexOf(img) === i);
    // L'image de la variante sélectionnée devient la photo principale : c'est
    // ce que l'acheteur voit réellement commander. Une URL propre à la
    // variante est acceptée même hors galerie (photo téléversée liée).
    const variantImage =
      allSelected && matchedVariant?.image
        ? matchedVariant.image
        : null;
    const currentImage = variantImage || selectedDetailImage || product.image;

    // --- Actions (options-aware) ---
    const resolveVariantId = () => {
      if (!hasOptions || variants.length === 0) return undefined;
      return findVariantByOptions(typedVariants, selectedOptions)?.id;
    };

    // Le couple affiché est-il déjà au panier ? Attention à ne pas confondre
    // « le panier contient des articles » (sans effet ici) et « CE produit
    // dans CETTE variante est au panier » : sans cette précision, un article
    // ajouté ailleurs ferait disparaître l'ajout sur toutes les fiches.
    const isCurrentSelectionInCart =
      isVariantInCart(resolveVariantId(), selectedOptions);

    /**
     * Amène l'utilisateur aux options : la feuille modale est le seul
     * sélecteur, elle s'ouvre donc quel que soit l'écran.
     */
    const focusOptions = () => {
      setIsOptionsSheetOpen(true);
    };

    const guardSelection = (): boolean => {
      if (!allSelected) {
        // Pas de toast ici : la feuille qui vient de s'ouvrir affiche déjà
        // l'état « Sélectionnez les options pour commander ». Le message était
        // un doublon qui masquait le sélecteur au moment où on veut le lire.
        focusOptions();
        return false;
      }
      if (isSelectedOutOfStock) {
        focusOptions();
        localNotify(
          matchedVariant
            ? "Cette combinaison est en rupture de stock"
            : "Cette combinaison n'existe pas pour ce produit",
          "warning",
        );
        return false;
      }
      return true;
    };

    const selectValue = (optionId: string, val: string) => {
      setSelectedOptions((prev: Record<string, string>) => {
        if (prev[optionId] === val) {
          const next = { ...prev };
          delete next[optionId];
          return next;
        }
        return { ...prev, [optionId]: val };
      });
    };

    const isValueDisabled = (optionId: string, val: string) => {
      if (variants.length === 0) return false;
      if (selectedOptions[optionId] === val) return false;
      return !optionValueAvailability(
        typedVariants,
        selectedOptions,
        optionId,
        val
      ).available;
    };

    const handleAddToCart = () => {
      if (!guardSelection()) return;
      addToCart(product, resolveVariantId());
    };

    const goToCart = () => {
      safeNavigate("/cart");
    };

    const handleBuyNow = () => {
      if (!guardSelection()) return;
      buyNow(product, resolveVariantId(), selectedOptions);
    };

    const reviewTotal =
      product.reviewCount || reviews.length || 0;
    const accentText = isFood ? "text-green-600" : "text-brand";

    const openZoom = (img: string) => {
      setCurrentZoomImage(img);
      setZoomGallery(galleryImages);
      setIsImageModalOpen(true);
    };

    const onGalleryScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const idx = Math.min(
        galleryImages.length - 1,
        Math.max(0, Math.round(el.scrollLeft / el.clientWidth)),
      );
      if (idx !== productSwipeIdx) {
        setProductSwipeIdx(idx);
        setSelectedDetailImage(galleryImages[idx]);
      }
    };

    const mobileGalleryRef = React.useRef<HTMLDivElement | null>(null);

    const galleryScroll = (dir: 1 | -1) => {
      const el = mobileGalleryRef.current;
      if (!el) return;
      el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
    };

    const galleryGoTo = (idx: number) => {
      const el = mobileGalleryRef.current;
      if (!el) return;
      el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
    };

    const stepGallery = (dir: 1 | -1) => {
      const idx = galleryImages.indexOf(currentImage);
      const next = (idx + dir + galleryImages.length) % galleryImages.length;
      const img = galleryImages[next];
      if (img) setSelectedDetailImage(img);
    };

    const scrollToSection = (id: string) => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-40 lg:pb-16 bg-[#f8f9fc] lg:bg-transparent -mx-4 lg:mx-auto">
        {/* Breadcrumb (desktop only) */}
        <nav
          aria-label="Fil d'Ariane"
          className="hidden md:flex items-center gap-2 mb-6 text-[11px] font-normal text-gray-400 px-4 lg:px-0 pt-5"
        >
          <button
            onClick={() => safeNavigate("/")}
            className="hover:text-brand transition-colors cursor-pointer"
          >
            Accueil
          </button>
          <ChevronRight size={10} className="text-gray-300" />
          <button
            onClick={() =>
              safeNavigate("/", {
                action: () => setSelectedCategory(mainCat),
              })
            }
            className="hover:text-brand transition-colors cursor-pointer truncate max-w-[220px]"
          >
            {mainCat}
          </button>
          <ChevronRight size={10} className="text-gray-300" />
          <span
            className="text-gray-700 font-medium truncate max-w-[320px]"
            aria-current="page"
          >
            {product.name}
          </span>
        </nav>

        {/* ================= MOBILE APP-BAR (M3 style) =================
            Bouton de retour uniquement. Le panier vit dans la barre du bas :
            le dupliquer ici affichait deux boutons pointant vers la meme
            destination sur le meme ecran. */}
        <div className="lg:hidden sticky top-0 z-[100] bg-white border-b border-gray-100/80 px-3 py-2 flex items-center gap-2 -mx-4 relative" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <button
            type="button"
            onClick={() => safeNavigate("/")}
            aria-label="Retour"
            className="relative z-10 w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-gray-700 active:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          {/* Nom centré dans la barre entière (et non dans l'espace restant
              après le bouton). `px-12` réserve de part et d'autre la place du
              bouton : le nom démarre donc à gauche dès qu'il déborde et se
              termine par « … ». */}
          <span className="absolute inset-0 px-12 flex items-center justify-center pointer-events-none">
            <span className="max-w-full truncate text-center text-xs font-bold tracking-[0.1em] uppercase text-gray-500">
              {product.storeName}
            </span>
          </span>
        </div>

        {/* ================= PRODUIT ================= */}
        <div id="pd-produit" className="scroll-mt-14">
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr] gap-6 lg:gap-8 items-start">
            {/* ---------- Colonne Gauche: Galerie + Description (Desktop) ---------- */}
            <div className="space-y-4">
              {/* Mobile: Swipeable Carousel inside an M3 Card */}
              <div className="lg:hidden relative bg-white overflow-hidden rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] mb-3.5 aspect-square">
                <div
                  ref={mobileGalleryRef}
                  className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory h-full"
                  onScroll={onGalleryScroll}
                >
                  {galleryImages.map((img, idx) => (
                    <div
                      key={idx}
                      className="min-w-full snap-center h-full relative"
                      onClick={() => openZoom(galleryImages[productSwipeIdx])}
                    >
                      <Image
                        src={img}
                        alt={`${product.name} - vue ${idx + 1}`}
                        fill
                        priority={idx === 0}
                        quality={90}
                        sizes="100vw"
                        className="object-cover pointer-events-none"
                        unoptimized={needsNoOptimization(img)}
                      />
                    </div>
                  ))}
                </div>

                {/* Manual slide arrows (mobile) */}
                {galleryImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        galleryScroll(-1);
                      }}
                      aria-label="Image précédente"
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md border border-gray-100 shadow-md flex items-center justify-center text-gray-700 hover:bg-white active:brightness-95 transition-colors z-10"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        galleryScroll(1);
                      }}
                      aria-label="Image suivante"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md border border-gray-100 shadow-md flex items-center justify-center text-gray-700 hover:bg-white active:brightness-95 transition-colors z-10"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}

                {/* Slide dots (mobile) */}
                {galleryImages.length > 1 && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                    {galleryImages.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          galleryGoTo(idx);
                        }}
                        aria-label={`Aller à l'image ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          idx === productSwipeIdx
                            ? "w-4 bg-brand"
                            : "w-1.5 bg-gray-400/60"
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Expand overlay button */}
                <button
                  onClick={() => openZoom(currentImage)}
                  aria-label="Agrandir l'image"
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-gray-100 shadow-md flex items-center justify-center text-gray-700 active:brightness-95 transition-colors z-10"
                >
                  <Maximize2 size={14} />
                </button>

                {/* Discount badge */}
                {discountPct > 0 && (
                  <div className="absolute top-3 left-3 bg-red-500 text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-full shadow-lg shadow-red-500/30 flex items-center gap-0.5 z-10">
                    <Zap size={10} fill="currentColor" /> -{discountPct}%
                  </div>
                )}

                {/* Freshness strip (food) */}
                {isFood && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-green-50 text-green-700 text-[8px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-full shadow-sm z-10">
                    <Clock size={10} className="flex-shrink-0" />
                    Fraîchement préparé · {product.preparationTime || product.deliveryTime || "Délai non précisé"}
                  </div>
                )}

                {/* Counter badge */}
                {galleryImages.length > 1 && (
                  <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-2.5 py-1 rounded-full z-10">
                    {productSwipeIdx + 1}/{galleryImages.length}
                  </div>
                )}
              </div>

              {/* Desktop: Main Image + Thumbnails (Compact Sizing) */}
              <div className="hidden lg:block space-y-2.5">
                <div
                  className="relative w-full aspect-square max-h-[380px] xl:max-h-[420px] rounded-2xl overflow-hidden bg-white border border-gray-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] group/main cursor-zoom-in"
                  onClick={() => openZoom(currentImage)}
                >
                  <Image
                    src={currentImage}
                    width={800}
                    height={800}
                    priority
                    quality={90}
                    alt={product.name}
                    sizes="(max-width: 1024px) 100vw, 420px"
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover/main:scale-105"
                    unoptimized={needsNoOptimization(currentImage)}
                  />

                  {/* Manual slide arrows (desktop) */}
                {galleryImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        stepGallery(-1);
                      }}
                      aria-label="Image précédente"
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md border border-gray-200/70 shadow-sm flex items-center justify-center text-gray-600 hover:bg-white hover:text-brand active:brightness-95 transition-colors z-10"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        stepGallery(1);
                      }}
                      aria-label="Image suivante"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md border border-gray-200/70 shadow-sm flex items-center justify-center text-gray-600 hover:bg-white hover:text-brand active:brightness-95 transition-colors z-10"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}

                {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover/main:bg-black/5 transition-colors duration-300 pointer-events-none" />

                  {discountPct > 0 && (
                    <div className="absolute top-3.5 left-3.5 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg shadow-md shadow-red-500/20 flex items-center gap-1 z-10">
                      <Zap size={11} fill="currentColor" /> -{discountPct}%
                    </div>
                  )}

                  {/* Action buttons top-right */}
                  <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 z-10">
                    <button
                      onClick={(e) => { e.stopPropagation(); openZoom(currentImage); }}
                      aria-label="Agrandir l'image"
                      className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-md border border-gray-200/70 shadow-xs flex items-center justify-center text-gray-600 hover:bg-white hover:text-brand transition-colors active:brightness-95"
                    >
                      <Maximize2 size={13} />
                    </button>
                  </div>

                  {isFood && (
                    <div className="absolute bottom-3.5 left-3.5 flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-green-100 text-green-700 text-[10px] font-semibold px-2.5 py-1 rounded-lg shadow-xs z-10">
                      <Clock size={11} />
                      Fraîchement préparé · {product.preparationTime || product.deliveryTime || "Délai non précisé"}
                    </div>
                  )}

                  {/* Image counter */}
                  {galleryImages.length > 1 && (
                    <div className="absolute bottom-3.5 right-3.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-0.5 rounded-md z-10">
                      {(galleryImages.indexOf(currentImage) !== -1 ? galleryImages.indexOf(currentImage) : 0) + 1} / {galleryImages.length}
                    </div>
                  )}
                </div>

                {galleryImages.length > 1 && (
                  <div className="grid grid-cols-6 gap-2">
                    {galleryImages.slice(0, 6).map((img, idx) => {
                      const isActive =
                        currentImage === img ||
                        (!selectedDetailImage && idx === 0);
                      return (
                        <button
                          key={idx}
                          onMouseEnter={() => setSelectedDetailImage(img)}
                          onFocus={() => setSelectedDetailImage(img)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDetailImage(img);
                          }}
                          aria-label={`Voir l'image ${idx + 1}`}
                          className={`aspect-square rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                            isActive
                              ? "border-brand ring-2 ring-orange-100 shadow-xs scale-[1.02]"
                              : "border-gray-200/70 opacity-60 hover:opacity-100 hover:border-gray-300"
                          }`}
                        >
                          <Image
                            src={img}
                            alt={`${product.name} - vue ${idx + 1}`}
                            width={80}
                            height={80}
                            quality={90}
                            className="w-full h-full object-cover"
                            sizes="70px"
                            unoptimized={needsNoOptimization(img)}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ---------- Colonne Droite: Panneau d'achat compact & organisé ---------- */}
            <div className="space-y-3.5 lg:space-y-0 lg:sticky lg:top-24">
              {/* DESKTOP CARD (Sleek, Compact, Clean) */}
              <div className="hidden lg:block bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 xl:p-6 space-y-4">
                <ProductSeller
                  product={product}
                  logo={storeLogo}
                  category={realCategory}
                  onCategoryClick={() =>
                    safeNavigate("/", {
                      action: () => setSelectedCategory(mainCat),
                    })
                  }
                />

                <ProductTitle product={product} />

                <ProductSocialProof
                  rating={product.rating || 0}
                  reviewTotal={reviewTotal}
                  salesCount={product.salesCount || 0}
                  viewCount={product.views || 0}
                  isFood={isFood}
                  onReviewsClick={() => scrollToSection("pd-avis")}
                />

                {/* Price block: compact & refined */}
                <div className="bg-gray-50/90 rounded-xl p-3.5 border border-gray-200/70 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase font-semibold tracking-wider text-gray-400 mb-1">
                      {hasOptions && !allSelected ? "À partir de" : (isFood ? "Prix unitaire" : "Prix")}
                    </span>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[28px] leading-none font-bold text-gray-950 tracking-tight">
                        {formatCurrency(basePrice)}
                      </span>
                      {product.unit && !hasOptions && (
                        <span className="text-sm font-medium text-gray-500">
                          / {product.unit}
                        </span>
                      )}
                      {product.originalPrice && product.originalPrice > basePrice && (
                        <span className="text-sm text-gray-400 line-through font-normal">
                          {formatCurrency(product.originalPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                  {product.originalPrice && product.originalPrice > basePrice && (
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-md">
                        <Zap size={10} fill="currentColor" /> -{discountPct}%
                      </span>
                      <span className="text-[10px] font-normal text-gray-500 whitespace-nowrap">
                        Éco. {formatCurrency(product.originalPrice - basePrice)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="-mt-1.5">
                  <ProductStockRow
                    isOutOfStock={isOutOfStock}
                    isLowStock={isLowStock}
                    stockValue={stockValue}
                    isSelectedOutOfStock={isSelectedOutOfStock}
                    isFood={isFood}
                    deliveryTime={product.deliveryTime}
                    preparationTime={product.preparationTime}
                  />
                </div>

                {/* Options / Variantes — le même sélecteur est rendu en inline
                    sur desktop et dans la feuille modale sur mobile : même
                    composant, même état, pas de divergence possible. */}
                {hasOptions && variants.length > 0 && (
                  <div className="bg-white border border-gray-100 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-900">Choisir vos options</span>
                      <span className="text-[9px] font-semibold text-brand">
                        {selectedOptionCount}/{options.length} sélectionné{options.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <OptionsPicker
                      options={options}
                      selectedOptions={selectedOptions}
                      onSelect={selectValue}
                      onRemove={(optionId) =>
                        setSelectedOptions((prev: Record<string, string>) => {
                          const next = { ...prev };
                          delete next[optionId];
                          return next;
                        })
                      }
                      isValueDisabled={isValueDisabled}
                      allSelected={allSelected}
                      outOfStock={isSelectedOutOfStock}
                      hasMatrix={variants.length > 0}
                      variantName={matchedVariant?.name}
                      variantStock={matchedVariant ? Number(matchedVariant.stock) || 0 : null}
                      price={matchedVariant ? Number(matchedVariant.price) || 0 : null}
                    />
                  </div>
                )}

                {/* Wholesale / B2B */}
                {hasWholesale && (
                  <div className="bg-amber-50/40 border border-amber-200/60 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setIsWholesaleExpanded(!isWholesaleExpanded)}
                      aria-expanded={isWholesaleExpanded}
                      className="w-full flex items-center justify-between px-3 py-3 cursor-pointer select-none group"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 group-hover:text-amber-950 transition-colors">
                        <Zap size={12} className="text-brand fill-brand" />
                        Tarifs Grossiste (B2B)
                      </div>
                      <span className="flex items-center gap-2">
                        <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          B2B
                        </span>
                        <ChevronDown size={14} className={`transition-transform duration-300 text-amber-700 ${isWholesaleExpanded ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    {isWholesaleExpanded && (
                      <div className="px-3 pb-3 space-y-2 animate-in slide-in-from-top-2 duration-300">
                        {wholesaleTiers.map((tier, idx) => {
                          const isAdding = addingWholesaleIdx === idx;
                          const isAdded = addedWholesaleIdx === idx;
                          const isTierUnavailable = stockValue !== null && stockValue < tier.minQty;
                          return (
                          <div
                            key={idx}
                            className={`flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg bg-white border border-amber-200/50 text-xs ${
                              isTierUnavailable ? "border-red-200 bg-red-50/40" : ""
                            }`}
                          >
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
                              <span className="font-medium text-gray-800">Qté Min : {tier.minQty} pièces</span>
                              <span className="text-gray-300">•</span>
                              <span className="font-semibold text-gray-900">
                                Prix total : {Math.floor(tier.packagePrice).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F
                              </span>
                              {tier.discountPct > 0 && (
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1 rounded">
                                  -{tier.discountPct}%
                                </span>
                              )}
                              {isTierUnavailable && (
                                <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1 rounded flex items-center gap-0.5">
                                  <AlertCircle size={10} />
                                  Stock bas ({stockValue} dispo.)
                                </span>
                              )}
                            </div>
                            {isTierUnavailable ? (
                              <span className="min-w-[86px] justify-center px-2 py-1 rounded-md bg-red-50 border border-red-200 text-red-500 text-[10px] font-semibold flex items-center gap-1 cursor-not-allowed">
                                <AlertCircle size={11} />
                                Stock bas
                              </span>
                            ) : (
                            <button
                              type="button"
                              onClick={() => handleWholesaleAdd(idx, tier.minQty)}
                              className={`min-w-[86px] justify-center px-2 py-1 rounded-md text-white text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                                isAdded ? "bg-emerald-600" : "bg-brand hover:bg-[#e04e0f]"
                              }`}
                            >
                              {isAdding ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : isAdded ? (
                                <Check size={11} strokeWidth={3} />
                              ) : (
                                <>
                                  <ShoppingCart size={10} />
                                  Ajouter {tier.minQty}
                                </>
                              )}
                            </button>
                            )}
                          </div>
                          );
                        })}
                        {waDigits && (
                          <a
                            href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                              `Bonjour ${product.storeName}, je vous contacte pour le produit "${product.name}" (Réf: ${product.id}). J'aimerais un devis personnalisé gros volume. Merci !`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline pt-0.5"
                          >
                            <MessageCircle size={12} />
                            Demander un devis sur WhatsApp
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* CTAs: Side-by-side, perfectly balanced, sleek 44px */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isBuyDisabled}
                    className="h-11 px-3 rounded-xl bg-white hover:bg-gray-50 text-gray-900 font-semibold text-xs flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 active:brightness-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                  >
                    <ShoppingCart size={15} strokeWidth={2.2} className="text-brand flex-shrink-0" />
                    <span className="truncate">{isOutOfStock || isSelectedOutOfStock ? "Rupture" : isFood ? "Commander" : "Ajouter au panier"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    disabled={isBuyDisabled}
                    className="h-11 px-3 rounded-xl bg-brand hover:bg-[#e04e0f] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-orange-500/20 active:brightness-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Zap size={14} fill="currentColor" className="flex-shrink-0" />
                    <span className="truncate">{isOutOfStock || isSelectedOutOfStock ? "Rupture" : isFood ? "Commander direct" : "Acheter direct"}</span>
                  </button>
                </div>

                {/* Reassurance: réassurance pure, la livraison vit dans ProductStockRow.
                    Deux éléments en ligne calme — une grille à 2 cases laissait un
                    vide asymétrique sous les CTA. */}
                <div className="flex items-center justify-center gap-x-3.5 gap-y-1 flex-wrap text-[10px] text-gray-400">
                  {isFood ? (
                    <>
                      <span className="flex items-center gap-1">
                        <Clock size={11} className="text-green-600 flex-shrink-0" />
                        Fait minute
                      </span>
                      <span className="text-gray-300">·</span>
                      <span className="flex items-center gap-1">
                        <ShieldCheck size={11} className="text-emerald-600 flex-shrink-0" />
                        Fraîcheur
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1">
                        <ShieldCheck size={11} className="text-emerald-600 flex-shrink-0" />
                        Paiement sécurisé
                      </span>
                      <span className="text-gray-300">·</span>
                      <span className="flex items-center gap-1">
                        <RotateCcw size={11} className="text-blue-600 flex-shrink-0" />
                        Retour 7 jours
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* MOBILE CARD */}
              <div className="lg:hidden bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4">
                <div className="mb-3">
                  <ProductSeller
                    product={product}
                    logo={storeLogo}
                    category={realCategory}
                    onCategoryClick={() =>
                      safeNavigate("/", {
                        action: () => setSelectedCategory(mainCat),
                      })
                    }
                  />
                </div>

                <div className="mb-2">
                  <ProductTitle product={product} />
                </div>

                <div className="mb-3.5">
                  <ProductSocialProof
                    rating={product.rating || 0}
                    reviewTotal={reviewTotal}
                    salesCount={product.salesCount || 0}
                    viewCount={product.views || 0}
                    isFood={isFood}
                    onReviewsClick={() => scrollToSection("pd-avis")}
                  />
                </div>

                {/* Price block: Fine, sleek & compact */}
                <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-100 mb-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase">
                      {hasOptions && !allSelected ? "Dès" : "Prix"}
                    </span>
                    <span className="text-[22px] font-bold tracking-tight text-gray-950 leading-none">
                      {formatCurrency(basePrice)}
                    </span>
                    {product.unit && !hasOptions && (
                      <span className="text-[11px] font-medium text-gray-500">
                        /{product.unit}
                      </span>
                    )}
                    {product.originalPrice && product.originalPrice > basePrice && (
                      <span className="text-[11px] text-gray-400 line-through font-normal">
                        {formatCurrency(product.originalPrice)}
                      </span>
                    )}
                  </div>
                  {product.originalPrice && product.originalPrice > basePrice && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-1.5 py-0.5 rounded-md flex-shrink-0">
                      -{discountPct}% Éco
                    </span>
                  )}
                </div>

                <div className="mb-3.5">
                  <ProductStockRow
                    isOutOfStock={isOutOfStock}
                    isLowStock={isLowStock}
                    stockValue={stockValue}
                    isSelectedOutOfStock={isSelectedOutOfStock}
                    isFood={isFood}
                    deliveryTime={product.deliveryTime}
                    preparationTime={product.preparationTime}
                  />
                </div>

                {/* Options / Variantes — uniquement dans la feuille modale
                    (ouverte par le bouton « Choisir les options »). */}

                {/* Mobile wholesale: Redesign compact & visible (accordion) */}
                {hasWholesale && (
                  <div className="bg-white rounded-2xl border border-amber-200/50 mb-2.5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setIsWholesaleExpanded(!isWholesaleExpanded)}
                      aria-expanded={isWholesaleExpanded}
                      className="w-full px-3 py-2.5 bg-amber-50/50 flex items-center justify-between active:bg-amber-100/60 transition-colors cursor-pointer select-none"
                    >
                        <span className="text-[10px] font-bold text-amber-950 flex items-center gap-1.5">
                            <Zap size={12} className="text-brand fill-brand" />
                            PRIX DE GROS
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="text-[9px] font-semibold text-[#e04e0f] uppercase">Dégressif</span>
                            <ChevronDown size={14} className={`transition-transform duration-300 text-amber-700 ${isWholesaleExpanded ? "rotate-180" : ""}`} />
                        </span>
                    </button>
                    {isWholesaleExpanded && (
                    <>
                    <div className="grid grid-cols-1 gap-px bg-amber-100/50">
                      {wholesaleTiers.map((tier, idx) => {
                        const isAdding = addingWholesaleIdx === idx;
                        const isAdded = addedWholesaleIdx === idx;
                        const isTierUnavailable = stockValue !== null && stockValue < tier.minQty;
                        return (
                        isTierUnavailable ? (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-2 bg-white cursor-not-allowed"
                        >
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
                            <span className="text-[10px] font-bold text-gray-700">
                                Qté Min : {tier.minQty} pièces
                            </span>
                            <span className="text-gray-300 font-bold">•</span>
                            <span className="text-xs font-bold text-brand">
                              Prix total : {Math.floor(tier.packagePrice).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                             {tier.discountPct > 0 && (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                -{tier.discountPct}%
                              </span>
                             )}
                            <div className="min-w-[44px] justify-center px-1.5 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-500 text-[9px] font-bold uppercase flex items-center gap-1">
                              <AlertCircle size={10} />
                              Stock bas
                            </div>
                          </div>
                        </div>
                        ) : (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleWholesaleAdd(idx, tier.minQty)}
                          className="flex items-center justify-between px-3 py-2 bg-white hover:bg-amber-50 active:bg-amber-100 transition-colors cursor-pointer group"
                        >
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
                            <span className="text-[10px] font-bold text-gray-700">
                                Qté Min : {tier.minQty} pièces
                            </span>
                            <span className="text-gray-300 font-bold">•</span>
                            <span className="text-xs font-bold text-brand">
                              Prix total : {Math.floor(tier.packagePrice).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                             {tier.discountPct > 0 && (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                -{tier.discountPct}%
                              </span>
                             )}
                            <div
                              className={`min-w-[44px] justify-center px-1.5 py-0.5 rounded-md text-white text-[9px] font-bold uppercase flex items-center gap-1 transition-colors ${
                                isAdded ? "bg-emerald-600" : "bg-gray-900"
                              }`}
                            >
                              {isAdding ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : isAdded ? (
                                <Check size={11} strokeWidth={3} />
                              ) : (
                                "Ajouter"
                              )}
                            </div>
                          </div>
                        </button>
                        )
                        );
                      })}
                    </div>

                    {waDigits && (
                      <div className="px-3 py-2 bg-white border-t border-amber-100 flex items-center justify-between text-[10px]">
                        <span className="text-gray-500 font-normal italic">Besoin d&apos;un devis volume ?</span>
                        <a
                          href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                            `Bonjour ${product.storeName}, je vous contacte pour le produit "${product.name}" (Réf: ${product.id}). J'aimerais commander un gros volume. Pouvez-vous me faire votre meilleur prix de gros ? Merci !`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline"
                        >
                          <MessageCircle size={11} className="text-emerald-600" />
                          Négocier sur WhatsApp
                        </a>
                      </div>
                    )}
                    </>
                    )}
                  </div>
                )}
              </div>

              {/* Mobile Description Card */}
              <div className="lg:hidden bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-3.5 bg-brand rounded-full" />
                  <h3 className="text-[11px] font-semibold text-gray-900 uppercase tracking-wider">
                    {isFood ? 'Détails du plat' : 'Description produit'}
                  </h3>
                </div>
                <div
                  className={`relative ${
                    !isDescriptionExpanded
                      ? "max-h-32 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
                      : ""
                  }`}
                >
                  <RichDescription text={descriptionText} accentClass={accentText} />
                  <AutoHighlights items={autoHighlights} accentClass={accentText} />
                  <AutoBadgesRow badges={autoBadges} />
                  <AutoSpecsGrid
                    specs={autoSpecs}
                    className="grid grid-cols-2 gap-2 mt-3.5"
                  />
                </div>
                {hasMoreContent && (
                  <button
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className={`mt-2 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-0.5 active:brightness-95 transition-colors ${accentText}`}
                  >
                    {isDescriptionExpanded ? "Réduire" : "Lire la suite"}
                    <ChevronRight
                      size={10}
                      className={`transition-transform duration-300 ${
                        isDescriptionExpanded ? "-rotate-90" : "rotate-90"
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Description : pleine largeur, comme la section Avis qui suit. */}
        <section className="hidden lg:block mt-3.5 lg:mt-10 bg-white rounded-[24px] lg:rounded-2xl border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4 lg:p-10">
          <div className="flex items-center justify-between mb-4 lg:mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="hidden md:block w-1 h-5 bg-brand rounded-full" />
              <h3 className="text-[9px] md:text-sm font-bold text-gray-900 uppercase tracking-[0.12em]">
                {isFood ? "Détails & Préparation" : "Description du produit"}
              </h3>
            </div>
          </div>

          <div
            className={`relative ${
              !isDescriptionExpanded
                ? "max-h-56 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
                : ""
            }`}
          >
            <RichDescription text={descriptionText} accentClass={accentText} />
            <AutoHighlights items={autoHighlights} accentClass={accentText} />
            <AutoBadgesRow badges={autoBadges} />
            <AutoSpecsGrid
              specs={autoSpecs}
              className="grid grid-cols-2 gap-2 pt-3.5 mt-3.5 border-t border-gray-100 text-xs"
            />
          </div>

          {hasMoreContent && (
            <button
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              className="mt-2 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-0.5 active:scale-95 transition-transform text-brand"
            >
              {isDescriptionExpanded ? "Réduire" : "Lire la suite"}
              <ChevronRight
                size={10}
                className={`transition-transform duration-300 ${
                  isDescriptionExpanded ? "-rotate-90" : "rotate-90"
                }`}
              />
            </button>
          )}
        </section>
        {/* ================= AVIS (CARD-BASED) ================= */}
        <section
          id="pd-avis"
          className="mt-3.5 lg:mt-10 bg-white rounded-[24px] lg:rounded-2xl border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4 lg:p-10 scroll-mt-14"
        >
          <div className="flex items-center justify-between mb-4 lg:mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="hidden md:block w-1 h-5 bg-amber-400 rounded-full" />
              <h3 className="text-[9px] md:text-sm font-bold text-gray-900 uppercase tracking-[0.12em]">
                Avis {isFood ? 'sur le repas' : 'sur le produit'}
              </h3>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 md:gap-12">
            {/* Score summary */}
            <div className="flex md:flex-col items-center md:items-center gap-3 md:min-w-[180px] md:border-r md:border-gray-100 md:pr-12">
              <div className="text-center">
                <div className="flex items-baseline gap-1 justify-center">
                  <span className="text-xl md:text-6xl font-bold text-gray-900 tracking-tighter leading-none">
                    {(product.rating || 0).toFixed(1)}
                  </span>
                  <span className="text-xs md:text-lg font-bold text-gray-300">/5</span>
                </div>
                <div className="flex text-amber-400 mt-2 justify-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={16}
                      fill={
                        s <= Math.round(product.rating || 0)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  ))}
                </div>
                <p className="text-[8px] md:text-[10px] font-semibold text-gray-400 mt-2 uppercase tracking-wider">
                  {formatNumber(reviewTotal)} {isFood ? 'avis clients' : 'notes et avis'}
                </p>
              </div>
            </div>

            {/* Distribution + list */}
            <div className="flex-grow min-w-0">
              {reviews.length > 0 && (
                <div className="mb-4 space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count =
                      reviews.filter((r: Review) => r && r.rating === star).length || 0;
                    const total = reviews.length || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <span className="text-[9px] font-bold text-gray-500 w-8 flex items-center gap-0.5">
                          {star}{" "}
                          <Star size={8} className="text-yellow-400" fill="currentColor" />
                        </span>
                        <div className="flex-grow h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-yellow-300 to-yellow-400 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 w-9 text-right">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="divide-y divide-gray-50">
                {selectedProductId && loadingReviews[selectedProductId] ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-brand animate-spin" />
                  </div>
                ) : reviews.length > 0 ? (
                  <>
                    <div className="md:hidden">
                      {reviews.slice(0, 3).map((review: Review, idx: number) =>
                        renderReviewCard(review, idx),
                      )}
                    </div>
                    <div className="hidden md:block">
                      {(showAllProductReviews
                        ? reviews
                        : reviews.slice(0, 3)
                      ).map((review: Review, idx: number) =>
                        renderReviewCard(review, idx),
                      )}
                    </div>

                    {reviews.length > 3 && !showAllProductReviews && (
                      <button
                        onClick={() => setShowAllProductReviews(true)}
                        className="w-full py-2.5 mt-2 bg-gray-50 text-gray-900 text-[8px] md:text-[10px] font-bold uppercase tracking-wider rounded-xl border border-gray-100 hover:bg-gray-100 transition-all flex items-center justify-center gap-1.5"
                      >
                        Voir les {reviews.length - 3} autres avis
                        <ChevronRight size={12} className="rotate-90" />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                    <MessageCircle size={18} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-xs font-bold text-gray-600">
                      Aucun avis rédigé
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5 font-normal">
                      {isFood ? 'Soyez le premier à donner votre avis !' : 'Partagez votre avis pour aider la communauté !'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ============ BOTTOM SHEET AVIS (mobile uniquement) ============ */}
        {showAllProductReviews && (
          <div className="md:hidden fixed inset-0 z-[2000]">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowAllProductReviews(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
              <div className="px-4 pt-3 pb-3 border-b border-gray-100 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                      <Star size={16} fill="currentColor" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">
                        {reviews.length} avis
                      </h4>
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">
                        {isFood ? "Sur le repas" : "Sur le produit"} ·{" "}
                        {(product.rating || 0).toFixed(1)}/5
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAllProductReviews(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 active:brightness-95 transition-colors"
                    aria-label="Fermer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 px-5 pt-1 pb-6 divide-y divide-gray-100">
                {reviews.map((review: Review, idx: number) =>
                  renderReviewCard(review, idx),
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= SIMILAIRES ================= */}
        {relatedProducts.length > 0 && (
          <section id="pd-similaires" className="mt-3.5 lg:mt-14 scroll-mt-14">
            <div className="flex items-center gap-2.5 mb-4 lg:mb-6 px-1">
              <div className="hidden md:block w-1 h-5 bg-brand rounded-full" />
              <h3 className="text-[9px] md:text-sm font-bold text-gray-900 uppercase tracking-[0.12em]">
                {isFood ? 'Vous aimerez aussi' : 'Recommandations similaires'}
              </h3>
            </div>
            <div className="flex overflow-x-auto no-scrollbar gap-3 snap-x snap-mandatory pb-4 pr-4 -mr-4 md:mr-0 md:pb-0 md:pr-0 md:grid md:grid-cols-4 lg:grid-cols-4 md:gap-5">
              {relatedProducts.slice(0, 8).map((relProduct: StorefrontProduct) => (
                <ProductCard
                  key={`${relProduct.storeId}-${relProduct.id}`}
                  product={relProduct}
                  onAddToCart={handleCardAddToCart}
                  onClick={() =>
                    safeNavigate(`/product/${generateProductSlug(relProduct)}`)
                  }
                  onPrefetch={() => warmProduct({ id: relProduct.id, image: relProduct.image })}
                  className="w-[145px] xs:w-[160px] md:w-auto flex-shrink-0 md:flex-shrink snap-start"
                />
              ))}
            </div>
          </section>
        )}

        {/* ================= STICKY MOBILE ACTION BAR =================
            Une seule rangée d'actions, hauteur constante, cibles tactiles
            généreuses (56px) : la barre ne sert qu'agir, l'information reste
            dans la fiche. Le panier est un second bouton explicite et ne peut
            plus remplacer l'action d'achat.

            Fond opaque, pas de `backdrop-blur` : sur Android, un
            `backdrop-filter` sur un élément `fixed` crée une couche de
            compositing qui peut s'afficher décalée pendant le défilement (les
            boutons paraissent alors « penchés »). Le retour d'appui se fait par
            la couleur et non par un `scale` : une mise à l'échelle de 5 % sur
            une pilule de 56 px se lit comme un décentrement. */}
        {(
          <div
            className="lg:hidden fixed left-0 right-0 bottom-0 z-[998] bg-white border-t border-gray-100 shadow-[0_-4px_16px_rgba(0,0,0,0.07)] px-3 pt-2.5"
            style={{
              paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div className="flex items-center gap-2.5">
              {isCurrentSelectionInCart ? (
                /* Le produit affiché est déjà au panier : l'action devient
                   « aller au panier » pour régler la quantité. */
                <button
                  type="button"
                  onClick={goToCart}
                  aria-label={`Voir le panier, ${cartItemsCount} article(s)`}
                  className="h-12 w-full px-4 rounded-full bg-gray-900 active:bg-gray-800 text-white font-bold text-[13px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ShoppingCart size={15} strokeWidth={2.5} className="flex-shrink-0" />
                  <span className="truncate">Voir mon panier</span>
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] flex items-center justify-center tabular-nums">
                    {cartItemsCount > 99 ? '99+' : cartItemsCount}
                  </span>
                </button>
              ) : (
                /* Produit absent du panier : l'action d'ajout, pleine largeur si
                   le panier est vide, sinon accompagnée du bouton panier pour
                   ne pas perdre l'accès au panier. */
                <>
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isBuyDisabled}
                    className="h-12 min-w-0 px-4 rounded-full bg-brand active:bg-[#e04e0f] text-white font-bold text-[13px] shadow-sm shadow-orange-500/25 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:active:bg-brand flex-1"
                  >
                    <ShoppingCart size={15} strokeWidth={2.5} className="flex-shrink-0" />
                    <span className="truncate">{primaryActionLabel}</span>
                  </button>

                  {cartItemsCount > 0 && (
                    <button
                      type="button"
                      onClick={goToCart}
                      aria-label={`Voir le panier, ${cartItemsCount} article(s)`}
                      className="relative h-12 w-12 shrink-0 rounded-full bg-gray-900 active:bg-gray-800 text-white flex items-center justify-center transition-colors"
                    >
                      <ShoppingCart size={18} strokeWidth={2.5} />
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center tabular-nums border-2 border-white">
                        {cartItemsCount > 99 ? '99+' : cartItemsCount}
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ================= OPTIONS SHEET =================
            Seul selecteur d'options de la fiche : feuille ancree en bas sur
            mobile, modale centree a partir de lg. */}
        {isOptionsSheetOpen && hasOptions && (
          <div className="fixed inset-0 z-[1000] flex items-end justify-center lg:items-center lg:p-6">
            <div
              className="absolute inset-0 bg-gray-900/50"
              onClick={() => setIsOptionsSheetOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Choisir les options"
              className="relative w-full max-w-md bg-white rounded-t-[28px] lg:rounded-2xl shadow-2xl flex flex-col max-h-[88vh] lg:max-h-[80vh]"
            >
              {/* Poignee + titre */}
              <div className="flex flex-col items-center pt-2.5 pb-1 shrink-0">
                <span className="w-9 h-1 rounded-full bg-gray-300 lg:hidden" />
                <div className="w-full flex items-center justify-between px-4 pt-2 pb-1">
                  <h2 className="text-sm font-bold text-gray-900">Choisir les options</h2>
                  <button
                    type="button"
                    onClick={() => setIsOptionsSheetOpen(false)}
                    aria-label="Fermer"
                    className="w-8 h-8 -mr-1.5 rounded-full flex items-center justify-center text-gray-500 active:bg-gray-100 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Selecteur : defilable, le pied reste visible */}
              <div className="overflow-y-auto overscroll-contain px-4 pb-2">
                <OptionsPicker
                  options={options}
                  selectedOptions={selectedOptions}
                  onSelect={selectValue}
                  onRemove={(optionId) =>
                    setSelectedOptions((prev: Record<string, string>) => {
                      const next = { ...prev };
                      delete next[optionId];
                      return next;
                    })
                  }
                  isValueDisabled={isValueDisabled}
                  allSelected={allSelected}
                  outOfStock={isSelectedOutOfStock}
                  hasMatrix={variants.length > 0}
                  variantName={matchedVariant?.name}
                  variantStock={matchedVariant ? Number(matchedVariant.stock) || 0 : null}
                  price={matchedVariant ? Number(matchedVariant.price) || 0 : null}
                />
              </div>

              {/* Pied : prix de la selection + ajout */}
              <div
                className="shrink-0 border-t border-gray-100 bg-white px-4 pt-3"
                style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
              >
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {selectedOptionCount}/{options.length} sélectionné{options.length > 1 ? "s" : ""}
                    </span>
                    {/* D4 : stock de la combinaison choisie */}
                    {matchedVariant && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          (Number(matchedVariant.stock) || 0) > 0
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-rose-50 text-rose-600 border border-rose-100"
                        }`}
                      >
                        {(Number(matchedVariant.stock) || 0) > 0
                          ? `${Number(matchedVariant.stock)} en stock`
                          : "Rupture"}
                      </span>
                    )}
                  </div>
                  <span className="text-base font-bold text-gray-950 tracking-tight">
                    {formatCurrency(matchedVariant ? matchedVariant.price : basePrice)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (guardSelection()) {
                      addToCart(product, resolveVariantId());
                      setIsOptionsSheetOpen(false);
                    }
                  }}
                  disabled={isBuyDisabled}
                  className="w-full h-12 rounded-full bg-brand active:bg-[#e04e0f] text-white font-bold text-[13px] shadow-sm shadow-orange-500/25 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingCart size={15} strokeWidth={2.5} className="flex-shrink-0" />
                  <span className="truncate">
                    {isOutOfStock || isSelectedOutOfStock
                      ? "Rupture"
                      : isFood
                        ? "Commander"
                        : "Ajouter au panier"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
}
