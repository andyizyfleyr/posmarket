'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Home,
  Store,
  Tag,
  TrendingUp,
  Sparkles,
  LayoutList,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  AlertTriangle,
  LayoutGrid,
} from 'lucide-react';
import {
  getHomepageLayoutAction,
  updateHomepageLayoutAction,
  getHomepageCategoryOptionsAction,
  type HomepageCategoryOption,
} from '@/app/actions/homepage';
import type { HomepageLayoutPayload } from '@/app/actions/homepage';
import Loader from '@/components/Loader';

const BLOCK_DEFS: {
  key: keyof Omit<HomepageLayoutPayload, 'categoryOrder' | 'categoryHidden'>;
  title: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'hero',
    title: 'Carrousel d’affiches',
    description: 'Les visuels pleine largeur en haut de l’accueil',
    icon: <ImageIcon size={22} />,
  },
  {
    key: 'partners',
    title: 'Boutiques partenaires',
    description: 'Rail horizontal des boutiques mises en avant',
    icon: <Store size={22} />,
  },
  {
    key: 'bestSellers',
    title: 'Meilleures ventes',
    description: 'Section éditoriale basée sur les volumes de commande',
    icon: <TrendingUp size={22} />,
  },
  {
    key: 'promotions',
    title: 'Promotions',
    description: 'Section éditoriale des produits en promotion',
    icon: <Tag size={22} />,
  },
  {
    key: 'newArrivals',
    title: 'Nouveautés',
    description: 'Section éditoriale des derniers produits publiés',
    icon: <Sparkles size={22} />,
  },
  {
    key: 'categoriesEnabled',
    title: 'Sections par catégorie',
    description: 'Une section par couple verticale / catégorie, sous les éditoriales',
    icon: <LayoutList size={22} />,
  },
];

