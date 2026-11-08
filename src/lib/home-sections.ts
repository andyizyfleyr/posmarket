/**
 * Sections de l'accueil — algorithme identique à celui de l'app mobile.
 *
 * L'accueil est composé de deux familles de sections :
 *  1. les sections éditoriales (meilleures ventes, promotions, nouveautés) ;
 *  2. les sections par catégorie (une par couple verticale :: catégorie).
 *
 * Chaque section affiche un aperçu de six produits, triés par score de
 * classement et diversifiés pour qu'une boutique ne domine pas la section.
 *
 * Les produits de restauration sont exclus de l'accueil, sections éditoriales
 * comprises. Un plat ou une boisson se parcourt dans le contexte de son
 * restaurant (carte, horaires, préparation), pas au milieu d'un catalogue
 * d'objets. Ils restent visibles sur la page de leur boutique et dans
 * l'onglet Restaurants.
 */

import {
  MAIN_CATEGORIES,
  verticalOfProduct,
} from '@/constants';
import {
  displayPriceOf,
  effectiveProductStock,
  isMarketableProduct,
  productDiscountPercent,
} from '@/utils';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Nombre d'aperçus par section. */
export const SECTION_PREVIEW_COUNT = 6;

export interface HomeSection<T extends HomeProduct = HomeProduct> {
  /** Clef `verticale::categorie` (ou identifiant editorial). */
  key: string;
  title: string;
  vertical?: 'shopping' | 'food';
  /** Produits de l'aperçu, déjà triés et diversifiés. */
  preview: T[];
  /** La section ouvre une liste complète (« Voir tout »). */
  canSeeAll: boolean;
}

export interface HomeProduct {
  id: string;
  name?: string;
  stock?: number;
  storeId: string;
  storeName?: string;
  salesCount?: number;
  rating?: number;
  reviewCount?: number;
  views?: number;
  createdAt?: string;
  price?: number;
  originalPrice?: number;
  image?: string;
  mainCategory?: string;
  category?: string;
}

/** Produit de vitrine complet (carte produit). */
export type HomeProductFull = HomeProduct & {
  name: string;
  stock: number;
  storeName: string;
};

/** Score de classement doux : ventes, note, avis, vues et fraîcheur. */
export function productRankScore(product: HomeProduct): number {
  const sales = product.salesCount ?? 0;
  const rating = product.rating ?? 0;
  const reviews = product.reviewCount ?? 0;
  const views = product.views ?? 0;
  const createdAt = product.createdAt ? Date.parse(product.createdAt) : NaN;
  const ageDays = Number.isFinite(createdAt)
    ? Math.max(0, (Date.now() - createdAt) / MS_PER_DAY)
    : 90;
  const recency = Number.isFinite(createdAt)
    ? Math.max(0, 1 - ageDays / 60)
    : 0;
  return (
    Math.log1p(sales) * 2.4 +
    rating * 0.9 +
    Math.log1p(reviews) * 0.55 +
    Math.log1p(views) * 0.08 +
    recency * 0.9
  );
}

/** Classement des produits d'une section. */
export function rankProducts<T extends HomeProduct>(products: T[]): T[] {
  return [...products].sort((a, b) => {
    const scoreDiff = productRankScore(b) - productRankScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    const salesDiff = (b.salesCount ?? 0) - (a.salesCount ?? 0);
    if (salesDiff !== 0) return salesDiff;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });
}

/**
 * Limite la domination d'une boutique (deux produits max sur six) puis
 * complète avec les meilleurs produits restants.
 */
export function diversifyProducts<T extends HomeProduct>(
  products: T[],
  limit: number,
): T[] {
  const maxPerStore = Math.max(1, Math.ceil(limit / 3));
  const picked: T[] = [];
  const overflow: T[] = [];
  const perStore = new Map<string, number>();

  for (const product of products) {
    const count = perStore.get(product.storeId) ?? 0;
    if (picked.length < limit && count < maxPerStore) {
      picked.push(product);
      perStore.set(product.storeId, count + 1);
    } else {
      overflow.push(product);
    }
  }

  for (const product of overflow) {
    if (picked.length >= limit) break;
    picked.push(product);
  }

  return picked;
}

export interface BuildHomeSectionsOptions {
  /** Collections éditoriales souhaitées (défaut : tout). */
  editorial?: {
    bestSellers?: boolean;
    promotions?: boolean;
    newArrivals?: boolean;
  };
  /** Affiche les sections par catégorie (défaut : true). */
  categoriesEnabled?: boolean;
  /** Catégories masquées, noms exacts. */
  categoryHidden?: string[];
  /** Ordre d'affichage des sections catégorie, noms exacts. */
  categoryOrder?: string[];
}

