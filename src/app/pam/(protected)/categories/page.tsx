'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCcw,
  AlertTriangle,
  X,
  Loader2,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  UtensilsCrossed,
  ShoppingBag,
  Eye,
  EyeOff,
  Layers,
  Package,
  CheckCircle2,
  MoreVertical,
  PencilLine,
  CornerDownLeft,
} from 'lucide-react';
import {
  getAdminProductCategories,
  createProductCategoryAction,
  updateProductCategoryAction,
  deleteProductCategoryAction,
  toggleProductCategoryAction,
  reorderProductCategoriesAction,
  previewCategoryRenameAction,
  setProductCategoriesActiveAction,
} from '@/app/actions/categories';
import type { ProductCategoryNode } from '@/app/actions/categories';
import type { CategoryRenameImpact } from '@/app/actions/categories';
import Loader from '@/components/Loader';
import { formatNumber } from '@/utils';

type Draft = {
  id: string | null;
  name: string;
  icon: string;
  parentId: string | null;
  businessType: 'shopping' | 'food';
  isActive: boolean;
};

const EMPTY_DRAFT: Draft = {
  id: null,
  name: '',
  icon: '',
  parentId: null,
  businessType: 'shopping',
  isActive: true,
};

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

type InlineEdit = {
  id: string;
  value: string;
  checking: boolean;
  impact: CategoryRenameImpact | null;
  impactError: string | null;
  confirming: boolean;
  saving: boolean;
  /** Incrémenté pour forcer un nouvel aperçu après un refus du serveur. */
  nonce: number;
};

function CategoryIcon({ businessType, size = 20 }: { businessType: string; size?: number }) {
  return businessType === 'food' ? (
    <UtensilsCrossed size={size} className="text-emerald-600" />
  ) : (
    <ShoppingBag size={size} className="text-[#f56b2a]" />
  );
}

function verticalLabel(value: string) {
  return value === 'food' ? 'Restauration' : 'Commerce';
}

function countLabel(count: number) {
  return `${formatNumber(count)} produit${count > 1 ? 's' : ''}`;
}

