'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Ban,
  CheckCircle2,
} from 'lucide-react';
import {
  getAdminProductCategories,
  createProductCategoryAction,
  updateProductCategoryAction,
  deleteProductCategoryAction,
  toggleProductCategoryAction,
  reorderProductCategoriesAction,
} from '@/app/actions/categories';
import type { ProductCategoryNode } from '@/app/actions/categories';
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

function CategoryIcon({
  businessType,
  size = 20,
}: {
  businessType: string;
  size?: number;
}) {
  return businessType === 'food' ? (
    <UtensilsCrossed size={size} className="text-emerald-600" />
  ) : (
    <ShoppingBag size={size} className="text-[#f56b2a]" />
  );
}

function verticalLabel(value: string) {
  return value === 'food' ? 'Restauration' : 'Commerce';
}

export default function AdminCategoriesPage() {
  const [tree, setTree] = useState<ProductCategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [toDelete, setToDelete] = useState<ProductCategoryNode | null>(null);

  const flash = useCallback((tone: 'success' | 'error', text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const fetchData = useCallback(async () => {
    const data = await getAdminProductCategories();
    setTree(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tree
      .map((node) => {
        const children = term
          ? node.children.filter(
              (c) => c.name.toLowerCase().includes(term) || (c.slug || '').toLowerCase().includes(term)
            )
          : node.children;
        const selfHit = !term || node.name.toLowerCase().includes(term) || (node.slug || '').toLowerCase().includes(term);
        return { node, children, selfHit };
      })
      .filter(({ node, children, selfHit }) => {
        if (!selfHit && children.length === 0) return false;
        if (statusFilter === 'ACTIVE') return node.isActive;
        if (statusFilter === 'INACTIVE') return !node.isActive;
        return true;
      });
  }, [tree, search, statusFilter]);

  const openCreate = (parentId: string | null) => {
    setFormError(null);
    setDraft({ ...EMPTY_DRAFT, parentId });
  };

  const openEdit = (node: ProductCategoryNode) => {
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
      const payload = {
        name: draft.name,
        icon: draft.icon,
        parentId: draft.parentId,
        businessType: draft.businessType,
        isActive: draft.isActive,
      };
      const result = draft.id
        ? await updateProductCategoryAction(draft.id, payload)
        : await createProductCategoryAction(payload);

      if (!result.success) {
        setFormError(
          result.error === 'Unauthorized'
            ? 'Session expirée, reconnectez-vous.'
            : result.error || 'Erreur inattendue.'
        );
        return;
      }
      setDraft(null);
      flash('success', draft.id ? `« ${draft.name} » a été mise à jour.` : `« ${draft.name} » a été créée.`);
      await fetchData();
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
    await fetchData();
  };

  const move = async (node: ProductCategoryNode, direction: -1 | 1) => {
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

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const parent = draft?.parentId ? tree.find((n) => n.id === draft.parentId) : undefined;
  const hasFilters = search.trim() !== '' || statusFilter !== 'ALL';
  const busy = processing.size > 0;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Catégories</h1>
          <p className="text-sm text-gray-500 mt-1">
            {stats.roots} catégorie{stats.roots > 1 ? 's' : ''} racine{stats.roots > 1 ? 's' : ''} ·{' '}
            {stats.children} sous-catégorie{stats.children > 1 ? 's' : ''} proposées aux vendeurs. Le nom
            d&apos;une catégorie est la clef de rattachement des produits.
          </p>
        </div>
        <button
          onClick={() => openCreate(null)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#f56b2a] to-orange-600 text-white text-sm font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-md active:scale-95 self-start"
        >
          <Plus size={16} /> Nouvelle catégorie
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {[
          { key: 'ALL' as StatusFilter, label: 'Toutes', value: stats.total, icon: <Tags size={18} />, color: 'text-gray-700 bg-gray-100' },
          { key: 'ACTIVE' as StatusFilter, label: 'Visibles', value: stats.active, icon: <Eye size={18} />, color: 'text-emerald-600 bg-emerald-50' },
          { key: 'INACTIVE' as StatusFilter, label: 'Masquées', value: stats.inactive, icon: <Ban size={18} />, color: 'text-slate-600 bg-slate-100' },
        ].map((s) => {
          const active = statusFilter === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${
                active ? 'ring-2 ring-[#f56b2a]/30' : ''
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color} mb-3`}>{s.icon}</div>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(s.value)}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">{s.label}</p>
            </button>
          );
        })}
      </div>

      {/* Barre de filtres */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher une catégorie ou un identifiant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#f56b2a] placeholder:text-gray-400 text-sm font-normal text-gray-900 shadow-sm transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none text-sm font-semibold text-gray-700 cursor-pointer shadow-sm md:w-52"
        >
          <option value="ALL">Toutes les catégories</option>
          <option value="ACTIVE">Visibles uniquement</option>
          <option value="INACTIVE">Masquées uniquement</option>
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
        >
          <RefreshCcw size={16} className={busy ? 'animate-spin' : ''} />
          <span className="md:hidden xl:inline">Actualiser</span>
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

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-4">
            <Tags size={28} />
          </div>
          <p className="text-gray-900 font-bold text-lg">
            {hasFilters ? 'Aucune catégorie trouvée' : 'Aucune catégorie configurée'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {hasFilters
              ? 'Essayez de modifier votre recherche ou vos filtres.'
              : 'Créez la première catégorie pour qu’elle apparaisse dans les formulaires des vendeurs.'}
          </p>
          {!hasFilters && (
            <button
              onClick={() => openCreate(null)}
              className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#f56b2a] hover:bg-[#d55a20] text-white text-sm font-bold transition-all active:scale-95"
            >
              <Plus size={16} /> Créer une catégorie
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(({ node, children }) => {
            const isOpen = expanded.has(node.id);
            const totalProducts = node.productCount + node.children.reduce((acc, c) => acc + c.productCount, 0);
            const nodeBusy = processing.has(node.id);
            // Index dans l'arbre complet : le réordonnancement ignore le filtre.
            const treeIndex = tree.findIndex((n) => n.id === node.id);

            return (
              <div
                key={node.id}
                className={`bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden ${
                  node.isActive ? '' : 'bg-gray-50/60'
                }`}
              >
                {/* En-tête catégorie */}
                <div className="bg-gradient-to-br from-gray-50 to-white px-5 md:px-6 py-5 flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        node.isActive ? 'bg-orange-50' : 'bg-gray-100'
                      }`}
                    >
                      {node.isActive ? (
                        <CategoryIcon businessType={node.businessType} />
                      ) : (
                        <EyeOff size={20} className="text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`text-base font-bold truncate ${node.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                          {node.name}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            node.businessType === 'food'
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                              : 'bg-orange-50 text-[#f56b2a] ring-1 ring-orange-200'
                          }`}
                        >
                          <CategoryIcon businessType={node.businessType} size={11} />
                          {verticalLabel(node.businessType)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 font-mono mt-0.5 truncate">/{node.slug}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm font-semibold text-gray-700 ring-1 ring-gray-200">
                      <Layers size={14} className="text-gray-400" />
                      {node.children.length} sous-catégorie{node.children.length > 1 ? 's' : ''}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm font-semibold text-gray-700 ring-1 ring-gray-200">
                      <Package size={14} className="text-[#f56b2a]" />
                      {formatNumber(totalProducts)} produit{totalProducts > 1 ? 's' : ''}
                    </span>

                    {/* Réordonnancement */}
                    <div className="flex items-center rounded-xl ring-1 ring-gray-200 bg-white overflow-hidden">
                      <button
                        onClick={() => move(node, -1)}
                        disabled={nodeBusy || treeIndex <= 0}
                        className="p-2 text-gray-400 hover:text-[#f56b2a] hover:bg-orange-50 transition-colors disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                        title="Monter"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        onClick={() => move(node, 1)}
                        disabled={nodeBusy || treeIndex >= tree.length - 1}
                        className="p-2 text-gray-400 hover:text-[#f56b2a] hover:bg-orange-50 transition-colors border-l border-gray-100 disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                        title="Descendre"
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>

                    <button
                      onClick={() => handleToggle(node)}
                      disabled={nodeBusy}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                        node.isActive
                          ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 hover:bg-emerald-500 hover:text-white'
                          : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100 hover:text-slate-700'
                      }`}
                    >
                      {nodeBusy ? (
                        <RefreshCcw size={14} className="animate-spin" />
                      ) : node.isActive ? (
                        <Eye size={14} />
                      ) : (
                        <EyeOff size={14} />
                      )}
                      {node.isActive ? 'Masquer' : 'Afficher'}
                    </button>

                    <button
                      onClick={() => openEdit(node)}
                      className="p-2 text-gray-400 hover:text-[#f56b2a] transition-colors"
                      title="Modifier"
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      onClick={() => setToDelete(node)}
                      className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={17} />
                    </button>
                    <button
                      onClick={() => toggleExpand(node.id)}
                      className="p-2 text-gray-400 hover:text-[#f56b2a] transition-colors"
                      aria-label={isOpen ? 'Réduire' : 'Déplier'}
                    >
                      <ChevronRight size={20} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Sous-catégories */}
                {isOpen && (
                  <div className="divide-y divide-gray-100 border-t border-gray-100">
                    {children.map((child) => {
                      const childBusy = processing.has(child.id);
                      const childIndex = node.children.findIndex((c) => c.id === child.id);
                      return (
                        <div
                          key={child.id}
                          className={`px-5 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors ${
                            child.isActive ? 'hover:bg-gray-50/50' : 'bg-gray-50/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="pl-3 border-l-2 border-gray-100 shrink-0">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                  child.isActive ? 'bg-gray-50' : 'bg-gray-100'
                                }`}
                              >
                                {child.isActive ? (
                                  <CategoryIcon businessType={child.businessType} size={17} />
                                ) : (
                                  <EyeOff size={16} className="text-gray-400" />
                                )}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p
                                className={`text-sm font-bold truncate ${
                                  child.isActive ? 'text-gray-900' : 'text-gray-400 line-through'
                                }`}
                              >
                                {child.name}
                              </p>
                              <p className="text-xs text-gray-400 font-mono truncate">/{child.slug}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 sm:gap-3 pl-12 sm:pl-0">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                                child.productCount > 0
                                  ? 'bg-orange-50 text-[#f56b2a] ring-1 ring-orange-200'
                                  : 'bg-gray-50 text-gray-400 ring-1 ring-gray-200'
                              }`}
                            >
                              <Package size={13} />
                              {formatNumber(child.productCount)}
                            </span>

                            <div className="flex items-center rounded-xl ring-1 ring-gray-200 bg-white overflow-hidden">
                              <button
                                onClick={() => move(child, -1)}
                                disabled={childBusy || childIndex === 0}
                                className="p-2 text-gray-400 hover:text-[#f56b2a] hover:bg-orange-50 transition-colors disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                                title="Monter"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                onClick={() => move(child, 1)}
                                disabled={childBusy || childIndex === node.children.length - 1}
                                className="p-2 text-gray-400 hover:text-[#f56b2a] hover:bg-orange-50 transition-colors border-l border-gray-100 disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                                title="Descendre"
                              >
                                <ArrowDown size={14} />
                              </button>
                            </div>

                            <button
                              onClick={() => handleToggle(child)}
                              disabled={childBusy}
                              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                                child.isActive
                                  ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 hover:bg-emerald-500 hover:text-white'
                                  : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100 hover:text-slate-700'
                              }`}
                            >
                              {childBusy ? (
                                <RefreshCcw size={13} className="animate-spin" />
                              ) : child.isActive ? (
                                <Eye size={13} />
                              ) : (
                                <EyeOff size={13} />
                              )}
                              {child.isActive ? 'Masquer' : 'Afficher'}
                            </button>

                            <button
                              onClick={() => openEdit(child)}
                              className="p-2 text-gray-400 hover:text-[#f56b2a] transition-colors"
                              title="Modifier"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => setToDelete(child)}
                              className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <div className="px-5 md:px-6 py-3 bg-gray-50/40">
                      <button
                        onClick={() => openCreate(node.id)}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#f56b2a] hover:text-[#d55a20] transition-colors"
                      >
                        <Plus size={15} /> Ajouter une sous-catégorie à {node.name}
                      </button>
                    </div>
                  </div>
                )}

                {!isOpen && node.children.length > 0 && !search.trim() && (
                  <div className="px-5 md:px-6 py-3 border-t border-gray-100 bg-gray-50/40 text-sm text-gray-400 font-normal">
                    {node.children.length} sous-catégorie{node.children.length > 1 ? 's' : ''} — cliquer pour
                    afficher le détail
                  </div>
                )}
              </div>
            );
          })}

          {hasFilters && (
            <p className="text-sm text-gray-400 text-center pt-2">
              {filtered.length} catégorie{filtered.length > 1 ? 's' : ''} sur {stats.roots} — affinez votre
              recherche pour en voir plus.
            </p>
          )}
        </div>
      )}

      <p className="text-[13px] text-gray-400 font-normal leading-relaxed max-w-3xl">
        Renommer une catégorie réaffecte automatiquement les produits qui la portent. Une catégorie utilisée par au
        moins un produit ne peut pas être supprimée : masquez-la pour la retirer des formulaires vendeur, ou
        réaffectez ses produits d&apos;abord.
      </p>

      {/* Modale création / édition */}
      {draft && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                  {draft.parentId ? <Layers size={19} className="text-[#f56b2a]" /> : <Tags size={19} className="text-[#f56b2a]" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                    {draft.id ? 'Modifier la catégorie' : draft.parentId ? 'Nouvelle sous-catégorie' : 'Nouvelle catégorie'}
                  </h3>
                  <p className="text-xs text-gray-400 font-semibold mt-0.5 truncate">
                    {parent ? `Rattachée à « ${parent.name} »` : 'Catégorie racine du catalogue'}
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
                <p className="text-[11px] text-gray-400 font-normal px-1">
                  L&apos;identifiant d&apos;URL est généré automatiquement.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Rattachement</label>
                  <select
                    value={draft.parentId ?? ''}
                    onChange={(e) => setDraft({ ...draft, parentId: e.target.value || null })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-orange-500/20 focus:bg-white outline-none appearance-none cursor-pointer transition-all"
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
                  draft.isActive
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500'
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
            <p className="text-sm text-gray-500 font-normal mb-2">
              Cette catégorie sera définitivement retirée du catalogue. Cette action est irréversible.
            </p>
            {toDelete.productCount > 0 && (
              <p className="text-sm font-semibold text-rose-600 mb-2">
                {formatNumber(toDelete.productCount)} produit(s) l&apos;utilisent : réaffectez-les d&apos;abord.
              </p>
            )}
            {toDelete.children.length > 0 && (
              <p className="text-sm font-semibold text-rose-600 mb-2">
                Elle contient {toDelete.children.length} sous-catégorie(s) : supprimez-les d&apos;abord.
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
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-all"
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
