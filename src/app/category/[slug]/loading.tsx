export default function Loading() {
  return (
    <div className="min-h-screen w-full bg-gray-50/50 pb-8">
      {/* Sticky header placeholder */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gray-100 skeleton" />
            <div className="w-28 h-5 rounded-lg bg-gray-100 skeleton" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gray-100 skeleton" />
            <div className="w-10 h-10 rounded-2xl bg-gray-100 skeleton" />
          </div>
        </div>
        <div className="h-11 w-full rounded-xl bg-gray-100 skeleton mb-3" />
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-6">
        {/* Titre catégorie */}
        <div className="h-7 w-48 rounded-lg bg-gray-200 skeleton mb-1" />
        <div className="h-4 w-32 rounded-lg bg-gray-100 skeleton mb-6" />

        {/* Product grid — 2 colonnes mobile, 4/5 desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
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