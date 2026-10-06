'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  Image as ImageIcon,
  X,
  Copy,
  Package,
  ChevronDown,
  Layers,
  Tag,
  BarChart3,
  Eye,
  EyeOff,
  Upload,
  Download,
} from 'lucide-react';
import {
  buildVariantMatrix,
  newVariantId,
  resolveVariantLimits,
  variantCombinationKey,
  type ProductOptionDef,
  type ProductVariantDef,
} from '@/utils/variants';

const OPTION_PRESETS: Record<string, string[]> = {
  Taille: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Taille Unique', 'Enfant', 'Adulte'],
  Couleur: [
    'Noir', 'Blanc', 'Rouge', 'Bleu', 'Marine', 'Vert', 'Kaki', 'Jaune',
    'Orange', 'Rose', 'Violet', 'Gris', 'Beige', 'Marron', 'Bordeaux', 'Or', 'Argent',
  ],
  Pointure: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  Format: ['Petit', 'Moyen', 'Grand', 'Standard', 'Pack', 'Unité', 'Douzaine', '100ml', '250ml', '500ml', '1L'],
  Modèle: ['Standard', 'Pro', 'Max', 'Mini', 'Lite', 'Slim', 'Luxe', 'Sport', 'Classic', 'Premium'],
  Saveur: ['Vanille', 'Chocolat', 'Fraise', 'Citron', 'Caramel', 'Banane', 'Pistache', 'Menthe', 'Pimenté', 'Nature'],
  Matière: ['Coton', 'Cuir', 'Bois', 'Acier', 'Aluminium', 'Plastique', 'Verre', 'Céramique', 'Laine', 'Nylon'],
  Poids: ['50g', '100g', '200g', '250g', '500g', '1kg', '2kg', '5kg', '10kg', '25kg'],
};

// Palette de couleurs pour distinguer visuellement les variantes
const VARIANT_COLORS = [
  'bg-orange-500', 'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
  'bg-rose-500', 'bg-amber-500', 'bg-teal-500', 'bg-indigo-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-lime-500', 'bg-red-500',
];

// Bornes par défaut de la matrice (surchargeables par boutique via la prop
// `limits` si un jour on expose les réglages) : voir resolveVariantLimits.
const { maxOptions: MAX_OPTIONS } = resolveVariantLimits();

type Props = {
  options: ProductOptionDef[];
  variants: ProductVariantDef[];
  basePrice: number;
  images: string[];
  onChange: (
    options: ProductOptionDef[],
    variants: ProductVariantDef[],
    notice: string | null
  ) => void;
};

