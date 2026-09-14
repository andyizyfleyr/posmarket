import React from 'react';
import Link from 'next/link';
import { ShoppingBag, Home, Search, Package, ArrowRight } from 'lucide-react';

export default function ProductNotFound() {
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
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200/80 rounded-full shadow-sm transition-all"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Accueil</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-md mx-auto text-center">
          <div className="relative bg-white rounded-3xl border border-orange-100/90 shadow-[0_20px_50px_rgba(245,107,42,0.08)] p-8 sm:p-10 overflow-hidden">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-tr from-orange-50 to-orange-100/80 border border-orange-200/70 flex items-center justify-center text-[#f56b2a] shadow-inner">
              <Package className="w-9 h-9" />
            </div>

            <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-2">
              Produit introuvable
            </h1>
            <p className="text-sm text-gray-500 font-medium leading-relaxed max-w-xs mx-auto mb-8">
              Cet article a été retiré de la vente, est en rupture définitive, ou le lien est erroné.
            </p>

            <Link
              href="/"
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#f56b2a] to-[#ff7d3b] hover:from-[#e45a19] hover:to-[#f56b2a] text-white text-sm font-black rounded-2xl shadow-lg shadow-[#f56b2a]/30 hover:shadow-xl transition-all cursor-pointer"
            >
              <span>Découvrir les autres articles</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 py-6 text-center text-xs font-semibold text-gray-400">
        © {new Date().getFullYear()} PosMarket
      </footer>
    </div>
  );
}
