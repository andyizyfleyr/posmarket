'use client';

import React from 'react';
import { AlertTriangle, Check, Plus, Trash2, Zap } from 'lucide-react';
import { formatCurrency } from '@/utils';
import { amountCls, hintCls } from './fieldStyles';
import { parseAmount } from './ProductEssentialsStep';
import type { ProductFormData } from './types';

/**
 * Paliers de prix de gros.
 *
 * Réécrit parce que l'ancien calcul d'économie pouvait afficher un montant
 * faux : quand le total saisi était inférieur au prix unitaire du produit, la
 * ligne retombait sur `effectiveUnit = baseUnitPrice` et `packageTotal` valait
 * `tierPrice * minQty`. Une saisie erronée produisait donc une « économie »
 * plausible mais inventée — le pire échec possible ici, puisque c'est le
 * montant que le vendeur annonce à ses clients.
 *
 * Le calcul est désormais explicite et sans repli silencieux :
 *   prix unitaire = total du palier / quantité
 *   économie      = (prix unitaire × quantité) − total du palier
 * et un avertissement s'affiche quand l'économie est nulle ou négative.
 */

export type WholesaleTier = {
  minQty: number;
  price: number;
  unitPrice?: number;
};

type Props = {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
};

/** Paliers proposés en un clic : quantités croissantes, remises décroissantes. */
function suggestedTiers(basePrice: number) {
  return [
    { minQty: 10, ratio: 0.9 },
    { minQty: 50, ratio: 0.8 },
    { minQty: 100, ratio: 0.75 },
    { minQty: 500, ratio: 0.65 },
  ]
.filter(() => basePrice > 0)
  .map((s) => ({
    minQty: s.minQty,
    total: Math.round(basePrice * s.minQty * s.ratio),
  }));
}

