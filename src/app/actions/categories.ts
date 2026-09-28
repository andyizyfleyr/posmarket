'use server';

import { db } from '@/db';
import { productCategories, products } from '@/db/schema';
import { eq, and, isNull, isNotNull, sql, asc, ne } from 'drizzle-orm';
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

async function countProductsByCategoryNames(names: string[]): Promise<Record<string, number>> {
  if (names.length === 0) return {};
  const rows = await db
    .select({ name: products.mainCategory, count: sql<number>`count(*)::int` })
    .from(products)
    .where(isNotNull(products.mainCategory))
    .groupBy(products.mainCategory);

  const subRows = await db
    .select({ name: products.category, count: sql<number>`count(*)::int` })
    .from(products)
    .where(isNotNull(products.category))
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
export async function getProductCategoryTree(): Promise<ProductCategoryNode[]> {
  try {
    const rows = await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.isActive, true))
      .orderBy(asc(productCategories.position));
    return buildTree(rows, {});
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

    if (name !== existing.name) {
      if (await ensureUniqueName(name, id)) {
        return { success: false, error: 'Une catégorie porte déjà ce nom.' };
      }
      // Le nom est la clef de rattachement des produits : on le propage.
      await db.update(products).set({ mainCategory: name }).where(eq(products.mainCategory, existing.name));
      await db.update(products).set({ category: name }).where(eq(products.category, existing.name));
    }

    let slug = existing.slug;
    if (typeof input?.slug === 'string') {
      const candidate = slugifyCategory(input.slug);
      if (!candidate) return { success: false, error: 'Identifiant invalide.' };
      if (candidate !== existing.slug && (await ensureUniqueSlug(candidate, id))) {
        return { success: false, error: 'Cet identifiant est déjà utilisé.' };
      }
      slug = candidate;
    } else if (name !== existing.name) {
      const candidate = slugifyCategory(name);
      if (candidate && !(await ensureUniqueSlug(candidate, id))) slug = candidate;
    }

    const parent = await resolveParentId(
      typeof input?.parentId === 'undefined' ? existing.parentId : input.parentId,
      id
    );
    if (!parent.ok) return { success: false, error: parent.error };

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
      const [child] = await db
        .select({ id: productCategories.id })
        .from(productCategories)
        .where(eq(productCategories.parentId, id))
        .limit(1);
      if (child) {
        return { success: false, error: 'Désactivez d’abord les sous-catégories de cette catégorie.' };
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
