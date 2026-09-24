export default function Loading() {
  return (
    <div className="min-h-screen w-full bg-gray-50">
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 skeleton-dark rounded-2xl" />
            <div className="h-6 w-56 rounded-lg bg-gray-200 skeleton" />
          </div>
          <div className="h-10 w-32 rounded-xl bg-gray-100 skeleton" />
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="h-4 w-24 rounded bg-gray-100 skeleton mb-3" />
              <div className="h-8 w-16 rounded-lg bg-gray-200 skeleton" />
            </div>
          ))}
        </div>

        {/* Rangs de table */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="w-10 h-10 rounded-lg bg-gray-100 skeleton" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-1/3 rounded bg-gray-100 skeleton" />
                <div className="h-3 w-1/4 rounded bg-gray-100 skeleton" />
              </div>
              <div className="h-8 w-24 rounded-lg bg-gray-100 skeleton" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}