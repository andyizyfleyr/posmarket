/**
 * Configuration « mise en page de l'accueil » — pilotée par l'admin /pam.
 *
 * Persistée en base dans `system_settings` (clé `homepage_layout`, JSON).
 * Tant que l'admin n'a rien enregistré, la configuration par défaut
 * (tout visible, ordre historique) s'applique : le comportement actuel est
 * conservé à l'identique.
 *
 * Consommée côté serveur (page `[[...slug]]`, route `/api/marketplace/home`)
 * et transmise aux vues : le web l'applique via `StorefrontView`, l'app Expo
 * via `fetchHomeCatalog`.
 */

import { unstable_cache } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { MAIN_CATEGORIES } from '@/constants';

export const HOMEPAGE_LAYOUT_KEY = 'homepage_layout';
export const HOMEPAGE_LAYOUT_TAG = 'homepage-layout';

export interface HomepageLayout {
  /** Carrousel d'affiches en haut de l'accueil. */
  hero: boolean;
  /** Rail « Boutiques partenaires ». */
  partners: boolean;
  /** Section éditoriale « Meilleures ventes ». */
  bestSellers: boolean;
  /** Section éditoriale « Promotions ». */
  promotions: boolean;
  /** Section éditoriale « Nouveautés ». */
  newArrivals: boolean;
  /** Sections par catégorie (une par couple verticale::catégorie). */
  categoriesEnabled: boolean;
  /** Ordre voulu des sections catégorie, par nom exact de catégorie. */
  categoryOrder: string[];
  /** Catégories masquées de l'accueil (noms exacts). */
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

const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback;

const stringList = (v: unknown, max = 60): string[] => {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    const s = typeof item === 'string' ? item.trim() : '';
    if (!s) continue;
    const clipped = s.slice(0, 120);
    if (seen.has(clipped)) continue;
    seen.add(clipped);
    out.push(clipped);
    if (out.length >= max) break;
  }
  return out;
};

/** Parse tolérant : toute valeur illisible retombe sur les défauts. */
export function parseHomepageLayout(raw: unknown): HomepageLayout {
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      obj = null;
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }
  if (!obj) return { ...DEFAULT_HOMEPAGE_LAYOUT };

  return {
    hero: bool(obj.hero, true),
    partners: bool(obj.partners, true),
    bestSellers: bool(obj.bestSellers, true),
    promotions: bool(obj.promotions, true),
    newArrivals: bool(obj.newArrivals, true),
    categoriesEnabled: bool(obj.categoriesEnabled, true),
    categoryOrder: stringList(obj.categoryOrder),
    categoryHidden: stringList(obj.categoryHidden),
  };
}

export function serializeHomepageLayout(layout: HomepageLayout): string {
  // On ne persiste QUE le souhaité : les listes vides reviennent en [] pour
  // que « réordonner puis remettre l'ordre historique » reste explicite.
  return JSON.stringify({
    hero: layout.hero,
    partners: layout.partners,
    bestSellers: layout.bestSellers,
    promotions: layout.promotions,
    newArrivals: layout.newArrivals,
    categoriesEnabled: layout.categoriesEnabled,
    categoryOrder: layout.categoryOrder,
    categoryHidden: layout.categoryHidden,
  } satisfies HomepageLayout);
}

/**
 * Filtre et ordonne les sections « catégorie » selon la configuration.
 * Les sections éditoriales portent des clefs mémoire (`collection-*`),
 * les sections catégorie des clefs `verticale::catégorie`.
 */
export interface HomepageSectionLike {
  key: string;
  vertical?: 'shopping' | 'food';
}

export function applyHomepageCategories<T extends HomepageSectionLike>(
  sections: T[],
  layout: Pick<HomepageLayout, 'categoryOrder' | 'categoryHidden'>,
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
    const i = MAIN_CATEGORIES.indexOf(name);
    return MAIN_CATEGORIES.length + (i === -1 ? 1000 : i);
  };

  // Verticale d'abord (shopping avant food, comportement historique), puis ordre
  // admin, puis ordre hérité des constantes.
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

/** Section éditoriale activée ? (clefs mémoire de buildHomeSections). */
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

async function loadHomepageLayout(): Promise<HomepageLayout> {
  try {
    const [row] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, HOMEPAGE_LAYOUT_KEY))
      .limit(1);
    return parseHomepageLayout(row?.value);
  } catch {
    // En cas d'erreur DB on préfère un accueil complet plutôt qu'un accueil vide.
    return { ...DEFAULT_HOMEPAGE_LAYOUT };
  }
}

const cached = unstable_cache(loadHomepageLayout, ['homepage-layout'], {
  tags: [HOMEPAGE_LAYOUT_TAG],
  revalidate: 3600,
});

/** Lecture publique (ISR/cache, tag `homepage-layout`). */
export async function getHomepageLayout(): Promise<HomepageLayout> {
  return cached();
}
