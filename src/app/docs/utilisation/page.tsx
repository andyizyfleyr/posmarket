import type { Metadata } from "next";
import { Link } from "@/components/RouterPolyfill";

export const metadata: Metadata = {
  title: "Guide d'utilisation — PosMarket",
  description:
    "Guide complet d'utilisation de PosMarket : installation, marketplace, backoffice vendeur, portail admin.",
};

const section =
  "space-y-3 text-sm font-medium text-gray-700 leading-relaxed [&_h2]:text-base [&_h2]:font-black [&_h2]:text-gray-900 [&_h2]:pt-2 [&_h3]:text-sm [&_h3]:font-black [&_h3]:text-gray-800 [&_h3]:pt-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-bold [&_table]:w-full [&_table]:text-xs [&_th]:text-left [&_th]:font-black [&_th]:text-gray-900 [&_th]:py-2 [&_td]:py-2 [&_td]:border-t [&_td]:border-gray-100";

export default function UtilisationPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto max-w-3xl px-4 py-10 md:py-16">
        <Link
          to="/"
          className="text-xs font-black uppercase tracking-wider text-[#f56b2a] hover:underline"
        >
          &larr; Retour &agrave; l&apos;accueil
        </Link>

        <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight mt-6 mb-2">
          Guide d&apos;utilisation
        </h1>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-10">
          PosMarket &mdash; Septembre 2026
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 md:p-10 space-y-10">

          {/* ===== PARTIE 1 ===== */}
          <section className={section}>
            <h2>1. Installation et configuration</h2>

            <h3>Étape 1 — Prérequis</h3>
            <ul>
              <li>Node.js 18 ou plus</li>
              <li>npm</li>
              <li>Un compte Neon (base PostgreSQL serverless)</li>
              <li>Un compte Vercel (déploiement)</li>
              <li>Un compte Cloudflare R2 (stockage d&apos;images)</li>
              <li>Un compte FusionPay (paiements carte bancaire)</li>
              <li>Une clé Firebase (notifications push)</li>
            </ul>

            <h3>Étape 2 — Cloner et installer</h3>
            <p>
              <code>git clone https://github.com/andyizyfleyr/posmarket</code>
              {" / "}
              <code>cd posmarket</code>
              {" / "}
              <code>npm install</code>
            </p>

            <h3>Étape 3 — Variables d&apos;environnement</h3>
            <p>Créez le fichier <code>.env.local</code> à partir de <code>.env.example</code> :</p>
            <table>
              <thead>
                <tr><th>Variable</th><th>Description</th><th>Obligatoire</th></tr>
              </thead>
              <tbody>
                <tr><td><code>DATABASE_URL</code></td><td>URL Neon PostgreSQL</td><td>Oui</td></tr>
                <tr><td><code>NEXT_PUBLIC_FUSIONPAY_API_URL</code></td><td>API FusionPay (carte bancaire)</td><td>Oui</td></tr>
                <tr><td><code>FIREBASE_SERVICE_ACCOUNT</code></td><td>JSON du compte de service Firebase</td><td>Oui</td></tr>
                <tr><td><code>CLOUDFLARE_ACCOUNT_ID</code></td><td>Identifiant Cloudflare</td><td>Oui</td></tr>
                <tr><td><code>R2_ACCESS_KEY_ID</code></td><td>Clé d&apos;accès R2</td><td>Oui</td></tr>
                <tr><td><code>R2_SECRET_ACCESS_KEY</code></td><td>Clé secrète R2</td><td>Oui</td></tr>
                <tr><td><code>R2_BUCKET</code></td><td>Nom du bucket R2</td><td>Oui</td></tr>
                <tr><td><code>R2_PUBLIC_URL</code></td><td>URL publique R2</td><td>Oui</td></tr>
                <tr><td><code>NEXT_PUBLIC_SITE_URL</code></td><td>URL publique du site</td><td>Recommandé</td></tr>
              </tbody>
            </table>

            <h3>Étape 4 — Base de données</h3>
            <p>
              Lancez <code>npm run db:migrate</code> pour créer toutes les tables. Les migrations 0005-0007
              s&apos;appliquent séparément avec <code>node scripts/apply-migration-000X.mjs</code>.
            </p>

            <h3>Étape 5 — Compte administrateur</h3>
            <p>
              <code>npm run db:seed:admin -- -u admin -p MotDePasse -e admin@site.com</code>
              {" — Le premier compte créé devient le super-administrateur racine."}
            </p>

            <h3>Étape 6 — Développement</h3>
            <p>
              <code>npm run dev</code> — Le site est disponible sur{" "}
              <code>http://localhost:3000</code>.
            </p>

            <h3>Étape 7 — Déploiement Vercel</h3>
            <ol>
              <li>Connectez le dépôt GitHub à Vercel</li>
              <li>Ajoutez les variables d&apos;environnement dans Settings</li>
              <li>Le déploiement se fait automatiquement à chaque push sur main</li>
              <li>Un ping GitHub Actions toutes les 3 minutes garde la base Neon éveillée</li>
            </ol>
          </section>

          {/* ===== PARTIE 2 ===== */}
          <section className={section}>
            <h2>2. Marketplace (Acheteur)</h2>

            <h3>2.1 — Page d&apos;accueil</h3>
            <p>
              La page d&apos;accueil affiche un carrousel d&apos;images, la liste des boutiques,
              les produits par catégorie et une barre de recherche. Tous les prix sont en{" "}
              <strong>FCFA (XOF)</strong>.
            </p>

            <h3>2.2 — Rechercher un produit</h3>
            <ol>
              <li>Cliquez sur la barre de recherche en haut</li>
              <li>Tapez le nom d&apos;un produit (ex: &quot;crème visage&quot;)</li>
              <li>Des suggestions apparaissent pendant que vous tapez</li>
              <li>Cliquez sur un produit ou appuyez sur Entrée pour voir tous les résultats</li>
            </ol>

            <h3>2.3 — Parcourir par catégorie</h3>
            <p>13 catégories sont disponibles : Cosmétique &amp; Emballage, Électronique &amp; High-Tech, Mode &amp; Accessoires, Épicerie &amp; Supermarché, Restauration &amp; Livraison Rapide, Mobilier &amp; Décoration, Beauté/Santé/Bien-être, Auto &amp; Moto, Sport &amp; Loisirs, Bricolage &amp; Jardin, Livres &amp; Papeterie, Jouets &amp; Enfants, Divers.</p>

            <h3>2.4 — Voir les détails d&apos;un produit</h3>
            <p>Cliquez sur un produit pour voir les photos, le prix unitaire, les remises en gros, la description, le temps de livraison et les avis clients avec étoiles.</p>

            <h3>2.5 — Ajouter au panier</h3>
            <ol>
              <li>Choisissez la quantité avec + et -</li>
              <li>Cliquez sur &quot;Ajouter au panier&quot;</li>
              <li>Un badge orange indique le nombre d&apos;articles dans le panier</li>
            </ol>

            <h3>2.6 — Passer commande</h3>
            <p>Le passage de commande se fait en <strong>3 étapes</strong> :</p>
            <ol>
              <li><strong>Panier</strong> — Vérifiez vos articles, appliquez un code promo, cliquez &quot;Commander&quot;</li>
              <li><strong>Livraison</strong> — Renseignez nom, téléphone et adresse de livraison</li>
              <li><strong>Paiement</strong> — Choisissez Espèces (à la livraison) ou Carte bancaire (via FusionPay)</li>
            </ol>
            <p>Après la commande, un message de confirmation s&apos;affiche et la commande apparaît dans votre espace &quot;Mes commandes&quot;.</p>

            <h3>2.7 — Espace Mon Compte</h3>
            <p>Accessible depuis la barre de navigation en bas. 4 onglets :</p>
            <ul>
              <li><strong>Commandes</strong> — Historique de toutes vos commandes (En attente / Prête / Validée)</li>
              <li><strong>Adresses</strong> — Gérer vos adresses de livraison</li>
              <li><strong>Avis</strong> — Les avis que vous avez laissés sur des produits</li>
              <li><strong>Profil</strong> — Nom d&apos;affichage, téléphone, déconnexion</li>
            </ul>
          </section>

          {/* ===== PARTIE 3 ===== */}
          <section className={section}>
            <h2>3. Backoffice Vendeur</h2>

            <h3>3.1 — Créer un compte vendeur</h3>
            <ol>
              <li>Allez sur <code>/login</code></li>
              <li>Cliquez sur &quot;Créer un compte&quot;</li>
              <li>Remplissez nom, e-mail, mot de passe</li>
              <li>Vous êtes redirigé vers la page d&apos;abonnement</li>
            </ol>

            <h3>3.2 — Plans d&apos;abonnement</h3>
            <table>
              <thead>
                <tr><th>Plan</th><th>Mois</th><th>Trimestre</th><th>An</th><th>Boutiques</th><th>Produits</th><th>Boutique en ligne</th></tr>
              </thead>
              <tbody>
                <tr><td>Starter</td><td>25 000 F</td><td>40 000 F</td><td>70 000 F</td><td>1</td><td>50</td><td>Non</td></tr>
                <tr><td>Pro</td><td>40 000 F</td><td>60 000 F</td><td>150 000 F</td><td>3</td><td>500</td><td>Oui</td></tr>
                <tr><td>Entreprise</td><td>70 000 F</td><td>95 000 F</td><td>350 000 F</td><td>Illimité</td><td>Illimité</td><td>Oui</td></tr>
              </tbody>
            </table>
            <p>Seuls les plans Pro et Entreprise donnent accès à la boutique en ligne visible par les acheteurs.</p>

            <h3>3.3 — Tableau de bord (<code>/dashboard</code>)</h3>
            <p>Affiche le nombre de produits, clients, commandes du jour et chiffre d&apos;affaires du mois.</p>

            <h3>3.4 — Créer une boutique</h3>
            <ol>
              <li>Cliquez &quot;Nouvelle boutique&quot; dans la barre de navigation</li>
              <li>Entrez le nom de la boutique</li>
              <li>Choisissez le type : Boutique (shopping) ou Restaurant (food)</li>
              <li>La boutique est créée avec un lien généré automatiquement</li>
            </ol>

            <h3>3.5 — Gérer les produits (<code>/inventory</code>)</h3>
            <p><strong>Ajouter :</strong> Nom, description, prix (FCFA), stock, unité, catégorie, image, options/variantes, prix de gros, temps de livraison, visibilité en ligne.</p>
            <p><strong>Modifier :</strong> Cliquez sur un produit, modifiez, enregistrez.</p>
            <p><strong>Supprimer :</strong> Icône poubelle (ou suppression en bloc).</p>
            <p>Limite selon votre plan (50 / 500 / illimité).</p>

            <h3>3.6 — Gérer les commandes (<code>/orders</code>)</h3>
            <ul>
              <li><strong>En attente (PENDING)</strong> — Nouvelle commande, pas encore traitée</li>
              <li><strong>Prête (READY)</strong> — Commande préparée</li>
              <li><strong>Validée (COMPLETED)</strong> — Commande terminée</li>
            </ul>
            <p>Vous pouvez changer le statut, supprimer (seul ou en bloc), et voir les détails (articles, montant, client, mode de paiement).</p>

            <h3>3.7 — Point de Vente POS (<code>/pos</code>)</h3>
            <p>Caisse enregistreuse pour vendre en magasin :</p>
            <ol>
              <li>Recherchez un produit ou parcourez les catégories</li>
              <li>Ajoutez au panier, ajustez la quantité</li>
              <li>Sélectionnez un client (optionnel)</li>
              <li>Choisissez En magasin (IN_STORE) ou Click &amp; Collect (PICKUP)</li>
              <li>Cliquez &quot;Payer&quot; (espèces par défaut)</li>
              <li>Un reçu s&apos;affiche (ticket 80mm ou PDF)</li>
            </ol>

            <h3>3.8 — Gérer les clients (<code>/customers</code>)</h3>
            <p>Liste triée par montant dépensé. Ajoutez, modifiez ou supprimez des clients. Les clients sont aussi créés automatiquement lors des commandes.</p>

            <h3>3.9 — Factures (<code>/invoices</code>)</h3>
            <p>Créez des factures formelles (Brouillon → Envoyée → Payée → En retard). Imprimez en PDF ou ticket 80mm. Disponible Pro et Entreprise.</p>

            <h3>3.10 — Paramètres (<code>/settings</code>)</h3>
            <ul>
              <li><strong>Boutique</strong> — Nom, logo, thème, devise, contact</li>
              <li><strong>Promotions</strong> — Codes promo (pourcentage, expiration, activation)</li>
              <li><strong>Personnel</strong> — Inviter du staff par e-mail avec un rôle (Propriétaire / Staff)</li>
              <li><strong>Boutiques</strong> — Créer ou supprimer des boutiques (minimum 1)</li>
            </ul>

            <h3>3.11 — Rapports (<code>/reports</code>)</h3>
            <p>Chiffre d&apos;affaires, nombre de commandes, revenus par période. Disponible Pro et Entreprise.</p>

            <h3>3.12 — Changer d&apos;abonnement (<code>/subscription</code>)</h3>
            <p>Choisissez un nouveau plan et une durée. La souscription prend effet immédiatement.</p>
          </section>

          {/* ===== PARTIE 4 ===== */}
          <section className={section}>
            <h2>4. Portail Administrateur (PAM)</h2>

            <h3>4.1 — Connexion</h3>
            <p>Allez sur <code>/pam/login</code>. Seuls les comptes créés avec <code>npm run db:seed:admin</code> peuvent se connecter. Session de 8 heures.</p>

            <h3>4.2 — Tableau de bord (<code>/pam</code>)</h3>
            <p>Statistiques globales : boutiques, utilisateurs, ventes, produits, boutiques en attente.</p>

            <h3>4.3 — Boutiques (<code>/pam/stores</code>)</h3>
            <p>Liste regroupée par propriétaire. Approuver / Rejeter / Désactiver / Supprimer (seul ou en bloc).</p>

            <h3>4.4 — Utilisateurs (<code>/pam/users</code>)</h3>
            <p>Tous les comptes. Promouvoir super-admin, changer le plan, supprimer (seul ou en bloc).</p>

            <h3>4.5 — Commandes globales (<code>/pam/orders</code>)</h3>
            <p>Toutes les commandes de toutes les boutiques. Recherche par ID, boutique, email. Filtre par statut.</p>

            <h3>4.6 — Produits globaux (<code>/pam/inventory</code>)</h3>
            <p>Recherche dans toutes les boutiques. Badge de stock bas. Suppression de produits.</p>

            <h3>4.7 — Avis (<code>/pam/reviews</code>)</h3>
            <p>Moderation des avis. Recherche par auteur, boutique, produit. Suppression d&apos;avis.</p>

            <h3>4.8 — Paramètres système (<code>/pam/settings</code>)</h3>
            <ul>
              <li>Mode maintenance — désactive l&apos;accès public</li>
              <li>Indexation automatique — SEO</li>
              <li>Rapports hebdomadaires — e-mails</li>
            </ul>

            <h3>4.9 — Factures globales (<code>/pam/invoices</code>)</h3>
            <p>Toutes les factures de toutes les boutiques. Recherche et filtre par statut.</p>
          </section>

          {/* ===== PARTIE 5 ===== */}
          <section className={section}>
            <h2>5. Fonctionnalités transverses</h2>

            <h3>Séparation des comptes</h3>
            <p>3 types : <strong>Acheteur</strong> (marketplace + /mon-compte), <strong>Vendeur</strong> (backoffice /dashboard etc.), <strong>Admin</strong> (portail /pam). Un type ne peut jamais accéder à l&apos;espace d&apos;un autre.</p>

            <h3>Moteur de recherche</h3>
            <p>Recherche en français, sans accents, par mots-clés et similarité. Suggestions automatiques. Classement par pertinence et popularité.</p>

            <h3>Notifications push</h3>
            <p>Vendeurs : nouvelles commandes, stock bas, nouveaux avis, abonnement expirant. Acheteurs : notifications web push pour les promotions.</p>

            <h3>Images</h3>
            <p>Compression automatique WebP (max 800 Ko, 1200px). Stockage sur Cloudflare R2 (CDN).</p>

            <h3>PWA</h3>
            <p>Installable sur téléphone. Mode hors ligne avec panier conservé.</p>

            <h3>Cache</h3>
            <p>Marketplace revalidée toutes les 60s (ISR). Commandes vendeur en cache 20s. Cache acheteur côté client (clé buyer_data_cache_v2).</p>
          </section>

          {/* ===== PARTIE 6 ===== */}
          <section className={section}>
            <h2>6. Problèmes fréquents</h2>
            <table>
              <thead>
                <tr><th>Problème</th><th>Solution</th></tr>
              </thead>
              <tbody>
                <tr><td>Session expirée</td><td>Reconnectez-vous via Mon Compte</td></tr>
                <tr><td>Minimum de commande requis</td><td>Ajoutez plus d&apos;articles de cette boutique</td></tr>
                <tr><td>Limite de produits atteinte</td><td>Passez à un plan supérieur</td></tr>
                <tr><td>Limite de boutiques atteinte</td><td>Passez à un plan supérieur</td></tr>
                <tr><td>Paiement carte ne fonctionne pas</td><td>Vérifiez NEXT_PUBLIC_FUSIONPAY_API_URL</td></tr>
                <tr><td>Images ne s&apos;affichent pas</td><td>Vérifiez les variables Cloudflare R2</td></tr>
              </tbody>
            </table>
          </section>

        </div>
      </main>
    </div>
  );
}
