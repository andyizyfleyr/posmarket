'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, Layers, Tag } from 'lucide-react';
import { amountCls, Field, inputCls, selectCls } from './fieldStyles';
import type { ProductFormData } from './types';
import { MAX_VARIANT_OPTIONS, newVariantId } from '@/utils/variants';

/**
 * Étape 2 — Nom, catégorie, prix, stock.
 *
 * Deux correctifs de fond par rapport à la version précédente :
 *
 * 1. `parseInt` sur le prix et le stock. « 12 500 » passait, « 12.5 » devenait
 *    12 — et un prix de gros saisi à la virgule était tronqué sans avertissement.
 *    On passe par `parseAmount`, qui accepte les deux notations.
 *
 * 2. Le piège prix/stock. `saveProductAction` écrase `products.stock` par la
 *    somme des stocks de variantes dès que le produit a des options, et le
 *    prix unitaire ne sert plus à rien. Le vendeur remplissait donc ces deux
 *    champs, créait ses options à l'étape 3, et ses valeurs disparaissaient
 *    sans message. D'où la question posée en premier : « ce produit existe-t-il
 *    en plusieurs versions ? ». Répondre « oui » crée une option et bascule les
 *    libellés, qui expliquent alors que le prix est un simple modèle.
 */

const UNIT_PRESETS = [
  { group: 'Standard', values: ['pièce', 'unité', 'douzaine', 'paquet', 'carton', 'boîte', 'sac', 'bouteille', 'lot'] },
  { group: 'Poids & Mesures', values: ['kg', 'g', 'L', 'ml', 'cl', 'm', 'cm', 'm²'] },
  { group: 'Services', values: ['nuitée', 'heure', 'jour', 'service', 'ticket'] },
];

const ALL_UNITS = UNIT_PRESETS.flatMap((g) => g.values);

const DELIVERY_PRESETS = [
  { group: 'Restauration / Immédiat', values: ['15 min', '30 min', '45 min', '1h'] },
  { group: 'Livraison Courte', values: ['24h', '48h', '72h'] },
  { group: 'Livraison Longue', values: ['3-5 jours', '1 semaine', '2 semaines', 'Sur commande'] },
];

const ALL_DELIVERIES = DELIVERY_PRESETS.flatMap((g) => g.values);

/**
 * Convertit une saisie en nombre en tolérant la virgule française.
 *
 * `Number.parseInt('12.5')` → 12. `parseFloat` seul ne tolère pas « 12500,5 ».
 * On nettoie donc d'abord les espaces (espace insécable ou fine) que le
 *vendeur colle facilement en copiant un prix, puis on normalise la virgule.
 */
