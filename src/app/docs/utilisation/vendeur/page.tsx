import type { Metadata } from "next";
import { Link } from "@/components/RouterPolyfill";
import {
  Store,
  User,
  CreditCard,
  Package,
  TerminalSquare,
  Users,
  FileText,
  Settings,
  BarChart,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Guide Vendeur — PosMarket",
  description: "Comment créer et gérer sa boutique sur PosMarket.",
};

const step =
  "w-7 h-7 shrink-0 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center shadow-md shadow-blue-100";

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
        <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">
          {number}
        </span>
        <h2 className="text-sm font-black text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Info({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium text-gray-500 bg-blue-50/60 rounded-xl p-3">
      {children}
    </div>
  );
}

export default function VendeurPage() {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
          <Store size={20} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
            Espace Vendeur
          </h1>
          <p className="text-xs font-medium text-gray-500">
            Créer votre boutique, vendre et gérer vos commandes.
          </p>
        </div>
      </div>

      {/* 1. Créer son compte */}
      <Section number={1} title="Créer son compte">
        <ol className="space-y-2">
          <li className="flex gap-3">
            <span className={step}>1</span>
            <p className="text-xs font-medium text-gray-700">
              Allez sur <strong>/login</strong> et cliquez « Créer un compte »
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>2</span>
            <p className="text-xs font-medium text-gray-700">
              Remplissez votre nom, e-mail et mot de passe
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>3</span>
            <p className="text-xs font-medium text-gray-700">
              Vous êtes redirigé vers la page d&apos;abonnement
            </p>
          </li>
        </ol>
        <Info>
          Aucun abonnement actif n&apos;est créé à l&apos;inscription : choisissez votre
          plan (Starter, Pro ou Entreprise) pour activer votre compte. Vous pouvez le
          changer à tout moment.
        </Info>
      </Section>

      {/* 2. Plans */}
      <Section number={2} title="Choisir son plan">
        <div className="grid md:grid-cols-3 gap-3">
          {[
            {
              name: "Starter",
              price: "25 000",
              per: "/mois",
              features: ["1 boutique", "50 produits", "POS uniquement"],
              highlight: false,
            },
            {
              name: "Pro",
              price: "40 000",
              per: "/mois",
              features: ["3 boutiques", "500 produits", "Boutique en ligne + rapports"],
              highlight: true,
            },
            {
              name: "Entreprise",
              price: "70 000",
              per: "/mois",
              features: ["Illimité", "Illimité", "Tout + reçus custom"],
              highlight: false,
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-4 text-center ${
                plan.highlight
                  ? "border-blue-300 bg-blue-50 ring-2 ring-blue-200/50"
                  : "border-gray-100 bg-gray-50"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest">
                  Populaire
                </span>
              )}
              <p className="text-xs font-black text-gray-900">{plan.name}</p>
              <p className="mt-1 text-xl font-black text-gray-900">
                {plan.price}{" "}
                <span className="text-[10px] font-bold text-gray-400">{plan.per}</span>
              </p>
              <ul className="mt-2 space-y-1 text-[10px] font-medium text-gray-600">
                {plan.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-[11px] font-medium text-gray-400">
          Prix en FCFA. Tarifs trimestriels et annuels disponibles. Seuls Pro et Entreprise
          ont une boutique en ligne visible par les acheteurs.
        </p>
      </Section>

      {/* 3. Créer sa boutique */}
      <Section number={3} title="Créer sa boutique">
        <ol className="space-y-2">
          <li className="flex gap-3">
            <span className={step}>1</span>
            <p className="text-xs font-medium text-gray-700">
              Dans la barre de navigation, cliquez « Nouvelle boutique »
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>2</span>
            <p className="text-xs font-medium text-gray-700">
              Entrez le nom de votre boutique
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>3</span>
            <p className="text-xs font-medium text-gray-700">
              Choisissez le type : <strong>Boutique</strong> (produits physiques) ou{" "}
              <strong>Restaurant</strong> (restauration)
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>4</span>
            <p className="text-xs font-medium text-gray-700">
              La boutique est créée. Un lien /slug est généré automatiquement
            </p>
          </li>
        </ol>
        <Info>
          Selon votre plan, vous pouvez avoir plusieurs boutiques (1 avec Starter, 3 avec Pro,
          illimité avec Entreprise).
        </Info>
      </Section>

      {/* 4. Produits */}
      <Section number={4} title="Ajouter et gérer vos produits">
        <p className="text-xs font-medium text-gray-700 mb-2">
          <strong>Pour ajouter un produit :</strong>
        </p>
        <ol className="space-y-2 mb-4">
          <li className="flex gap-3">
            <span className={step}>1</span>
            <p className="text-xs font-medium text-gray-700">
              Allez dans « Produits » et cliquez « Ajouter un produit »
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>2</span>
            <p className="text-xs font-medium text-gray-700">
              Remplissez : nom, description, prix (FCFA), stock, catégorie, photo
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>3</span>
            <p className="text-xs font-medium text-gray-700">
              Optionnel : variantes (taille, couleur), prix de gros, temps de livraison
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>4</span>
            <p className="text-xs font-medium text-gray-700">
              Activez ou désactivez la visibilité en ligne
            </p>
          </li>
        </ol>
        <p className="text-xs font-medium text-gray-700">
          <strong>Modifier :</strong> cliquez sur un produit, modifiez, enregistrez.
        </p>
        <p className="text-xs font-medium text-gray-700">
          <strong>Supprimer :</strong> icône poubelle, ou suppression en bloc avec la case à
          cocher.
        </p>
        <Info>
          Limite selon votre plan : 50 produits (Starter), 500 (Pro), illimité (Entreprise).
        </Info>
      </Section>

      {/* 5. Commandes */}
      <Section number={5} title="Gérer vos commandes">
        <p className="text-xs font-medium text-gray-700 mb-3">3 statuts possibles :</p>
        <div className="space-y-2">
          {[
            {
              status: "En attente",
              code: "PENDING",
              desc: "Nouvelle commande, pas encore traitée",
              color: "bg-yellow-100 text-yellow-700",
            },
            {
              status: "Prête",
              code: "READY",
              desc: "Commande préparée, prête pour retrait ou livraison",
              color: "bg-blue-100 text-blue-700",
            },
            {
              status: "Validée",
              code: "COMPLETED",
              desc: "Commande terminée",
              color: "bg-green-100 text-green-700",
            },
          ].map((s) => (
            <div key={s.code} className="flex items-center gap-3">
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${s.color}`}
              >
                {s.status}
              </span>
              <p className="text-[11px] font-medium text-gray-500">{s.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs font-medium text-gray-700 mt-2">
          Changez le statut en sélectionnant une commande. Vous pouvez aussi supprimer des
          commandes (seul ou en bloc).
        </p>
      </Section>

      {/* 6. POS */}
      <Section number={6} title="Point de Vente (caisse)">
        <p className="text-xs font-medium text-gray-700 mb-3">
          Le POS est une caisse pour vendre en magasin :
        </p>
        <ol className="space-y-2">
          <li className="flex gap-3">
            <span className={step}>1</span>
            <p className="text-xs font-medium text-gray-700">
              Recherchez un produit ou parcourez les catégories
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>2</span>
            <p className="text-xs font-medium text-gray-700">
              Ajoutez au panier, ajustez la quantité
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>3</span>
            <p className="text-xs font-medium text-gray-700">
              Sélectionnez un client (optionnel)
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>4</span>
            <p className="text-xs font-medium text-gray-700">
              Choisissez <strong>En magasin</strong> ou <strong>Click & Collect</strong>
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>5</span>
            <p className="text-xs font-medium text-gray-700">
              Cliquez « Payer » (espèces par défaut)
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>6</span>
            <p className="text-xs font-medium text-gray-700">
              Un reçu s&apos;affiche (impression ticket 80mm ou PDF)
            </p>
          </li>
        </ol>
      </Section>

      {/* 7. Les autres pages */}
      <Section number={7} title="Autres fonctionnalités">
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            {
              icon: Users,
              title: "Clients",
              desc: "Fichier trié par montant dépensé. Ajoutez, modifiez ou supprimez. Créés automatiquement à chaque commande.",
              route: "/customers",
            },
            {
              icon: FileText,
              title: "Factures",
              desc: "Créez des factures formelles (brouillon → payée). Impression PDF ou ticket 80mm. Plan Pro et Entreprise.",
              route: "/invoices",
            },
            {
              icon: Settings,
              title: "Paramètres",
              desc: "Logo, thème, codes promo, personnel (staff), création et suppression de boutiques.",
              route: "/settings",
            },
            {
              icon: BarChart,
              title: "Rapports",
              desc: "Chiffre d'affaires et revenus par période. Plan Pro et Entreprise uniquement.",
              route: "/reports",
            },
            {
              icon: LayoutDashboard,
              title: "Dashboard",
              desc: "Vue d'ensemble : produits, clients, commandes du jour, CA du mois.",
              route: "/dashboard",
            },
            {
              icon: CreditCard,
              title: "Abonnement",
              desc: "Changez de plan ou de durée à tout moment, effet immédiat.",
              route: "/subscription",
            },
          ].map((fn) => {
            const Icon = fn.icon;
            return (
              <div
                key={fn.title}
                className="flex items-start gap-3 rounded-2xl border border-gray-100 p-4"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-gray-900">{fn.title}</p>
                  <p className="text-[10px] font-medium text-gray-500 leading-snug mt-0.5">
                    {fn.desc}
                  </p>
                  <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider mt-1 inline-block">
                    {fn.route}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Nav */}
      <div className="flex justify-between pt-4 pb-4">
        <Link
          to="/docs/utilisation/acheteur"
          className="inline-flex items-center gap-2 text-xs font-black text-gray-400 hover:text-[#f56b2a] transition-colors"
        >
          Espace Acheteur
        </Link>
        <Link
          to="/docs/utilisation/fonctionnalites"
          className="inline-flex items-center gap-2 text-xs font-black text-[#f56b2a] hover:underline"
        >
          Fonctionnalités <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
