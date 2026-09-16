import type { Metadata } from "next";
import { Link } from "@/components/RouterPolyfill";
import {
  Sparkles,
  User,
  BellRing,
  ImageIcon,
  Download,
  ShieldCheck,
  Search,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Fonctionnalités — PosMarket",
  description: "Notifications, paiement, application mobile, bonnes pratiques.",
};

const features = [
  {
    icon: User,
    title: "Comptes séparés",
    desc: "Votre compte acheteur et votre compte vendeur sont totalement indépendants. Vos données d'achat restent séparées de vos données de vente.",
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    icon: BellRing,
    title: "Notifications push",
    desc: "Vendeurs : recevez une alerte pour chaque nouvelle commande, stock bas, nouveau avis ou abonnement bientôt expiré. Acheteurs : recevez les promotions par notification web.",
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    icon: ImageIcon,
    title: "Photos de bonne qualité",
    desc: "Les images sont automatiquement compressées (format WebP, max 800 Ko) pour que votre boutique reste rapide même sur connexion lente.",
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    icon: Download,
    title: "Application sur téléphone",
    desc: "Installez PosMarket sur votre téléphone comme une application. Même sans connexion internet, votre panier est conservé et vous pouvez reprendre vos achats.",
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    icon: ShieldCheck,
    title: "Paiement protégé",
    desc: "Paiement à la livraison (espèces), simple et sécurisé. Vous ne payez jamais avant d'avoir reçu votre commande.",
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    icon: Search,
    title: "Moteur de recherche intelligent",
    desc: "Recherche en français, sans accents, qui comprend les fautes d'orthographe. Les produits les plus vendus et les mieux notés remontent en premier.",
    color: "bg-indigo-50 text-indigo-600",
  },
];

export default function FonctionnalitesPage() {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
          <Sparkles size={20} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
            Fonctionnalités
          </h1>
          <p className="text-xs font-medium text-gray-500">
            Les bonnes choses à savoir pour bien utiliser PosMarket.
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-3">
        {features.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="flex items-start gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6"
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${item.color}`}
              >
                <Icon size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-gray-900">{item.title}</h2>
                <p className="text-[11px] font-medium text-gray-500 leading-relaxed mt-1">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Nav */}
      <div className="flex justify-between pt-4 pb-4">
        <Link
          to="/docs/utilisation/vendeur"
          className="inline-flex items-center gap-2 text-xs font-black text-gray-400 hover:text-[#f56b2a] transition-colors"
        >
          Espace Vendeur
        </Link>
        <Link
          to="/docs/utilisation/problemes"
          className="inline-flex items-center gap-2 text-xs font-black text-[#f56b2a] hover:underline"
        >
          Problèmes fréquents <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
