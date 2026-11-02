/**
 * Squelette du tableau de bord (l'ancien `(app)/loading.tsx`, qui servait à
 * toutes les pages de l'espace vendeur et affichait donc des statistiques
 * fantômes même en ouvrant la caisse).
 */
export default function DashboardSkeleton() {
  return (
    <div className="p-3 md:p-6 max-w-6xl mx-auto space-y-6" aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gray-100 skeleton" />
          <div className="space-y-2">
            <div className="h-5 w-40 rounded-lg bg-gray-200 skeleton" />
            <div className="h-3 w-24 rounded bg-gray-100 skeleton" />
          </div>
        </div>
        <div className="h-10 w-32 rounded-xl bg-gray-100 skeleton" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="h-3 w-20 rounded bg-gray-100 skeleton mb-3" />
            <div className="h-7 w-16 rounded-lg bg-gray-200 skeleton" />
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3 md:gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <div className="h-4 w-32 rounded bg-gray-200 skeleton" />
            <div className="h-40 rounded-xl bg-gray-100 skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}
