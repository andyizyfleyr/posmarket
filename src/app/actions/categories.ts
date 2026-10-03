'use server';

import { db } from '@/db';
import { productCategories, products } from '@/db/schema';
import { eq, and, isNull, isNotNull, sql, asc, ne, inArray } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';
import { getAdminSession } from '@/app/actions/admin-auth';

export type ProductCategoryInput = {
  name: string;
  slug?: string;
  icon?: string | null;
  parentId?: string | null;
  businessType?: string;
  position?: number;
  isActive?: boolean;
  /**
   * Renommer une catégorie réécrit `products.main_category` / `products.category`.
   * Cette réécriture de masse est bloquée tant que l'appelant ne l'a pas
   * explicitement validée après avoir vu le nombre de produits concernés.
   */
  acknowledgeImpact?: boolean;
};

export type CategoryRenameImpact = {
  currentName: string;
  nextName: string;
  asMainCategory: number;
  asSubCategory: number;
  total: number;
};

export type ProductCategoryRow = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  parentId: string | null;
  businessType: string;
  position: number;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type ProductCategoryNode = ProductCategoryRow & {
  productCount: number;
  children: ProductCategoryNode[];
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Accents / ponctuation retirés pour produire un slug stable et URL-friendly. */
function slugifyCategory(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function countProductsByCategoryNames(
  names: string[],
  businessType?: string,
): Promise<Record<string, number>> {
  if (names.length === 0) return {};
  const verticalFilter = businessType === 'food' ? 'food' : businessType === 'shopping' ? 'shopping' : null;

  const rows = await db
    .select({ name: products.mainCategory, count: sql<number>`count(*)::int` })
    .from(products)
    .where(and(isNotNull(products.mainCategory), verticalFilter ? eq(products.businessType, verticalFilter) : undefined))
    .groupBy(products.mainCategory);

  const subRows = await db
    .select({ name: products.category, count: sql<number>`count(*)::int` })
    .from(products)
    .where(and(isNotNull(products.category), verticalFilter ? eq(products.businessType, verticalFilter) : undefined))
    .groupBy(products.category);

  const totals: Record<string, number> = {};
  const nameSet = new Set(names);
  for (const row of rows) {
    if (row.name && nameSet.has(row.name)) {
      totals[row.name] = (totals[row.name] || 0) + Number(row.count || 0);
    }
  }
  for (const row of subRows) {
    if (row.name && nameSet.has(row.name)) {
      totals[row.name] = (totals[row.name] || 0) + Number(row.count || 0);
    }
  }
  return totals;
}

function buildTree(rows: ProductCategoryRow[], counts: Record<string, number>): ProductCategoryNode[] {
  const nodes = new Map<string, ProductCategoryNode>();
  rows.forEach((row) => {
    nodes.set(row.id, { ...row, productCount: counts[row.name] || 0, children: [] });
  });

  const roots: ProductCategoryNode[] = [];
  nodes.forEach((node) => {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortRec = (list: ProductCategoryNode[]) => {
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'fr'));
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/** Catégories actives, arborescence — usage vendeur / storefront. */
/**
 * Arbre des.categories pour une verticale.
 *
 * Le paramètre est obligatoire : les catégories sont typées
 * (`shopping` / `food`) et une boutique ne doit jamais voir les catégories de
 * l'autre type. Sans filtre, un resto voyait les catégories de commerce et
 * inversement, et pouvait y ranger ses produits.
 */
export async function getProductCategoryTree(businessType: string): Promise<ProductCategoryNode[]> {
  try {
    const vertical = businessType === 'food' ? 'food' : 'shopping';
    const rows = await db
      .select()
      .from(productCategories)
      .where(and(eq(productCategories.isActive, true), eq(productCategories.businessType, vertical)))
      .orderBy(asc(productCategories.position));

    // Les produits sont rangés par nom de catégorie (colonne texte) : le compte
    // doit donc être restreint à la même verticale, sinon un produit d'une
    // autre boutiqueurerait le total d'une catégorie.
    const names = rows.map((r) => r.name);
    const counts = await countProductsByCategoryNames(names, vertical);
    return buildTree(rows, counts);
  } catch (error: unknown) {
    console.error('Error fetching product categories:', error);
    return [];
  }
}

/** Toutes les catégories avec compteurs — usage admin. */
export async function getAdminProductCategories(): Promise<ProductCategoryNode[]> {
  try {
    const rows = await db.select().from(productCategories).orderBy(asc(productCategories.position));
    const counts = await countProductsByCategoryNames(rows.map((r) => r.name));
    return buildTree(rows, counts);
  } catch (error: unknown) {
    console.error('Error fetching admin product categories:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Écriture (admin uniquement)
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

async function ensureUniqueName(name: string, excludeId?: string) {
  const clauses = [eq(productCategories.name, name)];
  if (excludeId) clauses.push(ne(productCategories.id, excludeId));
  const [existing] = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(and(...clauses))
    .limit(1);
  return existing;
}

async function ensureUniqueSlug(slug: string, excludeId?: string) {
  const clauses = [eq(productCategories.slug, slug)];
  if (excludeId) clauses.push(ne(productCategories.id, excludeId));
  const [existing] = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(and(...clauses))
    .limit(1);
  return existing;
}

/** Produits rattachés au nom actuel : c'est la clef de rattachement. */
async function computeRenameImpact(
  currentName: string,
  nextName: string
): Promise<CategoryRenameImpact> {
  const [{ count: asMainCategory }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.mainCategory, currentName));
  const [{ count: asSubCategory }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.category, currentName));
  return {
    currentName,
    nextName,
    asMainCategory: Number(asMainCategory) || 0,
    asSubCategory: Number(asSubCategory) || 0,
    total: (Number(asMainCategory) || 0) + (Number(asSubCategory) || 0),
  };
}

async function nextPosition(parentId: string | null): Promise<number> {
  const rows = parentId
    ? await db
        .select({ position: productCategories.position })
        .from(productCategories)
        .where(eq(productCategories.parentId, parentId))
    : await db
        .select({ position: productCategories.position })
        .from(productCategories)
        .where(isNull(productCategories.parentId));
  return rows.reduce((max, r) => Math.max(max, Number(r.position) || 0), -1) + 1;
}

/** Résout et valide un parent : doit exister, ne pas être soi-même, pas être un enfant. */
async function resolveParentId(
  parentId: string | null | undefined,
  selfId?: string
): Promise<{ ok: true; value: string | null } | { ok: false; error: string }> {
  if (!parentId) return { ok: true, value: null };
  if (selfId && parentId === selfId) {
    return { ok: false, error: 'Une catégorie ne peut pas être son propre parent.' };
  }
  const [parent] = await db
    .select({ id: productCategories.id, parentId: productCategories.parentId })
    .from(productCategories)
    .where(eq(productCategories.id, parentId))
    .limit(1);
  if (!parent) return { ok: false, error: 'Catégorie parente introuvable.' };
  if (parent.parentId) {
    return { ok: false, error: 'Les sous-catégories ne peuvent pas être imbriquées sur plusieurs niveaux.' };
  }
  return { ok: true, value: parentId };
}

function revalidateCategoryViews() {
  revalidatePath('/pam/categories');
  revalidatePath('/inventory');
  updateTag('marketplace');
}

export async function createProductCategoryAction(input: ProductCategoryInput) {
  try {
    const session = await getAdminSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const name = normalizeName(input?.name || '');
    if (!name) return { success: false, error: 'Le nom de la catégorie est obligatoire.' };
    if (name.length > 80) return { success: false, error: 'Le nom ne doit pas dépasser 80 caractères.' };

    if (await ensureUniqueName(name)) {
      return { success: false, error: 'Une catégorie porte déjà ce nom.' };
    }

    let slug = slugifyCategory(input?.slug || name);
    if (!slug) return { success: false, error: 'Impossible de générer un identifiant à partir de ce nom.' };
    if (await ensureUniqueSlug(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const parent = await resolveParentId(input?.parentId ?? null);
    if (!parent.ok) return { success: false, error: parent.error };

    const businessType = input?.businessType === 'food' ? 'food' : 'shopping';
    const position = Number.isFinite(input?.position)
      ? Number(input?.position)
      : await nextPosition(parent.value);

    const [created] = await db
      .insert(productCategories)
      .values({
        name,
        slug,
        icon: input?.icon ? String(input.icon).trim().slice(0, 40) : null,
        parentId: parent.value,
        businessType,
        position,
        isActive: input?.isActive !== false,
      })
      .returning();

    revalidateCategoryViews();
    return { success: true, category: created as ProductCategoryRow };
  } catch (error: unknown) {
    console.error('Error creating product category:', error);
    return { success: false, error: errorMessage(error) };
  }
}

export async function updateProductCategoryAction(id: string, input: ProductCategoryInput) {
  try {
    const session = await getAdminSession();
    if (!session) return { success: false, error: 'Unauthorized' };
    if (!id) return { success: false, error: 'Catégorie introuvable.' };

    const [existing] = await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.id, id))
      .limit(1);
    if (!existing) return { success: false, error: 'Catégorie introuvable.' };

    const name = normalizeName(input?.name || '');
    if (!name) return { success: false, error: 'Le nom de la catégorie est obligatoire.' };
    if (name.length > 80) return { success: false, error: 'Le nom ne doit pas dépasser 80 caractères.' };

    const renaming = name !== existing.name;
    if (renaming && (await ensureUniqueName(name, id))) {
      return { success: false, error: 'Une catégorie porte déjà ce nom.' };
    }

    // Tout est validé avant la moindre écriture : le nom est la clef de
    // rattachement des produits, une validation refusée après coup laisserait
    // des produits orphelins.
    let slug = existing.slug;
    if (typeof input?.slug === 'string') {
      const candidate = slugifyCategory(input.slug);
      if (!candidate) return { success: false, error: 'Identifiant invalide.' };
      if (candidate !== existing.slug && (await ensureUniqueSlug(candidate, id))) {
        return { success: false, error: 'Cet identifiant est déjà utilisé.' };
      }
      slug = candidate;
    } else if (renaming) {
      const candidate = slugifyCategory(name);
      if (candidate && !(await ensureUniqueSlug(candidate, id))) slug = candidate;
    }

    const parent = await resolveParentId(
      typeof input?.parentId === 'undefined' ? existing.parentId : input.parentId,
      id
    );
    if (!parent.ok) return { success: false, error: parent.error };

    // Le renommage réécrit `products.main_category` / `products.category` :
    // opération de masse, elle exige un accord explicite de l'admin.
    if (renaming) {
      const impact = await computeRenameImpact(existing.name, name);
      if (impact.total > 0 && input?.acknowledgeImpact !== true) {
        return {
          success: false,
          error: `CONFIRM_IMPACT:${impact.total}`,
          impact,
        };
      }
      await db.update(products).set({ mainCategory: name }).where(eq(products.mainCategory, existing.name));
      await db.update(products).set({ category: name }).where(eq(products.category, existing.name));
    }

    const [updated] = await db
      .update(productCategories)
      .set({
        name,
        slug,
        icon: typeof input?.icon === 'undefined' ? existing.icon : input.icon ? String(input.icon).trim().slice(0, 40) : null,
        parentId: parent.value,
        businessType: input?.businessType === 'food' ? 'food' : input?.businessType === 'shopping' ? 'shopping' : existing.businessType,
        position: Number.isFinite(input?.position) ? Number(input?.position) : existing.position,
        isActive: typeof input?.isActive === 'boolean' ? input.isActive : existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(productCategories.id, id))
      .returning();

    revalidateCategoryViews();
    return { success: true, category: updated as ProductCategoryRow };
  } catch (error: unknown) {
    console.error('Error updating product category:', error);
    return { success: false, error: errorMessage(error) };
  }
}

/**
 * Nombre de produits qu'un renommage réaffecterait, sans rien écrire.
 * L'UI l'appelle pendant la saisie pour afficher l'avertissement avant le clic.
 */
export async function previewCategoryRenameAction(
  id: string,
  nextName: string
): Promise<{ success: boolean; impact?: CategoryRenameImpact; error?: string }> {
  try {
    const session = await getAdminSession();
    if (!session) return { success: false, error: 'Unauthorized' };
    if (!id) return { success: false, error: 'Catégorie introuvable.' };

    const candidate = normalizeName(nextName || '');
    if (!candidate) return { success: true, impact: undefined };
    if (candidate.length > 80) return { success: false, error: 'Le nom ne doit pas dépasser 80 caractères.' };

    const [existing] = await db
      .select({ name: productCategories.name })
      .from(productCategories)
      .where(eq(productCategories.id, id))
      .limit(1);
    if (!existing) return { success: false, error: 'Catégorie introuvable.' };
    if (existing.name === candidate) return { success: true, impact: undefined };

    if (await ensureUniqueName(candidate, id)) {
      return { success: false, error: 'Une catégorie porte déjà ce nom.' };
    }

    return { success: true, impact: await computeRenameImpact(existing.name, candidate) };
  } catch (error: unknown) {
    console.error('Error previewing category rename:', error);
    return { success: false, error: errorMessage(error) };
  }
}

/** Bascule l'état actif de plusieurs catégories en une seule action. */
export async function setProductCategoriesActiveAction(ids: string[], isActive: boolean) {
  try {
    const session = await getAdminSession();
    if (!session) return { success: false, error: 'Unauthorized' };
    const targets = (ids || []).filter((id) => typeof id === 'string' && id.length > 0);
    if (targets.length === 0) return { success: false, error: 'Aucune catégorie sélectionnée.' };

    if (!isActive) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(productCategories)
        .where(
          and(
            inArray(productCategories.parentId, targets),
            eq(productCategories.isActive, true)
          )
        );
      if (Number(count) > 0) {
        return {
          success: false,
          error: 'Masquez d’abord les sous-catégories avant de masquer leur catégorie parente.',
        };
      }
    }

    await db
      .update(productCategories)
      .set({ isActive, updatedAt: new Date() })
      .where(inArray(productCategories.id, targets));

    revalidateCategoryViews();
    return { success: true, updated: targets.length };
  } catch (error: unknown) {
    console.error('Error bulk toggling product categories:', error);
    return { success: false, error: errorMessage(error) };
  }
}

export async function toggleProductCategoryAction(id: string, isActive: boolean) {
  try {
    const session = await getAdminSession();
    if (!session) return { success: false, error: 'Unauthorized' };
    if (!id) return { success: false, error: 'Catégorie introuvable.' };

    const [existing] = await db
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(eq(productCategories.id, id))
      .limit(1);
    if (!existing) return { success: false, error: 'Catégorie introuvable.' };

    if (!isActive) {
      // Seules les sous-catégories encore visibles bloquent le masquage :
      // une sous-catégorie déjà masquée ne peut pas nuire à la catégorie parente.
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(productCategories)
        .where(and(eq(productCategories.parentId, id), eq(productCategories.isActive, true)));
      if (Number(count) > 0) {
        return { success: false, error: 'Masquez d’abord les sous-catégories de cette catégorie.' };
      }
    }

    await db
      .update(productCategories)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(productCategories.id, id));

    revalidateCategoryViews();
    return { success: true };
  } catch (error: unknown) {
    console.error('Error toggling product category:', error);
    return { success: false, error: errorMessage(error) };
  }
}

export async function deleteProductCategoryAction(id: string) {
  try {
    const session = await getAdminSession();
    if (!session) return { success: false, error: 'Unauthorized' };
    if (!id) return { success: false, error: 'Catégorie introuvable.' };

    const [existing] = await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.id, id))
      .limit(1);
    if (!existing) return { success: false, error: 'Catégorie introuvable.' };

    const [{ count: childCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(productCategories)
      .where(eq(productCategories.parentId, id));
    if (Number(childCount) > 0) {
      return { success: false, error: 'Supprimez d’abord les sous-categories de cette catégorie.' };
    }

    const [{ count: mainCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.mainCategory, existing.name));
    const [{ count: subCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.category, existing.name));
    const used = Number(mainCount) + Number(subCount);
    if (used > 0) {
      return {
        success: false,
        error: `Cette catégorie est utilisée par ${used} produit(s). Réaffectez-les ou désactivez-la.`,
      };
    }

    await db.delete(productCategories).where(eq(productCategories.id, id));

    revalidateCategoryViews();
    return { success: true, deleted: 1 };
  } catch (error: unknown) {
    console.error('Error deleting product category:', error);
    return { success: false, error: errorMessage(error) };
  }
}

/** Réordonne une liste de categories parentes ; les enfants suivent leur parent. */
export async function reorderProductCategoriesAction(orderedIds: string[]) {
  try {
    const session = await getAdminSession();
    if (!session) return { success: false, error: 'Unauthorized' };
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return { success: false, error: 'Aucun ordre reçu.' };
    }

    for (let index = 0; index < orderedIds.length; index += 1) {
      await db
        .update(productCategories)
        .set({ position: index, updatedAt: new Date() })
        .where(eq(productCategories.id, orderedIds[index]));
    }

    revalidateCategoryViews();
    return { success: true, updated: orderedIds.length };
  } catch (error: unknown) {
    console.error('Error reordering product categories:', error);
    return { success: false, error: errorMessage(error) };
  }
}
