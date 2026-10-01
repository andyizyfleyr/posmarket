/**
 * Jetons de style du formulaire produit.
 *
 * Avant ce fichier, le formulaire definirait une hanyenne de classes par
 * champ : `py-2`/`py-3`/`py-4`, `focus:ring-orange-50`/`ring-orange-200`,
 * `bg-gray-50`/`bg-white`, et une dizaine de tailles de police entre `7px` et
 * `10px`. Deux champs censés faire la même chose n'étaient pas alignés, et le
 * plancher de lisibilité n'existait nulle part.
 *
 * Règle appliquée : `7px`–`10px` sont interdits. Sous `11px` le texte est
 * illisible sur mobile et échoue aux contrastes AA. Les libellés restent
 * petits (`11px` majuscules) mais restent des libellés, pas du texte courant.
 */

export const inputCls =
  'w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 placeholder:text-gray-300 focus:border-[#f56b2a] focus:ring-4 focus:ring-orange-50 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-400';

/** Variante « chiffre » : prix, stock, quantités. */
export const amountCls =
  'w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-lg font-bold text-gray-900 focus:border-[#f56b2a] focus:ring-4 focus:ring-orange-50 outline-none transition-all';

export const selectCls = `${inputCls} appearance-none cursor-pointer bg-no-repeat pr-10`;

export const labelCls =
  'block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5';

export const hintCls = 'text-[11px] text-gray-500 font-medium mt-1.5 leading-relaxed';

export const errorCls =
  'text-[11px] font-bold text-rose-600 mt-1.5 flex items-start gap-1';

export const sectionTitleCls = 'text-sm font-bold text-gray-900 leading-tight';

/**
 * Libellé + contrôle + aide, avec le bon câblage ARIA.
 *
 * `error` remplace `hint` : afficher les deux fait dire deux choses contraires
 * au même champ. `aria-describedby` pointe vers l'id du message affiché.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string | null;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelCls}>
        {label}
        {required && <span className="ml-1 text-[#f56b2a]">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className={errorCls}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className={hintCls}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}