export default function AdminHomepagePage() {
  const [layout, setLayout] = useState<HomepageLayoutPayload | null>(null);
  const [initial, setInitial] = useState<HomepageLayoutPayload | null>(null);
  const [options, setOptions] = useState<HomepageCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [layoutRes, optionsRes] = await Promise.all([
        getHomepageLayoutAction(),
        getHomepageCategoryOptionsAction(),
      ]);
      if (!mounted) return;
      const base: HomepageLayoutPayload = {
        hero: true,
        partners: true,
        bestSellers: true,
        promotions: true,
        newArrivals: true,
        categoriesEnabled: true,
        categoryOrder: [],
        categoryHidden: [],
        ...(layoutRes.success ? layoutRes.layout : {}),
      };
      setLayout(base);
      setInitial(base);
      setOptions(optionsRes.categories ?? []);
      if (!optionsRes.success) setOptionsError(optionsRes.error ?? 'Catégories indisponibles.');
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Liste affichée = ordre enregistré (s'il existe encore au catalogue ou en
   * masqués), puis catégories du catalogue pas encore ordonnées.
   */
  const orderedNames = useMemo(() => {
    if (!layout) return [];
    const optionNames = new Set(options.map((o) => o.name));
    const hiddenExtra = layout.categoryHidden.filter((n) => !optionNames.has(n));
    const known = new Set<string>();
    const out: string[] = [];
    for (const name of layout.categoryOrder) {
      if (known.has(name)) continue;
      if (optionNames.has(name) || layout.categoryHidden.includes(name) || hiddenExtra.includes(name)) {
        known.add(name);
        out.push(name);
      }
    }
    for (const opt of options) {
      if (!known.has(opt.name)) {
        known.add(opt.name);
        out.push(opt.name);
      }
    }
    // Masquées encore absentes (renommage côté catalogue) : affichées tout en bas.
    for (const name of hiddenExtra) {
      if (!known.has(name)) {
        known.add(name);
        out.push(name);
      }
    }
    return out;
  }, [layout, options]);

  const optionCount = useMemo(() => {
    const map = new Map(options.map((o) => [o.name, o.productCount]));
    return (name: string) => map.get(name) ?? 0;
  }, [options]);

  const dirty = useMemo(
    () => layout && initial && JSON.stringify(layout) !== JSON.stringify(initial),
    [layout, initial],
  );

  const hiddenSet = useMemo(
    () => new Set(layout?.categoryHidden ?? []),
    [layout?.categoryHidden],
  );

  const toggleBlock = useCallback((key: keyof HomepageLayoutPayload) => {
    setLayout((prev) => (prev ? { ...prev, [key]: !prev[key] } : prev));
    setFeedback(null);
  }, []);

  const toggleCategoryHidden = useCallback((name: string) => {
    setLayout((prev) => {
      if (!prev) return prev;
      const hidden = new Set(prev.categoryHidden);
      if (hidden.has(name)) hidden.delete(name);
      else hidden.add(name);
      return { ...prev, categoryHidden: Array.from(hidden) };
    });
    setFeedback(null);
  }, []);

  const moveCategory = useCallback((name: string, delta: -1 | 1) => {
    setLayout((prev) => {
      if (!prev) return prev;
      const list = orderedNames.includes(name)
        ? [...orderedNames]
        : [...prev.categoryOrder, ...orderedNames.filter((n) => !prev.categoryOrder.includes(n))];
      const from = list.indexOf(name);
      const to = from + delta;
      if (from === -1 || to < 0 || to >= list.length) return prev;
      [list[from], list[to]] = [list[to], list[from]];
      return { ...prev, categoryOrder: list };
    });
    setFeedback(null);
  }, [orderedNames]);

  const showAllCategories = useCallback(() => {
    setLayout((prev) => (prev ? { ...prev, categoryHidden: [] } : prev));
    setFeedback(null);
  }, []);

  const hideAllCategories = useCallback(() => {
    setLayout((prev) =>
      prev ? { ...prev, categoryHidden: [...orderedNames] } : prev,
    );
    setFeedback(null);
  }, [orderedNames]);

  const handleSave = async () => {
    if (!layout) return;
    setSaving(true);
    setFeedback(null);
    const res = await updateHomepageLayoutAction(layout);
    setSaving(false);
    if (res.success) {
      setInitial(layout);
      setFeedback({ ok: true, message: 'Accueil mis à jour. La page sera visible sous une minute.' });
    } else {
      setFeedback({ ok: false, message: res.error || 'Enregistrement impossible.' });
    }
  };

  const handleReset = () => {
    if (!initial) return;
    setLayout(JSON.parse(JSON.stringify(initial)) as HomepageLayoutPayload);
    setFeedback(null);
  };

  if (loading || !layout) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader size="lg" />
      </div>
    );
  }

  const hiddenCount = layout.categoryHidden.length;
  const visibleCount = orderedNames.length - hiddenSet.size;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 uppercase tracking-tighter">Accueil</h1>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mt-1">
            Blocs, collections et catégories affichés sur la page d’accueil
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!dirty || saving}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-5 py-2.5 rounded-xl bg-brand text-white text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-orange-500/20 hover:bg-[#e04e0f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {saving ? <Loader size="sm" /> : <Save size={14} />}
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold ${
            feedback.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {feedback.message}
        </div>
      )}

      {/* ── Blocs de l'accueil ── */}
      <div className="bg-white rounded-[32px] border border-gray-100 p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-6 mb-6">
          <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-brand shadow-inner border border-orange-100">
            <LayoutGrid size={26} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Blocs de l’accueil</h2>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mt-0.5">
              Activer / désactiver chaque bloc
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {BLOCK_DEFS.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-4 p-4 md:p-5 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-orange-50/20 transition-all"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-500">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 uppercase tracking-tight">
                    {item.title}
                  </p>
                  <p className="text-[10px] text-gray-400 font-normal mt-0.5">
                    {item.description}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(layout[item.key])}
                aria-label={`${layout[item.key] ? 'Masquer' : 'Afficher'} ${item.title}`}
                onClick={() => toggleBlock(item.key)}
                className={`w-12 h-7 rounded-full relative p-1 transition-all flex-shrink-0 ${
                  layout[item.key] ? 'bg-brand shadow-lg shadow-orange-100' : 'bg-gray-200'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${
                    layout[item.key] ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Catégories de l'accueil ── */}
      <div className="bg-white rounded-[32px] border border-gray-100 p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-6 mb-2">
          <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600 shadow-inner border border-violet-100">
            <Home size={26} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Sections catégories</h2>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mt-0.5">
              Ordre et visibilité · {visibleCount} affichée{visibleCount > 1 ? 's' : ''}
              {hiddenCount > 0 ? ` · ${hiddenCount} masquée${hiddenCount > 1 ? 's' : ''}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <p className="text-[11px] text-gray-500 max-w-md">
            Uniquement les catégories présentes dans le catalogue en ligne. Les flèches fixent l’ordre des sections sur l’accueil.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={showAllCategories}
              className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-brand border border-brand/30 hover:bg-orange-50 transition-colors"
            >
              Tout afficher
            </button>
            <button
              type="button"
              onClick={hideAllCategories}
              className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Tout masquer
            </button>
          </div>
        </div>

        {optionsError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
            <AlertTriangle size={14} /> {optionsError}
          </div>
        )}

        {orderedNames.length === 0 ? (
          <p className="text-xs text-gray-400 py-8 text-center">
            Aucune catégorie détectée dans le catalogue en ligne.
          </p>
        ) : (
          <ol className="divide-y divide-gray-100 rounded-2xl border border-gray-100 overflow-hidden">
            {orderedNames.map((name, index) => {
              const hidden = hiddenSet.has(name);
              const count = optionCount(name);
              return (
                <li
                  key={name}
                  className={`flex items-center gap-3 px-3 md:px-4 py-3 transition-colors ${
                    hidden ? 'bg-gray-50/60' : 'bg-white'
                  }`}
                >
                  <span className="w-6 text-[10px] font-bold text-gray-400 tabular-nums text-center flex-shrink-0">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleCategoryHidden(name)}
                    aria-pressed={!hidden}
                    className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center border transition-all ${
                      hidden
                        ? 'border-gray-200 bg-gray-100 text-gray-400 hover:text-gray-600'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}
                    aria-label={hidden ? `Afficher ${name}` : `Masquer ${name}`}
                    title={hidden ? 'Affichée sur l’accueil (cliquer pour masquer)' : 'Masquée de l’accueil (cliquer pour afficher)'}
                  >
                    {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${hidden ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {name}
                    </p>
                    <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-widest">
                      {count} produit{count > 1 ? 's' : ''} en ligne
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveCategory(name, -1)}
                      disabled={index === 0}
                      aria-label="Monter"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCategory(name, 1)}
                      disabled={index === orderedNames.length - 1}
                      aria-label="Descendre"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
