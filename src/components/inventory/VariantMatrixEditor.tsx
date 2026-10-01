'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Layers, Plus, Zap } from 'lucide-react';
import {
  buildVariantMatrix,
  newVariantId,
  MAX_VARIANT_OPTIONS,
  type ProductOptionDef,
  type ProductVariantDef,
} from '@/utils/variants';
import OptionEditorCard from './OptionEditorCard';
import VariantMatrixTable, { MatrixStats } from './VariantMatrixTable';

/**
 * Section « Options & variantes » du formulaire produit.
 *
 * Orchestrateur seul : la saisie des options vit dans `OptionEditorCard`, la
 * matrice dans `VariantMatrixTable`. Ce fichier ne fait que porter l'état
 * (`options` / `variants` sont contrôlés par `InventoryView`) et la règle qui
 * relie les deux — toute modification d'une option reconstruit la matrice via
 * `buildVariantMatrix`, qui conserve prix, stock, référence et photo des
 * combinaisons survivantes.
 */

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

const BULK_BUTTON_CLASS =
  'px-3 py-2 rounded-xl text-[11px] font-bold text-gray-600 bg-white ring-1 ring-gray-200 hover:text-[#f56b2a] hover:ring-orange-200 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed';

export default function VariantMatrixEditor({
  options,
  variants,
  basePrice,
  images,
  onChange,
}: Props) {
  const [notice, setNotice] = useState<string | null>(null);
  const [valueDraft, setValueDraft] = useState<Record<string, string>>({});

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

  /** Émet le nouvel état ; la matrice n'est reconstruite que si on le demande. */
  const push = (
    nextOptions: ProductOptionDef[],
    nextVariants?: ProductVariantDef[],
    message: string | null = null
  ) => {
    setNotice(message);
    onChange(nextOptions, nextVariants ?? variants, message);
  };

  /** Toute modification d'option passe par ici : la matrice suit. */
  const sync = (nextOptions: ProductOptionDef[], customMessage: string | null = null) => {
    const { variants: rebuilt, dropped } = buildVariantMatrix(
      nextOptions,
      variants,
      basePrice
    );
    const message =
      customMessage ??
      (dropped.length > 0
        ? `${dropped.length} variante(s) retirée(s) car leurs options n'existent plus.`
        : null);
    setNotice(message);
    onChange(nextOptions, rebuilt, message);
  };

  const addOption = () => {
    if (options.length >= MAX_VARIANT_OPTIONS) return;
    const next = [...options, { id: newVariantId(), name: '', values: [] }];
    const { variants: rebuilt, dropped } = buildVariantMatrix(next, variants, basePrice);
    const message =
      dropped.length > 0
        ? `${dropped.length} variante(s) retirée(s) car leurs options n'existent plus.`
        : null;
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
    updateOption(options.indexOf(option), {
      values: option.values.filter((v) => v !== value),
    });
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
      stock > 0
        ? `Stock positionné à ${stock} sur toutes les variantes.`
        : 'Stock remis à 0 sur toutes les variantes.'
    );
  };

  /** Reporte la référence de la ligne N sur la ligne N+1, suffixée. */
  const copySkuFromIndex = (index: number) => {
    const source = variants[index];
    if (!source) return;
    const base = source.sku?.trim() || '';
    if (!base) return;
    const used = new Set(variants.map((v) => v.sku));
    let suffix = 1;
    let candidate = `${base}-${suffix}`;
    while (used.has(candidate)) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    updateVariant(variants[index + 1]?.id || source.id, { sku: candidate });
  };

  const canAddOption = options.length < MAX_VARIANT_OPTIONS;
  // Une option « prête » a un nom ET au moins une valeur. `combinationsOf`
  // fait le produit cartésien sur TOUTES les options : une seule option sans
  // valeur suffit à vider la matrice. D'où les deux garde-fous — l'étape 2
  // n'apparaît que si au moins une option est prête, et son libellé annonce le
  // compte réel (`variants.length`) plutôt qu'un produit théorique qui
  // mentirait dès qu'une option est vide.
  const readyOptions = options.filter((o) => o.name.trim() && o.values.length > 0);
  const pendingOptions = options.length - readyOptions.length;

  return (
    <div className="space-y-6">
      {/* ---------- Titre de section ---------- */}
      <div className="flex items-start gap-2.5">
        <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-xl bg-[#f56b2a]/10 text-[#f56b2a]">
          <Layers size={16} strokeWidth={2.5} />
        </span>
        <div>
          <h4 className="text-sm font-bold text-gray-900 leading-tight">
            Options &amp; variantes
          </h4>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5 leading-relaxed">
            Proposez votre produit en plusieurs versions (tailles, couleurs…) et donnez un
            prix et un stock à chacune.
          </p>
        </div>
      </div>

      {/* ================= ÉTAPE 1 ================= */}
      <section className="space-y-3">
        <StepHeader
          step={1}
          title="Choisissez ce qui varie"
          hint="Une option = une caractéristique du produit (ex. la taille). Ses valeurs se combinent entre elles."
        />

        {options.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-5 py-7 text-center">
            <p className="text-sm font-bold text-gray-600">
              Votre produit se vend en un seul prix
            </p>
            <p className="text-xs font-medium text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
              Ajoutez une option si, par exemple, il existe en plusieurs tailles ou couleurs.
              Sinon, rien à faire : c&apos;est déjà prêt.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {options.map((option, index) => (
              <OptionEditorCard
                key={option.id}
                option={option}
                index={index}
                draft={valueDraft[option.id] ?? ''}
                onDraftChange={(value) =>
                  setValueDraft((prev) => ({ ...prev, [option.id]: value }))
                }
                onRename={(name) => updateOption(index, { name })}
                onAddValue={(raw) => addValue(option, raw)}
                onRemoveValue={(value) => removeValue(option, value)}
                onRemove={() => removeOption(index)}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={addOption}
            disabled={!canAddOption}
            className="self-start shrink-0 inline-flex items-center gap-1.5 px-4 py-3 bg-gray-900 text-white rounded-xl text-[11px] font-bold hover:bg-[#f56b2a] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} strokeWidth={3} /> AJOUTER UNE OPTION
          </button>
          {!canAddOption && (
            <span className="text-[11px] font-bold text-amber-700">
              {MAX_VARIANT_OPTIONS} options maximum : au-delà, la fiche devient illisible pour
              vos clients.
            </span>
          )}
        </div>
      </section>

      {/* ================= ÉTAPE 2 =================
          Masquée tant que l'étape 1 n'a rien produit : afficher un tableau vide
          sous un titre « Variantes » faisait croire à un bug. */}
      {readyOptions.length > 0 && (
        <section className="space-y-3 pt-2 border-t border-gray-100">
          <StepHeader
            step={2}
            title="Prix et stock de chaque version"
            hint={
              variants.length > 0
                ? pendingOptions > 0
                  ? `${variants.length} ligne(s) pour le moment. ${pendingOptions} option(s) sans valeur : autant de lignes à venir.`
                  : `${variants.length} combinaison(s) générée(s) à partir de vos options.`
                : `Complétez l'étape 1 pour générer les lignes.`
            }
          />

          {notice && (
            <p className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 border border-amber-100 rounded-xl text-[11px] font-bold text-amber-700">
              <AlertTriangle size={13} className="shrink-0" />
              {notice}
            </p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <MatrixStats
              variants={variants}
              min={stats.min}
              max={stats.max}
              total={stats.total}
              outOfStock={stats.outOfStock}
              free={stats.free}
            />
            {variants.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={setAllPrices}
                  className={BULK_BUTTON_CLASS}
                  title={`Aligner tous les prix sur le prix du produit (${basePrice} XOF)`}
                >
                  Prix = {basePrice.toLocaleString('fr-FR')} XOF
                </button>
                <button
                  type="button"
                  onClick={() => setAllStock(0)}
                  className={BULK_BUTTON_CLASS}
                  title="Remettre le stock de toutes les variantes à 0"
                >
                  Stock = 0
                </button>
              </div>
            )}
          </div>

          {variants.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-5 py-7 text-center text-xs font-semibold text-gray-400 leading-relaxed">
              Tant qu&apos;une option n&apos;a aucune valeur, aucune ligne ne peut être
              construite : les versions se combinent toutes ensemble.
            </p>
          ) : (
            <>
              <VariantMatrixTable
                options={options}
                variants={variants}
                images={images}
                onUpdateVariant={updateVariant}
                onRemoveVariant={(id) =>
                  push(
                    options,
                    variants.filter((v) => v.id !== id),
                    'Variante retirée de la matrice.'
                  )
                }
                onCopySku={copySkuFromIndex}
              />
              <p className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400">
                <Zap size={11} className="text-[#f56b2a] shrink-0" />
                Tableau régénéré automatiquement : vos prix, stocks et références sont
                conservés.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * En-tête d'étape numérotée.
 *
 * La section combine deux actes dans l'ordre : définir les options, puis
 * remplir le tableau qui en découle. Sans numérotation ni ordre explicite, les
 * deux blocs se lisaient comme concurrents et l'on ne savait pas par lequel
 * commencer.
 */
function StepHeader({
  step,
  title,
  hint,
}: {
  step: number;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-[#f56b2a] text-white text-[11px] font-black mt-px">
        {step}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-gray-900 leading-tight">{title}</p>
        <p className="text-[11px] font-medium text-gray-400 mt-0.5 leading-relaxed">
          {hint}
        </p>
      </div>
    </div>
  );
}