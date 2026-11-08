'use server';

import { db } from '@/db';
import { products, systemSettings } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { refreshTag } from '@/lib/revalidate';
import { getAdminSession } from '@/app/actions/admin-auth';
import {
  HOMEPAGE_LAYOUT_KEY,
  HOMEPAGE_LAYOUT_TAG,
  parseHomepageLayout,
  serializeHomepageLayout,
  type HomepageLayout,
} from '@/lib/homepage-layout';

async function requirePamAdmin() {
  return await getAdminSession();
}

const ACCES_REFUSE = 'Accès refusé.';

export interface HomepageLayoutPayload {
  hero: boolean;
  partners: boolean;
  bestSellers: boolean;
  promotions: boolean;
  newArrivals: boolean;
  categoriesEnabled: boolean;
  categoryOrder: string[];
  categoryHidden: string[];
}

/** Canonicalise l'entrée client : booléens stricts, listes plafonnées. */
function sanitizeLayout(input: HomepageLayoutPayload): HomepageLayout {
  return parseHomepageLayout({
    hero: Boolean(input?.hero),
    partners: Boolean(input?.partners),
    bestSellers: Boolean(input?.bestSellers),
    promotions: Boolean(input?.promotions),
    newArrivals: Boolean(input?.newArrivals),
    categoriesEnabled: Boolean(input?.categoriesEnabled),
    categoryOrder: input?.categoryOrder,
    categoryHidden: input?.categoryHidden,
  });
}

/** Configuration courante (lecture tolérante aux erreurs). */
export async function getHomepageLayoutAction(): Promise<{
  success: boolean;
  layout: HomepageLayout;
  error?: string;
}> {
  if (!(await requirePamAdmin())) {
    return { success: false, error: ACCES_REFUSE, layout: parseHomepageLayout(null) };
  }
  try {
    const [row] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, HOMEPAGE_LAYOUT_KEY))
      .limit(1);
    return { success: true, layout: parseHomepageLayout(row?.value) };
  } catch {
    return {
      success: false,
      error: 'Impossible de charger la configuration de l’accueil.',
      layout: parseHomepageLayout(null),
    };
  }
}

export async function updateHomepageLayoutAction(input: HomepageLayoutPayload) {
  if (!(await requirePamAdmin())) return { success: false, error: ACCES_REFUSE };
  try {
    const layout = sanitizeLayout(input);
    await db
      .insert(systemSettings)
      .values({ key: HOMEPAGE_LAYOUT_KEY, value: serializeHomepageLayout(layout) })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: serializeHomepageLayout(layout), updatedAt: new Date() },
      });

    revalidatePath('/pam/accueil');
    refreshTag(HOMEPAGE_LAYOUT_TAG);
    // L'accueil web (ISR 60 s) et la route mobile /api/marketplace/home en
    // dépendent aussi : les invalider immédiatement.
    refreshTag('marketplace');
    return { success: true };
  } catch {
    return {
      success: false,
      error: 'Impossible d’enregistrer la mise en page de l’accueil.',
    };
  }
}

export interface HomepageCategoryOption {
  /** Nom exact de la catégorie (tel qu'affiché sur l'accueil). */
  name: string;
  /** Produits en ligne dans le catalogue. */
  productCount: number;
}

/**
 * Catégories réellement présentes dans le catalogue en ligne — ce sont les
 * seules sections « catégorie » que l'accueil peut afficher.
 */
export async function getHomepageCategoryOptionsAction(): Promise<{
  success: boolean;
  categories: HomepageCategoryOption[];
  error?: string;
}> {
  if (!(await requirePamAdmin())) {
    return { success: false, categories: [], error: ACCES_REFUSE };
  }
  try {
    const rows = await db
      .select({
        name: sql<string>`COALESCE(${products.mainCategory}, ${products.category})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(products)
      .where(
        sql`${products.isOnline} = true AND COALESCE(${products.mainCategory}, ${products.category}) IS NOT NULL`,
      )
      .groupBy(sql`COALESCE(${products.mainCategory}, ${products.category})`)
      .orderBy(sql`COUNT(*) desc`);

    const byName = new Map<string, HomepageCategoryOption>();
    for (const row of rows) {
      const name = String(row.name || '').trim();
      if (!name) continue;
      const prev = byName.get(name);
      if (prev) {
        prev.productCount += row.count;
      } else {
        byName.set(name, { name: name.slice(0, 120), productCount: row.count });
      }
    }
    return { success: true, categories: Array.from(byName.values()) };
  } catch {
    return {
      success: false,
      categories: [],
      error: 'Impossible de lire les catégories du catalogue.',
    };
  }
}
