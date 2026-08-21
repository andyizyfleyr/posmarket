import type { Metadata } from "next";
import { Link } from "@/components/RouterPolyfill";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité de PosMarket : données collectées, utilisation, partage avec les vendeurs, sécurité et vos droits.",
};

export default function ConfidentialitePage() {
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
          Politique de confidentialité
        </h1>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-10">
          Dernière mise à jour : août 2026
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 md:p-10 space-y-8 text-sm font-medium text-gray-700 leading-relaxed [&_h2]:text-base [&_h2]:font-black [&_h2]:text-gray-900 [&_h2]:pt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
          <section className="space-y-3">
            <h2>1. Données collectées</h2>
            <p>
              Dans le cadre de l&apos;utilisation de PosMarket, nous
              collectons uniquement les données nécessaires :
            </p>
            <ul>
              <li>
                <strong>Données de compte :</strong> nom, adresse e-mail,
                numéro de téléphone.
              </li>
              <li>
                <strong>Données de commande :</strong> articles commandés,
                adresse de livraison, historique d&apos;achats.
              </li>
              <li>
                <strong>Données techniques :</strong> type d&apos;appareil,
                préférences locales (panier), mesures de performance.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2>2. Utilisation des données</h2>
            <ul>
              <li>Traiter et suivre vos commandes auprès des Vendeurs.</li>
              <li>Vous permettre de gérer votre compte et vos achats.</li>
              <li>Améliorer la performance et la sécurité de la plateforme.</li>
              <li>
                Vous envoyer des notifications liées à vos commandes (aucune
                prospection sans votre consentement).
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2>3. Partage des données</h2>
            <p>
              Vos informations de commande (nom, téléphone, adresse) sont
              transmises au Vendeur concerné afin de permettre la livraison.
              Nous ne vendons jamais vos données personnelles à des tiers.
              Les prestataires techniques (hébergement, paiement mobile)
              traitent certaines données dans le strict cadre de leurs
              missions.
            </p>
          </section>

          <section className="space-y-3">
            <h2>4. Conservation</h2>
            <p>
              Les données de compte sont conservées tant que votre compte est
              actif. Les données de commande sont conservées pour la durée
              légale applicable (obligations comptables et fiscales), puis
              supprimées ou anonymisées.
            </p>
          </section>

          <section className="space-y-3">
            <h2>5. Sécurité</h2>
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles
              (chiffrement des communications, contrôle d&apos;accès,
              authentification sécurisée) pour protéger vos données contre tout
              accès non autorisé.
            </p>
          </section>

          <section className="space-y-3">
            <h2>6. Vos droits</h2>
            <p>
              Vous disposez d&apos;un droit d&apos;accès, de rectification et
              de suppression de vos données personnelles. Pour l&apos;exercer,
              contactez-nous via les coordonnées disponibles sur la plateforme.
              Nous répondons à toute demande dans un délai raisonnable.
            </p>
          </section>

          <section className="space-y-3">
            <h2>7. Cookies et stockage local</h2>
            <p>
              PosMarket utilise le stockage local de votre navigateur
              uniquement à des fins fonctionnels : conservation de votre
              panier et accélération de l&apos;affichage du catalogue. Aucun
              cookie publicitaire n&apos;est déposé sans votre consentement.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
