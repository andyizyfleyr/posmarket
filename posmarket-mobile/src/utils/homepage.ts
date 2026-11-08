/**
 * Configuration « mise en page de l'accueil » — version app Expo.
 *
 * Reçue dans la réponse de `/api/marketplace/home` (champ `homepage`), écrite
 * par l'admin /pam (« Accueil »). Tant que l'admin n'a rien enregistré, les
 * défauts (tout visible) s'appliquent et le comportement reste inchangé.
 * Les clés sont volontairement identiques à celles du web (voir le module
 * correspondant sur le site Next.js).
 */
export interface HomepageLayout {
  hero: boolean;
  partners: boolean;
  bestSellers: boolean;
  promotions: boolean;
  newArrivals: boolean;
  categoriesEnabled: boolean;
  categoryOrder: string[];
  categoryHidden: string[];
}

export const DEFAULT_HOMEPAGE_LAYOUT: HomepageLayout = {
  hero: true,
  partners: true,
  bestSellers: true,
  promotions: true,
  newArrivals: true,
  categoriesEnabled: true,
  categoryOrder: [],
  categoryHidden: [],
};

/** Parse tolérant : toute valeur invalide retombe sur les défauts. */
export function parseHomepageLayout(raw: unknown): HomepageLayout {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_HOMEPAGE_LAYOUT };
  }
  const obj = raw as Record<string, unknown>;
  const bool = (v: unknown, fallback: boolean) =>
    typeof v === 'boolean' ? v : fallback;
  const strings = (v: unknown, max = 60): string[] => {
    if (!Array.isArray(v)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of v) {
      const s = typeof item === 'string' ? item.trim().slice(0, 120) : '';
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
      if (out.length >= max) break;
    }
    return out;
  };
  return {
    hero: bool(obj.hero, true),
    partners: bool(obj.partners, true),
    bestSellers: bool(obj.bestSellers, true),
    promotions: bool(obj.promotions, true),
    newArrivals: bool(obj.newArrivals, true),
    categoriesEnabled: bool(obj.categoriesEnabled, true),
    categoryOrder: strings(obj.categoryOrder),
    categoryHidden: strings(obj.categoryHidden),
  };
}

interface SectionLike {
  key: string;
  vertical?: 'shopping' | 'food';
}

/** Sections éditoriales autorisées selon la config (clefs `collection-*`). */
export function isEditorialSectionEnabled(
  sectionKey: string,
  layout: Pick<HomepageLayout, 'bestSellers' | 'promotions' | 'newArrivals'>,
): boolean {
  switch (sectionKey) {
    case 'collection-best-sellers':
      return layout.bestSellers;
    case 'collection-promotions':
      return layout.promotions;
    case 'collection-new-arrivals':
      return layout.newArrivals;
    default:
      return true;
  }
}

/**
 * Catégories masquées retirées, sections réordonnées selon `categoryOrder`
 * (verticale shopping avant food, comportement historique inchangé).
 */
export function applyHomepageCategories<T extends SectionLike>(
  sections: T[],
  layout: Pick<HomepageLayout, 'categoryOrder' | 'categoryHidden'>,
  categories: string[],
): T[] {
  const hidden = new Set(layout.categoryHidden);
  const catOf = (key: string) => {
    const idx = key.indexOf('::');
    return idx === -1 ? key : key.slice(idx + 2);
  };
  const visible = sections.filter((s) => !hidden.has(catOf(s.key)));

  const rank = new Map(
    layout.categoryOrder.map((name, index) => [name, index] as const),
  );
  const fallbackIndex = (name: string) => {
    const i = categories.indexOf(name);
    return categories.length + (i === -1 ? 1000 : i);
  };

  return [...visible].sort((a, b) => {
    const [va, ca] = a.key.split('::');
    const [vb, cb] = b.key.split('::');
    if (va !== vb) return va === 'shopping' ? -1 : 1;
    const ra = rank.get(ca);
    const rb = rank.get(cb);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return fallbackIndex(ca) - fallbackIndex(cb);
  });
}
