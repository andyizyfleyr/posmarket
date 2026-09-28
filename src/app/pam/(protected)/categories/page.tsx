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
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  FolderTree,
  UtensilsCrossed,
  ShoppingBag,
  Eye,
  EyeOff,
  Layers,
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

type FlatRow = {
  node: ProductCategoryNode;
  depth: number;
};

const verticalLabel = (value: string) => (value === 'food' ? 'Restauration' : 'Commerce');

function flatten(tree: ProductCategoryNode[], search: string): FlatRow[] {
  const term = search.trim().toLowerCase();
  const matches = (n: ProductCategoryNode) =>
    !term ||
    n.name.toLowerCase().includes(term) ||
    (n.slug || '').toLowerCase().includes(term);

  const rows: FlatRow[] = [];
  for (const node of tree) {
    const selfHit = matches(node);
    // En recherche, un parent reste visible si un de ses enfants correspond.
    const hitChildren = node.children.some(matches);
    if (selfHit || hitChildren || !term) {
      rows.push({ node, depth: 0 });
      for (const child of node.children) {
        if (!term || selfHit || matches(child)) rows.push({ node: child, depth: 1 });
      }
    }
  }
  return rows;
}

export default function AdminCategoriesPage() {
  const [tree, setTree] = useState<ProductCategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [toDelete, setToDelete] = useState<ProductCategoryNode | null>(null);

  const flash = useCallback((tone: 'success' | 'error', text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 4000);
  }, []);

  const fetchData = useCallback(async () => {
    const data = await getAdminProductCategories();
    setTree(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rows = useMemo(() => flatten(tree, search), [tree, search]);
  const roots = useMemo(() => tree.map((n) => n.id), [tree]);

  const totals = useMemo(() => {
    let all = 0;
    let inactive = 0;
    const walk = (list: ProductCategoryNode[]) => {
      for (const n of list) {
        all += 1;
        if (!n.isActive) inactive += 1;
        walk(n.children);
      }
    };
    walk(tree);
    return { all, inactive, parents: tree.length, children: all - tree.length };
  }, [tree]);

  const withBusy = async (id: string, run: () => Promise<void>) => {
    setProcessing((prev) => new Set(prev).add(id));
    try {
      await run();
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

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
        setFormError(result.error === 'Unauthorized' ? 'Session expirée, reconnectez-vous.' : result.error || 'Erreur inattendue.');
        return;
      }
      setDraft(null);
      flash('success', draft.id ? 'Catégorie mise à jour.' : 'Catégorie créée.');
      await fetchData();
    } catch {
      setFormError('Erreur lors de l’enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (node: ProductCategoryNode) => {
    return withBusy(node.id, async () => {
      const result = await toggleProductCategoryAction(node.id, !node.isActive);
      if (!result.success) {
        flash('error', result.error === 'Unauthorized' ? 'Session expirée, reconnectez-vous.' : result.error || 'Erreur.');
        return;
      }
      flash('success', node.isActive ? 'Catégorie désactivée.' : 'Catégorie activée.');
      await fetchData();
    });
  };

  const handleDelete = (node: ProductCategoryNode) => {
    setToDelete(null);
    return withBusy(node.id, async () => {
      const result = await deleteProductCategoryAction(node.id);
      if (!result.success) {
        flash('error', result.error === 'Unauthorized' ? 'Session expirée, reconnectez-vous.' : result.error || 'Erreur.');
        return;
      }
      flash('success', `Catégorie « ${node.name} » supprimée.`);
      await fetchData();
    });
  };

  const move = (node: ProductCategoryNode, direction: -1 | 1) => {
    return withBusy(node.id, async () => {
      const siblings = node.parentId
        ? tree.find((n) => n.id === node.parentId)?.children ?? []
        : tree;
      const index = siblings.findIndex((n) => n.id === node.id);
      const target = siblings[index + direction];
      if (!target) return;

      const next = [...siblings];
      next[index] = target;
      next[index + direction] = node;

      const result = await reorderProductCategoriesAction(next.map((n) => n.id));
      if (!result.success) {
        flash('error', result.error || 'Erreur.');
        return;
      }
      await fetchData();
    });
  };

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const parentOptions = tree.filter((n) => (draft?.id ? n.id !== draft.id : true));
  const parent = draft?.parentId ? parentOptions.find((n) => n.id === draft.parentId) : undefined;
  const busyCount = processing.size;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 uppercase tracking-tighter">Catégories Produit</h1>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mt-1">
            Taxonomie globale du catalogue · {totals.parents} catégories · {totals.children} sous-catégories
            {totals.inactive > 0 ? ` · ${totals.inactive} désactivée(s)` : ''}
          </p>
        </div>
        <button
          onClick={() => openCreate(null)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#f56b2a] hover:bg-[#d55a20] text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-orange-100"
        >
          <Plus size={16} /> Nouvelle catégorie
        </button>
      </div>

      {notice && (
        <div
          className={`px-4 py-3 rounded-2xl text-xs font-bold border flex items-center gap-2 ${
            notice.tone === 'success'
              ? 'bg-green-50 text-green-700 border-green-100'
              : 'bg-red-50 text-red-600 border-red-100'
          }`}
        >
          {notice.tone === 'success' ? <Tags size={14} /> : <AlertTriangle size={14} />}
          {notice.text}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Chercher une catégorie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 placeholder:text-gray-300 text-sm font-semibold text-gray-900 shadow-sm"
          />
        </div>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          disabled={busyCount > 0}
          className="px-4 py-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-gray-700 transition-all disabled:opacity-50"
          title="Rafraîchir"
        >
          <RefreshCcw size={16} className={busyCount > 0 ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-400 border-b border-gray-100">
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest">Catégorie</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest">Verticale</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-center">Produits</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-center">État</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-right">Ordre</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(({ node, depth }) => {
                const isParent = node.children.length > 0;
                const isCollapsed = collapsed.has(node.id);
                const siblings = node.parentId
                  ? tree.find((n) => n.id === node.parentId)?.children ?? []
                  : tree;
                const index = siblings.findIndex((n) => n.id === node.id);
                const busy = processing.has(node.id);

                return (
                  <tr
                    key={node.id}
                    className={`hover:bg-orange-50/20 group transition-colors ${node.isActive ? '' : 'opacity-55'} ${depth === 1 ? 'bg-gray-50/40' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-2 ${depth === 1 ? 'pl-8' : ''}`}>
                        {depth === 0 ? (
                          isParent ? (
                            <button
                              onClick={() => toggleCollapse(node.id)}
                              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-[#f56b2a] transition-colors shrink-0"
                              aria-label={isCollapsed ? 'Déplier' : 'Replier'}
                            >
                              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                          ) : (
                            <span className="w-6 h-6 flex items-center justify-center shrink-0">
                              <FolderTree size={14} className="text-gray-300" />
                            </span>
                          )
                        ) : (
                          <span className="w-6 h-6 flex items-center justify-center shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                          </span>
                        )}

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate max-w-[260px] flex items-center gap-1.5">
                            {depth === 1 && <Layers size={11} className="text-gray-300 shrink-0" />}
                            {node.name}
                          </p>
                          <p className="text-[9px] font-semibold text-gray-400 truncate max-w-[260px]">/{node.slug}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase border ${
                          node.businessType === 'food'
                            ? 'bg-green-50 text-green-600 border-green-100'
                            : 'bg-orange-50 text-[#f56b2a] border-orange-100'
                        }`}
                      >
                        {node.businessType === 'food' ? <UtensilsCrossed size={10} /> : <ShoppingBag size={10} />}
                        {verticalLabel(node.businessType)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase border ${
                          node.productCount > 0
                            ? 'bg-gray-50 text-gray-500 border-gray-100'
                            : 'bg-amber-50 text-amber-600 border-amber-100'
                        }`}
                      >
                        {node.productCount}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggle(node)}
                        disabled={busy}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase border transition-all disabled:opacity-50 ${
                          node.isActive
                            ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                        }`}
                        title={node.isActive ? 'Désactiver' : 'Activer'}
                      >
                        {busy ? <RefreshCcw size={10} className="animate-spin" /> : node.isActive ? <Eye size={10} /> : <EyeOff size={10} />}
                        {node.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => move(node, -1)}
                          disabled={busy || index <= 0}
                          className="p-1.5 text-gray-300 hover:text-[#f56b2a] transition-colors disabled:opacity-25 disabled:hover:text-gray-300"
                          title="Monter"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <span className="text-[10px] font-bold text-gray-300 w-5 text-center">{index + 1}</span>
                        <button
                          onClick={() => move(node, 1)}
                          disabled={busy || index >= siblings.length - 1}
                          className="p-1.5 text-gray-300 hover:text-[#f56b2a] transition-colors disabled:opacity-25 disabled:hover:text-gray-300"
                          title="Descendre"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => (isParent ? openCreate(node.id) : openEdit(node))}
                          disabled={busy}
                          className="p-2.5 bg-white text-slate-300 border border-gray-100 rounded-xl hover:text-[#f56b2a] hover:border-orange-200 transition-all disabled:opacity-50"
                          title={isParent ? 'Ajouter une sous-catégorie' : 'Modifier'}
                        >
                          {isParent ? <Plus size={16} /> : <Pencil size={16} />}
                        </button>
                        <button
                          onClick={() => setToDelete(node)}
                          disabled={busy}
                          className="p-2.5 bg-white text-slate-300 border border-gray-100 rounded-xl hover:text-red-500 hover:border-red-200 transition-all disabled:opacity-50"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <Tags size={32} className="mx-auto text-gray-200 mb-3" />
                    <p className="text-sm font-bold text-gray-500">
                      {search ? 'Aucune catégorie ne correspond à cette recherche.' : 'Aucune catégorie configurée.'}
                    </p>
                    {!search && (
                      <button
                        onClick={() => openCreate(null)}
                        className="mt-4 px-4 py-2.5 rounded-xl bg-[#f56b2a] hover:bg-[#d55a20] text-white text-xs font-bold transition-all"
                      >
                        <Plus size={14} className="inline mr-1" /> Créer la première catégorie
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider leading-relaxed">
        {roots.length} catégories racines. Le nom est la clef de rattachement des produits : le renommer
        réaffecte automatiquement les produits concernés. Une catégorie utilisée par au moins un produit ne peut
        pas être supprimée — désactivez-la pour la retirer des formulaires vendeur.
      </p>

      {draft && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                  {draft.id ? 'Modifier la catégorie' : draft.parentId ? 'Nouvelle sous-catégorie' : 'Nouvelle catégorie'}
                </h3>
                <p className="text-[11px] text-gray-400 font-semibold mt-0.5">
                  {parent ? `Rattachée à « ${parent.name} »` : 'Catégorie racine du catalogue'}
                </p>
              </div>
              <button
                onClick={() => setDraft(null)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-50 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Nom</label>
                <input
                  required
                  maxLength={80}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-[#f56b2a]/10 focus:bg-white outline-none transition-all shadow-inner"
                  placeholder="Ex. Électronique & High-Tech"
                />
                <p className="text-[10px] text-gray-400 font-semibold px-1">
                  L&apos;identifiant d&apos;URL est généré automatiquement à partir du nom.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Rattachement</label>
                  <select
                    value={draft.parentId ?? ''}
                    onChange={(e) => setDraft({ ...draft, parentId: e.target.value || null })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-[#f56b2a]/10 focus:bg-white outline-none appearance-none cursor-pointer transition-all shadow-inner"
                  >
                    <option value="">Aucune (catégorie racine)</option>
                    {parentOptions.map((n) => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Verticale</label>
                  <select
                    value={draft.businessType}
                    onChange={(e) => setDraft({ ...draft, businessType: e.target.value as 'shopping' | 'food' })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-[#f56b2a]/10 focus:bg-white outline-none appearance-none cursor-pointer transition-all shadow-inner"
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
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-[#f56b2a]/10 focus:bg-white outline-none transition-all shadow-inner"
                  placeholder="Nom d'icône lucide, ex. Smartphone"
                />
              </div>

              <button
                type="button"
                onClick={() => setDraft({ ...draft, isActive: !draft.isActive })}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-sm font-bold transition-all ${
                  draft.isActive ? 'bg-green-50 border-green-200 text-green-600' : 'bg-gray-50 border-gray-100 text-gray-400'
                }`}
              >
                <span className="flex items-center gap-2">
                  {draft.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                  {draft.isActive ? 'Visible dans les formulaires vendeur' : 'Masquée des formulaires vendeur'}
                </span>
                <span className={`w-9 h-5 rounded-full transition-colors ${draft.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
              </button>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="flex-1 py-3.5 border-2 border-gray-100 rounded-2xl font-bold text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all active:scale-95"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white bg-[#f56b2a] hover:bg-[#d55a20] transition-all active:scale-95 shadow-lg shadow-orange-100 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Tags size={16} />}
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toDelete && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Supprimer cette catégorie ?</h3>
            <p className="text-sm text-gray-500 font-normal text-center mb-6">
              « {toDelete.name} » sera définitivement retirée du catalogue.
              {toDelete.productCount > 0 && (
                <span className="block mt-2 text-red-500 font-semibold">
                  {toDelete.productCount} produit(s) utilisent cette catégorie : réaffectez-les d&apos;abord.
                </span>
              )}
              {toDelete.children.length > 0 && (
                <span className="block mt-2 text-red-500 font-semibold">
                  Supprimez d&apos;abord ses {toDelete.children.length} sous-catégorie(s).
                </span>
              )}
            </p>
            <div className="flex gap-3">
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
