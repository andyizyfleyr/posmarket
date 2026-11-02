/**
 * Squelette de la page de vente.
 *
 * Remplace `(app)/loading.tsx`, qui affichait un tableau de bord — donc des
 * cartes de statistiques fantômes avant la grille produits. La forme reproduit
 * la vraie mise en page : barre de recherche, filtres de catégories, grille de
 * produits à gauche, panier à droite. L'utilisateur voit immédiatement où il
 * arrive au lieu d'un écran qui se réorganise.
 */
export default function PosSkeleton() {
  return (
    <div className="flex flex-1 h-full overflow-hidden" aria-hidden="true">
      {/* Colonne produits */}
      <div className="flex-1 flex flex-col min-w-0 p-3 md:p-4 gap-3">
        {/* Recherche + actions */}
        <div className="flex gap-2">
          <div className="h-11 flex-1 rounded-2xl bg-gray-100 skeleton" />
          <div className="h-11 w-11 rounded-2xl bg-gray-100 skeleton" />
        </div>

        {/* Filtres de catégories */}
        <div className="flex gap-2 overflow-hidden">
          {[64, 88, 72, 96, 60].map((w, i) => (
            <div key={i} className="h-8 rounded-full bg-gray-100 skeleton" style={{ width: w }} />
          ))}
        </div>

        {/* Grille produits : même nombre de colonnes que la vraie grille */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 md:gap-3">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="aspect-square w-full bg-gray-100 skeleton" />
              <div className="p-2 space-y-1.5">
                <div className="h-2.5 w-4/5 rounded bg-gray-100 skeleton" />
                <div className="h-2.5 w-1/3 rounded bg-gray-100 skeleton" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panier (desktop uniquement, comme la vraie page) */}
      <div className="hidden md:flex w-[360px] lg:w-[400px] xl:w-[420px] flex-col border-l border-gray-100 bg-white p-4 gap-3">
        <div className="h-5 w-32 rounded bg-gray-100 skeleton" />
        <div className="flex-1 space-y-3 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gray-100 skeleton" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-gray-100 skeleton" />
                <div className="h-2.5 w-1/3 rounded bg-gray-100 skeleton" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-14 rounded-2xl bg-gray-100 skeleton" />
      </div>
    </div>
  );
}