export default function AdminCategoriesPage() {
  const [tree, setTree] = useState<ProductCategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [toDelete, setToDelete] = useState<ProductCategoryNode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inline, setInline] = useState<InlineEdit | null>(null);
  const [newChild, setNewChild] = useState<{ value: string; saving: boolean } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const flash = useCallback((tone: 'success' | 'error', text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const fetchData = useCallback(async () => {
    const data = await getAdminProductCategories();
    setTree(data);
    setLoading(false);
    return data;
  }, []);

  useEffect(() => {
    fetchData().then((data) => {
      if (data.length > 0) setSelectedId((current) => current ?? data[0].id);
    });
  }, [fetchData]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setBusy = useCallback((id: string, on: boolean) => {
    setProcessing((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const stats = useMemo(() => {
    let total = 0;
    let inactive = 0;
    const walk = (list: ProductCategoryNode[]) => {
      for (const n of list) {
        total += 1;
        if (!n.isActive) inactive += 1;
        walk(n.children);
      }
    };
    walk(tree);
    return { total, inactive, active: total - inactive, roots: tree.length, children: total - tree.length };
  }, [tree]);

  // Regroupe pour le panneau de gauche : un parent reste affiché si l'un de
  // ses enfants correspond, sinon l'admin ne voit plus où se trouve le résultat.
  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tree
      .map((parent) => {
        const parentHit =
          !term || parent.name.toLowerCase().includes(term) || (parent.slug || '').toLowerCase().includes(term);
        const childHits = term
          ? parent.children.filter(
              (c) => c.name.toLowerCase().includes(term) || (c.slug || '').toLowerCase().includes(term)
            )
          : parent.children;
        return { parent, parentHit, childHits };
      })
      .filter(({ parent, parentHit, childHits }) => {
        if (!parentHit && childHits.length === 0) return false;
        if (statusFilter === 'ACTIVE') return parent.isActive || childHits.some((c) => c.isActive);
        if (statusFilter === 'INACTIVE') return !parent.isActive || childHits.some((c) => !c.isActive);
        return true;
      });
  }, [tree, search, statusFilter]);

  const selected = useMemo(
    () => tree.find((n) => n.id === selectedId) ?? groups[0]?.parent ?? tree[0] ?? null,
    [tree, selectedId, groups]
  );

  const selectedIndex = useMemo(
    () => (selected ? tree.findIndex((n) => n.id === selected.id) : -1),
    [tree, selected]
  );

  const selectedTotalProducts = useMemo(() => {
    if (!selected) return 0;
    return selected.productCount + selected.children.reduce((acc, c) => acc + c.productCount, 0);
  }, [selected]);

  // --- Édition en ligne -----------------------------------------------------

  // Primitives extraites pour que l'aperçu ne se relance que sur un vrai
  // changement de cible ou de saisie (et non à chaque frappe d'état).
  const inlineId = inline?.id ?? null;
  const inlineValue = inline?.value ?? '';
  const inlineNonce = inline?.nonce ?? 0;

  const startInline = (node: ProductCategoryNode) => {
    setInline({
      id: node.id,
      value: node.name,
      checking: false,
      impact: null,
      impactError: null,
      confirming: false,
      saving: false,
      nonce: 0,
    });
  };

  // Prévisualise l'impact pendant la saisie : l'admin voit le nombre de
  // produits concernés avant de valider, pas après.
  useEffect(() => {
    if (!inlineId) return;
    const trimmed = inlineValue.trim();
    if (trimmed.length < 2) {
      setInline((prev) => (prev ? { ...prev, impact: null, impactError: null, confirming: false } : prev));
      return;
    }
    let cancelled = false;
    setInline((prev) => (prev ? { ...prev, checking: true, impactError: null } : prev));
    const timer = window.setTimeout(async () => {
      const result = await previewCategoryRenameAction(inlineId, trimmed);
      if (cancelled) return;
      setInline((prev) => {
        if (!prev) return prev;
        if (!result.success) {
          return { ...prev, checking: false, impact: null, impactError: result.error || 'Vérification impossible.' };
        }
        return { ...prev, checking: false, impact: result.impact ?? null, impactError: null };
      });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [inlineId, inlineValue, inlineNonce]);

  const commitInline = async (acknowledged: boolean) => {
    if (!inline) return;
    const name = inline.value.trim();
    if (!name) {
      setInline(null);
      return;
    }
    if (inline.impact && inline.impact.total > 0 && !acknowledged) {
      setInline({ ...inline, confirming: true });
      return;
    }
    setInline({ ...inline, saving: true, confirming: false });
    const result = await updateProductCategoryAction(inline.id, { name, acknowledgeImpact: acknowledged });
    if (!result.success) {
      // Le serveur refuse la réaffectation de masse sans accord explicite :
      // on repasse en confirmation après un nouvel aperçu de l'impact.
      if (typeof result.error === 'string' && result.error.startsWith('CONFIRM_IMPACT:')) {
        setInline({ ...inline, saving: false, confirming: true, impactError: null, nonce: inline.nonce + 1 });
        return;
      }
      setInline({
        ...inline,
        saving: false,
        confirming: false,
        impactError:
          result.error === 'Unauthorized' ? 'Session expirée, reconnectez-vous.' : result.error ?? 'Erreur inattendue.',
      });
      return;
    }
    setInline(null);
    flash('success', acknowledged && inline.impact ? `« ${name} » renommée, ${inline.impact.total} produit(s) réaffectés.` : `« ${name} » enregistrée.`);
    await fetchData();
  };

  // --- Création rapide d'une sous-catégorie -------------------------------

  const submitNewChild = async () => {
    if (!selected || !newChild) return;
    const name = newChild.value.trim();
    if (!name) {
      setNewChild(null);
      return;
    }
    setNewChild({ value: name, saving: true });
    const result = await createProductCategoryAction({
      name,
      parentId: selected.id,
      businessType: selected.businessType,
    });
    if (!result.success) {
      flash('error', result.error === 'Unauthorized' ? 'Session expirée, reconnectez-vous.' : result.error || 'Erreur.');
      setNewChild(null);
      return;
    }
    setNewChild(null);
    flash('success', `« ${name} » ajoutée à ${selected.name}.`);
    await fetchData();
  };

  // --- Actions ------------------------------------------------------------

  // Le bouton d'en-tête crée une catégorie racine ; l'ajout d'une sous-catégorie
  // se fait en ligne, sans quitter le panneau de droite.
  const openCreate = () => {
    setFormError(null);
    setDraft({ ...EMPTY_DRAFT });
  };

  const openEditDetails = (node: ProductCategoryNode) => {
    setMenuOpen(false);
    setFormError(null);
    setDraft({
      id: node.id,
      name: node.name,
      icon: node.icon || '',
      parentId: node.parentId,
      businessType: node.businessType === 'food' ? 'food' : 'shopping',
      isActive: node.isActive,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    try {
      const result = draft.id
        ? await updateProductCategoryAction(draft.id, {
            name: draft.name,
            icon: draft.icon,
            parentId: draft.parentId,
            businessType: draft.businessType,
            isActive: draft.isActive,
            acknowledgeImpact: true,
          })
        : await createProductCategoryAction({
            name: draft.name,
            icon: draft.icon,
            parentId: draft.parentId,
            businessType: draft.businessType,
            isActive: draft.isActive,
          });

      if (!result.success) {
        setFormError(
          result.error === 'Unauthorized' ? 'Session expirée, reconnectez-vous.' : result.error || 'Erreur inattendue.'
        );
        return;
      }
      setDraft(null);
      flash('success', draft.id ? 'Catégorie mise à jour.' : `« ${draft.name} » créée.`);
      const data = await fetchData();
      if (data.length > 0) setSelectedId((current) => current ?? data[0].id);
    } catch {
      setFormError('Erreur lors de l’enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (node: ProductCategoryNode) => {
    setBusy(node.id, true);
    const result = await toggleProductCategoryAction(node.id, !node.isActive);
    setBusy(node.id, false);
    if (!result.success) {
      flash('error', result.error === 'Unauthorized' ? 'Session expirée, reconnectez-vous.' : result.error || 'Erreur.');
      return;
    }
    flash('success', node.isActive ? `« ${node.name} » est désormais masquée.` : `« ${node.name} » est de nouveau visible.`);
    await fetchData();
  };

  const handleBulkToggleChildren = async (isActive: boolean) => {
    if (!selected) return;
    setBusy(selected.id, true);
    const result = await setProductCategoriesActiveAction(
      selected.children.map((c) => c.id),
      isActive
    );
    setBusy(selected.id, false);
    if (!result.success) {
      flash('error', result.error || 'Erreur.');
      return;
    }
    flash('success', `${result.updated} sous-catégorie(s) ${isActive ? 'affichées' : 'masquées'}.`);
    await fetchData();
  };

  const handleDelete = async (node: ProductCategoryNode) => {
    setToDelete(null);
    setBusy(node.id, true);
    const result = await deleteProductCategoryAction(node.id);
    setBusy(node.id, false);
    if (!result.success) {
      flash('error', result.error === 'Unauthorized' ? 'Session expirée, reconnectez-vous.' : result.error || 'Erreur.');
      return;
    }
    flash('success', `« ${node.name} » a été supprimée.`);
    const data = await fetchData();
    if (selectedId === node.id) setSelectedId(data[0]?.id ?? null);
  };

  const move = async (node: ProductCategoryNode, direction: -1 | 1) => {
    setMenuOpen(false);
    const siblings = node.parentId
      ? tree.find((n) => n.id === node.parentId)?.children ?? []
      : tree;
    const index = siblings.findIndex((n) => n.id === node.id);
    const target = siblings[index + direction];
    if (!target) return;

    const next = [...siblings];
    next[index] = target;
    next[index + direction] = node;

    setBusy(node.id, true);
    const result = await reorderProductCategoriesAction(next.map((n) => n.id));
    setBusy(node.id, false);
    if (!result.success) {
      flash('error', result.error || 'Erreur.');
      return;
    }
    await fetchData();
  };

  const hasFilters = search.trim() !== '' || statusFilter !== 'ALL';
  const busy = processing.size > 0;
  const draftParent = draft?.parentId ? tree.find((n) => n.id === draft.parentId) : undefined;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Catégories</h1>
          <p className="text-sm text-gray-500 mt-1">
            {stats.roots} catégories racines, {stats.children} sous-catégories. Sélectionnez une catégorie à
            gauche pour gérer ses sous-catégories.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#f56b2a] to-orange-600 text-white text-sm font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-md active:scale-95 self-start"
        >
          <Plus size={16} /> Nouvelle catégorie
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Rechercher une catégorie ou une sous-catégorie…  ( / )"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#f56b2a] placeholder:text-gray-400 text-sm font-normal text-gray-900 shadow-sm transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none text-sm font-semibold text-gray-700 cursor-pointer shadow-sm md:w-48"
        >
          <option value="ALL">Toutes</option>
          <option value="ACTIVE">Visibles</option>
          <option value="INACTIVE">Masquées</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('ALL');
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all"
          >
            <X size={15} /> Réinitialiser
          </button>
        )}
        <button
          onClick={() => {
            setLoading(true);
            fetchData();
          }}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-400 hover:text-gray-700 transition-all disabled:opacity-50"
          title="Actualiser"
        >
          <RefreshCcw size={16} className={busy ? 'animate-spin' : ''} />
        </button>
      </div>

      {notice && (
        <div
          className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold shadow-sm ${
            notice.tone === 'success'
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
              : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
          }`}
        >
          {notice.tone === 'success' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
          {notice.text}
        </div>
      )}

      {tree.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-4">
            <Tags size={28} />
          </div>
          <p className="text-gray-900 font-bold text-lg">Aucune catégorie configurée</p>
          <p className="text-sm text-gray-500 mt-1">
            Créez la première catégorie pour qu’elle apparaisse dans les formulaires des vendeurs.
          </p>
          <button
            onClick={openCreate}
            className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#f56b2a] hover:bg-[#d55a20] text-white text-sm font-bold transition-all active:scale-95"
          >
            <Plus size={16} /> Créer une catégorie
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">
          {/* ---------- Panneau gauche : les catégories racines ---------- */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden lg:sticky lg:top-4">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                Catégories racines
              </p>
              <span className="text-[11px] font-bold text-gray-400">
                {stats.active} / {stats.total} visibles
              </span>
            </div>

            <div className="max-h-[62vh] overflow-y-auto custom-scrollbar">
              {groups.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-gray-400">Aucun résultat.</p>
              )}

              {groups.map(({ parent, parentHit, childHits }) => {
                const isSelected = selected?.id === parent.id;
                const total = parent.productCount + parent.children.reduce((acc, c) => acc + c.productCount, 0);
                return (
                  <div key={parent.id}>
                    <button
                      onClick={() => {
                        setSelectedId(parent.id);
                        setInline(null);
                      }}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                        isSelected ? 'bg-orange-50/70' : 'hover:bg-gray-50/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-white' : parent.isActive ? 'bg-gray-50' : 'bg-gray-100'
                          }`}
                        >
                          {parent.isActive ? (
                            <CategoryIcon businessType={parent.businessType} size={15} />
                          ) : (
                            <EyeOff size={14} className="text-gray-400" />
                          )}
                        </span>
                        <span
                          className={`text-sm font-bold truncate flex-1 ${
                            parent.isActive ? (isSelected ? 'text-[#f56b2a]' : 'text-gray-900') : 'text-gray-400'
                          }`}
                        >
                          {parent.name}
                        </span>
                        <span className="text-[11px] font-bold text-gray-400 tabular-nums shrink-0">
                          {parent.children.length}
                        </span>
                        {isSelected && <ChevronRight size={15} className="text-[#f56b2a] shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1 pl-10 text-[11px] text-gray-400">
                        <span className="font-semibold">{countLabel(total)}</span>
                        <span>·</span>
                        <span>{verticalLabel(parent.businessType)}</span>
                      </div>
                    </button>

                    {/* Résultats de recherche dans les sous-catégories */}
                    {search.trim() && childHits.length > 0 && (
                      <div className="bg-gray-50/60 border-b border-gray-50">
                        {childHits.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => {
                              setSelectedId(parent.id);
                              setInline(null);
                            }}
                            className="w-full text-left pl-11 pr-4 py-2 text-xs text-gray-600 hover:bg-white hover:text-[#f56b2a] transition-colors flex items-center gap-2"
                          >
                            <Layers size={12} className="text-gray-300 shrink-0" />
                            <span className="truncate font-semibold">{child.name}</span>
                            <span className="text-[11px] text-gray-400 ml-auto shrink-0 tabular-nums">
                              {child.productCount}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {search.trim() && !parentHit && childHits.length > 0 && (
                      <div className="px-4 py-1.5 bg-gray-50/60 text-[11px] text-gray-400 border-b border-gray-50">
                        correspondance dans les sous-catégories
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---------- Panneau droit : détail de la catégorie sélectionnée ---------- */}
          {selected ? (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              {/* En-tête */}
              <div className="bg-gradient-to-br from-gray-50 to-white px-5 md:px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      selected.isActive ? 'bg-orange-50' : 'bg-gray-100'
                    }`}
                  >
                    {selected.isActive ? (
                      <CategoryIcon businessType={selected.businessType} size={22} />
                    ) : (
                      <EyeOff size={21} className="text-gray-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {inline?.id === selected.id ? (
                      <div className="space-y-2">
                        <input
                          autoFocus
                          value={inline.value}
                          onChange={(e) => setInline({ ...inline, value: e.target.value, confirming: false })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitInline(inline.confirming);
                            }
                            if (e.key === 'Escape') setInline(null);
                          }}
                          className="w-full px-3 py-2 bg-white border-2 border-[#f56b2a] rounded-xl text-base font-bold outline-none"
                        />
                        <InlineImpact
                          edit={inline}
                          onCancel={() => setInline(null)}
                          onConfirm={() => commitInline(true)}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2
                            className={`text-lg font-bold truncate ${
                              selected.isActive ? 'text-gray-900' : 'text-gray-400 line-through'
                            }`}
                          >
                            {selected.name}
                          </h2>
                          <button
                            onClick={() => startInline(selected)}
                            className="p-1 text-gray-300 hover:text-[#f56b2a] transition-colors"
                            title="Renommer (Entrée pour valider)"
                          >
                            <PencilLine size={15} />
                          </button>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              selected.businessType === 'food'
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                : 'bg-orange-50 text-[#f56b2a] ring-1 ring-orange-200'
                            }`}
                          >
                            <CategoryIcon businessType={selected.businessType} size={11} />
                            {verticalLabel(selected.businessType)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 font-mono mt-0.5 truncate">/{selected.slug}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[13px] text-gray-500">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-gray-700">
                            <Package size={14} className="text-[#f56b2a]" />
                            {countLabel(selectedTotalProducts)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Layers size={14} className="text-gray-400" />
                            {selected.children.length} sous-catégorie{selected.children.length > 1 ? 's' : ''}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            {selected.isActive ? (
                              <>
                                <Eye size={14} className="text-emerald-500" /> Visible
                              </>
                            ) : (
                              <>
                                <EyeOff size={14} className="text-gray-400" /> Masquée
                              </>
                            )}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(selected)}
                    disabled={processing.has(selected.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                      selected.isActive
                        ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 hover:bg-emerald-500 hover:text-white'
                        : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    {processing.has(selected.id) ? (
                      <RefreshCcw size={14} className="animate-spin" />
                    ) : selected.isActive ? (
                      <Eye size={14} />
                    ) : (
                      <EyeOff size={14} />
                    )}
                    {selected.isActive ? 'Masquer' : 'Afficher'}
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen((v) => !v)}
                      className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                      aria-label="Autres actions"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-1.5 z-20 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 overflow-hidden">
                          <MenuItem icon={<Pencil size={15} />} onClick={() => openEditDetails(selected)}>
                            Détails (icône, verticale)
                          </MenuItem>
                          <MenuItem
                            icon={<ArrowUp size={15} />}
                            disabled={selectedIndex <= 0}
                            onClick={() => move(selected, -1)}
                          >
                            Monter
                          </MenuItem>
                          <MenuItem
                            icon={<ArrowDown size={15} />}
                            disabled={selectedIndex >= tree.length - 1}
                            onClick={() => move(selected, 1)}
                          >
                            Descendre
                          </MenuItem>
                          <div className="h-px bg-gray-100 my-1" />
                          <MenuItem icon={<Trash2 size={15} />} danger onClick={() => { setMenuOpen(false); setToDelete(selected); }}>
                            Supprimer
                          </MenuItem>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Sous-catégories */}
              <div className="border-t border-gray-100">
                <div className="px-5 md:px-6 py-3 bg-gray-50/50 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Sous-catégories
                  </p>
                  {selected.children.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleBulkToggleChildren(true)}
                        disabled={processing.has(selected.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-gray-500 bg-white ring-1 ring-gray-200 hover:text-emerald-600 hover:ring-emerald-200 transition-all disabled:opacity-50"
                      >
                        <Eye size={12} /> Tout afficher
                      </button>
                      <button
                        onClick={() => handleBulkToggleChildren(false)}
                        disabled={processing.has(selected.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-gray-500 bg-white ring-1 ring-gray-200 hover:text-slate-700 hover:ring-slate-300 transition-all disabled:opacity-50"
                      >
                        <EyeOff size={12} /> Tout masquer
                      </button>
                    </div>
                  )}
                </div>

                {selected.children.length === 0 ? (
                  <p className="px-5 md:px-6 py-8 text-center text-sm text-gray-400">
                    Aucune sous-catégorie. Les vendeurs ne pourront choisir que « {selected.name} ».
                  </p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {selected.children.map((child) => {
                      const childBusy = processing.has(child.id);
                      const childIndex = selected.children.findIndex((c) => c.id === child.id);
                      const editing = inline?.id === child.id;

                      return (
                        <div
                          key={child.id}
                          className={`px-5 md:px-6 py-3 transition-colors ${
                            child.isActive ? 'hover:bg-gray-50/50' : 'bg-gray-50/40'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            {editing ? (
                              <div className="flex-1 min-w-0 space-y-2">
                                <input
                                  autoFocus
                                  value={inline.value}
                                  onChange={(e) => setInline({ ...inline, value: e.target.value, confirming: false })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      commitInline(inline.confirming);
                                    }
                                    if (e.key === 'Escape') setInline(null);
                                  }}
                                  className="w-full px-3 py-2 bg-white border-2 border-[#f56b2a] rounded-xl text-sm font-bold outline-none"
                                />
                                <InlineImpact
                                  edit={inline}
                                  onCancel={() => setInline(null)}
                                  onConfirm={() => commitInline(true)}
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    child.isActive ? 'bg-gray-50' : 'bg-gray-100'
                                  }`}
                                >
                                  {child.isActive ? (
                                    <CategoryIcon businessType={child.businessType} size={15} />
                                  ) : (
                                    <EyeOff size={14} className="text-gray-400" />
                                  )}
                                </div>
                                <button
                                  onClick={() => startInline(child)}
                                  className="group/name flex items-center gap-2 min-w-0 text-left"
                                  title="Renommer"
                                >
                                  <span
                                    className={`text-sm font-bold truncate ${
                                      child.isActive
                                        ? 'text-gray-900 group-hover/name:text-[#f56b2a]'
                                        : 'text-gray-400 line-through'
                                    }`}
                                  >
                                    {child.name}
                                  </span>
                                  <PencilLine
                                    size={13}
                                    className="text-gray-300 opacity-0 group-hover/name:opacity-100 group-focus-within/name:opacity-100 transition-opacity shrink-0"
                                  />
                                </button>
                              </div>
                            )}

                            {!editing && (
                              <div className="flex items-center gap-1.5 pl-11 sm:pl-0 shrink-0">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                    child.productCount > 0
                                      ? 'bg-orange-50 text-[#f56b2a] ring-1 ring-orange-200'
                                      : 'bg-gray-50 text-gray-400 ring-1 ring-gray-200'
                                  }`}
                                >
                                  <Package size={12} />
                                  {formatNumber(child.productCount)}
                                </span>
                                <IconAction
                                  title="Monter"
                                  disabled={childBusy || childIndex === 0}
                                  onClick={() => move(child, -1)}
                                >
                                  <ArrowUp size={14} />
                                </IconAction>
                                <IconAction
                                  title="Descendre"
                                  disabled={childBusy || childIndex === selected.children.length - 1}
                                  onClick={() => move(child, 1)}
                                >
                                  <ArrowDown size={14} />
                                </IconAction>
                                <button
                                  onClick={() => handleToggle(child)}
                                  disabled={childBusy}
                                  className={`p-2 rounded-lg transition-all disabled:opacity-50 ${
                                    child.isActive
                                      ? 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                                      : 'text-emerald-600 bg-emerald-50 hover:text-emerald-700'
                                  }`}
                                  title={child.isActive ? 'Masquer' : 'Afficher'}
                                >
                                  {childBusy ? (
                                    <RefreshCcw size={14} className="animate-spin" />
                                  ) : child.isActive ? (
                                    <Eye size={15} />
                                  ) : (
                                    <EyeOff size={15} />
                                  )}
                                </button>
                                <IconAction title="Supprimer" danger onClick={() => setToDelete(child)}>
                                  <Trash2 size={14} />
                                </IconAction>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Ajout rapide, sans modale */}
                <div className="px-5 md:px-6 py-3 border-t border-gray-100 bg-gray-50/30">
                  {newChild ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={newChild.value}
                        onChange={(e) => setNewChild({ value: e.target.value, saving: false })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            submitNewChild();
                          }
                          if (e.key === 'Escape') setNewChild(null);
                        }}
                        placeholder="Nom de la nouvelle sous-catégorie"
                        className="flex-1 px-3 py-2.5 bg-white border-2 border-[#f56b2a] rounded-xl text-sm font-semibold outline-none"
                      />
                      <button
                        onClick={submitNewChild}
                        disabled={newChild.saving}
                        className="p-2.5 rounded-xl bg-[#f56b2a] text-white hover:bg-[#d55a20] transition-colors disabled:opacity-60"
                        title="Valider (Entrée)"
                      >
                        {newChild.saving ? <Loader2 size={16} className="animate-spin" /> : <CornerDownLeft size={16} />}
                      </button>
                      <button
                        onClick={() => setNewChild(null)}
                        className="p-2.5 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setNewChild({ value: '', saving: false })}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-[#f56b2a] hover:text-[#d55a20] transition-colors"
                    >
                      <Plus size={15} /> Ajouter une sous-catégorie
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
              <div className="w-16 h-16 mx-auto bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-4">
                <Tags size={28} />
              </div>
              <p className="text-gray-900 font-bold text-lg">Sélectionnez une catégorie</p>
              <p className="text-sm text-gray-500 mt-1">Choisissez une catégorie à gauche pour la gérer.</p>
            </div>
          )}
        </div>
      )}

      {/* Modale création / édition */}
      {draft && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                  {draft.parentId ? <Layers size={19} className="text-[#f56b2a]" /> : <Tags size={19} className="text-[#f56b2a]" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                    {draft.id ? 'Détails de la catégorie' : 'Nouvelle catégorie'}
                  </h3>
                  <p className="text-xs text-gray-400 font-semibold mt-0.5 truncate">
                    {draftParent ? `Rattachée à « ${draftParent.name} »` : 'Catégorie racine du catalogue'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDraft(null)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-50 rounded-xl transition-all shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5">
              {draft.id ? (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-500">
                    Nom : <span className="text-gray-900">{draft.name}</span>
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Pour renommer, utilisez le crayon à côté du nom : l’impact sur les produits est évalué avant
                    d’être appliqué.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Nom</label>
                  <input
                    required
                    autoFocus
                    maxLength={80}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-orange-500/20 focus:border-[#f56b2a] focus:bg-white outline-none transition-all"
                    placeholder="Ex. Électronique & High-Tech"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Rattachement</label>
                  <select
                    value={draft.parentId ?? ''}
                    onChange={(e) => setDraft({ ...draft, parentId: e.target.value || null })}
                    disabled={!!draft.id}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-orange-500/20 focus:bg-white outline-none appearance-none cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">Aucune (racine)</option>
                    {tree
                      .filter((n) => n.id !== draft.id)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                  </select>
                  {draft.id && (
                    <p className="text-[11px] text-gray-400 font-normal px-1">
                      Le rattachement se change en déplaçant la catégorie.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Verticale</label>
                  <select
                    value={draft.businessType}
                    onChange={(e) => setDraft({ ...draft, businessType: e.target.value as 'shopping' | 'food' })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-orange-500/20 focus:bg-white outline-none appearance-none cursor-pointer transition-all"
                  >
                    <option value="shopping">Commerce</option>
                    <option value="food">Restauration</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Icône (optionnel)</label>
                <input
                  maxLength={40}
                  value={draft.icon}
                  onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-orange-500/20 focus:border-[#f56b2a] focus:bg-white outline-none transition-all"
                  placeholder="Nom d'icône lucide, ex. Smartphone"
                />
              </div>

              <button
                type="button"
                onClick={() => setDraft({ ...draft, isActive: !draft.isActive })}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-sm font-bold transition-all ${
                  draft.isActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500'
                }`}
              >
                <span className="flex items-center gap-2">
                  {draft.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                  {draft.isActive ? 'Visible dans les formulaires vendeur' : 'Masquée des formulaires vendeur'}
                </span>
                <span className={`w-9 h-5 rounded-full transition-colors ${draft.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              </button>

              {formError && (
                <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm font-semibold text-rose-600">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="flex-1 py-3 border-2 border-gray-100 rounded-xl font-bold text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all active:scale-95"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#f56b2a] to-orange-600 hover:from-orange-600 hover:to-orange-700 transition-all active:scale-95 shadow-md disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale de confirmation */}
      {toDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Supprimer « {toDelete.name} » ?</h3>
            {toDelete.productCount > 0 || toDelete.children.length > 0 ? (
              <p className="text-sm font-semibold text-rose-600 mb-2">
                Suppression impossible :
                {toDelete.productCount > 0 && <> {countLabel(toDelete.productCount)} l&apos;utilisent</>}
                {toDelete.productCount > 0 && toDelete.children.length > 0 && ' et'}
                {toDelete.children.length > 0 && (
                  <> {toDelete.children.length} sous-catégorie(s) lui sont rattachées</>
                )}
                . Réaffectez-les ou masquez-la.
              </p>
            ) : (
              <p className="text-sm text-gray-500 font-normal mb-2">
                Cette catégorie n&apos;est utilisée par aucun produit. Elle sera définitivement retirée du
                catalogue.
              </p>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setToDelete(null)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(toDelete)}
                disabled={toDelete.productCount > 0 || toDelete.children.length > 0}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function InlineImpact({
  edit,
  onConfirm,
  onCancel,
}: {
  edit: InlineEdit;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (edit.impactError) {
    return (
      <p className="flex items-start gap-1.5 text-[11px] font-semibold text-rose-600">
        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
        {edit.impactError}
      </p>
    );
  }

  if (edit.saving) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
        <Loader2 size={12} className="animate-spin" /> Enregistrement…
      </p>
    );
  }

  if (edit.checking) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
        <Loader2 size={12} className="animate-spin" /> Vérification de l&apos;impact…
      </p>
    );
  }

  if (!edit.impact) {
    return (
      <p className="flex items-center justify-between gap-2 text-[11px] font-semibold text-gray-400">
        <span className="inline-flex items-center gap-1">
          <CornerDownLeft size={11} /> Entrée pour valider · Échap pour annuler
        </span>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
          Annuler
        </button>
      </p>
    );
  }

  const { total, asMainCategory, asSubCategory } = edit.impact;
  if (total === 0) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
        <CheckCircle2 size={12} /> Aucun produit n&apos;utilise cette catégorie.
      </p>
    );
  }

  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 space-y-2">
      <p className="flex items-start gap-1.5 text-[11px] font-bold text-amber-800">
        <AlertTriangle size={13} className="shrink-0 mt-px" />
        <span>
          {total} produit{total > 1 ? 's' : ''} seront réaffectés
          {asMainCategory > 0 && asSubCategory > 0
            ? ` (${asMainCategory} comme catégorie principale, ${asSubCategory} comme sous-catégorie)`
            : asMainCategory > 0
              ? ' comme catégorie principale'
              : ' comme sous-catégorie'}
          .
        </span>
      </p>
      {edit.confirming ? (
        <div className="flex items-center gap-2">
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-bold hover:bg-amber-600 transition-colors"
          >
            Renommer et réaffecter
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg bg-white text-amber-700 text-[11px] font-bold ring-1 ring-amber-200 hover:bg-amber-50 transition-colors"
          >
            Annuler
          </button>
        </div>
      ) : (
        <p className="text-[11px] font-semibold text-amber-700">
          Appuyez sur Entrée pour confirmer la réaffectation.
        </p>
      )}
    </div>
  );
}

function IconAction({
  children,
  onClick,
  disabled,
  danger,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded-lg transition-all disabled:opacity-25 ${
        danger
          ? 'text-gray-400 hover:text-rose-500 hover:bg-rose-50'
          : 'text-gray-400 hover:text-[#f56b2a] hover:bg-orange-50'
      }`}
    >
      {children}
    </button>
  );
}

function MenuItem({
  children,
  icon,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? 'text-rose-600 hover:bg-rose-50' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className="text-gray-400">{icon}</span>
      {children}
    </button>
  );
}
