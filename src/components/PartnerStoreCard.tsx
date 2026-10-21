'use client';

import Image from "next/image";
import { BadgeCheck, Check, ChevronRight, MapPin } from "lucide-react";
import { needsNoOptimization } from "@/lib/imageOptimizer";
import { COUNTRIES } from "@/constants/countries";
import { formatNumber, formatRating } from "@/utils";
import type { StoreData } from "@/types";

export interface PartnerStoreStats {
  /** Ventes cumulées des produits en ligne. */
  salesCount: number;
  /** Visites cumulées (boutique + produits). */
  viewsCount: number;
}

interface PartnerStoreCardProps {
  store: StoreData;
  stats: PartnerStoreStats;
  onOpen: (store: StoreData) => void;
}

/**
 * Le pays est stocké par nom (sélecteur vendeur), mais on tolère un code.
 */
export function resolveCountryName(value?: string | null): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const normalized = raw.toLowerCase();
  const match = COUNTRIES.find(
    (country) =>
      country.name.toLowerCase() === normalized ||
      country.code.toLowerCase() === normalized,
  );
  return match?.name || raw;
}

/**
 * Carte « boutique partenaire » — portage web de la carte mobile.
 *
 * Composition : couverture en dégradé avec badge « Vérifié », logo qui
 * chevauche la couverture avec sa pastille de validation, nom, pays puis
 * ligne de statistiques (note + avis, ventes, vues) sur une seule ligne.
 */
export function PartnerStoreCard({ store, stats, onOpen }: PartnerStoreCardProps) {
  const name = store.settings?.name || store.name || "Boutique";
  const rating = store.rating ?? 0;
  const reviewCount = store.reviewCount ?? 0;
  const initials = name.trim().slice(0, 2).toUpperCase();
  const country = resolveCountryName(store.settings?.country);
  const logo = store.settings?.logo;

  // Ordre de lecture : note + avis, puis ventes, puis vues. Les stats à zéro
  // sont masquées et le séparateur ne se place qu'entre deux blocs réellement
  // affichés.
  const statNodes: React.ReactNode[] = [];
  const addSeparator = () => {
    if (statNodes.length > 0) {
      statNodes.push(
        <span key={`separator-${statNodes.length}`} className="text-[#D1D5DB]">
          {" | "}
        </span>,
      );
    }
  };

  addSeparator();
  statNodes.push(
    rating > 0 ? (
      <span key="rating">
        <span className="font-bold text-brand">★ </span>
        <span className="font-bold text-gray-900">{formatRating(rating)}</span>
        {reviewCount > 0 ? (
          <span className="font-semibold text-gray-500">
            {" "}({formatNumber(reviewCount)} avis)
          </span>
        ) : null}
      </span>
    ) : (
      <span key="new" className="font-bold text-brand">
        Nouveau
      </span>
    ),
  );

  if (stats.salesCount > 0) {
    addSeparator();
    statNodes.push(
      <span key="sales">
        <span className="font-bold text-gray-900">{formatNumber(stats.salesCount)}</span>{" "}
        <span className="font-semibold text-gray-500">
          {stats.salesCount > 1 ? "ventes" : "vente"}
        </span>
      </span>,
    );
  }

  if (stats.viewsCount > 0) {
    addSeparator();
    statNodes.push(
      <span key="views">
        <span className="font-bold text-gray-900">{formatNumber(stats.viewsCount)}</span>{" "}
        <span className="font-semibold text-gray-500">
          {stats.viewsCount > 1 ? "vues" : "vue"}
        </span>
      </span>,
    );
  }

  return (
    <div
      onClick={() => onOpen(store)}
      role="button"
      tabIndex={0}
      aria-label={`Voir la boutique ${name}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(store);
        }
      }}
      className="group w-[calc((100vw-44px)/2+18px)] max-w-[228px] shrink-0 cursor-pointer overflow-hidden rounded-[18px] border border-[#F0F1F3] bg-white shadow-[0_4px_10px_rgba(17,24,39,0.07)] transition-all hover:border-brand/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand/60 active:scale-[0.98] active:border-brand/40 active:opacity-95"
    >
      {/* Couverture + badge « Vérifié » */}
      <div className="relative h-11 overflow-hidden bg-gradient-to-br from-[#FFF6F0] to-[#FFE3D3]">
        <span className="absolute -right-6 -top-8 h-[76px] w-[76px] rounded-full bg-[rgba(245,107,42,0.10)]" />
        <span className="absolute bottom-[-22px] left-[30px] h-9 w-9 rounded-full bg-[rgba(255,255,255,0.55)]" />
        <span className="absolute right-2.5 top-2 inline-flex shrink-0 items-center gap-[3px] rounded-full bg-[rgba(255,255,255,0.78)] px-1.5 py-[3px]">
          <span className="text-[7.5px] font-bold tracking-[0.15px] text-[#22C55E]">
            Vérifié
          </span>
          <BadgeCheck size={9} strokeWidth={2.5} className="text-[#22C55E]" />
        </span>
      </div>

      {/* Logo, nom, pays, stats */}
      <div className="px-3 pb-2.5">
        <div className="relative -mt-[21px] h-[42px] w-[42px]">
          <div className="relative flex h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-full border-2 border-white bg-brand-soft shadow-[0_2px_5px_rgba(17,24,39,0.12)]">
            {logo ? (
              <Image
                src={logo}
                alt={name}
                fill
                sizes="42px"
                className="object-cover"
                unoptimized={needsNoOptimization(logo)}
              />
            ) : (
              <span className="text-[13px] font-extrabold tracking-[-0.4px] text-brand">
                {initials}
              </span>
            )}
          </div>
          <span className="absolute -bottom-px -right-px flex h-[15px] w-[15px] items-center justify-center rounded-full border-2 border-white bg-[#1877F2]">
            <Check size={7} strokeWidth={4} className="text-white" />
          </span>
        </div>

        <div className="mt-1.5 flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold tracking-[-0.2px] text-gray-900 transition-colors group-hover:text-brand">
            {name}
          </span>
          <ChevronRight size={12} strokeWidth={2.5} className="flex-shrink-0 text-[#C4C8CE]" />
        </div>

        <div className="mt-0.5 flex items-center gap-[3px]">
          <MapPin
            size={9.5}
            strokeWidth={2.5}
            className={country ? "flex-shrink-0 text-brand" : "flex-shrink-0 text-gray-300"}
          />
          <span
            className={`truncate text-[9.5px] font-semibold ${
              country ? "text-gray-600" : "font-medium text-gray-300"
            }`}
          >
            {country || "Non défini"}
          </span>
        </div>

        <div className="mt-[3px] truncate text-[8.5px] font-semibold tracking-[-0.1px] text-gray-500 md:text-[9px]">
          {statNodes}
        </div>
      </div>
    </div>
  );
}

export default PartnerStoreCard;
