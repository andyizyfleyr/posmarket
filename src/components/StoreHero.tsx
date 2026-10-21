'use client';

import Image from "next/image";
import { MapPin, MessageCircle, ShieldCheck, Star, Store } from "lucide-react";
import { needsNoOptimization } from "@/lib/imageOptimizer";
import { formatNumber, formatRating } from "@/utils";
import type { StoreData } from "@/types";

interface StoreHeroProps {
  store: StoreData;
  /** Produits en ligne (avec image). */
  productCount: number;
  /** Visiteurs cumulés (boutique + produits). */
  visitorsCount: number;
  /** Nombre d'avis de la boutique. */
  reviewCount: number;
}

/**
 * En-tête de boutique — même composition que l'app mobile : couverture en
 * dégradé, logo qui chevauche, nom vérifié, note, adresse, description,
 * contact WhatsApp et bandeau de statistiques.
 */
export function StoreHero({
  store,
  productCount,
  visitorsCount,
  reviewCount,
}: StoreHeroProps) {
  const name = store.settings?.name || store.name || "Boutique";
  const address = store.address || (store.settings?.address as string) || "";
  const description =
    store.description || (store.settings?.description as string) || "";
  const phone = store.phone || (store.settings?.phone as string) || "";
  const waDigits = phone.replace(/[^0-9]/g, "");
  const logo = store.settings?.logo;
  const rating = store.rating ?? 0;

  const waUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
        `Bonjour ${name}, je vous contacte depuis PosMarket.`,
      )}`
    : null;

  return (
    <section className="mb-6 md:mb-8 overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm">
      {/* Couverture */}
      <div
        className="h-24 w-full md:h-32"
        style={{
          background:
            "linear-gradient(90deg, #F56B2A 0%, #FF8A50 50%, #FFB26B 100%)",
        }}
      />

      <div className="-mt-9 px-4 pb-4 md:-mt-11 md:px-6 md:pb-6">
        {/* Logo (chevauche la couverture) */}
        <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md">
          {logo ? (
            <Image
              src={logo}
              alt={name}
              fill
              sizes="72px"
              className="object-cover"
              unoptimized={needsNoOptimization(logo)}
            />
          ) : (
            <Store className="text-brand" size={26} />
          )}
        </div>

        {/* Nom + verification */}
        <div className="mt-2 flex items-start gap-1.5">
          <h1 className="text-xl font-extrabold leading-tight tracking-tight text-gray-900 md:text-2xl">
            {name}
          </h1>
          <ShieldCheck size={16} strokeWidth={3} className="mt-0.5 flex-shrink-0 text-green-500" />
        </div>

        {/* Note + produits en ligne */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <Star size={11} className="fill-yellow-400 text-yellow-400" />
            <span className="font-bold text-gray-700">
              {formatRating(rating)}
            </span>
            <span className="text-gray-500">({formatNumber(reviewCount)} avis)</span>
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">{productCount} produits en ligne</span>
        </div>

        {/* Adresse */}
        {address ? (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500">
            <MapPin size={11} className="flex-shrink-0 text-brand/70" />
            <span className="truncate">{address}</span>
          </div>
        ) : null}

        {/* Description */}
        {description ? (
          <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-gray-600">
            {description}
          </p>
        ) : null}

        {/* Contact */}
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-[12px] font-bold text-green-700 transition-colors hover:bg-green-500 hover:text-white"
          >
            <MessageCircle size={14} strokeWidth={2.5} />
            Contacter sur WhatsApp
          </a>
        ) : null}
      </div>

      {/* Bandeau de statistiques */}
      <div className="grid grid-cols-3 border-t border-gray-100 bg-gray-50/60">
        {[
          { value: formatNumber(productCount), label: "Produits" },
          { value: formatNumber(visitorsCount), label: "Visiteurs" },
          { value: `${formatRating(rating)}/5`, label: "Note" },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={`px-2 py-3 text-center ${index < 2 ? "border-r border-gray-200/70" : ""}`}
          >
            <p className="text-sm font-extrabold tabular-nums text-gray-900">
              {stat.value}
            </p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default StoreHero;
