'use client';

import React from 'react';
import { ShoppingBasketIcon, ShieldCheck, MapPin } from 'lucide-react';
import { Link } from '@/components/RouterPolyfill';

const footerNav = [
  { label: 'Conditions Générales de Vente', href: '/cgv' },
  { label: 'Politique de confidentialité', href: '/confidentialite' },
];

export const MarketplaceFooter: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-100 mt-12">
      <div className="container mx-auto px-4 py-8 md:py-12 pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-12">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          {/* Marque */}
          <div className="max-w-xs">
            <Link
              to="/"
              className="flex items-center gap-2.5 w-fit group"
              aria-label="PosMarket - Retour à l'accueil"
            >
              <div className="w-9 h-9 bg-[#f56b2a] rounded-xl flex items-center justify-center shadow-md shadow-orange-100 group-hover:scale-110 transition-transform">
                <ShoppingBasketIcon size={20} className="text-white" />
              </div>
              <span className="text-lg font-black tracking-tight text-gray-900">
                Pos<span className="text-[#f56b2a]">Market</span>
              </span>
            </Link>
            <p className="mt-3 text-[11px] font-medium text-gray-500 leading-relaxed">
              La marketplace express qui connecte les commerçants locaux et les
              acheteurs. Achetez et vendez en toute confiance.
            </p>
          </div>

          {/* Navigation légale */}
          <nav aria-label="Liens légaux">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Légal
            </h3>
            <ul className="space-y-2">
              {footerNav.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className="text-xs font-bold text-gray-600 hover:text-[#f56b2a] transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Confiance */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Nos engagements
            </h3>
            <ul className="space-y-2 text-xs font-bold text-gray-600">
              <li className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-green-500 flex-shrink-0" />
                Paiement sécurisé
              </li>
              <li className="flex items-center gap-2">
                <MapPin size={14} className="text-[#f56b2a] flex-shrink-0" />
                Commerçants locaux vérifiés
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 mt-8 pt-5 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            © {new Date().getFullYear()} PosMarket — Tous droits réservés
          </p>
          <p className="text-[10px] font-medium text-gray-400">
            Prix affichés en FCFA (XOF)
          </p>
        </div>
      </div>
    </footer>
  );
};
