import React from 'react';
import Link from 'next/link';
import { 
  ShoppingBag, 
  Home, 
  ArrowLeft, 
  Search, 
  Compass, 
  Sparkles,
  ShoppingBasket,
  Smartphone,
  Shirt,
  Utensils
} from 'lucide-react';

export default function NotFound() {
  const popularCategories = [
    { name: 'Mode & Maillots', icon: Shirt, href: '/?cat=Mode' },
    { name: 'Smartphones & Tech', icon: Smartphone, href: '/?cat=Électronique' },
    { name: 'Restauration & Fast-food', icon: Utensils, href: '/?cat=Restauration' },
    { name: 'Toutes les boutiques', icon: ShoppingBasket, href: '/' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffaf7] via-white to-[#f8fafc] flex flex-col justify-between selection:bg-[#f56b2a]/20 selection:text-[#f56b2a]">
      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#f56b2a] to-[#ff8c42] flex items-center justify-center text-white shadow-lg shadow-[#f56b2a]/25 group-hover:scale-105 transition-transform duration-300">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl tracking-tight text-gray-950 flex items-center gap-1">
              Pos<span className="text-[#f56b2a]">Market</span>
            </span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest -mt-1">
              Express Marketplace
            </span>
          </div>
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-700 hover:text-gray-900 bg-white/90 hover:bg-white border border-gray-200/80 rounded-full shadow-sm backdrop-blur-sm transition-all"
        >
          <Home className="w-3.5 h-3.5 text-[#f56b2a]" />
          <span>Accueil</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-xl mx-auto text-center">
          {/* Animated 404 Badge */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="text-8xl sm:text-9xl font-black tracking-tighter bg-gradient-to-r from-orange-200 via-orange-300 to-amber-200 bg-clip-text text-transparent select-none">
              404
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="px-4 py-1.5 rounded-full bg-white/90 border border-orange-200 shadow-md flex items-center gap-2 text-xs font-black text-[#f56b2a] uppercase tracking-wider backdrop-blur-sm">
                <Compass className="w-4 h-4 animate-spin" style={{ animationDuration: '10s' }} />
                Page introuvable
              </div>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-3">
            Oups ! Cet article ou cette page n&apos;existe pas
          </h1>
          <p className="text-sm sm:text-base text-gray-500 font-medium leading-relaxed max-w-md mx-auto mb-8">
            Le lien est peut-être expiré, ou le produit a été déplacé par la boutique. Retrouvez des milliers d&apos;autres articles disponibles immédiatement.
          </p>

          {/* Primary Action Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-[#f56b2a] to-[#ff7d3b] hover:from-[#e45a19] hover:to-[#f56b2a] text-white text-sm font-black rounded-2xl shadow-lg shadow-[#f56b2a]/30 hover:shadow-xl hover:shadow-[#f56b2a]/40 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Explorer le catalogue</span>
            </Link>
          </div>

          {/* Popular Categories Shortcut */}
          <div className="bg-white/80 rounded-3xl border border-gray-100 p-6 shadow-sm">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-4 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#f56b2a]" />
              Catégories populaires
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {popularCategories.map((cat) => {
                const IconComponent = cat.icon;
                return (
                  <Link
                    key={cat.name}
                    href={cat.href}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50/80 hover:bg-orange-50/60 border border-gray-100 hover:border-orange-200 text-gray-700 hover:text-[#f56b2a] transition-all group"
                  >
                    <IconComponent className="w-5 h-5 mb-1 text-gray-500 group-hover:text-[#f56b2a] group-hover:scale-110 transition-all" />
                    <span className="text-[11px] font-bold text-center leading-tight">
                      {cat.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 py-6 text-center text-xs font-semibold text-gray-400">
        © {new Date().getFullYear()} PosMarket. Tous droits réservés.
      </footer>
    </div>
  );
}