/**
 * Construit les sections de l'accueil : éditoriales d'abord, puis les
 * catégories (ordre historique à l'intérieur). La restauration est écartée.
 */
export function buildHomeSections<T extends HomeProduct>(
  products: T[],
  previewCount: number = SECTION_PREVIEW_COUNT,
  options: BuildHomeSectionsOptions = {},
): HomeSection<T>[] {
  const {
    editorial,
    categoriesEnabled = true,
    categoryHidden,
    categoryOrder,
  } = options;
  const wantBest = editorial?.bestSellers !== false;
  const wantPromotions = editorial?.promotions !== false;
  const wantNew = editorial?.newArrivals !== false;
  // Restauration hors accueil : voir l'en-tête du fichier.
  const marketable = products.filter(
    (p) => isMarketableProduct(p) && verticalOfProduct(p) !== 'food',
  );
  const sections: HomeSection<T>[] = [];

  // ── Meilleures ventes ──
  const bestSellers = rankProducts(
    wantBest
      ? marketable.filter((p) => (p.salesCount ?? 0) > 0).sort(
        (a, b) =>
          (b.salesCount ?? 0) - (a.salesCount ?? 0) ||
          productRankScore(b) - productRankScore(a),
      )
      : [],
  );
  const bestPreview = diversifyProducts(bestSellers, previewCount);
  if (bestPreview.length > 0) {
    sections.push({
      key: 'collection-best-sellers',
      title: 'Meilleures ventes',
      preview: bestPreview,
      canSeeAll: false,
    });
  }

  // ── Promotions ──
  const promotions = (wantPromotions ? [...marketable] : [])
    .filter((p) => productDiscountPercent(p) > 0)
    .sort(
      (a, b) =>
        productDiscountPercent(b) - productDiscountPercent(a) ||
        productRankScore(b) - productRankScore(a),
    );
  const promoPreview = diversifyProducts(promotions, previewCount);
  if (promoPreview.length > 0) {
    sections.push({
      key: 'collection-promotions',
      title: 'Promotions',
      preview: promoPreview,
      canSeeAll: false,
    });
  }

  // ── Nouveautés ──
  const newArrivals = (wantNew ? [...marketable] : [])
    .filter(
      (p) =>
        Boolean(p.createdAt) &&
        Number.isFinite(Date.parse(p.createdAt as string)),
    )
    .sort(
      (a, b) =>
        Date.parse(b.createdAt as string) - Date.parse(a.createdAt as string),
    );
  const newPreview = diversifyProducts(newArrivals, previewCount);
  if (newPreview.length > 0) {
    sections.push({
      key: 'collection-new-arrivals',
      title: 'Nouveautés',
      preview: newPreview,
      canSeeAll: false,
    });
  }

  // ── Sections par catégorie ──
  const groups = new Map<string, T[]>();
  marketable.forEach((p) => {
    const cat = p.mainCategory || p.category || 'Autres';
    const key = `${verticalOfProduct(p)}::${cat}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  });

  const hidden = new Set(categoryHidden ?? []);
  const orderRank = new Map(
    (categoryOrder ?? []).map((name, index) => [name, index] as const),
  );
  const fallbackIndex = (name: string) => {
    const i = MAIN_CATEGORIES.indexOf(name);
    return MAIN_CATEGORIES.length + (i === -1 ? 1000 : i);
  };

  const categorySections = categoriesEnabled
    ? Array.from(groups.entries())
        .filter(([key]) => !hidden.has(key.slice(key.indexOf('::') + 2)))
        .sort(([a], [b]) => {
          const [va, ca] = a.split('::');
          const [vb, cb] = b.split('::');
          if (va !== vb) return va === 'shopping' ? -1 : 1;
          const ra = orderRank.get(ca);
          const rb = orderRank.get(cb);
          if (ra !== undefined && rb !== undefined) return ra - rb;
          if (ra !== undefined) return -1;
          if (rb !== undefined) return 1;
          return fallbackIndex(ca) - fallbackIndex(cb);
        })
        .map(([key, items]) => {
          const sep = key.indexOf('::');
          return {
            key,
            title: key.slice(sep + 2),
            vertical: key.slice(0, sep) as 'shopping' | 'food',
            preview: diversifyProducts(rankProducts(items), previewCount),
            canSeeAll: true,
          } satisfies HomeSection<T>;
        })
    : [];

  return [...sections, ...categorySections];
}

/** Prix affiché d'un produit (variante la moins chère si le produit en a). */
export { displayPriceOf, effectiveProductStock };
