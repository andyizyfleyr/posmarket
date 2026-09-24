export default function Loading() {
  return (
    <div className="min-h-screen w-full bg-gray-50/50 pb-8">
      {/* Barre retour */}
      <div className="max-w-5xl mx-auto px-4 pt-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-100 skeleton" />
        <div className="h-9 w-40 rounded-full bg-gray-100 skeleton" />
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-5">
        {/* Fiche produit : image + infos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <div className="aspect-square rounded-2xl bg-gray-100 skeleton" />
          <div className="space-y-3 pt-2">
            <div className="h-5 w-1/2 rounded bg-gray-200 skeleton" />
            <div className="h-4 w-2/3 rounded bg-gray-100 skeleton" />
            <div className="h-8 w-32 rounded-xl bg-gray-200 skeleton" />
            <div className="h-14 w-full rounded-xl bg-gray-100 skeleton mt-4" />
            <div className="h-14 w-full rounded-xl bg-gray-100 skeleton" />
          </div>
        </div>

        {/* Produits similaires */}
        <div className="h-5 w-40 rounded bg-gray-200 skeleton mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
              <div className="aspect-square skeleton" />
              <div className="p-2 md:p-3 space-y-2 flex-1">
                <div className="h-3 w-3/4 skeleton rounded" />
                <div className="h-4 w-1/2 skeleton rounded" />
                <div className="h-8 w-full skeleton rounded-xl mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}