import type { Metadata } from "next";
import { Link } from "@/components/RouterPolyfill";

export const metadata: Metadata = {
  title: "Conditions Générales de Vente",
  description:
    "Conditions Générales de Vente de la marketplace PosMarket : commandes, prix en FCFA, paiements, livraisons, retours.",
};

export default function CgvPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto max-w-3xl px-4 py-10 md:py-16">
        <Link
          to="/"
          className="text-xs font-black uppercase tracking-wider text-[#f56b2a] hover:underline"
        >
          ← Retour à l&apos;accueil
        </Link>

        <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight mt-6 mb-2">
          Conditions Générales de Vente
        </h1>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-10">
          Dernière mise à jour : août 2026
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 md:p-10 space-y-8 text-sm font-medium text-gray-700 leading-relaxed [&_h2]:text-base [&_h2]:font-black [&_h2]:text-gray-900 [&_h2]:pt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
          <section className="space-y-3">
            <h2>1. Objet</h2>
            <p>
              Les présentes Conditions Générales de Vente (CGV) régissent
              l&apos;utilisation de la plateforme PosMarket, marketplace qui
              met en relation des commerçants indépendants (« Vendeurs ») et
              des acheteurs (« Clients »). PosMarket agit en qualité
              d&apos;intermédiaire technique : les contrats de vente sont
              conclus directement entre le Client et le Vendeur concerné.
            </p>
          </section>

          <section className="space-y-3">
            <h2>2. Commandes</h2>
            <p>
              Toute commande passée via PosMarket implique l&apos;acceptation
              sans réserve des présentes CGV. Le Client s&apos;engage à fournir
              des informations exactes (nom, téléphone, adresse de livraison).
              La confirmation de la commande est envoyée au Vendeur, qui se
              réserve le droit de refuser une commande en cas de rupture de
              stock ou d&apos;indisponibilité.
            </p>
          </section>

          <section className="space-y-3">
            <h2>3. Prix et paiement</h2>
            <ul>
              <li>
                Les prix sont affichés en franc CFA (FCFA — XOF), toutes taxes
                comprises lorsqu&apos;elles s&apos;appliquent.
              </li>
              <li>
                Le paiement peut être effectué à la livraison (espèces) ou en
                ligne via un prestataire de paiement mobile sécurisé.
              </li>
              <li>
                En cas de paiement en ligne, les fonds sont transmis au
                Vendeur après validation de la commande par ce dernier.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2>4. Livraison</h2>
            <p>
              Les délais et frais de livraison sont définis par chaque
              Vendeur et affichés avant validation de la commande. Le Client
              est informé que les délais annoncés sont indicatifs. En cas de
              retard important, le Client peut contacter le Vendeur via les
              coordonnées figurant sur sa boutique PosMarket.
            </p>
          </section>

          <section className="space-y-3">
            <h2>5. Droit de rétractation et retours</h2>
            <p>
              Conformément à la réglementation applicable, le Client dispose
              d&apos;un délai pour se rétracter après réception de sa
              commande, sauf pour les produits périssables (notamment
              alimentaires). Les produits doivent être retournés neufs, non
              utilisés et dans leur emballage d&apos;origine. Les frais de
              retour sont à la charge du Client sauf produit défectueux ou
              erreur du Vendeur.
            </p>
          </section>

          <section className="space-y-3">
            <h2>6. Responsabilité</h2>
            <p>
              Chaque Vendeur est seul responsable de la conformité, de la
              qualité et de la légalité des produits qu&apos;il propose.
              PosMarket met en œuvre les moyens raisonnables pour garantir la
              fiabilité de la plateforme mais ne saurait être tenu responsable
              des litiges commerciaux entre Clients et Vendeurs.
            </p>
          </section>

          <section className="space-y-3">
            <h2>7. Compte du Client</h2>
            <p>
              La création d&apos;un compte est nécessaire pour finaliser une
              commande. Le Client est responsable de la confidentialité de ses
              identifiants et s&apos;engage à ne pas utiliser la plateforme à
              des fins frauduleuses.
            </p>
          </section>

          <section className="space-y-3">
            <h2>8. Droit applicable</h2>
            <p>
              Les présentes CGV sont soumises au droit applicable au siège de
              PosMarket. Tout litige sera soumis aux tribunaux compétents
              après tentative de résolution amiable.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
