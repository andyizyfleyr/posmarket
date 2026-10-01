'use client';

import React from 'react';
import { Check, Globe, Monitor } from 'lucide-react';
import { Field, inputCls } from './fieldStyles';
import type { ProductFormData } from './types';

/**
 * Étape 3 — Description et visibilité.
 *
 * La description passe en premier dans l'étape : c'est le contenu le plus lu
 * sur la fiche produit, et elle était reléguée après la matrice des variantes,
 * la section la plus longue de la modale.
 */

type Props = {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
};

export default function ProductDescriptionStep({ formData, setFormData }: Props) {
  const description = formData.description || '';
  const [showTips, setShowTips] = React.useState(false);

  return (
    <div className="space-y-5">
      <Field
        id="pf-description"
        label="Description"
        hint="Matière, dimensions, usage, entretien. Laissez vide si vous ne savez pas : la fiche reste complète."
      >
        <textarea
          id="pf-description"
          value={description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="ex. T-shirt en coton bio 220 g/m², coupe régulière, lavable en machine à 30°C."
          rows={6}
          className={`${inputCls} font-normal leading-relaxed resize-y min-h-[140px]`}
        />
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowTips((v) => !v)}
            aria-expanded={showTips}
            className="text-[11px] font-bold text-[#f56b2a] hover:underline underline-offset-2"
          >
            {showTips ? 'Masquer les conseils' : 'Comment bien rédiger ?'}
          </button>
          <span className="text-[11px] text-gray-400 font-medium tabular-nums">
            {description.length} caractères
          </span>
        </div>
        {showTips && (
          <ul className="space-y-1.5 pt-2 border-l-2 border-orange-100 pl-3">
            {[
              'Matière et grammage',
              'Dimensions ou contenance',
              'Usage prévu',
              'Entretien / conservation',
              'Ce qui est inclus dans le prix',
            ].map((tip) => (
              <li key={tip} className="text-[11px] text-gray-500 font-medium leading-relaxed flex gap-1.5">
                <Check size={12} className="shrink-0 mt-0.5 text-[#f56b2a]" />
                {tip}
              </li>
            ))}
          </ul>
        )}
      </Field>

      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`flex items-center justify-center w-10 h-10 shrink-0 rounded-xl transition-colors ${
                formData.isOnline ? 'bg-[#f56b2a] text-white' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {formData.isOnline ? <Globe size={18} /> : <Monitor size={18} />}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-gray-900 leading-tight">
                Publier sur le store
              </p>
              <p className="text-[11px] text-gray-500 font-medium mt-0.5 leading-relaxed">
                {formData.isOnline
                  ? 'Visible par vos clients en ligne et utilisable en caisse.'
                  : 'Utilisable en caisse uniquement : invisible dans votre boutique en ligne.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={formData.isOnline}
            aria-label="Publier sur le store"
            onClick={() => setFormData((prev) => ({ ...prev, isOnline: !prev.isOnline }))}
            className={`shrink-0 w-12 h-7 rounded-full transition-colors relative ${
              formData.isOnline ? 'bg-[#f56b2a]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
                formData.isOnline ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}