export default function VariantMatrixEditor({
  options,
  variants,
  basePrice,
  images,
  onChange,
}: Props) {
  const [notice, setNotice] = useState<string | null>(null);
  const [imagePickerFor, setImagePickerFor] = useState<string | null>(null);
  const [valueDraft, setValueDraft] = useState<Record<string, string>>({});
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});
  const [bulkConfirm, setBulkConfirm] = useState<null | 'price' | 'stock'>(null);
  const [imageUrlDraft, setImageUrlDraft] = useState<string>('');
  const csvFileRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const total = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    const outOfStock = variants.filter((v) => (v.stock || 0) <= 0).length;
    const withStock = variants.filter((v) => (v.stock || 0) > 0).length;
    const lowStock = variants.filter((v) => (v.stock || 0) > 0 && (v.stock || 0) <= 3).length;
    const prices = variants.map((v) => Number(v.price) || 0).filter((p) => p > 0);
    return {
      total,
      outOfStock,
      withStock,
      lowStock,
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    };
  }, [variants]);

  const push = (nextOptions: ProductOptionDef[], nextVariants?: ProductVariantDef[], message: string | null = null) => {
    setNotice(message);
    onChange(nextOptions, nextVariants ?? variants, message);
  };

  const sync = (nextOptions: ProductOptionDef[], customMessage: string | null = null) => {
    const { variants: rebuilt, dropped } = buildVariantMatrix(nextOptions, variants, basePrice);
    const message =
      customMessage ??
      (dropped.length > 0
        ? `${dropped.length} variante(s) retirée(s) car leurs options n'existent plus.`
        : null);
    setNotice(message);
    onChange(nextOptions, rebuilt, message);
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    const next = [...options, { id: newVariantId(), name: '', values: [] }];
    const { variants: rebuilt, dropped } = buildVariantMatrix(next, variants, basePrice);
    const message = dropped.length > 0 ? `${dropped.length} variante(s) retirée(s) car leurs options n'existent plus.` : null;
    setNotice(message);
    onChange(next, rebuilt, message);
  };

  const updateOption = (index: number, patch: Partial<ProductOptionDef>) => {
    sync(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  };

  const removeOption = (index: number) => {
    sync(
      options.filter((_, i) => i !== index),
      'Option supprimée : les variantes correspondantes ont été retirées.'
    );
  };

  const addValue = (option: ProductOptionDef, raw: string) => {
    const value = raw.trim().replace(/,$/, '').trim();
    setValueDraft((prev) => ({ ...prev, [option.id]: '' }));
    if (!value) return;
    if (option.values.some((v) => v.toLowerCase() === value.toLowerCase())) return;
    updateOption(options.indexOf(option), { values: [...option.values, value] });
  };

  const removeValue = (option: ProductOptionDef, value: string) => {
    updateOption(options.indexOf(option), { values: option.values.filter((v) => v !== value) });
  };

  const updateVariant = (id: string, patch: Partial<ProductVariantDef>) => {
    push(options, variants.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };

  const setAllPrices = () => {
    push(
      options,
      variants.map((v) => ({ ...v, price: basePrice })),
      `Prix de toutes les variantes aligné sur ${basePrice.toLocaleString('fr-FR')} XOF.`
    );
    setBulkConfirm(null);
  };

  const setAllStock = (stock: number) => {
    push(
      options,
      variants.map((v) => ({ ...v, stock })),
      stock > 0 ? `Stock positionné à ${stock} sur toutes les variantes.` : 'Stock remis à 0 sur toutes les variantes.'
    );
    setBulkConfirm(null);
  };

  const copySkuFromIndex = (index: number) => {
    const source = variants[index];
    if (!source) return;
    let suffix = 1;
    const base = source.sku?.trim() || '';
    if (!base) return;
    const used = new Set(variants.map((v) => v.sku));
    let candidate = `${base}-${suffix}`;
    while (used.has(candidate)) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    updateVariant(variants[index + 1]?.id || source.id, { sku: candidate });
  };

  // ── CSV : export / import de la matrice des variantes (C5) ────────
  const csvCell = (value: unknown): string => {
    const text = value == null ? '' : String(value);
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const exportVariantsCsv = () => {
    if (variants.length === 0) return;
    const header = [
      ...options.map((o) => o.name || 'Option'),
      'Nom', 'Prix', 'Stock', 'SKU', 'Image', 'Activee',
    ];
    const rows = variants.map((v) => [
      ...options.map((o) => v.optionValues[o.id] || ''),
      v.name || '',
      v.price ?? '',
      v.stock ?? '',
      v.sku || '',
      v.image || '',
      v.enabled === false ? '0' : '1',
    ]);
    const csv = [header, ...rows].map((line) => line.map(csvCell).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `variantes-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importVariantsCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '')
          .replace(/^\ufeff/, '')
          .trim();
        if (!text) return;
        const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
        if (lines.length < 2) return;
        const parseLine = (line: string): string[] => {
          const cells: string[] = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i += 1) {
            const ch = line[i];
            if (ch === '"') {
              if (inQuotes && line[i + 1] === '"') { cur += '"'; i += 1; }
              else inQuotes = !inQuotes;
            } else if (ch === ';' && !inQuotes) {
              cells.push(cur);
              cur = '';
            } else {
              cur += ch;
            }
          }
          cells.push(cur);
          return cells.map((c) => c.trim());
        };

        const existingByKey = new Map(
          variants.map((v) => [variantCombinationKey(v.optionValues), v]),
        );
        const merged: ProductVariantDef[] = [...variants];
        const mergedKeys = new Set(variants.map((v) => variantCombinationKey(v.optionValues)));

        for (const line of lines.slice(1)) {
          const cells = parseLine(line);
          if (cells.length < options.length + 2) continue;
          const optionValues: Record<string, string> = {};
          options.forEach((o, i) => {
            const val = cells[i]?.replace(/"/g, '');
            if (val) optionValues[o.id] = val;
          });
          const nbOpts = options.length;
          const name = cells[nbOpts]?.replace(/"/g, '') || '';
          const price = Math.max(0, Number(String(cells[nbOpts + 1]).replace(',', '.')) || 0);
          const stock = Math.max(0, Math.round(Number(cells[nbOpts + 2]) || 0));
          const sku = cells[nbOpts + 3]?.replace(/"/g, '') || '';
          const image = cells[nbOpts + 4]?.replace(/"/g, '') || '';
          const enabled = String(cells[nbOpts + 5] ?? '1') !== '0';

          const key = variantCombinationKey(optionValues);
          if (!key || Object.keys(optionValues).length !== options.length) continue;
          const previous = existingByKey.get(key);
          const variant: ProductVariantDef = {
            id: previous?.id || newVariantId(),
            name: name || previous?.name || '',
            nameCustom: !!(name && name !== (previous?.name || '')),
            optionValues,
            price,
            stock,
            enabled,
            ...(sku ? { sku } : {}),
            ...(image ? { image } : {}),
            ...(previous?.image && !image ? { image: previous.image } : {}),
          };
          if (mergedKeys.has(key)) {
            const idx = merged.findIndex((v) => variantCombinationKey(v.optionValues) === key);
            if (idx >= 0) merged[idx] = variant;
          } else {
            merged.push(variant);
            mergedKeys.add(key);
          }
        }
        setNotice('Importation CSV : variantes fusionnées avec la matrice existante.');
        onChange(options, merged, null);
      } catch {
        setNotice("Importation impossible : le format du fichier est invalide.");
      } finally {
        if (csvFileRef.current) csvFileRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">

      {/* ── EN-TÊTE DE SECTION ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <Layers size={17} className="text-brand" />
          </div>
          <div>
            <h4 className="text-sm font-black text-gray-900 leading-tight">Options &amp; Variantes</h4>
            <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
              Taille, couleur… prix et stock par combinaison
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={addOption}
          disabled={options.length >= MAX_OPTIONS}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-brand to-[#e0571a] text-white rounded-xl text-xs font-bold shadow-md shadow-orange-200/60 hover:shadow-orange-300/70 hover:from-[#e0571a] hover:to-[#c94a0d] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <Plus size={14} strokeWidth={3} /> Ajouter une option
        </button>
      </div>

      {/* Compteur d'options */}
      {options.length > 0 && (
        <div className="flex items-center gap-2">
          {Array.from({ length: MAX_OPTIONS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i < options.length ? 'bg-brand flex-1' : 'bg-gray-100 flex-1'
              }`}
            />
          ))}
          <span className="text-[10px] font-bold text-gray-400 shrink-0 ml-1">
            {options.length}/{MAX_OPTIONS}
          </span>
        </div>
      )}

      {/* Alerte max options */}
      {options.length >= MAX_OPTIONS && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <p className="text-xs font-semibold text-amber-700">
            Maximum {MAX_OPTIONS} options — au-delà, la fiche devient illisible pour vos clients.
          </p>
        </div>
      )}

      {/* État vide */}
      {options.length === 0 && (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl px-6 py-10 text-center bg-gray-50/50">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Package size={22} className="text-gray-300" />
          </div>
          <p className="text-sm font-bold text-gray-500 mb-1">Aucune variante</p>
          <p className="text-xs text-gray-400">
            Ce produit se vend en un seul prix. Ajoutez <strong>Taille</strong> ou <strong>Couleur</strong> pour créer des variantes.
          </p>
        </div>
      )}

      {/* ── CARTES D'OPTIONS ──────────────────────────────────────── */}
      {options.map((option, index) => {
        const suggestions = OPTION_PRESETS[option.name] || [];
        const isPreset = Boolean(OPTION_PRESETS[option.name]);

        return (
          <div
            key={option.id}
            className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm overflow-hidden transition-shadow hover:shadow-md"
          >
            {/* Header de l'option */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0">
                  {index + 1}
                </span>
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Option {index + 1}
                  {option.name && ` — ${option.name}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeOption(index)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors text-[10px] font-bold"
                title="Supprimer l'option"
              >
                <Trash2 size={12} /> Supprimer
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Sélecteur de type */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  Type d&apos;option
                </label>
                <div className="relative">
                  <select
                    value={isPreset ? option.name : 'custom'}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        updateOption(index, { name: '' });
                      } else {
                        sync(
                          options.map((o, i) => (i === index ? { ...o, name: e.target.value } : o))
                        );
                      }
                    }}
                    className="w-full appearance-none pl-4 pr-10 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm font-semibold text-gray-800 focus:border-brand focus:bg-white outline-none transition-all cursor-pointer"
                  >
                    <option value="custom">Nom personnalisé…</option>
                    {Object.keys(OPTION_PRESETS).map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Nom personnalisé */}
              {!isPreset && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                    Nom de l&apos;option
                  </label>
                  <input
                    type="text"
                    autoFocus={!option.name}
                    value={option.name}
                    onChange={(e) => updateOption(index, { name: e.target.value })}
                    placeholder="Ex : Pointure, Matière, Parfum…"
                    className="w-full px-4 py-3 bg-white border-2 border-orange-100 rounded-xl text-sm font-semibold focus:border-brand outline-none transition-all placeholder:text-gray-300"
                  />
                </div>
              )}

              {/* Zone de valeurs */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Valeurs ajoutées
                  {option.values.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-brand rounded-md text-[9px]">
                      {option.values.length}
                    </span>
                  )}
                </label>

                {/* Chips des valeurs existantes */}
                <div className="min-h-[44px] p-2 bg-gray-50 border-2 border-gray-100 rounded-xl flex flex-wrap gap-2 mb-3 transition-colors focus-within:border-brand">
                  {option.values.map((value) => (
                    <span
                      key={value}
                      className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800 shadow-sm"
                    >
                      {value}
                      <button
                        type="button"
                        onClick={() => removeValue(option, value)}
                        className="w-4 h-4 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-rose-500 transition-colors"
                        title={`Retirer ${value}`}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={valueDraft[option.id] ?? ''}
                    onChange={(e) => setValueDraft((prev) => ({ ...prev, [option.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addValue(option, valueDraft[option.id] ?? '');
                      }
                      if (e.key === 'Backspace' && !(valueDraft[option.id] ?? '') && option.values.length > 0) {
                        removeValue(option, option.values[option.values.length - 1]);
                      }
                    }}
                    placeholder={option.values.length === 0 ? 'Saisir une valeur puis Entrée…' : '+ Ajouter…'}
                    className="flex-1 min-w-[140px] bg-transparent text-sm font-semibold outline-none placeholder:text-gray-300 py-0.5"
                  />
                </div>

                {/* Suggestions de presets */}
                {suggestions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                      Suggestions rapides
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((suggestion) => {
                        const active = option.values.some((v) => v.toLowerCase() === suggestion.toLowerCase());
                        return (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() =>
                              active
                                ? removeValue(option, suggestion)
                                : updateOption(index, { values: [...option.values, suggestion] })
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                              active
                                ? 'bg-brand text-white border-brand shadow-sm shadow-orange-200'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300 hover:text-brand hover:bg-orange-50'
                            }`}
                          >
                            {active ? <Check size={11} /> : <Plus size={11} />}
                            {suggestion}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* ── NOTICE DE CHANGEMENT ─────────────────────────────────── */}
      {notice && (
        <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-amber-700">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-auto text-amber-400 hover:text-amber-600"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── MATRICE DE VARIANTES ─────────────────────────────────── */}
      {options.length > 0 && (
        <div className="space-y-4">

          {/* Stats en pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-xl text-xs font-bold text-gray-600">
              <Package size={13} className="text-brand" />
              {variants.length} variante{variants.length > 1 ? 's' : ''}
            </div>
            {stats.total > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-700">
                <BarChart3 size={13} />
                {stats.total} en stock
              </div>
            )}
            {stats.outOfStock > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold text-rose-600">
                <AlertTriangle size={12} />
                {stats.outOfStock} en rupture
              </div>
            )}
            {variants.length > 0 && stats.min > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-xl text-xs font-bold text-brand">
                <Tag size={12} />
                {stats.min === stats.max
                  ? `${stats.min.toLocaleString('fr-FR')} XOF`
                  : `${stats.min.toLocaleString('fr-FR')} – ${stats.max.toLocaleString('fr-FR')} XOF`}
              </div>
            )}
          </div>

          {/* Bulk Actions */}
          {variants.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Actions groupées :</span>
              <input
                ref={csvFileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importVariantsCsv(file);
                }}
              />
              <button
                type="button"
                onClick={() => csvFileRef.current?.click()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-600 bg-white ring-1 ring-gray-200 hover:text-brand hover:ring-orange-300 transition-all"
                title="Importer une matrice depuis un CSV"
              >
                <Upload size={11} /> Importer
              </button>
              <button
                type="button"
                onClick={exportVariantsCsv}
                disabled={variants.length === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-600 bg-white ring-1 ring-gray-200 hover:text-brand hover:ring-orange-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                title="Exporter la matrice en CSV"
              >
                <Download size={11} /> Exporter
              </button>
              {bulkConfirm === 'price' ? (
                <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
                  <span className="text-xs font-semibold text-gray-600">
                    Aligner tous les prix sur {basePrice.toLocaleString('fr-FR')} XOF ?
                  </span>
                  <button type="button" onClick={setAllPrices}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-brand text-white">
                    Confirmer
                  </button>
                  <button type="button" onClick={() => setBulkConfirm(null)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-200 text-gray-600">
                    Annuler
                  </button>
                </div>
              ) : bulkConfirm === 'stock' ? (
                <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
                  <span className="text-xs font-semibold text-gray-600">
                    Remettre tout le stock à 0 ?
                  </span>
                  <button type="button" onClick={() => setAllStock(0)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500 text-white">
                    Confirmer
                  </button>
                  <button type="button" onClick={() => setBulkConfirm(null)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-200 text-gray-600">
                    Annuler
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setBulkConfirm('price')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-600 bg-white ring-1 ring-gray-200 hover:text-brand hover:ring-orange-300 transition-all"
                  >
                    <Tag size={11} /> Prix → {basePrice.toLocaleString('fr-FR')} XOF
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkConfirm('stock')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-600 bg-white ring-1 ring-gray-200 hover:text-rose-500 hover:ring-rose-200 transition-all"
                  >
                    <Package size={11} /> Stock → 0
                  </button>
                </>
              )}
            </div>
          )}

          {/* Tableau des variantes */}
          {variants.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl px-6 py-8 text-center bg-gray-50/50">
              <p className="text-sm font-bold text-gray-400 mb-1">La matrice est vide</p>
              <p className="text-xs text-gray-400">
                Ajoutez au moins une valeur à chaque option pour générer les variantes automatiquement.
                <br />
                <span className="text-[10px] text-emerald-600 font-semibold">
                  ✓ Vos prix, stocks et références sont toujours préservés.
                </span>
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-gray-100 overflow-hidden shadow-sm">
              {/* Header de colonnes */}
              <div className="grid grid-cols-[1fr_120px_72px_1fr_48px] gap-0 bg-gray-50 border-b-2 border-gray-100 px-3 py-2.5">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Variante</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Prix XOF</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Stock</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Référence SKU</div>
                <div className="text-sm font-semibold text-gray-500 text-center">Photo</div>
              </div>

              {/* Lignes */}
              <div className="divide-y divide-gray-100">
                {variants.map((variant, index) => {
                  const priceNumber = Number(variant.price) || 0;
                  const stock = variant.stock || 0;
                  const colorClass = VARIANT_COLORS[index % VARIANT_COLORS.length];
                  const stockStatus = stock === 0 ? 'empty' : stock <= 3 ? 'low' : 'ok';

                  return (
                    <div
                      key={variant.id}
                      className={`grid grid-cols-[1fr_120px_72px_1fr_48px] gap-0 items-center px-3 py-2.5 transition-colors hover:bg-orange-50/30 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} ${variant.enabled === false ? 'opacity-45' : ''}`}
                    >
                      {/* Nom de la variante — éditable (C1) */}
                      <div className="flex items-center gap-2.5 min-w-0 pl-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${colorClass} shrink-0 ${variant.enabled === false ? 'bg-gray-300' : ''}`} />
                        <div className="min-w-0">
                          <input
                            type="text"
                            value={variant.name ?? options.map((o) => variant.optionValues[o.id]).filter(Boolean).join(' / ')}
                            onChange={(e) =>
                              updateVariant(variant.id, { name: e.target.value, nameCustom: true })
                            }
                            placeholder={options.map((o) => variant.optionValues[o.id]).filter(Boolean).join(' / ') || 'Nom de la variante'}
                            className="w-full text-sm font-bold text-gray-800 truncate leading-tight bg-transparent border-b border-dashed border-transparent focus:border-brand focus:outline-none transition-colors"
                            title="Nom d'affichage (modifiable)"
                          />
                          <p className="flex items-center gap-1 mt-0.5">
                            {variant.enabled === false && (
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Masquée</span>
                            )}
                            {priceNumber === 0 && (
                              <span className="text-[9px] font-bold text-rose-500 leading-tight">Prix manquant</span>
                            )}
                            {stock === 0 && priceNumber > 0 && variant.enabled !== false && (
                              <span className="text-[9px] font-bold text-amber-500 leading-tight">Épuisé</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Prix */}
                      <div className="px-1">
                        <div className="relative">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            value={priceDraft[variant.id] ?? String(variant.price ?? '')}
                            onChange={(e) => setPriceDraft((prev) => ({ ...prev, [variant.id]: e.target.value }))}
                            onBlur={(e) => {
                              const raw = e.target.value.trim();
                              setPriceDraft((prev) => {
                                const next = { ...prev };
                                delete next[variant.id];
                                return next;
                              });
                              const parsed = Number(raw === '' ? 0 : raw.replace(',', '.'));
                              updateVariant(variant.id, {
                                price: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
                              });
                            }}
                            className={`w-full px-2.5 py-2 bg-white border-2 rounded-xl text-xs font-bold text-right outline-none transition-all focus:ring-2 focus:ring-orange-100 ${
                              priceNumber > 0
                                ? 'border-gray-200 text-brand focus:border-brand'
                                : 'border-rose-200 text-rose-500 focus:border-rose-400'
                            }`}
                            title="Prix de vente (XOF)"
                          />
                        </div>
                      </div>

                      {/* Stock */}
                      <div className="px-1">
                        <div className="relative">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={variant.stock}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === '') { updateVariant(variant.id, { stock: 0 }); return; }
                              const parsed = Number(raw);
                              if (Number.isFinite(parsed) && parsed >= 0) {
                                updateVariant(variant.id, { stock: Math.round(parsed) });
                              }
                            }}
                            className={`w-full px-2 py-2 border-2 rounded-xl text-xs font-bold text-center outline-none transition-all focus:ring-2 ${
                              stockStatus === 'empty'
                                ? 'bg-rose-50 border-rose-200 text-rose-500 focus:ring-rose-100 focus:border-rose-400'
                                : stockStatus === 'low'
                                  ? 'bg-amber-50 border-amber-200 text-amber-600 focus:ring-amber-100 focus:border-amber-400'
                                  : 'bg-white border-gray-200 text-gray-800 focus:ring-orange-100 focus:border-brand'
                            }`}
                            title="Stock disponible"
                          />
                        </div>
                      </div>

                      {/* SKU */}
                      <div className="px-1 flex items-center gap-1">
                        <input
                          type="text"
                          value={variant.sku || ''}
                          onChange={(e) => updateVariant(variant.id, { sku: e.target.value })}
                          placeholder={`ex: ${options.map((o) => (variant.optionValues[o.id] || '').slice(0, 3).toUpperCase()).join('-')}`}
                          className="w-full px-2.5 py-2 bg-white border-2 border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:border-brand outline-none transition-all focus:ring-2 focus:ring-orange-100 placeholder:text-gray-300"
                          title="Référence interne SKU"
                        />
                        {/* Bouton copier SKU */}
                        {index === 0 && variant.sku && variants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => copySkuFromIndex(index)}
                            className="p-2 rounded-lg text-gray-300 hover:text-brand hover:bg-orange-50 transition-colors shrink-0"
                            title="Copier cette référence pour la ligne suivante"
                          >
                            <Copy size={12} />
                          </button>
                        )}
                        {/* Bouton masquer / réactiver (C4) */}
                        <button
                          type="button"
                          onClick={() =>
                            updateVariant(variant.id, { enabled: variant.enabled === false ? true : false })
                          }
                          className={`p-2 rounded-lg transition-colors shrink-0 ${
                            variant.enabled === false
                              ? 'text-emerald-500 hover:bg-emerald-50'
                              : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                          title={variant.enabled === false ? 'Réactiver cette variante' : 'Masquer cette variante (non vendable)'}
                        >
                          {variant.enabled === false ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        {/* Bouton supprimer variante */}
                        <button
                          type="button"
                          onClick={() => {
                            const next = variants.filter((v) => v.id !== variant.id);
                            push(options, next, 'Variante retirée de la matrice.');
                          }}
                          className="p-2 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                          title="Retirer cette variante"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Photo */}
                      <div className="flex justify-center">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setImagePickerFor(imagePickerFor === variant.id ? null : variant.id)}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                              variant.image
                                ? 'ring-2 ring-brand ring-offset-1'
                                : 'text-gray-300 hover:text-brand hover:bg-orange-50 border-2 border-dashed border-gray-200'
                            }`}
                            title="Photo de cette variante"
                          >
                            {variant.image ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={variant.image} alt="" className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              <ImageIcon size={14} />
                            )}
                          </button>

                          {/* Picker de photo — indépendant de la galerie : URL libre + raccourcis */}
                          {imagePickerFor === variant.id && (
                            <div className="absolute right-0 top-full mt-2 z-30 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 p-3">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                Photo de la variante
                              </p>
                              <input
                                type="url"
                                value={imageUrlDraft}
                                onChange={(e) => setImageUrlDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const url = imageUrlDraft.trim();
                                    if (url) {
                                      updateVariant(variant.id, { image: url });
                                      setImageUrlDraft('');
                                      setImagePickerFor(null);
                                    }
                                  }
                                }}
                                placeholder="Collez une URL d'image…"
                                className="w-full px-2.5 py-2 mb-2 bg-gray-50 border-2 border-gray-100 rounded-lg text-[11px] font-semibold focus:border-brand focus:bg-white outline-none transition-all placeholder:text-gray-300"
                              />
                              {images.length > 0 ? (
                                <div className="grid grid-cols-3 gap-1.5">
                                  {images.map((img) => (
                                    <button
                                      key={img}
                                      type="button"
                                      onClick={() => {
                                        updateVariant(variant.id, { image: img });
                                        setImageUrlDraft('');
                                        setImagePickerFor(null);
                                      }}
                                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                        variant.image === img
                                          ? 'border-brand shadow-md'
                                          : 'border-transparent hover:border-orange-200'
                                      }`}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={img} alt="" className="w-full h-full object-cover" />
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateVariant(variant.id, { image: '' });
                                      setImageUrlDraft('');
                                      setImagePickerFor(null);
                                    }}
                                    className="aspect-square rounded-lg bg-gray-50 border-2 border-dashed border-gray-200 text-[9px] font-bold text-gray-400 hover:text-rose-500 hover:border-rose-200 transition-colors flex items-center justify-center"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <p className="text-[9px] font-semibold text-gray-400">
                                  Astuce : ajoutez aussi la photo à la galerie du produit pour qu&apos;elle apparaisse sur la fiche.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
