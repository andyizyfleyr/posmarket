'use client';

import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  Image as ImageIcon,
  X,
  Copy,
  Zap,
  Package,
} from 'lucide-react';
import {
  buildVariantMatrix,
  newVariantId,
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

const MAX_OPTIONS = 3;

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

  const stats = useMemo(() => {
    const total = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    const outOfStock = variants.filter((v) => (v.stock || 0) <= 0).length;
    const free = variants.filter((v) => !v.sku).length;
    const prices = variants.map((v) => Number(v.price) || 0);
    return {
      total,
      outOfStock,
      free,
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
      `Prix de toutes les variantes aligné sur ${basePrice} XOF.`
    );
  };

  const setAllStock = (stock: number) => {
    push(
      options,
      variants.map((v) => ({ ...v, stock })),
      stock > 0 ? `Stock positionné à ${stock} sur toutes les variantes.` : 'Stock remis à 0 sur toutes les variantes.'
    );
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

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h4 className="text-[11px] md:text-sm font-bold text-gray-900 leading-tight">Options &amp; variantes</h4>
          <p className="text-[8px] md:text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
            Taille, couleur, format… le stock et le prix se gèrent par combinaison
          </p>
        </div>
        <button
          type="button"
          onClick={addOption}
          disabled={options.length >= MAX_OPTIONS}
          className="self-start inline-flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-xl text-[9px] font-bold hover:bg-[#f56b2a] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={12} strokeWidth={3} /> AJOUTER UNE OPTION
        </button>
      </div>

      {options.length >= MAX_OPTIONS && (
        <p className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          {MAX_OPTIONS} options maximum : au-delà, la fiche devient illisible pour vos clients.
        </p>
      )}

      {options.length === 0 && (
        <p className="text-[11px] font-semibold text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-2xl px-4 py-6 text-center">
          Aucune option : le produit se vend en un seul prix. Ajoutez « Taille » ou « Couleur » pour créer des
          variantes.
        </p>
      )}

      {options.map((option, index) => {
        const suggestions = OPTION_PRESETS[option.name] || [];
        return (
          <div key={option.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex items-start gap-3 mb-3">
              <select
                value={OPTION_PRESETS[option.name] ? option.name : 'custom'}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    updateOption(index, { name: '' });
                  } else {
                    sync(
                      options.map((o, i) => (i === index ? { ...o, name: e.target.value } : o))
                    );
                  }
                }}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:border-[#f56b2a] outline-none shadow-sm"
              >
                <option value="custom">Autre option…</option>
                {Object.keys(OPTION_PRESETS).map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
              {!OPTION_PRESETS[option.name] && (
                <input
                  type="text"
                  autoFocus={!option.name}
                  value={option.name}
                  onChange={(e) => updateOption(index, { name: e.target.value })}
                  placeholder="Nom de l'option (ex. Pointure)"
                  className="flex-1 px-3 py-2 bg-white border border-orange-100 rounded-lg text-xs font-semibold focus:border-[#f56b2a] outline-none shadow-sm"
                />
              )}
              <button
                type="button"
                onClick={() => removeOption(index)}
                className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                title="Supprimer l'option"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {option.values.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {option.values.map((value) => (
                  <span
                    key={value}
                    className="inline-flex items-center gap-1 pl-2 pr-1 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700"
                  >
                    {value}
                    <button
                      type="button"
                      onClick={() => removeValue(option, value)}
                      className="p-0.5 rounded-md text-gray-300 hover:text-rose-500 hover:bg-rose-50"
                      title={`Retirer ${value}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

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
              placeholder="Saisissez une valeur puis Entrée (ex. Rouge)"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:border-[#f56b2a] outline-none shadow-sm"
            />

            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {suggestions.map((suggestion) => {
                  const active = option.values.some((v) => v.toLowerCase() === suggestion.toLowerCase());
                  return (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() =>
                        active ? removeValue(option, suggestion) : updateOption(index, { values: [...option.values, suggestion] })
                      }
                      className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-tighter transition-all border ${
                        active
                          ? 'bg-[#f56b2a] text-white border-[#f56b2a] shadow-sm'
                          : 'bg-white text-gray-400 border-gray-100 hover:border-orange-200 hover:text-orange-500'
                      }`}
                    >
                      {active ? <Check size={10} className="inline" /> : '+ '}
                      {suggestion}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {notice && (
        <p className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl text-[10px] font-bold text-amber-700">
          <AlertTriangle size={12} className="shrink-0" />
          {notice}
        </p>
      )}

      {options.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-gray-500">
              <span className="inline-flex items-center gap-1">
                <Package size={11} className="text-[#f56b2a]" /> {variants.length} variante(s)
              </span>
              <span>{stats.total} en stock</span>
              {stats.outOfStock > 0 && <span className="text-rose-500">{stats.outOfStock} en rupture</span>}
              {variants.length > 0 && stats.min !== stats.max && (
                <span>
                  de {stats.min.toLocaleString('fr-FR')} à {stats.max.toLocaleString('fr-FR')} XOF
                </span>
              )}
              {stats.free > 0 && (
                <span className="text-gray-400">{stats.free} sans référence</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {variants.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={setAllPrices}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-gray-500 bg-white ring-1 ring-gray-200 hover:text-[#f56b2a] hover:ring-orange-200 transition-all"
                  >
                    Prix = {basePrice} XOF
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllStock(0)}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-gray-500 bg-white ring-1 ring-gray-200 hover:text-slate-700 hover:ring-slate-300 transition-all"
                  >
                    Stock = 0
                  </button>
                </>
              )}
            </div>
          </div>

          {variants.length === 0 ? (
            <p className="text-[11px] font-semibold text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-2xl px-4 py-6 text-center">
              Ajoutez au moins une valeur à chaque option : la matrice se construit automatiquement, sans jamais
              écraser vos prix ni vos stocks.
            </p>
          ) : (
            <div className="space-y-2">
              {variants.map((variant, index) => {
                const priceNumber = Number(variant.price) || 0;
                return (
                  <div
                    key={variant.id}
                    className="grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-3 p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-orange-100 transition-colors"
                  >
                    <div className="col-span-2 md:col-span-4 flex items-center gap-2 min-w-0">
                      <div className="flex flex-wrap gap-1 min-w-0">
                        {options.map((option) => (
                          <span
                            key={option.id}
                            className="text-[10px] font-semibold text-gray-900 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100 truncate max-w-[120px]"
                          >
                            {variant.optionValues[option.id]}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-2">
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
                        className={`w-full px-2.5 py-2 bg-gray-50 border border-transparent rounded-lg text-xs font-bold focus:bg-white focus:border-[#f56b2a] outline-none ${
                          priceNumber > 0 ? 'text-[#f56b2a]' : 'text-rose-500'
                        }`}
                        title="Prix de vente de cette variante (XOF)"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={variant.stock}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            updateVariant(variant.id, { stock: 0 });
                            return;
                          }
                          const parsed = Number(raw);
                          if (Number.isFinite(parsed) && parsed >= 0) {
                            updateVariant(variant.id, { stock: Math.round(parsed) });
                          }
                        }}
                        className={`w-full px-2.5 py-2 bg-gray-50 border border-transparent rounded-lg text-xs font-bold focus:bg-white focus:border-[#f56b2a] outline-none ${
                          (variant.stock || 0) > 0 ? 'text-gray-700' : 'text-rose-500'
                        }`}
                        title="Stock disponible"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-3">
                      <input
                        type="text"
                        value={variant.sku || ''}
                        onChange={(e) => updateVariant(variant.id, { sku: e.target.value })}
                        placeholder="Référence (ex. TSH-RGE-M)"
                        className="w-full px-2.5 py-2 bg-gray-50 border border-transparent rounded-lg text-xs font-semibold text-gray-700 focus:bg-white focus:border-[#f56b2a] outline-none placeholder:text-gray-300"
                        title="Référence interne : indispensable pour préparer la commande"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-1 flex items-center justify-end gap-1">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setImagePickerFor(imagePickerFor === variant.id ? null : variant.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            variant.image ? 'text-[#f56b2a] bg-orange-50' : 'text-gray-300 hover:text-[#f56b2a] hover:bg-orange-50'
                          }`}
                          title="Photo de cette variante"
                        >
                          <ImageIcon size={14} />
                        </button>
                        {imagePickerFor === variant.id && images.length > 0 && (
                          <div className="absolute right-0 top-full mt-1 z-30 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 grid grid-cols-3 gap-1.5">
                            {images.map((img) => (
                              <button
                                key={img}
                                type="button"
                                onClick={() => {
                                  updateVariant(variant.id, { image: img });
                                  setImagePickerFor(null);
                                }}
                                className={`aspect-square rounded-lg overflow-hidden border-2 ${
                                  variant.image === img ? 'border-[#f56b2a]' : 'border-transparent hover:border-orange-200'
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
                                setImagePickerFor(null);
                              }}
                              className="aspect-square rounded-lg bg-gray-50 text-[9px] font-bold text-gray-400 hover:text-rose-500"
                            >
                              Aucune
                            </button>
                          </div>
                        )}
                      </div>
                      {index === 0 && variant.sku && variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => copySkuFromIndex(index)}
                          className="p-2 rounded-lg text-gray-300 hover:text-[#f56b2a] hover:bg-orange-50 transition-colors"
                          title="Reprendre cette référence pour la ligne suivante"
                        >
                          <Copy size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const next = variants.filter((v) => v.id !== variant.id);
                          push(options, next, 'Variante retirée de la matrice.');
                        }}
                        className="p-2 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                        title="Retirer cette variante"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {(index === 0 || priceNumber === 0 || (variant.stock || 0) === 0) && (
                      <div className="col-span-2 md:col-span-12 flex flex-wrap items-center gap-3 text-[9px] font-semibold text-gray-400">
                        {index === 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Zap size={10} className="text-[#f56b2a]" /> Matrice regenerated automatiquement : vos prix,
                            stocks et références sont conservés.
                          </span>
                        )}
                        {priceNumber === 0 && <span className="text-rose-500">Prix à 0 : invisible en boutique.</span>}
                        {(variant.stock || 0) === 0 && <span className="text-rose-500">Stock 0 : vendu comme épuisé.</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
