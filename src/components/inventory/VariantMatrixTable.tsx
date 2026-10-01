'use client';

import React, { useState } from 'react';
import { AlertTriangle, Copy, Image as ImageIcon, Package, Trash2 } from 'lucide-react';
import type { ProductOptionDef, ProductVariantDef } from '@/utils/variants';
import { FIELD_CLASS } from './OptionEditorCard';

/**
 * Matrice des variantes : une ligne par combinaison, avec prix, stock,
 * référence et photo.
 *
 * Deux rendus pour un seul contenu :
 *  - `md+` : un vrai tableau avec un en-tête de colonnes collant, seul moyen de
 *    savoir que la 2e colonne est un prix et la 3e un stock ;
 *  - mobile : une carte par combinaison, chaque champ portant son libellé.
 *
 * L'ancienne version empilait tout sur une grille de 12 colonnes sans
 * en-tête ni libellé : sur mobile les quatre champs se confondaient.
 */

const CELL_CLASS =
  'w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:border-[#f56b2a] focus:ring-4 focus:ring-orange-50 outline-none transition-all';

// `th` de tableau : pas de `block`, la mise en page columnaire en dépend.
const HEAD_CLASS =
  'px-3 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left whitespace-nowrap';

// Libellé posé au-dessus d'un input dans les cartes mobile.
const FIELD_LABEL_CLASS = `block ${HEAD_CLASS} mb-1.5`;

type Props = {
  options: ProductOptionDef[];
  variants: ProductVariantDef[];
  images: string[];
  onUpdateVariant: (id: string, patch: Partial<ProductVariantDef>) => void;
  onRemoveVariant: (id: string) => void;
  onCopySku: (index: number) => void;
};

