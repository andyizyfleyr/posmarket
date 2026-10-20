'use client';

import React from 'react';
import Image from 'next/image';
import { Link } from '@/components/RouterPolyfill';

export const MarketplaceFooter: React.FC<{ reserveCartBar?: boolean }> = ({
  reserveCartBar = true,
}) => {
  return (
    <footer className="bg-white border-t border-gray-100">
      <div
        className={`container mx-auto px-4 py-8 md:py-12 md:pb-12 ${
          reserveCartBar
            ? "pb-[calc(80px+env(safe-area-inset-bottom,0px))]"
            : "pb-[calc(24px+env(safe-area-inset-bottom,0px))]"
        }`}
      >
        <div className="max-w-xs">
          <Link
            to="/"
            className="flex items-center gap-2.5 w-fit group"
            aria-label="PosMarket - Retour à l'accueil"
          >
            <Image
              src="/logo-trimmed.png"
              alt="PosMarket - Local & Express"
              width={1767}
              height={401}
              className="h-8 w-auto group-hover:opacity-80 transition-opacity"
            />
          </Link>
          <p className="mt-3 text-sm font-normal text-gray-500 leading-relaxed">
            Place de marché reliant les vendeurs et les acheteurs.
          </p>
        </div>

        <div className="border-t border-gray-100 mt-8 pt-5 flex items-center justify-center">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">
            © {new Date().getFullYear()} PosMarket — Tous droits réservés
          </p>
        </div>
      </div>
    </footer>
  );
};
