'use client';

import React from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { MAX_VALUES_PER_OPTION, type ProductOptionDef } from '@/utils/variants';

/**
 * Carte d'édition d'une option (ex. « Couleur »).
 *
 * Extrait de `VariantMatrixEditor` pour que la fiche reste lisible : chaque
 * champ porte un libellé explicite. Le nom de l'option passe par un input
 * texte et non par un `<select>` qui se substituait à lui — impossible de
 * savoir d'un coup d'œil si un nom est tapé ou choisi, et la saisie libre
 * d'un nom « Pointure » n'apparaissait qu'après sélection du preset.
 */

export const FIELD_CLASS =
  'w-full px-3.5 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 placeholder:text-gray-300 focus:border-[#f56b2a] focus:ring-4 focus:ring-orange-50 outline-none transition-all';

const LABEL_CLASS =
  'block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5';

/**
 * Suggestions proposées quand le nom de l'option correspond à un preset.
 * Rester dans ce fichier : les presets décrivent les valeurs, pas la matrice.
 */
export const OPTION_PRESETS: Record<string, string[]> = {
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

type Props = {
  option: ProductOptionDef;
  index: number;
  draft: string;
  onDraftChange: (value: string) => void;
  onRename: (name: string) => void;
  onAddValue: (raw: string) => void;
  onRemoveValue: (value: string) => void;
  onRemove: () => void;
};

export default function OptionEditorCard({
  option,
  index,
  draft,
  onDraftChange,
  onRename,
  onAddValue,
  onRemoveValue,
  onRemove,
}: Props) {
  const suggestions = OPTION_PRESETS[option.name] || [];
  const isFull = option.values.length >= MAX_VALUES_PER_OPTION;
  const hasName = option.name.trim().length > 0;

  const commitDraft = () => onAddValue(draft);

  return (
    <section className="rounded-2xl border border-gray-100 bg-gray-50/60 overflow-hidden">
      {/* En-tête : pastille numérotée + nom de l'option + suppression */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <span className="flex items-center justify-center w-8 h-8 shrink-0 rounded-xl bg-[#f56b2a]/10 text-[#f56b2a] text-xs font-black">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <label htmlFor={`option-name-${option.id}`} className={LABEL_CLASS}>
            Nom de l&apos;option {index + 1}
          </label>
          <input
            id={`option-name-${option.id}`}
            type="text"
            value={option.name}
            onChange={(e) => onRename(e.target.value)}
            placeholder="ex. Taille, Couleur, Pointure…"
            className={`${FIELD_CLASS} ${hasName ? '' : 'border-orange-200 bg-orange-50/40'}`}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Supprimer l'option ${option.name || index + 1}`}
          className="shrink-0 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
          title="Supprimer l'option"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Valeurs sélectionnées */}
      <div className="px-4 pb-4 space-y-2">
        <span className={LABEL_CLASS}>
          Valeurs
          <span className="ml-2 normal-case tracking-normal font-semibold text-gray-300">
            {option.values.length}/{MAX_VALUES_PER_OPTION}
          </span>
        </span>

        {option.values.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => (
              <span
                key={value}
                className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 shadow-sm"
              >
                {value}
                <button
                  type="button"
                  onClick={() => onRemoveValue(value)}
                  aria-label={`Retirer ${value}`}
                  className="w-5 h-5 rounded-md text-gray-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors"
                  title={`Retirer ${value}`}
                >
                  <X size={11} strokeWidth={3} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs font-semibold text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl px-3 py-2.5">
            Aucune valeur : ajoutez-en au moins une pour que la matrice se construise.
          </p>
        )}

        {/* Saisie d'une nouvelle valeur : Entrée, virgule ou bouton */}
        <div className="flex items-start gap-2">
          <input
            type="text"
            value={draft}
            disabled={isFull}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                commitDraft();
              }
              if (e.key === 'Backspace' && !draft && option.values.length > 0) {
                onRemoveValue(option.values[option.values.length - 1]);
              }
            }}
            placeholder={isFull ? `Limite de ${MAX_VALUES_PER_OPTION} valeurs atteinte` : 'ex. Rouge — puis Entrée'}
            className={`${FIELD_CLASS} flex-1 disabled:bg-gray-100 disabled:text-gray-400`}
          />
          <button
            type="button"
            onClick={commitDraft}
            disabled={isFull || draft.trim().length === 0}
            className="shrink-0 h-[46px] px-4 rounded-xl bg-gray-900 text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#f56b2a] transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} strokeWidth={3} /> Ajouter
          </button>
        </div>

        {/* Suggestions du preset correspondant au nom saisi */}
        {suggestions.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Suggestions {option.name}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((suggestion) => {
                const active = option.values.some(
                  (v) => v.toLowerCase() === suggestion.toLowerCase()
                );
                return (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() =>
                      active ? onRemoveValue(suggestion) : onAddValue(suggestion)
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                      active
                        ? 'bg-[#f56b2a] text-white border-[#f56b2a] shadow-sm'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-orange-200 hover:text-[#f56b2a]'
                    }`}
                  >
                    {active ? <Check size={10} strokeWidth={3} /> : <Plus size={10} strokeWidth={3} />}
                    {suggestion}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}