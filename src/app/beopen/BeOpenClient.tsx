'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Zap,
  TrendingUp,
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Users,
  Store,
  ArrowRight,
  MessageCircle,
  HelpCircle,
  ChevronDown,
  Star,
  Award,
  Sparkles,
  Lock,
  Eye,
  AlertTriangle,
  Receipt,
  ShoppingBag,
  Bell,
  HeartHandshake
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@/constants';
import { formatCurrency } from '@/utils';

export default function BeOpenClient() {
  const [duration, setDuration] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const getPrice = (plan: typeof SUBSCRIPTION_PLANS.STARTER) => {
    if (duration === 'quarterly') return Math.round(plan.priceQuarterly / 3);
    if (duration === 'annual') return Math.round(plan.priceAnnual / 12);
    return plan.priceMonthly;
  };

  const getTotalPrice = (plan: typeof SUBSCRIPTION_PLANS.STARTER) => {
    if (duration === 'quarterly') return plan.priceQuarterly;
    if (duration === 'annual') return plan.priceAnnual;
    return plan.priceMonthly;
  };

  const whatsappLink = (planName?: string) => {
    const text = planName
      ? `Bonjour l'équipe PosMarket, je souhaite en savoir plus et activer mon abonnement ${planName}.`
      : `Bonjour l'équipe PosMarket, je suis commerçant et je souhaite être accompagné pour lancer ma boutique.`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-[#f56b2a] selection:text-white overflow-x-hidden">
      {/* Top Notification Bar */}
      <div className="bg-gradient-to-r from-orange-600 via-[#f56b2a] to-amber-500 text-white text-xs md:text-sm py-2 px-4 text-center font-bold flex items-center justify-center gap-2 shadow-sm">
        <Sparkles size={15} className="animate-spin duration-3000" />
        <span>Accompagnement VIP offert : Configuration de votre boutique & caisse en 10 minutes avec notre équipe !</span>
        <a
          href={whatsappLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-orange-100 hidden sm:inline ml-2 font-black"
        >
          Profiter de l&apos;offre &rarr;
        </a>
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#f56b2a] to-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/25 group-hover:scale-105 transition-transform">
              <Store size={22} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tight text-white">
                Pos<span className="text-[#f56b2a]">Market</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest -mt-1">
                L&apos;Espace Commerçant
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#douleurs" className="hover:text-[#f56b2a] transition-colors">Vos défis</a>
            <a href="#solutions" className="hover:text-[#f56b2a] transition-colors">La Solution</a>
            <a href="#comparatif" className="hover:text-[#f56b2a] transition-colors">Avant / Après</a>
            <a href="#tarifs" className="hover:text-[#f56b2a] transition-colors">Tarifs</a>
            <a href="#faq" className="hover:text-[#f56b2a] transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-xs md:text-sm font-bold text-slate-300 hover:text-white transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/subscription"
              className="px-4 md:px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#f56b2a] to-orange-500 hover:from-orange-500 hover:to-[#f56b2a] text-white text-xs md:text-sm font-black shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all flex items-center gap-1.5"
            >
              <span>Ouvrir ma boutique</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#f56b2a]/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Heart Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs md:text-sm font-black mb-6 animate-fade-in">
            <HeartHandshake size={16} />
            <span>Conçu spécialement pour la réalité des commerçants d&apos;Afrique</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-[1.15] mb-6">
            Vous travaillez dur pour votre boutique. <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-[#f56b2a] to-amber-300">
              Il est temps que votre boutique travaille pour vous.
            </span>
          </h1>

          {/* Emotional Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-10 font-normal">
            Vous méritez de dormir sur vos deux oreilles sans l&apos;angoisse d&apos;une caisse fausse, de stocks perdus ou de ventes ratées. <strong className="text-white font-bold">PosMarket</strong> transforme votre simple téléphone en <span className="text-orange-400 font-bold">Caisse Enregistreuse tactile</span> et en <span className="text-emerald-400 font-bold">Boutique en Ligne ouverte 24h/24</span> avec paiement Mobile Money automatique.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-12">
            <Link
              href="/subscription"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#f56b2a] to-orange-500 hover:from-orange-500 hover:to-[#f56b2a] text-white font-black text-base shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
              <span>Activer mon abonnement</span>
              <ArrowRight size={18} />
            </Link>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-base transition-all flex items-center justify-center gap-2 hover:border-emerald-500/40"
            >
              <MessageCircle size={18} className="text-emerald-400" />
              <span>Assistance WhatsApp</span>
            </a>
          </div>

          {/* Social Proof Badges */}
          <div className="pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm font-semibold text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Zéro ordinateur cher requis</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Paiements MTN &amp; Moov Money intégrés</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Prise en main facile en 5 minutes</span>
            </div>
          </div>
        </div>
      </section>

      {/* Agitation Section: Les 4 Douleurs Réelles */}
      <section id="douleurs" className="py-16 md:py-24 bg-slate-900/60 border-y border-slate-800/80 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
              La réalité sans PosMarket
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-4 mb-4">
              Reconnaissez-vous l&apos;un de ces cauchemars du quotidien ?
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Gérer un commerce ne devrait pas être une source permanente d&apos;anxiété et d&apos;épuisement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Douleur 1 */}
            <div className="bg-slate-950/80 rounded-3xl p-6 sm:p-8 border border-red-500/20 hover:border-red-500/40 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-5 group-hover:scale-110 transition-transform">
                <Clock size={24} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                1. Le calvaire du cahier froissé à 21h
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Les yeux rouges après 12 heures debout, la calculatrice à la main, à recompter frénétiquement en essayant de comprendre pourquoi il manque 12 000 FCFA dans la caisse. Cette fatigue mentale vous vole votre temps en famille.
              </p>
            </div>

            {/* Douleur 2 */}
            <div className="bg-slate-950/80 rounded-3xl p-6 sm:p-8 border border-red-500/20 hover:border-red-500/40 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-5 group-hover:scale-110 transition-transform">
                <Eye size={24} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                2. L&apos;angoisse dès que vous quittez la boutique
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Impossible d&apos;aller à un événement de famille, chez le médecin ou de vous reposer sans avoir la boule au ventre : <em>&quot;Est-ce qu&apos;on encaisse bien ? Est-ce qu&apos;un article a disparu sans trace ?&quot;</em> Vous êtes prisonnier de votre propre magasin.
              </p>
            </div>

            {/* Douleur 3 */}
            <div className="bg-slate-950/80 rounded-3xl p-6 sm:p-8 border border-red-500/20 hover:border-red-500/40 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-5 group-hover:scale-110 transition-transform">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                3. Les fausses captures d&apos;écran Mobile Money
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Des clients pressés qui vous montrent un SMS de transfert falsifié ou une capture retouchée et repartent avec vos articles. Quand vous vous en rendez compte, c&apos;est trop tard : la perte est directe sur votre bénéfice net.
              </p>
            </div>

            {/* Douleur 4 */}
            <div className="bg-slate-950/80 rounded-3xl p-6 sm:p-8 border border-red-500/20 hover:border-red-500/40 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-5 group-hover:scale-110 transition-transform">
                <ShoppingBag size={24} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                4. Les clients qui achètent ailleurs la nuit
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Quand votre rideau de fer baisse à 19h, vos clients continuent de chercher des produits sur leur téléphone à 22h. Sans vitrine web synchronisée, ces ventes partent directement chez vos concurrents.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section: Les 4 Piliers PosMarket */}
      <section id="solutions" className="py-16 md:py-24 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-[#f56b2a] bg-orange-500/10 border border-orange-500/30 px-3 py-1 rounded-full">
              La Renaissance de votre Commerce
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-4 mb-4">
              Respirez. PosMarket devient votre associé silencieux.
            </h2>
            <p className="text-slate-300 text-sm sm:text-base">
              Un système intelligent qui ne dort jamais, ne fait pas d&apos;erreur de calcul et sécurise chaque franc.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pilier 1 */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 md:p-8 hover:border-[#f56b2a]/50 transition-all flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-6">
                  <Zap size={28} />
                </div>
                <h3 className="text-xl font-black text-white mb-3">
                  Caisse Tactile Express (POS)
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Encaissez un client en 3 secondes chrono. Recherche rapide, gestion des remises, impression ticket ou envoi de facture numérique sur WhatsApp.
                </p>
              </div>
              <ul className="space-y-2 text-xs font-semibold text-slate-300 pt-4 border-t border-slate-800">
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /> Mode tactile ultra-fluide</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /> Compatible douchette code-barres</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /> Zéro blocage réseau</li>
              </ul>
            </div>

            {/* Pilier 2 */}
            <div className="bg-slate-900/70 border border-emerald-500/30 rounded-3xl p-6 md:p-8 hover:border-emerald-500/60 transition-all flex flex-col justify-between relative shadow-lg shadow-emerald-500/5">
              <div className="absolute top-4 right-4 bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-emerald-500/30">
                Générateur de Ventes
              </div>
              <div>
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6">
                  <Store size={28} />
                </div>
                <h3 className="text-xl font-black text-white mb-3">
                  Vitrine E-Commerce Ouverte 24/7
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Votre propre boutique en ligne avec lien personnalisé. Vos clients parcourent votre catalogue, commandent et paient pendant que vous dormez.
                </p>
              </div>
              <ul className="space-y-2 text-xs font-semibold text-slate-300 pt-4 border-t border-slate-800">
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /> Stock synchronisé en direct</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /> Commande WhatsApp en 1 clic</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /> Référencement sur la marketplace</li>
              </ul>
            </div>

            {/* Pilier 3 */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 md:p-8 hover:border-blue-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-6">
                  <ShieldCheck size={28} />
                </div>
                <h3 className="text-xl font-black text-white mb-3">
                  Validation Mobile Money Automatique
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Intégration certifiée FedaPay &amp; Kkiapay. Les transferts MTN MoMo, Moov Money et Wave sont vérifiés par l&apos;opérateur avant validation de la commande.
                </p>
              </div>
              <ul className="space-y-2 text-xs font-semibold text-slate-300 pt-4 border-t border-slate-800">
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /> Zéro faux SMS ou fausse capture</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /> Pop-up de confirmation instantané</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /> Rapprochement de caisse automatique</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Comparatif Avant / Après */}
      <section id="comparatif" className="py-16 md:py-24 bg-slate-900/80 border-y border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
              Le Contraste
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-4 mb-3">
              Votre quotidien : Avant vs Après PosMarket
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Voyez concrètement comment votre commerce change de dimension.
            </p>
          </div>

          <div className="bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="grid grid-cols-2 bg-slate-900 text-xs sm:text-sm font-black text-slate-300 uppercase tracking-wider py-4 px-6 border-b border-slate-800">
              <div className="text-red-400 flex items-center gap-2">
                <XCircle size={16} />
                <span>Méthode Traditionnelle (Cahier)</span>
              </div>
              <div className="text-emerald-400 flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>Avec PosMarket</span>
              </div>
            </div>

            <div className="divide-y divide-slate-800/80 text-xs sm:text-sm">
              {[
                {
                  label: 'Clôture de caisse le soir',
                  before: '1h à 2h d\'angoisse et de calculs à la main avec risque d\'erreur',
                  after: '1 clic : rapport de caisse instantané, juste au centime près',
                },
                {
                  label: 'Quand vous quittez le magasin',
                  before: 'Peur constante des vols, des erreurs et du manque de sérieux',
                  after: 'Vous suivez chaque vente en direct sur votre smartphone où que vous soyez',
                },
                {
                  label: 'Ventes après fermeture',
                  before: 'Zéro franc : votre commerce s\'arrête dès que le rideau est baissé',
                  after: 'Vos clients commandent et paient en ligne 24h/24 sur votre vitrine',
                },
                {
                  label: 'Gestion des ruptures de stock',
                  before: 'Vous découvrez la rupture devant un client mécontent et perdez la vente',
                  after: 'Alertes automatiques dès que le stock atteint votre seuil d\'alerte',
                },
                {
                  label: 'Paiements Mobile Money',
                  before: 'Vérification manuelle stressante avec risque d\'arnaque et de faux SMS',
                  after: 'Validation sécurisée automatique par FedaPay & Kkiapay en temps réel',
                },
                {
                  label: 'Visibilité sur vos bénéfices',
                  before: 'Flou total : vous mélangez chiffre d\'affaires et bénéfice réel',
                  after: 'Calcul précis de la marge nette et des produits les plus rentables',
                },
              ].map((row, idx) => (
                <div key={idx} className="grid grid-cols-2 p-4 sm:p-6 gap-4 hover:bg-slate-900/40 transition-colors">
                  <div className="text-slate-400 pr-2">
                    <p className="font-bold text-slate-300 text-[11px] uppercase mb-1">{row.label}</p>
                    <p className="text-red-300/80 leading-snug">{row.before}</p>
                  </div>
                  <div className="text-emerald-300/90 pl-2">
                    <p className="font-bold text-slate-300 text-[11px] uppercase mb-1">{row.label}</p>
                    <p className="font-semibold leading-snug text-emerald-300">{row.after}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Le Calculateur de Rentabilité (ROI) */}
      <section className="py-16 md:py-24 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-tr from-orange-950/60 via-slate-900 to-slate-950 border border-orange-500/30 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
            <div className="w-16 h-16 rounded-3xl bg-[#f56b2a]/20 border border-[#f56b2a]/40 flex items-center justify-center text-orange-400 mx-auto mb-6">
              <TrendingUp size={32} />
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-white mb-4">
              Combien vous coûte réellement le fait de ne pas être équipé ?
            </h2>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto mb-8 leading-relaxed">
              Faisons un calcul mathématique simple et honnête :
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mb-8">
              <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800">
                <span className="text-red-400 font-black text-lg block mb-1">- 20 000 FCFA</span>
                <p className="text-xs text-slate-400">Pertes moyennes mensuelles dues aux erreurs de caisse et oublis de saisie.</p>
              </div>
              <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800">
                <span className="text-red-400 font-black text-lg block mb-1">- 45 000 FCFA</span>
                <p className="text-xs text-slate-400">Ventes perdues chaque mois par manque de vitrine web accessible le soir.</p>
              </div>
              <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800">
                <span className="text-red-400 font-black text-lg block mb-1">- 30 Heures</span>
                <p className="text-xs text-slate-400">Temps perdu chaque mois à recompter, vérifier les stocks et chercher les erreurs.</p>
              </div>
            </div>

            <div className="bg-emerald-950/50 border border-emerald-500/30 p-4 rounded-2xl text-emerald-300 text-sm sm:text-base font-bold mb-8">
              👉 L&apos;abonnement PosMarket Starter ne vous coûte que <span className="text-white font-black text-lg underline decoration-orange-500">400 FCFA par jour</span> (12 000 FCFA/mois). Moins cher qu&apos;une bouteille d&apos;eau pour sécuriser des dizaines de milliers de francs !
            </div>

            <Link
              href="/subscription"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-[#f56b2a] to-orange-500 text-white font-black text-base shadow-xl shadow-orange-500/30 hover:scale-[1.02] transition-all"
            >
              <span>Sécuriser ma boutique maintenant</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Tarifs Clairs et Transparents */}
      <section id="tarifs" className="py-16 md:py-24 bg-slate-900/60 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-[#f56b2a] bg-orange-500/10 border border-orange-500/30 px-3 py-1 rounded-full">
              Formules Claires
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-4 mb-4">
              Investissez dans la sérénité de votre entreprise
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Pas de frais cachés. Aucun engagement long terme. Paiement Mobile Money direct.
            </p>

            {/* Toggle Duration */}
            <div className="mt-8 inline-flex p-1.5 rounded-2xl bg-slate-950 border border-slate-800">
              {(['monthly', 'quarterly', 'annual'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    duration === d
                      ? 'bg-[#f56b2a] text-white shadow-lg shadow-orange-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {d === 'monthly' ? 'Mensuel' : d === 'quarterly' ? 'Trimestriel (-10%)' : 'Annuel (-20%)'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* STARTER */}
            <div className="bg-slate-950 rounded-3xl p-8 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                    <Star size={20} />
                  </div>
                  <span className="text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                    Pour démarrer
                  </span>
                </div>

                <h3 className="text-xl font-black text-white mb-2">STARTER</h3>
                <p className="text-xs text-slate-400 mb-6">Idéal pour sécuriser et automatiser votre première boutique physique.</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-white">
                      {formatCurrency(getPrice(SUBSCRIPTION_PLANS.STARTER)).replace(/\s*FCFA/i, '').trim()}
                    </span>
                    <span className="text-xs font-bold text-slate-400">FCFA / mois</span>
                  </div>
                  {duration !== 'monthly' && (
                    <span className="text-[11px] text-orange-400 font-bold">
                      Facturé {formatCurrency(getTotalPrice(SUBSCRIPTION_PLANS.STARTER))} par période
                    </span>
                  )}
                </div>

                <ul className="space-y-3 text-xs text-slate-300 mb-8 border-t border-slate-800/80 pt-6">
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> 1 Boutique physique connectée</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Caisse POS tactile express</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Jusqu&apos;à 50 produits en catalogue</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Suivi des ventes &amp; clôture de caisse</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Reçus imprimables et WhatsApp</li>
                </ul>
              </div>

              <Link
                href={duration === 'monthly' ? '/subscription' : whatsappLink('STARTER')}
                className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs text-center transition-all flex items-center justify-center gap-2"
              >
                <span>{duration === 'monthly' ? 'Choisir Starter' : 'Contacter sur WhatsApp'}</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* PRO (Highlighted) */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl p-8 border-2 border-[#f56b2a] flex flex-col justify-between relative shadow-2xl shadow-orange-500/10 scale-[1.03]">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#f56b2a] to-orange-500 text-white text-[11px] font-black uppercase tracking-wider px-4 py-1 rounded-full shadow-md">
                ⭐ Le Choix N°1 des Commerçants
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                    <Award size={20} />
                  </div>
                  <span className="text-xs font-bold text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/30">
                    Caisse + Vitrine Web
                  </span>
                </div>

                <h3 className="text-xl font-black text-white mb-2">PRO</h3>
                <p className="text-xs text-slate-400 mb-6">La formule complète pour multiplier vos ventes en magasin et en ligne.</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-white">
                      {formatCurrency(getPrice(SUBSCRIPTION_PLANS.PRO)).replace(/\s*FCFA/i, '').trim()}
                    </span>
                    <span className="text-xs font-bold text-slate-400">FCFA / mois</span>
                  </div>
                  {duration !== 'monthly' && (
                    <span className="text-[11px] text-orange-400 font-bold">
                      Facturé {formatCurrency(getTotalPrice(SUBSCRIPTION_PLANS.PRO))} par période
                    </span>
                  )}
                </div>

                <ul className="space-y-3 text-xs text-slate-300 mb-8 border-t border-slate-800/80 pt-6 font-medium">
                  <li className="flex items-center gap-2.5 text-white font-bold"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Vitrine E-Commerce 24/7 incluse</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Jusqu&apos;à 3 Boutiques gérées</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Jusqu&apos;à 500 Produits en stock</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Paiements FedaPay &amp; Kkiapay automatiques</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Rapports de marges &amp; best-sellers</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Multi-vendeurs &amp; gestion des caissiers</li>
                </ul>
              </div>

              <Link
                href={duration === 'monthly' ? '/subscription' : whatsappLink('PRO')}
                className="w-full py-4 px-4 rounded-xl bg-gradient-to-r from-[#f56b2a] to-orange-500 hover:from-orange-500 hover:to-[#f56b2a] text-white font-black text-sm text-center shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2"
              >
                <span>{duration === 'monthly' ? 'Passer à PRO' : 'Contacter sur WhatsApp'}</span>
                <ArrowRight size={16} />
              </Link>
            </div>

            {/* ENTERPRISE */}
            <div className="bg-slate-950 rounded-3xl p-8 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                    <Zap size={20} />
                  </div>
                  <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/30">
                    Multi-Établissements
                  </span>
                </div>

                <h3 className="text-xl font-black text-white mb-2">ENTREPRISE</h3>
                <p className="text-xs text-slate-400 mb-6">Pour les réseaux de boutiques, franchises et supermarchés ambitieux.</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-white">
                      {formatCurrency(getPrice(SUBSCRIPTION_PLANS.ENTERPRISE)).replace(/\s*FCFA/i, '').trim()}
                    </span>
                    <span className="text-xs font-bold text-slate-400">FCFA / mois</span>
                  </div>
                  {duration !== 'monthly' && (
                    <span className="text-[11px] text-orange-400 font-bold">
                      Facturé {formatCurrency(getTotalPrice(SUBSCRIPTION_PLANS.ENTERPRISE))} par période
                    </span>
                  )}
                </div>

                <ul className="space-y-3 text-xs text-slate-300 mb-8 border-t border-slate-800/80 pt-6">
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Boutiques illimitées</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Produits illimités</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Reçus et factures personnalisés à votre logo</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Support dédié WhatsApp prioritaire 7j/7</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Formation d&apos;équipe sur site ou visio</li>
                </ul>
              </div>

              <Link
                href={duration === 'monthly' ? '/subscription' : whatsappLink('ENTERPRISE')}
                className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs text-center transition-all flex items-center justify-center gap-2"
              >
                <span>{duration === 'monthly' ? 'Choisir Entreprise' : 'Contacter sur WhatsApp'}</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Témoignages / Preuve Sociale */}
      <section className="py-16 md:py-24 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
              Témoignages Réels
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-4 mb-3">
              Ils ont transformé leur commerce avec PosMarket
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Découvrez les retours de commerçants qui ont retrouvé le sommeil et multiplié leurs ventes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Fatima Z.',
                role: 'Boutique de Mode & Prêt-à-porter (Cotonou)',
                text: 'Avant PosMarket, chaque fin de mois était une source de dispute avec mes vendeuses pour des trous de 30 000 à 50 000 FCFA. Aujourd’hui, chaque vente est enregistrée avec son nom. La caisse est nette tous les soirs, et mes clientes commandent sur ma vitrine même le dimanche !',
                stars: 5,
              },
              {
                name: 'Serge K.',
                role: 'Supérette & Alimentation Générale (Abidjan)',
                text: 'Ce qui a tout changé pour moi, c’est de pouvoir aller aux obsèques de mon oncle sans fermer la boutique et sans avoir peur. J’ouvrais mon téléphone et je voyais les encaissements en direct. PosMarket m’a redonné ma liberté.',
                stars: 5,
              },
              {
                name: 'Awa D.',
                role: 'Cosmétiques & Parfumerie (Lomé)',
                text: 'Le système de paiement Mobile Money avec FedaPay est magique. Finies les arnaques de faux SMS de transfert. Dès que le client paie, mon téléphone valide la vente. Je ne reviendrai plus jamais au cahier en papier.',
                stars: 5,
              },
            ].map((t, idx) => (
              <div key={idx} className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <div className="flex gap-1 text-amber-400 mb-4">
                    {[...Array(t.stars)].map((_, i) => (
                      <Star key={i} size={16} fill="currentColor" />
                    ))}
                  </div>
                  <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6 italic">
                    &quot;{t.text}&quot;
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-800">
                  <h4 className="font-bold text-white text-sm">{t.name}</h4>
                  <p className="text-[11px] text-slate-400">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Accordéon */}
      <section id="faq" className="py-16 md:py-24 bg-slate-900/60 border-y border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-[#f56b2a] bg-orange-500/10 border border-orange-500/30 px-3 py-1 rounded-full">
              Foire Aux Questions
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-4 mb-3">
              Toutes vos questions, des réponses simples
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Tout ce que vous devez savoir avant de faire décoller votre boutique.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'Est-ce difficile à utiliser si je ne m\'y connais pas en informatique ?',
                a: 'Pas du tout ! PosMarket a été conçu pour être aussi simple d\'utilisation que WhatsApp. Si vous savez envoyer un message sur votre téléphone, vous saurez enregistrer une vente en moins de 3 minutes. De plus, notre équipe vous accompagne pas à pas.',
              },
              {
                q: 'Ai-je besoin d\'acheter un ordinateur cher ou une machine spéciale ?',
                a: 'Non ! PosMarket fonctionne parfaitement sur n\'importe quel smartphone Android/iPhone, tablette ou ordinateur portable que vous possédez déjà. Zéro investissement matériel obligatoire.',
              },
              {
                q: 'Que se passe-t-il si la connexion Internet est lente dans mon quartier ?',
                a: 'L\'application est ultra-légère et optimisée pour les réseaux mobiles africains (3G/4G). Elle consomme très peu de données et reste ultra-fluide au quotidien.',
              },
              {
                q: 'Comment mes clients paient-ils sur ma vitrine en ligne ?',
                a: 'Vos clients peuvent payer instantanément par MTN Mobile Money, Moov Money, Wave ou Carte bancaire grâce à nos passerelles sécurisées FedaPay & Kkiapay. L\'argent arrive directement sur votre compte.',
              },
              {
                q: 'Puis-je changer de formule ou arrêter quand je veux ?',
                a: 'Absolument. Vous êtes 100% libre. Vous pouvez passer d\'une formule Starter à Pro à tout moment, ou arrêter votre abonnement sans aucune pénalité.',
              },
              {
                q: 'Comment démarrer dès aujourd\'hui ?',
                a: 'Il vous suffit de cliquer sur le bouton "Ouvrir ma boutique", de choisir votre formule (ex: Pro à 15 000 FCFA) et de valider votre paiement Mobile Money. Votre compte est activé instantanément !',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 text-left font-bold text-white flex items-center justify-between gap-4 hover:text-orange-400 transition-colors"
                >
                  <span className="text-sm sm:text-base">{item.q}</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                      openFaq === idx ? 'rotate-180 text-orange-400' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="p-5 pt-0 text-slate-400 text-xs sm:text-sm leading-relaxed border-t border-slate-800/50">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hero CTA Final */}
      <section className="py-20 md:py-32 relative overflow-hidden text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#f56b2a] to-orange-400 flex items-center justify-center text-white mx-auto mb-8 shadow-2xl shadow-orange-500/40 animate-bounce-subtle">
            <Store size={40} />
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white mb-6 leading-tight">
            Votre réussite mérite les meilleurs outils. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-[#f56b2a] to-amber-300">
              Passez au commerce moderne aujourd&apos;hui.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Rejoignez des centaines de commerçants qui ont éliminé le stress des erreurs de caisse et font fructifier leur boutique 24h/24.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <Link
              href="/subscription"
              className="w-full sm:w-auto px-10 py-4 rounded-2xl bg-gradient-to-r from-[#f56b2a] to-orange-500 hover:from-orange-500 hover:to-[#f56b2a] text-white font-black text-base shadow-2xl shadow-orange-500/40 hover:scale-[1.03] transition-all flex items-center justify-center gap-2"
            >
              <span>Démarrer maintenant</span>
              <ArrowRight size={18} />
            </Link>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 border border-slate-700 text-slate-200 font-bold text-base hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <MessageCircle size={18} className="text-emerald-400" />
              <span>Contacter un conseiller</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/80 py-12 text-slate-500 text-xs text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#f56b2a] flex items-center justify-center text-white">
              <Store size={14} />
            </div>
            <span className="font-black text-sm text-white">PosMarket</span>
            <span className="text-slate-600">|</span>
            <span>La plateforme des commerçants gagnants</span>
          </div>

          <div className="flex items-center gap-6 font-semibold">
            <Link href="/" className="hover:text-slate-300 transition-colors">Accueil</Link>
            <Link href="/subscription" className="hover:text-slate-300 transition-colors">Abonnements</Link>
            <Link href="/cgv" className="hover:text-slate-300 transition-colors">CGV</Link>
            <Link href="/confidentialite" className="hover:text-slate-300 transition-colors">Confidentialité</Link>
          </div>

          <p className="text-slate-600">
            &copy; {new Date().getFullYear()} PosMarket Inc. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