function parseAmount(raw: string): number | undefined {
  const cleaned = raw.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  if (cleaned === '') return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Liste déroulante à recherche : les catégories sont trop nombreuses pour un `<select>` nu. */
function SearchableSelect({
  id,
  value,
  placeholder,
  groups,
  onChange,
}: {
  id: string;
  value: string;
  placeholder: string;
  groups: { group: string; values: string[] }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const flat = useMemo(
    () => groups.flatMap((g) => g.values.map((v) => ({ group: g.group, value: v }))),
    [groups]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? flat.filter((item) => item.value.toLowerCase().includes(q)) : flat;
  }, [flat, query]);

  React.useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${selectCls} flex items-center justify-between text-left`}
      >
        <span className={value ? 'truncate' : 'text-gray-300 truncate'}>
          {value || placeholder}
        </span>
        <ChevronDown size={16} className="shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-xl p-1.5">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            aria-label={`Rechercher — ${placeholder}`}
            className={`${inputCls} mb-1.5 py-2 text-[13px]`}
          />
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-[11px] font-semibold text-gray-400 text-center">
              Aucun résultat
            </p>
          ) : (
            filtered.map((item, i) => {
              const showGroup = i === 0 || filtered[i - 1].group !== item.group;
              return (
                <React.Fragment key={`${item.group}-${item.value}`}>
                  {showGroup && (
                    <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-300">
                      {item.group}
                    </p>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={item.value === value}
                    onClick={() => {
                      onChange(item.value);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-left text-[13px] font-semibold transition-colors ${
                      item.value === value
                        ? 'bg-orange-50 text-[#f56b2a]'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {item.value}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  mainCategories: string[];
  categoryMapping: Record<string, string>;
  errors: Record<string, string>;
};

export default function ProductEssentialsStep({
  formData,
  setFormData,
  mainCategories,
  categoryMapping,
  errors,
}: Props) {
  const options = formData.options || [];
  const hasVersions = options.length > 0;
  const canAddVersions = hasVersions || options.length < MAX_VARIANT_OPTIONS;

  const subCategories = Object.keys(categoryMapping);

  /** Active le mode « plusieurs versions » : crée l'option d'amorce. */
  const enableVersions = () => {
    if (hasVersions) return;
    setFormData((prev) => ({
      ...prev,
      options: [...(prev.options || []), { id: newVariantId(), name: '', values: [] }],
      variants: [],
    }));
  };

  return (
    <div className="space-y-5">
      <Field
        id="pf-name"
        label="Nom du produit"
        required
        error={errors.name}
        hint="Ce que le client cherche. ex. « T-shirt coton bio »."
      >
        <input
          id="pf-name"
          type="text"
          value={formData.name || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="ex. T-shirt coton bio"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'pf-name-error' : 'pf-name-hint'}
          maxLength={140}
          className={inputCls}
        />
        <p className="text-[11px] text-gray-400 font-medium text-right tabular-nums">
          {(formData.name || '').length}/140
        </p>
      </Field>

      <Field
        id="pf-category"
        label="Catégorie"
        required
        error={errors.category}
        hint="Détermine où le produit apparaît dans votre boutique."
      >
        <SearchableSelect
          id="pf-category"
          value={formData.category || ''}
          placeholder="Choisissez une catégorie…"
          groups={mainCategories.map((main) => ({
            group: main,
            values: subCategories.filter((sub) => categoryMapping[sub] === main),
          }))}
          onChange={(sub) =>
            setFormData((prev) => ({
              ...prev,
              category: sub,
              mainCategory: categoryMapping[sub] || mainCategories[0] || 'Divers',
            }))
          }
        />
      </Field>

      {/* ---------- A. Versions multiples, AVANT le prix ----------
          C'est la seule façon d'éviter que le vendeur saisisse un prix et un
          stock qui seront ignorés dès qu'il ajoutera des options à l'étape 3. */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 shrink-0 rounded-xl bg-[#f56b2a]/10 text-[#f56b2a]">
            <Layers size={15} strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-gray-900 leading-tight">
              Ce produit existe-t-il en plusieurs versions ?
            </p>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5 leading-relaxed">
              Plusieurs tailles, plusieurs couleurs, plusieurs formats…
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={enableVersions}
            disabled={!canAddVersions}
            aria-pressed={hasVersions}
            className={`flex-1 px-4 py-3 rounded-xl text-[12px] font-bold border transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
              hasVersions
                ? 'bg-[#f56b2a] text-white border-[#f56b2a] shadow-sm shadow-orange-200'
                : 'bg-white text-gray-700 border-gray-200 hover:border-orange-200 hover:text-[#f56b2a]'
            }`}
          >
            {hasVersions ? 'Oui — je les définirai à l’étape 3' : 'Oui, plusieurs versions'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!options.length) {
                setFormData((prev) => ({ ...prev, options: [], variants: [] }));
              }
            }}
            disabled={hasVersions}
            aria-pressed={!hasVersions}
            className={`flex-1 px-4 py-3 rounded-xl text-[12px] font-bold border transition-all active:scale-[0.98] disabled:opacity-40 ${
              !hasVersions
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-400 border-gray-100'
            }`}
          >
            Non, une seule version
          </button>
        </div>
      </div>

      {/* ---------- Prix & stock ---------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <Field
          id="pf-price"
          label={hasVersions ? 'Prix de base par version' : 'Prix de vente'}
          required
          error={errors.price}
          hint={
            hasVersions
              ? `Copié dans chaque version à l'étape 3, où vous pourrez le corriger ligne par ligne.`
              : undefined
          }
        >
          <div className="relative">
            <input
              id="pf-price"
              type="text"
              inputMode="decimal"
              value={formData.price != null ? String(formData.price) : ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, price: parseAmount(e.target.value) }))
              }
              placeholder="0"
              aria-invalid={!!errors.price}
              aria-describedby={errors.price ? 'pf-price-error' : 'pf-price-hint'}
              className={`${amountCls} pl-4 pr-14 text-[#f56b2a] ${
                errors.price ? 'border-rose-300' : ''
              }`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">
              XOF
            </span>
          </div>
        </Field>

        <Field
          id="pf-stock"
          label={hasVersions ? 'Stock (ignoré)' : 'Stock disponible'}
          error={errors.stock}
          hint={
            hasVersions
              ? `Le stock se règle version par version à l'étape 3. Ce champ est ignoré.`
              : undefined
          }
        >
          <input
            id="pf-stock"
            type="text"
            inputMode="numeric"
            value={formData.stock != null ? String(formData.stock) : ''}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, stock: parseAmount(e.target.value) }))
            }
            placeholder="0"
            disabled={hasVersions}
            aria-invalid={!!errors.stock}
            aria-describedby={errors.stock ? 'pf-stock-error' : 'pf-stock-hint'}
            className={`${amountCls} ${errors.stock ? 'border-rose-300' : ''}`}
          />
        </Field>
      </div>

      {/* ---------- Unité ---------- */}
      {formData.businessType === 'shopping' && (
        <Field
          id="pf-unit"
          label="Unité de vente"
          hint="Ce que le client achète : une pièce, un carton, un kilo…"
        >
          <div className="space-y-2">
            <SearchableSelect
              id="pf-unit"
              value={ALL_UNITS.includes(formData.unit || '') ? (formData.unit as string) : ''}
              placeholder="Choisissez une unité…"
              groups={UNIT_PRESETS}
              onChange={(unit) => setFormData((prev) => ({ ...prev, unit }))}
            />
            {/* La saisie libre s'ajoute à la liste au lieu de la remplacer :
                le select disparaissait, sans indice sur la valeur retenue. */}
            {!ALL_UNITS.includes(formData.unit || '') && (
              <input
                type="text"
                value={formData.unit || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                placeholder="Autre unité : pack de 100, fagot, plateau…"
                aria-label="Unité personnalisée"
                className={inputCls}
              />
            )}
          </div>
        </Field>
      )}

      {/* ---------- Délai ---------- */}
      <Field
        id="pf-delivery"
        label="Délai de livraison ou de préparation"
        hint="Affiché sur la fiche produit pour rassurer le client."
      >
        <div className="space-y-2">
          <SearchableSelect
            id="pf-delivery"
            value={ALL_DELIVERIES.includes(formData.deliveryTime || '') ? (formData.deliveryTime as string) : ''}
            placeholder="Choisissez un délai…"
            groups={DELIVERY_PRESETS}
            onChange={(t) => setFormData((prev) => ({ ...prev, deliveryTime: t }))}
          />
          {!ALL_DELIVERIES.includes(formData.deliveryTime || '') && formData.deliveryTime !== '' && (
            <input
              type="text"
              value={formData.deliveryTime || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, deliveryTime: e.target.value }))}
              placeholder="Autre délai : 2h, sur rendez-vous…"
              aria-label="Délai personnalisé"
              className={inputCls}
            />
          )}
        </div>
      </Field>

      {/* Rappel du contrat serveur, formulé avant que le vendeur ne parte sur
          l'étape 3 : c'est la matrice qui fait foi, pas ces deux champs. */}
      {hasVersions && (
        <p className="flex items-start gap-2 px-3.5 py-3 bg-orange-50/60 border border-orange-100 rounded-xl text-[11px] font-semibold text-orange-800 leading-relaxed">
          <Tag size={13} className="shrink-0 mt-px text-[#f56b2a]" />
          À l&apos;étape 3, chaque version aura son propre prix et son propre stock.
          Le prix de base ci-dessus sert de modèle, et le total affiché en boutique
          sera la somme des stocks de vos versions.
        </p>
      )}
    </div>
  );
}

export { parseAmount };