export default function WholesaleTiersEditor({ formData, setFormData }: Props) {
  const tiers = (formData.wholesaleTiers || []) as WholesaleTier[];
  const baseUnitPrice = Number(formData.price) || 0;
  const isEnabled = tiers.length > 0;

  const writeTiers = (next: WholesaleTier[]) => {
    const sorted = [...next].sort((a, b) => a.minQty - b.minQty);
    setFormData((prev) => ({
      ...prev,
      wholesaleTiers: sorted,
      // `wholesalePrice`/`wholesaleMinQty` sont des champs legacy conservés
      // pour les produits créés avant les paliers : ils doivent refléter le
      // premier, sinon l'ancien chemin de lecture les utiliserait à tort.
      wholesaleMinQty: sorted[0]?.minQty,
      wholesalePrice: sorted[0]?.price,
    }));
  };

  const setTier = (idx: number, patch: Partial<WholesaleTier>) => {
    const next = tiers.map((tier, i) => (i === idx ? { ...tier, ...patch } : tier));
    writeTiers(next);
  };

  const toggleEnabled = () => {
    if (isEnabled) {
      setFormData((prev) => ({
        ...prev,
        wholesaleTiers: [],
        wholesaleMinQty: undefined,
        wholesalePrice: undefined,
      }));
    } else {
      const first = suggestedTiers(baseUnitPrice)[0];
      writeTiers(
        first
          ? [{ minQty: first.minQty, price: first.total, unitPrice: Math.round(first.total / first.minQty) }]
          : [{ minQty: 10, price: 0, unitPrice: 0 }]
      );
    }
  };

  const addTier = () => {
    const last = tiers[tiers.length - 1];
    const minQty = last ? last.minQty * 2 : 10;
    const ratio = Math.max(0.5, (last && last.minQty ? last.price / (last.minQty * (baseUnitPrice || 1)) : 0.8) - 0.05);
    const total = baseUnitPrice > 0 ? Math.round(baseUnitPrice * minQty * ratio) : 0;
    writeTiers([...tiers, { minQty, price: total, unitPrice: minQty ? Math.round(total / minQty) : 0 }]);
  };

  const addSuggested = (minQty: number, total: number) => {
    const existing = tiers.findIndex((t) => t.minQty === minQty);
    if (existing >= 0) {
      setTier(existing, { price: total });
      return;
    }
    writeTiers([...tiers, { minQty, price: total, unitPrice: Math.round(total / minQty) }]);
  };

  const unusedSuggestions = suggestedTiers(baseUnitPrice).filter(
    (s) => !tiers.some((t) => t.minQty === s.minQty)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-8 h-8 shrink-0 rounded-xl bg-amber-50 text-amber-600">
            <Zap size={15} strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-bold text-gray-900 leading-tight">
                Vente en gros &amp; B2B
              </p>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold uppercase">
                Grossiste
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5 leading-relaxed">
              Un prix dégressif automatique au-delà d&apos;une quantité.
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={toggleEnabled}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95 ${
            isEnabled
              ? 'bg-[#f56b2a] text-white shadow-md shadow-orange-200'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {isEnabled ? <Check size={13} strokeWidth={3} /> : null}
          {isEnabled ? 'ACTIVÉ' : 'ACTIVER'}
        </button>
      </div>

      {isEnabled && (
        <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
          {/* Le stock de gros n'a de sens qu'avec un prix de base connu. */}
          {baseUnitPrice <= 0 && (
            <p className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl text-[11px] font-bold text-amber-700">
              <AlertTriangle size={13} className="shrink-0 mt-px" />
              Renseignez d&apos;abord le prix du produit : c&apos;est la référence pour
              calculer vos remises.
            </p>
          )}

          {baseUnitPrice > 0 && unusedSuggestions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Paliers suggérés
              </p>
              <div className="flex flex-wrap gap-2">
                {unusedSuggestions.map((s) => (
                  <button
                    key={s.minQty}
                    type="button"
                    onClick={() => addSuggested(s.minQty, s.total)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-amber-200 text-[11px] font-bold text-amber-800 hover:border-[#f56b2a] hover:text-[#f56b2a] transition-colors"
                  >
                    <Plus size={12} strokeWidth={3} />
                    dès {s.minQty} → {formatCurrency(s.total)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tiers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 px-5 py-6 text-center">
              <p className="text-[12px] font-bold text-gray-600">
                Aucun palier défini
              </p>
              <button
                type="button"
                onClick={addTier}
                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-[#f56b2a] text-white rounded-xl text-[11px] font-bold active:scale-95"
              >
                <Plus size={13} strokeWidth={3} /> Ajouter un palier
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {tiers.map((tier, idx) => {
                const minQty = Math.max(1, Number(tier.minQty) || 1);
                const total = Math.max(0, Number(tier.price) || 0);
                // Calculs explicites, sans repli : c'est ce que le vendeur
                // annonce au client, donc c'est ce qui doit être exact.
                const unitPrice = minQty > 0 ? Math.round(total / minQty) : 0;
                const retailTotal = baseUnitPrice * minQty;
                const savings = retailTotal - total;
                const savingsPct = retailTotal > 0 && savings > 0 ? Math.round((savings / retailTotal) * 100) : 0;
                const noDiscount = baseUnitPrice > 0 && savings <= 0;

                return (
                  <div
                    key={idx}
                    className={`rounded-2xl border p-4 space-y-2 ${
                      noDiscount ? 'border-rose-200 bg-rose-50/40' : 'border-amber-100 bg-amber-50/40'
                    }`}
                  >
                    <div className="flex items-end gap-3">
                      <span className="flex items-center justify-center w-6 h-6 shrink-0 mb-2.5 rounded-lg bg-amber-500 text-white text-[11px] font-bold">
                        {idx + 1}
                      </span>

                      <div className="w-28 shrink-0">
                        <label htmlFor={`wt-qty-${idx}`} className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                          Dès (qté)
                        </label>
                        <input
                          id={`wt-qty-${idx}`}
                          type="text"
                          inputMode="numeric"
                          value={String(tier.minQty ?? '')}
                          onChange={(e) => setTier(idx, { minQty: parseAmount(e.target.value) ?? 1 })}
                          placeholder="10"
                          className={`${amountCls} py-2.5 text-sm`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <label htmlFor={`wt-total-${idx}`} className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                          Prix de gros total
                        </label>
                        <div className="relative">
                          <input
                            id={`wt-total-${idx}`}
                            type="text"
                            inputMode="decimal"
                            value={tier.price != null ? String(tier.price) : ''}
                            onChange={(e) => setTier(idx, { price: parseAmount(e.target.value) ?? 0 })}
                            placeholder="0"
                            className={`${amountCls} py-2.5 text-sm pl-3.5 pr-12 text-[#f56b2a]`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400">
                            XOF
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => writeTiers(tiers.filter((_, i) => i !== idx))}
                        aria-label={`Supprimer le palier ${idx + 1}`}
                        className="shrink-0 w-10 h-10 mb-0.5 rounded-xl text-gray-400 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Retour de calcul : c'est le montant que le client voit. */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-100/70">
                      <p className="text-[11px] font-semibold text-gray-500">
                        Soit{' '}
                        <span className="font-bold text-gray-900">
                          {formatCurrency(unitPrice)}
                        </span>{' '}
                        l&rsquo;unité
                        {baseUnitPrice > 0 && (
                          <>
                            {' '}
                            au lieu de{' '}
                            <span className="line-through text-gray-400">
                              {formatCurrency(baseUnitPrice)}
                            </span>
                          </>
                        )}
                      </p>
                      {savings > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                          Économie {formatCurrency(savings)}
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[10px]">
                            −{savingsPct}%
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                          <AlertTriangle size={12} />
                          Aucune remise : le client paiera plus cher qu&apos;en boutique.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addTier}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-amber-200 text-[11px] font-bold text-amber-800 hover:border-[#f56b2a] hover:text-[#f56b2a] transition-colors active:scale-95"
              >
                <Plus size={13} strokeWidth={3} /> Ajouter un palier
              </button>
            </div>
          )}

          <p className={hintCls}>
            Le prix de gros s&apos;applique automatiquement dès que le panier du client
            atteint la quantité, sans code à saisir.
          </p>
        </div>
      )}
    </div>
  );
}