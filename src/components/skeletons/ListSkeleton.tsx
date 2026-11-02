/**
 * Squelette générique de liste/tableau, paramétrable.
 *
 * Un seul composant pour inventaire, commandes, factures et clients : la forme
 * commune (en-tête, filtres, lignes) suffit à donner une impression de
 * continuité, et évite quatre fichiers quasi identiques.
 */
interface ListSkeletonProps {
  /** Nombre de colonnes visuelles par ligne (hors vignette et actions). */
  columns?: number;
  rows?: number;
  /** Affiche une grille de cartes (inventaire) plutôt que des lignes (commandes). */
  variant?: 'rows' | 'cards';
}

export default function ListSkeleton({ columns = 3, rows = 8, variant = 'rows' }: ListSkeletonProps) {
  if (variant === 'cards') {
    return (
      <div className="p-3 md:p-4 space-y-3" aria-hidden="true">
        <div className="flex gap-2">
          <div className="h-11 flex-1 rounded-2xl bg-gray-100 skeleton" />
          <div className="h-11 w-28 rounded-2xl bg-gray-100 skeleton" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="aspect-square w-full bg-gray-100 skeleton" />
              <div className="p-3 space-y-2">
                <div className="h-3 w-4/5 rounded bg-gray-100 skeleton" />
                <div className="h-3 w-1/3 rounded bg-gray-100 skeleton" />
                <div className="h-6 w-2/3 rounded-lg bg-gray-100 skeleton" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-4" aria-hidden="true">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-44 rounded-lg bg-gray-200 skeleton" />
          <div className="h-3 w-64 rounded bg-gray-100 skeleton" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-gray-100 skeleton" />
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {[80, 96, 72].map((w, i) => (
          <div key={i} className="h-9 rounded-xl bg-gray-100 skeleton" style={{ width: w }} />
        ))}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="h-10 w-10 rounded-xl bg-gray-100 skeleton" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-gray-100 skeleton" />
              <div className="h-2.5 w-1/5 rounded bg-gray-100 skeleton" />
            </div>
            {Array.from({ length: columns }).map((_, c) => (
              <div key={c} className="hidden md:block h-3 w-16 rounded bg-gray-100 skeleton" />
            ))}
            <div className="h-8 w-20 rounded-lg bg-gray-100 skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}
