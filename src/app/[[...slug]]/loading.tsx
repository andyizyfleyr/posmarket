export default function Loading() {
  return (
    <div className="min-h-screen w-full bg-gray-50/50 pb-8">
      {/* Sticky header placeholder */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-orange-100 skeleton-dark" />
            <div className="w-28 h-5 rounded-lg bg-gray-100 skeleton-dark" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gray-100 skeleton-dark" />
            <div className="w-10 h-10 rounded-2xl bg-gray-100 skeleton-dark" />
          </div>
        </div>
        {/* Search bar */}
        <div className="h-11 w-full rounded-xl bg-gray-100 skeleton mb-3" />
        {/* Category chips */}
        <div className="flex gap-2 py-2 overflow-hidden mb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-24 rounded-full bg-gray-100 skeleton" />
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-5">
        {/* Hero placeholder */}
        <div className="h-32 md:h-64 rounded-[24px] md:rounded-[32px] bg-gray-100 skeleton mb-4" />

        {/* Boutiques partenaires */}
        <div className="w-44 h-6 rounded-lg bg-gray-200 skeleton mb-4" />
        <div className="flex gap-3 overflow-hidden mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[200px] h-28 rounded-2xl bg-gray-100 skeleton" />
          ))}
        </div>

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