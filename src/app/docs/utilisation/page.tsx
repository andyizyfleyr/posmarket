import type { Metadata } from "next";
import { Link } from "@/components/RouterPolyfill";
import {
  ArrowLeft,
  ArrowRight,
  BarChart,
  BellRing,
  BookOpen,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Package,
  Receipt,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  TerminalSquare,
  User,
  Users,
  Wrench,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Guide d'utilisation — PosMarket",
  description:
    "Guide d'utilisation de PosMarket pour les acheteurs et les vendeurs : acheter, vendre, gérer sa boutique.",
};

const sectionTitle =
  "flex items-center gap-3 text-lg md:text-2xl font-black text-gray-900 tracking-tight";

const chip =
  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest";

const code =
  "bg-gray-100 text-[#f56b2a] px-1.5 py-0.5 rounded-md text-xs font-black";

const stepNum =
  "w-7 h-7 shrink-0 rounded-full bg-[#f56b2a] text-white text-xs font-black flex items-center justify-center shadow-md shadow-orange-100";

export default function UtilisationPage() {
  const toc = [
    { id: "acheteur", label: "Acheteur", icon: ShoppingBag, color: "text-orange-600 bg-orange-50 border-orange-100" },
    { id: "vendeur", label: "Vendeur", icon: Store, color: "text-blue-600 bg-blue-50 border-blue-100" },
    { id: "transverse", label: "Fonctionnalités", icon: Sparkles, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
    { id: "problemes", label: "Problèmes", icon: Wrench, color: "text-red-600 bg-red-50 border-red-100" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-gray-50 to-gray-50">
      {/* ===== HERO ===== */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#002f34] via-[#00463f] to-[#f56b2a] text-white">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, #f56b2a 0, transparent 40%), radial-gradient(circle at 80% 70%, #fff 0, transparent 30%)",
        }} />
        <div className="relative container mx-auto px-4 pt-8 pb-12 md:pb-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Retour à l&apos;accueil
          </Link>

          <div className="mt-8 md:mt-12 flex flex-col md:flex-row md:items-end gap-6">
            <div className="flex-1">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-[10px] font-black uppercase tracking-widest text-orange-300">
                <BookOpen size={12} /> Documentation officielle
              </span>
              <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight leading-tight">
                Guide d&apos;utilisation
              </h1>
              <p className="mt-3 text-sm md:text-base font-medium text-white/70 max-w-xl leading-relaxed">
                Tout savoir sur PosMarket : acheter sur la marketplace et gérer
                votre boutique en ligne. Suivez les étapes dans l&apos;ordre.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-3xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center shadow-xl">
                <Rocket size={32} className="text-orange-300" />
              </div>
            </div>
          </div>

          {/* ===== TOC ===== */}
          <nav className="mt-8 md:mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {toc.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`group rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 hover:bg-white/10 transition-all hover:-translate-y-0.5`}
                >
                  <div className={`inline-flex w-9 h-9 rounded-xl items-center justify-center mb-2 ${item.color} transition-transform group-hover:scale-110`}>
                    <Icon size={17} />
                  </div>
                  <p className="text-[11px] font-black text-white">{item.label}</p>
                  <p className="text-[9px] font-bold text-white/50 uppercase tracking-wider">
                    Partie {toc.indexOf(item) + 1}
                  </p>
                </a>
              );
            })}
          </nav>
        </div>
        <svg className="absolute bottom-0 left-0 right-0 w-full text-gray-50" viewBox="0 0 1440 40" fill="currentColor" preserveAspectRatio="none" style={{ height: 32 }}>
          <path d="M0,32 C480,0 960,0 1440,32 L1440,40 L0,40 Z" />
        </svg>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-10 md:py-14 space-y-12 md:space-y-20">

        {/* ============================================================
            PARTIE 1 — ACHETEUR
        ============================================================ */}
        <section id="acheteur" className="scroll-mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className={sectionTitle}>
              <span className="w-10 h-10 rounded-2xl bg-orange-100 text-[#f56b2a] flex items-center justify-center">
                <ShoppingBag size={20} />
              </span>
              Marketplace
              <span className={chip + " bg-orange-50 text-orange-600 border border-orange-100"}>Acheteur</span>
            </h2>
            <span className="hidden md:inline-flex text-[10px] font-black uppercase tracking-widest text-orange-400">
              Partie 1
            </span>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-6 ml-14">Acheter des produits aux commerçants locaux, sans compte obligatoire.</p>

          {/* Parcours visuel */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { icon: Home, label: "Accueil", desc: "Boutiques & produits" },
              { icon: Search, label: "Recherche", desc: "Mots-clés + suggestions" },
              { icon: ShoppingCart, label: "Panier", desc: "Codes promo" },
              { icon: CreditCard, label: "Paiement", desc: "Espèces ou carte" },
            ].map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center group hover:-translate-y-0.5 transition-all">
                  <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-[#f56b2a] text-white text-[10px] font-black flex items-center justify-center shadow-md shadow-orange-100">
                    {i + 1}
                  </div>
                  <div className="inline-flex w-11 h-11 rounded-2xl bg-orange-50 text-[#f56b2a] items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Icon size={20} />
                  </div>
                  <p className="text-xs font-black text-gray-900">{step.label}</p>
                  <p className="text-[10px] font-medium text-gray-400">{step.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {/* Recherche */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:col-span-1 space-y-3">
              <div className="flex items-center gap-2 text-[#f56b2a]">
                <Search size={16} />
                <h3 className="text-sm font-black text-gray-900">Rechercher un produit</h3>
              </div>
              <ol className="space-y-2 text-xs font-medium text-gray-600">
                <li className="flex gap-2"><span className="stepNum scale-90">1</span>Cliquez sur la barre de recherche en haut de la page</li>
                <li className="flex gap-2"><span className="stepNum scale-90">2</span>Tapez un mot-clé (ex: « crème visage »)</li>
                <li className="flex gap-2"><span className="stepNum scale-90">3</span>Les suggestions s&apos;affichent pendant la frappe</li>
                <li className="flex gap-2"><span className="stepNum scale-90">4</span>Cliquez sur un résultat ou appuyez sur Entrée</li>
              </ol>
              <p className="text-[11px] font-medium text-gray-400 bg-orange-50/60 rounded-xl p-3">
                La recherche est en français, sans accents et par similarité d&apos;orthographe. Les résultats sont classés par pertinence et popularité.
              </p>
            </div>

            {/* Catégories */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-3">
              <div className="flex items-center gap-2 text-[#f56b2a]">
                <LayoutGrid size={16} />
                <h3 className="text-sm font-black text-gray-900">Parcourir par catégorie</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["Cosmétique & Emballage", "Électronique", "Mode & Accessoires", "Épicerie", "Restauration", "Mobilier", "Beauté / Santé", "Auto & Moto", "Sport & Loisirs", "Bricolage", "Livres & Papeterie", "Jouets", "Divers"].map((cat) => (
                  <span key={cat} className="px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100 text-[10px] font-bold text-gray-600">
                    {cat}
                  </span>
                ))}
              </div>
              <p className="text-[11px] font-medium text-gray-400">Tous les prix sont affichés en <strong className="text-orange-600">FCFA (XOF)</strong>.</p>
            </div>

            {/* Produit */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-3">
              <div className="flex items-center gap-2 text-[#f56b2a]">
                <Package size={16} />
                <h3 className="text-sm font-black text-gray-900">Fiche produit</h3>
              </div>
              <ul className="space-y-1.5 text-xs font-medium text-gray-600">
                <li className="flex gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />Photos multiples</li>
                <li className="flex gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />Prix unitaire + remises en gros</li>
                <li className="flex gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />Options / variantes (taille, couleur…)</li>
                <li className="flex gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />Temps de livraison estimé</li>
                <li className="flex gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />Avis clients avec étoiles</li>
              </ul>
            </div>

            {/* Commande */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-3">
              <div className="flex items-center gap-2 text-[#f56b2a]">
                <ShoppingCart size={16} />
                <h3 className="text-sm font-black text-gray-900">Passer commande</h3>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide mb-3">
                <span className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 border border-orange-100">1 · Panier</span>
                <ChevronRight size={12} className="text-gray-300" />
                <span className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 border border-orange-100">2 · Livraison</span>
                <ChevronRight size={12} className="text-gray-300" />
                <span className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 border border-orange-100">3 · Paiement</span>
              </div>
              <p className="text-xs font-medium text-gray-600">
                Vérifiez vos articles et codes promo, renseignez votre adresse,
                puis choisissez <strong>Espèces à la livraison</strong> ou{" "}
                <strong>Carte bancaire</strong> (paiement sécurisé FusionPay).
              </p>
              <p className="text-[11px] font-medium text-gray-400 bg-orange-50/60 rounded-xl p-3">
                Une boutique peut imposer un minimum de commande. Les commandes multi-boutiques sont groupées.
              </p>
            </div>
          </div>

          {/* Mon Compte */}
          <div className="mt-3 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 text-[#f56b2a]">
              <User size={16} />
              <h3 className="text-sm font-black text-gray-900">Espace « Mon Compte »</h3>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {[
                { icon: ShoppingBag, label: "Commandes", desc: "Historique et statut des commandes" },
                { icon: MapPin, label: "Adresses", desc: "Adresses de livraison enregistrées" },
                { icon: Star, label: "Avis", desc: "Vos avis laissés sur des produits" },
                { icon: User, label: "Profil", desc: "Nom, téléphone, déconnexion" },
              ].map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <div key={tab.label} className="flex items-start gap-3 rounded-2xl border border-gray-100 p-3.5 hover:border-orange-200 hover:bg-orange-50/40 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#f56b2a] flex items-center justify-center shrink-0">
                      <TabIcon size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900">{tab.label}</p>
                      <p className="text-[10px] font-medium text-gray-400 leading-snug">{tab.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============================================================
            PARTIE 2 — VENDEUR
        ============================================================ */}
        <section id="vendeur" className="scroll-mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className={sectionTitle}>
              <span className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Store size={20} />
              </span>
              Backoffice Vendeur
              <span className={chip + " bg-blue-50 text-blue-600 border border-blue-100"}>Portail</span>
            </h2>
            <span className="hidden md:inline-flex text-[10px] font-black uppercase tracking-widest text-blue-400">
              Partie 2
            </span>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-6 ml-14">Gérez votre boutique, vos produits et vos ventes.</p>

          {/* Plans */}
          <div className="grid md:grid-cols-3 gap-3 mb-3">
            {[
              { name: "Starter", price: "25 000", per: "/mois", features: ["1 boutique", "50 produits", "POS uniquement"], highlight: false },
              { name: "Pro", price: "40 000", per: "/mois", features: ["3 boutiques", "500 produits", "Boutique en ligne + rapports"], highlight: true },
              { name: "Entreprise", price: "70 000", per: "/mois", features: ["Boutiques illimitées", "Produits illimités", "Tout inclus + reçus custom"], highlight: false },
            ].map((plan) => (
              <div key={plan.name} className={`relative rounded-3xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 ${plan.highlight ? "border-blue-300 bg-gradient-to-b from-blue-50 to-white ring-2 ring-blue-200/50" : "border-gray-100 bg-white"}`}>
                {plan.highlight && (
                  <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest">
                    Populaire
                  </span>
                )}
                <p className="text-xs font-black text-gray-900">{plan.name}</p>
                <p className="mt-1 text-2xl font-black text-gray-900">
                  {plan.price} <span className="text-xs font-bold text-gray-400">{plan.per}</span>
                </p>
                <ul className="mt-3 space-y-1.5 text-[11px] font-medium text-gray-600">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1 shrink-0" />{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-medium text-gray-400 mb-6">
            Tarifs trimestriels et annuels disponibles. Les prix sont en FCFA. Seuls Pro et Entreprise ont une boutique visible par les acheteurs.
          </p>

          {/* Premiers pas */}
          <div className="mt-3 mb-6 bg-gradient-to-br from-blue-50/70 to-white rounded-3xl border border-blue-100 p-6">
            <div className="flex items-center gap-2 text-blue-600 mb-4">
              <Rocket size={16} />
              <h3 className="text-sm font-black text-gray-900">Créer son compte et démarrer</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="relative bg-white rounded-2xl border border-blue-100 p-4">
                <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow-md">1</span>
                <div className="inline-flex w-9 h-9 rounded-xl bg-blue-50 text-blue-600 items-center justify-center mb-2"><User size={16} /></div>
                <p className="text-xs font-black text-gray-900">Créez votre compte</p>
                <p className="text-[10px] font-medium text-gray-500 leading-snug">Allez sur « Se connecter », onglet « Créer un compte », remplissez nom, e-mail et mot de passe.</p>
              </div>
              <div className="relative bg-white rounded-2xl border border-blue-100 p-4">
                <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow-md">2</span>
                <div className="inline-flex w-9 h-9 rounded-xl bg-blue-50 text-blue-600 items-center justify-center mb-2"><CreditCard size={16} /></div>
                <p className="text-xs font-black text-gray-900">Choisissez votre plan</p>
                <p className="text-[10px] font-medium text-gray-500 leading-snug">Un abonnement Pro est créé automatiquement. Changez de plan à tout moment.</p>
              </div>
              <div className="relative bg-white rounded-2xl border border-blue-100 p-4">
                <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow-md">3</span>
                <div className="inline-flex w-9 h-9 rounded-xl bg-blue-50 text-blue-600 items-center justify-center mb-2"><Store size={16} /></div>
                <p className="text-xs font-black text-gray-900">Créez votre boutique</p>
                <p className="text-[10px] font-medium text-gray-500 leading-snug">« Nouvelle boutique » dans la barre de navigation, puis type Boutique (shopping) ou Restaurant (food).</p>
              </div>
              <div className="relative bg-white rounded-2xl border border-blue-100 p-4">
                <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow-md">4</span>
                <div className="inline-flex w-9 h-9 rounded-xl bg-blue-50 text-blue-600 items-center justify-center mb-2"><Package size={16} /></div>
                <p className="text-xs font-black text-gray-900">Ajoutez vos produits</p>
                <p className="text-[10px] font-medium text-gray-500 leading-snug">Dans « Produits », remplissez nom, prix, stock et photo. C&apos;est prêt à vendre !</p>
              </div>
            </div>
          </div>

          {/* Fonctions vendeur */}
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { icon: LayoutDashboard, title: "Tableau de bord", text: "KPIs de la boutique : produits, clients, commandes du jour, CA du mois.", route: "/dashboard" },
              { icon: Package, title: "Produits", text: "Créer, modifier, supprimer. Prix, stock, variantes, prix de gros, image.", route: "/inventory" },
              { icon: Receipt, title: "Commandes", text: "Statuts En attente → Prête → Validée. Suppression en bloc, recherche.", route: "/orders" },
              { icon: TerminalSquare, title: "Point de Vente", text: "Caisse intégrée : vente en magasin ou Click & Collect, reçu imprimable.", route: "/pos" },
              { icon: Users, title: "Clients", text: "Fichier clients trié par dépense. Créés automatiquement à chaque commande.", route: "/customers" },
              { icon: FileText, title: "Factures", text: "Factures formelles (brouillon → payée), impression PDF ou ticket 80 mm.", route: "/invoices" },
              { icon: Settings, title: "Paramètres", text: "Logo, thème, codes promo, personnel (staff), multi-boutiques.", route: "/settings" },
              { icon: BarChart, title: "Rapports", text: "Chiffre d'affaires et revenus par période (Pro et Entreprise).", route: "/reports" },
              { icon: CreditCard, title: "Abonnement", text: "Changer de plan ou de durée à tout moment, effet immédiat.", route: "/subscription" },
            ].map((fn) => {
              const FnIcon = fn.icon;
              return (
                <div key={fn.title} className="group bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex flex-col hover:border-blue-200 hover:shadow-md transition-all hover:-translate-y-0.5">
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FnIcon size={20} />
                  </div>
                  <h4 className="text-sm font-black text-gray-900">{fn.title}</h4>
                  <p className="text-[11px] font-medium text-gray-500 leading-relaxed mt-1">{fn.text}</p>
                  <span className="mt-auto pt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-500">
                    {fn.route} <ArrowRight size={10} />
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ============================================================
            PARTIE 3 — FONCTIONNALITÉS
        ============================================================ */}
        <section id="transverse" className="scroll-mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className={sectionTitle}>
              <span className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Sparkles size={20} />
              </span>
              Astuces et fonctionnalités
              <span className={chip + " bg-indigo-50 text-indigo-600 border border-indigo-100"}>À savoir</span>
            </h2>
            <span className="hidden md:inline-flex text-[10px] font-black uppercase tracking-widest text-indigo-400">
              Partie 3
            </span>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-6 ml-14">Les bonnes choses à savoir pour bien utiliser la plateforme.</p>

          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: User, title: "Comptes séparés", desc: "Acheteur et vendeur sont deux espaces distincts : vos données d'achat et de vente restent séparées.", color: "text-indigo-600 bg-indigo-50" },
              { icon: BellRing, title: "Notifications push", desc: "Vendeurs : nouvelles commandes, stock bas, nouveaux avis. Acheteurs : promos web push.", color: "text-indigo-600 bg-indigo-50" },
              { icon: ImageIcon, title: "Photos de bonne qualité", desc: "Les images sont compressées automatiquement (WebP) : votre boutique reste rapide, même sur 3G.", color: "text-indigo-600 bg-indigo-50" },
              { icon: Download, title: "Application sur téléphone", desc: "Installez PosMarket comme une application. Même hors connexion, votre panier est conservé.", color: "text-indigo-600 bg-indigo-50" },
              { icon: ShieldCheck, title: "Paiement protégé", desc: "Deux modes : espèces à la livraison, ou carte bancaire via une passerelle sécurisée.", color: "text-indigo-600 bg-indigo-50" },
              { icon: Search, title: "Bien vendre : bien décrire", desc: "Des produits bien décrits (nom, prix, photo, temps de livraison) remontent mieux dans la recherche.", color: "text-indigo-600 bg-indigo-50" },
            ].map((item) => {
              const ItemIcon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3 bg-white rounded-3xl border border-gray-100 shadow-sm p-5 hover:border-indigo-200 transition-colors">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${item.color}`}>
                    <ItemIcon size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900">{item.title}</h4>
                    <p className="text-[11px] font-medium text-gray-500 leading-relaxed mt-1">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ============================================================
            PARTIE 4 — PROBLEMES
        ============================================================ */}
        <section id="problemes" className="scroll-mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className={sectionTitle}>
              <span className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                <Wrench size={20} />
              </span>
              Problèmes fréquents
              <span className={chip + " bg-red-50 text-red-600 border border-red-100"}>Dépannage</span>
            </h2>
            <span className="hidden md:inline-flex text-[10px] font-black uppercase tracking-widest text-red-400">
              Partie 4
            </span>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-6 ml-14">Les messages les plus courants et leurs solutions.</p>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {[
              { icon: User, problem: "« Session expirée »", solution: "Reconnectez-vous via l'onglet Mon Compte." },
              { icon: ShoppingCart, problem: "« Minimum de commande requis »", solution: "Ajoutez plus d'articles de cette boutique avant de commander." },
              { icon: Package, problem: "« Limite de produits atteinte » (vendeur)", solution: "Passez à un plan supérieur (Starter → Pro → Entreprise)." },
              { icon: Store, problem: "« Limite de boutiques atteinte » (vendeur)", solution: "Passez à un plan supérieur ou supprimez une boutique." },
              { icon: CreditCard, problem: "Le paiement par carte échoue", solution: "Réessayez, ou choisissez le paiement à la livraison (espèces)." },
              { icon: ImageIcon, problem: "Une photo de produit ne s'affiche pas", solution: "Rechargez la page, et réessayez après quelques secondes." },
            ].map((item) => {
              const ItemIcon = item.icon;
              return (
                <div key={item.problem} className="flex items-center gap-4 px-5 py-4 hover:bg-red-50/30 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                    <ItemIcon size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-gray-900">{item.problem}</p>
                    <p className="text-[11px] font-medium text-gray-500">{item.solution}</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 shrink-0" />
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== CTA FINAL ===== */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#f56b2a] via-[#e55a1b] to-[#002f34] text-white p-8 md:p-12 text-center">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #fff 0, transparent 40%)" }} />
          <div className="relative">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20 items-center justify-center mb-4">
              <ShoppingCart size={28} className="text-orange-200" />
            </div>
            <h2 className="text-xl md:text-3xl font-black tracking-tight">
              Prêt à rejoindre PosMarket&nbsp;?
            </h2>
            <p className="mt-2 text-sm font-medium text-white/70 max-w-lg mx-auto">
              Achetez chez les commerçants locaux ou créez votre boutique en
              ligne. Chaque espace est à portée de clic.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#f56b2a] rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform">
                <ShoppingCart size={15} /> Découvrir la marketplace
              </Link>
              <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 border border-white/25 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-white/20 transition-colors">
                <Store size={15} /> Devenir vendeur
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}