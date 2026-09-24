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
        {/* Search bar */}
        <div className="h-11 w-full rounded-xl bg-gray-100 skeleton mb-3" />
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-5">
        {/* Hero placeholder */}
        <div className="h-32 md:h-64 rounded-[24px] md:rounded-[32px] bg-gray-100 skeleton mb-6" />

        {/* Boutiques partenaires */}
        <div className="w-52 h-6 rounded-lg bg-gray-200 skeleton mb-4" />
        <div className="flex gap-2.5 overflow-hidden mb-8 snap-x">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-[calc((100vw-52px)/3)] md:w-[112px] shrink-0 rounded-2xl bg-white border border-gray-100 shadow-sm"
            >
              <div className="px-2.5 py-2.5 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-gray-100 skeleton shrink-0" />
                <div className="mt-1.5 w-16 h-2.5 rounded bg-gray-100 skeleton" />
                <div className="mt-1 w-12 h-2 rounded bg-gray-100 skeleton" />
              </div>
            </div>
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