export default function VariantMatrixTable({
  options,
  variants,
  images,
  onUpdateVariant,
  onRemoveVariant,
  onCopySku,
}: Props) {
  const [imagePickerFor, setImagePickerFor] = useState<string | null>(null);
  // Prix en cours de saisie : commité au blur seulement, sinon une frappe
  // intermédiaire (« 12 » en chemin vers « 12500 ») écraserait la valeur.
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});

  const combinationLabel = (variant: ProductVariantDef) =>
    options.map((option) => variant.optionValues[option.id] ?? '—');

  const renderImagePicker = (variant: ProductVariantDef) => {
    if (imagePickerFor !== variant.id || images.length === 0) return null;
    return (
      <div className="absolute right-0 top-full mt-1 z-30 w-64 bg-white rounded-2xl shadow-xl ring-1 ring-gray-100 p-2 grid grid-cols-3 gap-1.5">
        {images.map((img) => (
          <button
            key={img}
            type="button"
            onClick={() => {
              onUpdateVariant(variant.id, { image: img });
              setImagePickerFor(null);
            }}
            className={`aspect-square rounded-lg overflow-hidden border-2 ${
              variant.image === img
                ? 'border-[#f56b2a]'
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
            onUpdateVariant(variant.id, { image: '' });
            setImagePickerFor(null);
          }}
          className="aspect-square rounded-lg bg-gray-50 text-[9px] font-bold text-gray-400 hover:text-rose-500"
        >
          Aucune
        </button>
      </div>
    );
  };

  const renderPriceInput = (variant: ProductVariantDef, compact = false) => {
    const price = Number(variant.price) || 0;
    return (
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        aria-label={`Prix de la variante ${variant.name}`}
        value={priceDraft[variant.id] ?? String(variant.price ?? '')}
        onChange={(e) =>
          setPriceDraft((prev) => ({ ...prev, [variant.id]: e.target.value }))
        }
        onBlur={(e) => {
          const raw = e.target.value.trim();
          setPriceDraft((prev) => {
            const next = { ...prev };
            delete next[variant.id];
            return next;
          });
          const parsed = Number(raw === '' ? 0 : raw.replace(',', '.'));
          onUpdateVariant(variant.id, {
            price: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
          });
        }}
        className={`${compact ? CELL_CLASS : FIELD_CLASS} ${
          price > 0 ? 'text-[#f56b2a]' : 'text-rose-500 border-rose-200'
        }`}
        placeholder="0"
      />
    );
  };

  const renderStockInput = (variant: ProductVariantDef, compact = false) => (
    <input
      type="number"
      inputMode="numeric"
      min="0"
      aria-label={`Stock de la variante ${variant.name}`}
      value={variant.stock}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onUpdateVariant(variant.id, { stock: 0 });
          return;
        }
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 0) {
          onUpdateVariant(variant.id, { stock: Math.round(parsed) });
        }
      }}
      className={`${compact ? CELL_CLASS : FIELD_CLASS} ${
        (variant.stock || 0) > 0 ? 'text-gray-900' : 'text-rose-500 border-rose-200'
      }`}
      placeholder="0"
    />
  );

  const renderSkuInput = (variant: ProductVariantDef, compact = false) => (
    <input
      type="text"
      aria-label={`Référence de la variante ${variant.name}`}
      value={variant.sku || ''}
      onChange={(e) => onUpdateVariant(variant.id, { sku: e.target.value })}
      placeholder="ex. TSH-RGE-M"
      className={`${compact ? CELL_CLASS : FIELD_CLASS} font-semibold placeholder:text-gray-300`}
    />
  );

  const renderActions = (variant: ProductVariantDef, index: number) => (
    <div className="flex items-center gap-1">
      <div className="relative">
        <button
          type="button"
          onClick={() => setImagePickerFor(imagePickerFor === variant.id ? null : variant.id)}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
            variant.image
              ? 'text-[#f56b2a] bg-orange-50'
              : 'text-gray-300 hover:text-[#f56b2a] hover:bg-orange-50'
          }`}
          title="Photo de cette variante"
          aria-label="Photo de cette variante"
        >
          <ImageIcon size={15} />
        </button>
        {renderImagePicker(variant)}
      </div>
      {index === 0 && variant.sku && variants.length > 1 && (
        <button
          type="button"
          onClick={() => onCopySku(index)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-300 hover:text-[#f56b2a] hover:bg-orange-50 transition-colors"
          title="Reprendre cette référence pour la ligne suivante"
          aria-label="Reprendre cette référence pour la ligne suivante"
        >
          <Copy size={14} />
        </button>
      )}
      <button
        type="button"
        onClick={() => onRemoveVariant(variant.id)}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
        title="Retirer cette variante"
        aria-label="Retirer cette variante"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );

  return (
    <>
      {/* ---------- Mobile : une carte par combinaison, champs labellisés ---------- */}
      <div className="md:hidden space-y-3">
        {variants.map((variant, index) => {
          const price = Number(variant.price) || 0;
          const stock = variant.stock || 0;
          return (
            <article
              key={variant.id}
              className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-1.5 min-w-0">
                  {combinationLabel(variant).map((value, i) => (
                    <span
                      key={options[i]?.id ?? i}
                      className="inline-flex items-center gap-1 text-xs font-bold text-gray-900 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg"
                    >
                      <span className="text-gray-400 font-semibold">{options[i]?.name}</span>
                      {value}
                    </span>
                  ))}
                </div>
                <span className="shrink-0 text-[10px] font-bold text-gray-300 tabular-nums">
                  #{index + 1}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className={FIELD_LABEL_CLASS}>Prix (XOF)</span>
                  {renderPriceInput(variant)}
                </div>
                <div>
                  <span className={FIELD_LABEL_CLASS}>Stock</span>
                  {renderStockInput(variant)}
                </div>
              </div>

              <div>
                <span className={FIELD_LABEL_CLASS}>Référence (SKU)</span>
                {renderSkuInput(variant)}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-50">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-400">
                  {price === 0 && (
                    <span className="inline-flex items-center gap-1 text-rose-500">
                      <AlertTriangle size={11} /> Prix à 0
                    </span>
                  )}
                  {stock === 0 && (
                    <span className="inline-flex items-center gap-1 text-rose-500">
                      <AlertTriangle size={11} /> Stock 0
                    </span>
                  )}
                  {price > 0 && stock > 0 && <span>Prête à vendre</span>}
                </div>
                {renderActions(variant, index)}
              </div>
            </article>
          );
        })}
      </div>

      {/* ---------- Desktop : tableau avec en-têtes de colonnes ---------- */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={HEAD_CLASS}>Combinaison</th>
              <th className={`${HEAD_CLASS} w-[120px]`}>Prix (XOF)</th>
              <th className={`${HEAD_CLASS} w-[100px]`}>Stock</th>
              <th className={`${HEAD_CLASS} w-[180px]`}>Référence</th>
              <th className={`${HEAD_CLASS} w-[130px] text-right`}>Photo / Actions</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => {
              const price = Number(variant.price) || 0;
              const stock = variant.stock || 0;
              return (
                <tr key={variant.id} className="group align-top">
                  <td className="py-1.5 pr-3">
                    <div className="flex flex-wrap gap-1.5">
                      {combinationLabel(variant).map((value, i) => (
                        <span
                          key={options[i]?.id ?? i}
                          className="inline-flex items-center gap-1 text-xs font-bold text-gray-900 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg"
                        >
                          <span className="text-gray-400 font-semibold">{options[i]?.name}</span>
                          {value}
                        </span>
                      ))}
                    </div>
                    {(price === 0 || stock === 0) && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-rose-500">
                        <AlertTriangle size={10} />
                        {price === 0 && 'Prix à 0'}
                        {price === 0 && stock === 0 && ' · '}
                        {stock === 0 && 'Stock 0'}
                      </p>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">{renderPriceInput(variant, true)}</td>
                  <td className="py-1.5 pr-3">{renderStockInput(variant, true)}</td>
                  <td className="py-1.5 pr-3">{renderSkuInput(variant, true)}</td>
                  <td className="py-1.5">
                    <div className="flex justify-end">{renderActions(variant, index)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Résumé chiffré affiché au-dessus de la matrice. */
export function MatrixStats({
  variants,
  min,
  max,
  total,
  outOfStock,
  free,
}: {
  variants: ProductVariantDef[];
  min: number;
  max: number;
  total: number;
  outOfStock: number;
  free: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold text-gray-500">
      <span className="inline-flex items-center gap-1.5">
        <Package size={13} className="text-[#f56b2a]" />
        {variants.length} variante{variants.length > 1 ? 's' : ''}
      </span>
      <span>{total} en stock</span>
      {outOfStock > 0 && <span className="text-rose-500">{outOfStock} en rupture</span>}
      {variants.length > 0 && min !== max && (
        <span>
          de {min.toLocaleString('fr-FR')} à {max.toLocaleString('fr-FR')} XOF
        </span>
      )}
      {free > 0 && <span className="text-gray-400">{free} sans référence</span>}
    </div>
  );
}