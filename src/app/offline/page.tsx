import Link from 'next/link';

export const metadata = {
  title: 'Hors ligne · PosMarket',
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 bg-white border border-gray-100 rounded-3xl grid place-items-center shadow-sm mb-6">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f56b2a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2a10 10 0 1 0 10 10" />
          <path d="M12 12 8.5 8.5" />
          <circle cx="12" cy="12" r="1" fill="#f56b2a" />
        </svg>
      </div>
      <h1 className="text-xl font-black text-gray-900 mb-2">
        Vous êtes hors ligne
      </h1>
      <p className="text-sm text-gray-500 font-bold max-w-[280px] leading-relaxed mb-8">
        Vérifiez votre connexion internet puis réessayez. Votre panier est
        conservé sur votre téléphone.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-[#f56b2a] hover:bg-[#e55a1b] text-white rounded-2xl font-black text-sm transition-all active:scale-95"
      >
        Réessayer
      </Link>
    </div>
  );
}
