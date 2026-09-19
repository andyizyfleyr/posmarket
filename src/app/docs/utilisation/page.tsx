import type { Metadata } from "next";
import { Link } from "@/components/RouterPolyfill";
import { ShoppingBag, Store, Sparkles, Wrench, ChevronRight, Rocket } from "lucide-react";

export const metadata: Metadata = {
  title: "Guide d'utilisation — PosMarket",
  description: "Guide d'utilisation de PosMarket pour les acheteurs et les vendeurs.",
};

const cards = [
  {
    href: "/docs/utilisation/acheteur",
    icon: ShoppingBag,
    color: "bg-orange-50 text-[#f56b2a] border-orange-100",
    hoverBorder: "hover:border-orange-300",
    title: "Espace Acheteur",
    desc: "Rechercher, ajouter au panier, passer commande, gérer votre compte et vos adresses.",
  },
  {
    href: "/docs/utilisation/vendeur",
    icon: Store,
    color: "bg-blue-50 text-blue-600 border-blue-100",
    hoverBorder: "hover:border-blue-300",
    title: "Espace Vendeur",
    desc: "Créer votre boutique, gérer les produits, les commandes et les clients.",
  },
  {
    href: "/docs/utilisation/fonctionnalites",
    icon: Sparkles,
    color: "bg-indigo-50 text-indigo-600 border-indigo-100",
    hoverBorder: "hover:border-indigo-300",
    title: "Fonctionnalités",
    desc: "Notifications, paiement, application mobile, bonnes pratiques.",
  },
  {
    href: "/docs/utilisation/problemes",
    icon: Wrench,
    color: "bg-red-50 text-red-600 border-red-100",
    hoverBorder: "hover:border-red-300",
    title: "Problèmes fréquents",
    desc: "Messages d'erreur courants et comment les résoudre.",
  },
];

export default function DocsHubPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#002f34] via-[#00463f] to-[#f56b2a] text-white p-8 md:p-10">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #fff 0, transparent 40%)" }} />
        <div className="relative flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center shrink-0">
            <Rocket size={26} className="text-orange-300" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Guide d&apos;utilisation</h1>
            <p className="mt-1 text-sm font-normal text-white/70">
              Tout savoir sur PosMarket : acheter et vendre en toute confiance.
            </p>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              to={card.href}
              className={`group flex items-start gap-4 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${card.hoverBorder}`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${card.color} transition-transform group-hover:scale-110`}>
                <Icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-gray-900">{card.title}</h2>
                <p className="text-[11px] font-normal text-gray-500 leading-relaxed mt-1">{card.desc}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 shrink-0 mt-1 group-hover:text-gray-500 transition-colors" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
