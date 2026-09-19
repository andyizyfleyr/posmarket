import type { Metadata } from "next";
import { Link } from "@/components/RouterPolyfill";
import {
  ShoppingBag,
  Search,
  ShoppingCart,
  CreditCard,
  User,
  MapPin,
  Star,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Guide Acheteur — PosMarket",
  description: "Comment acheter sur PosMarket : recherche, panier, commande, compte.",
};

const step =
  "w-7 h-7 shrink-0 rounded-full bg-[#f56b2a] text-white text-xs font-bold flex items-center justify-center shadow-md shadow-orange-100";

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6 space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-xl bg-orange-50 text-[#f56b2a] text-xs font-bold flex items-center justify-center">
          {number}
        </span>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Info({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-normal text-gray-500 bg-orange-50/60 rounded-xl p-3">
      {children}
    </div>
  );
}

export default function AcheteurPage() {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-orange-100 text-[#f56b2a] flex items-center justify-center">
          <ShoppingBag size={20} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
            Espace Acheteur
          </h1>
          <p className="text-xs font-normal text-gray-500">
            Acheter sur la marketplace, pas de compte obligatoire pour regarder.
          </p>
        </div>
      </div>

      {/* 1. Parcours */}
      <Section number={1} title="Le parcours d'achat">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: ShoppingBag, label: "Accueil", desc: "Voir les boutiques" },
            { icon: Search, label: "Recherche", desc: "Trouver un produit" },
            { icon: ShoppingCart, label: "Panier", desc: "Vérifier la commande" },
            { icon: CreditCard, label: "Paiement", desc: "Espèces ou carte" },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="relative bg-gray-50 rounded-2xl p-4 text-center">
                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-[#f56b2a] text-white text-[10px] font-bold flex items-center justify-center shadow-md shadow-orange-100">
                  {i + 1}
                </div>
                <div className="inline-flex w-10 h-10 rounded-2xl bg-orange-100 text-[#f56b2a] items-center justify-center mb-2">
                  <Icon size={18} />
                </div>
                <p className="text-xs font-bold text-gray-900">{s.label}</p>
                <p className="text-[10px] font-normal text-gray-400">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* 2. Recherche */}
      <Section number={2} title="Rechercher un produit">
        <ol className="space-y-2">
          <li className="flex gap-3">
            <span className={step}>1</span>
            <p className="text-xs font-normal text-gray-700">
              Cliquez sur la barre de recherche en haut de la page
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>2</span>
            <p className="text-xs font-normal text-gray-700">
              Tapez un mot-clé (ex: « crème visage », « tissu wax »)
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>3</span>
            <p className="text-xs font-normal text-gray-700">
              Des suggestions apparaissent pendant que vous tapez
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>4</span>
            <p className="text-xs font-normal text-gray-700">
              Cliquez sur un résultat ou appuyez sur Entrée
            </p>
          </li>
        </ol>
        <Info>
          La recherche est en français, sans accents, et fonctionne même avec des fautes
          d&apos;orthographe.
        </Info>
      </Section>

      {/* 3. Catégories */}
      <Section number={3} title="Parcourir par catégorie">
        <p className="text-xs font-normal text-gray-700 mb-3">
          13 catégories sont disponibles :
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[
            "Cosmétique & Emballage",
            "Électronique",
            "Mode & Accessoires",
            "Épicerie",
            "Restauration",
            "Mobilier",
            "Beauté / Santé",
            "Auto & Moto",
            "Sport & Loisirs",
            "Bricolage",
            "Livres & Papeterie",
            "Jouets",
            "Divers",
          ].map((cat) => (
            <span
              key={cat}
              className="px-2.5 py-1 rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600"
            >
              {cat}
            </span>
          ))}
        </div>
        <p className="text-xs font-normal text-gray-500 mt-3">
          Tous les prix sont en{" "}
          <strong className="text-orange-600">FCFA (XOF)</strong>.
        </p>
      </Section>

      {/* 4. Fiche produit */}
      <Section number={4} title="Voir un produit en détail">
        <p className="text-xs font-normal text-gray-700 mb-3">
          En cliquant sur un produit, vous trouvez :
        </p>
        <ul className="space-y-1.5">
          {[
            "Les photos du produit (plusieurs images possibles)",
            "Le prix unitaire",
            "Les remises en gros si vous achetez en grande quantité",
            "Les options : taille, couleur, tailleur…",
            "Le temps de livraison estimé",
            "Les avis clients avec étoiles (1 à 5)",
          ].map((item) => (
            <li
              key={item}
              className="flex gap-2 text-xs font-normal text-gray-700"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </Section>

      {/* 5. Panier */}
      <Section number={5} title="Gérer son panier">
        <ol className="space-y-2">
          <li className="flex gap-3">
            <span className={step}>1</span>
            <p className="text-xs font-normal text-gray-700">
              Ajoutez un produit avec « Ajouter au panier »
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>2</span>
            <p className="text-xs font-normal text-gray-700">
              Ouvrez le panier (icône en bas sur mobile, en haut sur ordinateur)
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>3</span>
            <p className="text-xs font-normal text-gray-700">
              Modifiez les quantités (+ et -) ou supprimez des articles
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>4</span>
            <p className="text-xs font-normal text-gray-700">
              Vous pouvez entrer un <strong>code promo</strong> pour obtenir une remise
            </p>
          </li>
        </ol>
        <Info>
          Certains produits ont un minimum de commande. Si le montant est insuffisant, un
          message vous le signale.
        </Info>
      </Section>

      {/* 6. Commander */}
      <Section number={6} title="Passer commande">
        <p className="text-xs font-normal text-gray-700 mb-3">
          La commande se fait en <strong>3 étapes</strong> :
        </p>
        <div className="space-y-4">
          <div className="flex gap-3">
            <span className={step}>1</span>
            <div>
              <p className="text-xs font-bold text-gray-900">Panier</p>
              <p className="text-[11px] font-normal text-gray-500 mt-0.5">
                Vérifiez vos articles et vos prix. Cliquez sur « Commander ».
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className={step}>2</span>
            <div>
              <p className="text-xs font-bold text-gray-900">Livraison</p>
              <p className="text-[11px] font-normal text-gray-500 mt-0.5">
                Renseignez votre nom, téléphone et adresse. Une adresse enregistrée est
                pré-remplie.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className={step}>3</span>
            <div>
              <p className="text-xs font-bold text-gray-900">Paiement</p>
              <p className="text-[11px] font-normal text-gray-500 mt-0.5">
                Choisissez <strong>Espèces à la livraison</strong>.
              </p>
            </div>
          </div>
        </div>
        <Info>
          Les commandes multi-boutiques sont groupées. Après validation, un récapitulatif
          s&apos;affiche et la commande apparaît dans « Mes commandes ».
        </Info>
      </Section>

      {/* 7. Mon Compte */}
      <Section number={7} title="Mon Compte">
        <p className="text-xs font-normal text-gray-700 mb-4">
          Cliquez sur « Mon compte » en bas de l&apos;écran. 4 onglets :
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            {
              icon: ShoppingBag,
              label: "Commandes",
              desc: "Historique de toutes vos commandes avec leur statut.",
            },
            {
              icon: MapPin,
              label: "Adresses",
              desc: "Ajoutez, modifiez ou supprimez vos adresses de livraison.",
            },
            {
              icon: Star,
              label: "Avis",
              desc: "Vos avis laissés sur les produits.",
            },
            {
              icon: User,
              label: "Profil",
              desc: "Nom et téléphone modifiables. Déconnexion.",
            },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <div
                key={tab.label}
                className="flex items-start gap-3 rounded-2xl border border-gray-100 p-4"
              >
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#f56b2a] flex items-center justify-center shrink-0">
                  <Icon size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">{tab.label}</p>
                  <p className="text-[10px] font-normal text-gray-500 leading-snug mt-0.5">
                    {tab.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Nav */}
      <div className="flex justify-between pt-4 pb-4">
        <Link
          to="/docs/utilisation"
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-[#f56b2a] transition-colors"
        >
          Accueil du guide
        </Link>
        <Link
          to="/docs/utilisation/vendeur"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#f56b2a] hover:underline"
        >
          Espace Vendeur <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
