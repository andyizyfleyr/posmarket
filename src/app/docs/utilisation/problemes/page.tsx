import type { Metadata } from "next";
import { Link } from "@/components/RouterPolyfill";
import { Wrench, User, ShoppingCart, Package, Store, CreditCard, ImageIcon, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Problèmes fréquents — PosMarket",
  description: "Les erreurs les plus courantes sur PosMarket et comment les résoudre.",
};

const problems = [
  {
    icon: User,
    problem: "« Session expirée »",
    solution: "Votre connexion a expiré. Cliquez sur « Mon compte » en bas de l'écran et reconnectez-vous avec votre e-mail et mot de passe.",
    who: "Acheteur & Vendeur",
  },
  {
    icon: ShoppingCart,
    problem: "« Minimum de commande requis »",
    solution: "La boutique que vous achetez exige un montant minimum. Ajoutez plus d'articles de cette boutique dans votre panier.",
    who: "Acheteur",
  },
  {
    icon: Package,
    problem: "« Limite de produits atteinte »",
    solution: "Vous avez atteint le nombre maximum de produits autorisé par votre plan. Passez à un plan supérieur (Starter → Pro → Entreprise).",
    who: "Vendeur",
  },
  {
    icon: Store,
    problem: "« Limite de boutiques atteinte »",
    solution: "Vous ne pouvez pas créer de nouvelle boutique avec votre plan actuel. Passez à un plan supérieur ou supprimez une boutique existante.",
    who: "Vendeur",
  },
  {
    icon: CreditCard,
    problem: "Le paiement par carte bancaire échoue",
    solution: "Vérifiez que votre carte est bien activée pour les paiements en ligne. Vous pouvez aussi choisir le paiement à la livraison (espèces).",
    who: "Acheteur",
  },
  {
    icon: ImageIcon,
    problem: "Une photo de produit ne s'affiche pas",
    solution: "Essayez de recharger la page. Si le problème persiste, le vendeur peut modifier la photo depuis son backoffice.",
    who: "Acheteur & Vendeur",
  },
];

export default function ProblemesPage() {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
          <Wrench size={20} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
            Problèmes fréquents
          </h1>
          <p className="text-xs font-normal text-gray-500">
            Les messages d&apos;erreur les plus courants et comment les résoudre.
          </p>
        </div>
      </div>

      {/* Problems */}
      <div className="space-y-3">
        {problems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.problem}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{item.problem}</p>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-gray-100 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                    {item.who}
                  </span>
                </div>
              </div>
              <p className="text-xs font-normal text-gray-600 leading-relaxed pl-12">
                {item.solution}
              </p>
            </div>
          );
        })}
      </div>

      {/* Nav */}
      <div className="flex justify-between pt-4 pb-4">
        <Link
          to="/docs/utilisation/fonctionnalites"
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-[#f56b2a] transition-colors"
        >
          Fonctionnalités
        </Link>
        <Link
          to="/docs/utilisation"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#f56b2a] hover:underline"
        >
          Retour à l&apos;accueil du guide
        </Link>
      </div>
    </div>
  );
}
