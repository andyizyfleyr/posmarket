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
  Store,
  ArrowRight,
  MessageCircle,
  ChevronDown,
  Star,
  Award,
  Sparkles,
  Receipt,
  ShoppingBag,
  HeartHandshake,
  BarChart3,
  Flame,
  CreditCard,
  Layers,
  Package,
  Check
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@/constants';
import { formatCurrency } from '@/utils';

export default function BeOpenClient() {
  const [duration, setDuration] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [activeTab, setActiveTab] = useState<'pos' | 'storefront' | 'momo' | 'reports'>('pos');
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
      ? `Bonjour l'équipe PosMarket, je souhaite activer mon abonnement ${planName}. Pouvez-vous m'accompagner ?`
      : `Bonjour l'équipe PosMarket, je suis commerçant et je souhaite être accompagné pour lancer ma boutique et ma caisse.`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-[#f56b2a] selection:text-white pb-24 md:pb-0">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-orange-600 via-[#f56b2a] to-amber-500 text-white text-xs py-2 px-3 text-center font-bold flex items-center justify-center gap-1.5 shadow-xs sticky top-0 z-50">
        <Sparkles size={14} className="text-amber-200 shrink-0" />
        <span className="truncate">Accompagnement VIP offert : Boutique &amp; caisse configurées en 10 min !</span>
        <a
          href={whatsappLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-orange-100 shrink-0 font-black ml-1"
        >
          En profiter &rarr;
        </a>
      </div>

      {/* 2. Navigation */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-[33px] z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#f56b2a] flex items-center justify-center shadow-md shadow-orange-500/20 text-white font-black">
              <Store size={22} />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tight text-slate-900">
                Pos<span className="text-[#f56b2a]">Market</span>
              </span>
              <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest -mt-1">
                Espace Commerçant
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-bold text-slate-600">
            <a href="#features" className="hover:text-[#f56b2a] transition-colors">Fonctionnalités</a>
            <a href="#comparatif" className="hover:text-[#f56b2a] transition-colors">Comparatif</a>
            <a href="#tarifs" className="hover:text-[#f56b2a] transition-colors">Tarifs</a>
            <a href="#faq" className="hover:text-[#f56b2a] transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-[#f56b2a]"
            >
              Connexion
            </Link>
            <Link
              href="/subscription"
              className="px-4 py-2.5 rounded-xl bg-[#f56b2a] hover:bg-[#e05a1d] text-white text-xs sm:text-sm font-black shadow-md shadow-orange-500/25 flex items-center gap-1.5 transition-all"
            >
              <span>Démarrer</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* 3. Hero Section (Clean, Punchy, High Impact) */}
      <section className="pt-8 pb-14 sm:pt-14 sm:pb-20 bg-gradient-to-b from-orange-50/70 via-white to-slate-50 border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Copywriting */}
            <div className="lg:col-span-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-700 text-xs font-extrabold mb-4">
                <Flame size={14} className="text-[#f56b2a]" />
                <span>La Solution n°1 des Commerces Modernes</span>
              </div>

              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-4">
                Fini le cahier et les trous de caisse. <br />
                <span className="text-[#f56b2a]">
                  Pilotez votre boutique &amp; vendez 24h/24.
                </span>
              </h1>

              <p className="text-sm sm:text-base md:text-lg text-slate-600 mb-6 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
                Transformez votre smartphone en <strong className="text-slate-900">Caisse Enregistreuse Tactile</strong> et en <strong className="text-emerald-600">Boutique en Ligne avec Mobile Money</strong>. Suivez vos ventes, vos stocks et vos bénéfices en temps réel, où que vous soyez.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-8">
                <Link
                  href="/subscription"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#f56b2a] hover:bg-[#e05a1d] text-white font-black text-sm shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                >
                  <span>Activer ma caisse &amp; boutique</span>
                  <ArrowRight size={16} />
                </Link>
                <a
                  href={whatsappLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xs"
                >
                  <MessageCircle size={18} className="text-emerald-600" />
                  <span>Aide WhatsApp</span>
                </a>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-2 text-[11px] sm:text-xs font-bold text-slate-600 max-w-md mx-auto lg:mx-0">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                  <span className="text-emerald-600 block font-black text-xs sm:text-sm">MTN &amp; Moov</span>
                  <span>Mobile Money</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                  <span className="text-[#f56b2a] block font-black text-xs sm:text-sm">0 Matériel</span>
                  <span>Smartphone/PC</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                  <span className="text-purple-600 block font-black text-xs sm:text-sm">5 Minutes</span>
                  <span>Prise en main</span>
                </div>
              </div>
            </div>

            {/* Right: UI Interactive Mockup Card */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-3xl p-5 shadow-xl border border-slate-200/80 relative">
                {/* Header of Mockup */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-black text-slate-900">Caisse PosMarket Active</span>
                  </div>
                  <span className="text-[10px] font-bold bg-orange-50 text-orange-700 px-2 py-0.5 rounded-md border border-orange-200">
                    Boutique Principale
                  </span>
                </div>

                {/* Simulated Order Items */}
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 text-[#f56b2a] flex items-center justify-center font-black text-xs">
                        👗
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-slate-800 leading-tight">Robe Wax Soie</p>
                        <p className="text-[10px] text-slate-500">Qté: 1 • Réf: #WX-04</p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-slate-900">15 000 FCFA</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-xs">
                        🧴
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-slate-800 leading-tight">Lotion Hydratante</p>
                        <p className="text-[10px] text-slate-500">Qté: 2 • En stock: 14</p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-slate-900">7 000 FCFA</span>
                  </div>
                </div>

                {/* Total & Payment Pill */}
                <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Total à Encaisser</span>
                    <span className="text-lg font-black text-white">22 000 FCFA</span>
                  </div>
                  <span className="text-[11px] font-black bg-emerald-500 text-white px-3 py-1.5 rounded-xl shadow-xs">
                    ✓ Encaisser (MoMo)
                  </span>
                </div>

                {/* Live Stats Footnote */}
                <div className="grid grid-cols-2 gap-2 text-center text-[11px] font-extrabold text-slate-600">
                  <div className="bg-orange-50/70 p-2 rounded-xl border border-orange-100 text-orange-800">
                    📈 CA du jour : <span className="font-black">185 000 F</span>
                  </div>
                  <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-100 text-emerald-800">
                    📦 0 Rupture de stock
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. Section Fonctionnalités Clés (Visuelle & Interactive) */}
      <section id="features" className="py-12 sm:py-16 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-black uppercase tracking-wider text-[#f56b2a] bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
              Ce que vous obtenez
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 mb-2">
              Les 4 Outils Indispensables à Votre Commerce
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm">
              Tout est pensé pour vous faire gagner du temps et éliminer les erreurs.
            </p>
          </div>

          {/* Interactive Feature Tabs */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-3 mb-8 overflow-x-auto pb-2 no-scrollbar">
            {[
              { id: 'pos' as const, label: 'Caisse POS Tactile', icon: Zap },
              { id: 'storefront' as const, label: 'Vitrine Web 24/7', icon: ShoppingBag },
              { id: 'momo' as const, label: 'Mobile Money Sécurisé', icon: CreditCard },
              { id: 'reports' as const, label: 'Bilan & Bénéfices', icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#f56b2a] text-white shadow-md shadow-orange-500/25'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Feature Tab Content Cards */}
          <div className="bg-slate-50 rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xs">
            {activeTab === 'pos' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#f56b2a] flex items-center justify-center mb-4">
                    <Zap size={22} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-3">
                    Caisse Tactile Express &amp; Reçus WhatsApp
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-5 font-medium">
                    Encaissez vos clients en 3 secondes depuis votre téléphone. Vos vendeurs sélectionnent les articles, appliquent des remises et impriment le ticket ou l&apos;envoient sur le WhatsApp du client.
                  </p>
                  <ul className="space-y-2 text-xs font-bold text-slate-700">
                    <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Recherche instantanée par nom ou code-barres</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Envoi direct du reçu digital par WhatsApp</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Clôture de caisse quotidienne en 1 clic sans erreur</li>
                  </ul>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-left">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <span className="text-xs font-black text-slate-800">Aperçu Caisse Express</span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">En direct</span>
                  </div>
                  <div className="space-y-2 text-xs font-medium text-slate-600 mb-4">
                    <div className="flex justify-between"><span>Ventes aujourd&apos;hui :</span> <strong className="text-slate-900">28 transactions</strong></div>
                    <div className="flex justify-between"><span>Total encaissé :</span> <strong className="text-emerald-600 font-bold">245 000 FCFA</strong></div>
                    <div className="flex justify-between"><span>Écart de caisse :</span> <strong className="text-emerald-600 font-bold">0 FCFA (Conforme)</strong></div>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-xl text-orange-900 text-xs font-bold flex items-center gap-2">
                    <Receipt size={16} className="text-[#f56b2a]" />
                    <span>Reçu #891 envoyé à +229 97 00 00 00</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'storefront' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                    <ShoppingBag size={22} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-3">
                    Votre Vitrine E-Commerce Ouverte 24h/24
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-5 font-medium">
                    Ne perdez plus les clients qui cherchent vos produits le soir. Partagez votre lien de boutique personnalisé sur WhatsApp, TikTok et Instagram pour recevoir des commandes automatiques.
                  </p>
                  <ul className="space-y-2 text-xs font-bold text-slate-700">
                    <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Catalogue produits toujours à jour</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Déduction automatique du stock en boutique</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Commande et paiement Mobile Money direct</li>
                  </ul>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-left">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black">
                      🛒
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900">Boutique en Ligne Active</p>
                      <p className="text-[10px] text-slate-500">posmarket.com/store/votre-boutique</p>
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900 text-xs font-bold">
                    ✨ 3 nouvelles commandes reçues pendant la nuit (+48 000 FCFA)
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'momo' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                    <CreditCard size={22} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-3">
                    Zéro Faux SMS : Validation Mobile Money Certifiée
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-5 font-medium">
                    Fini le stress des fausses captures d&apos;écran. Grâce à l&apos;intégration FedaPay (MTN/Moov) et Kkiapay (Wave/CB), le paiement est vérifié directement par l&apos;opérateur avant confirmation de la vente.
                  </p>
                  <ul className="space-y-2 text-xs font-bold text-slate-700">
                    <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Confirmation instantanée et infalsifiable</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Support MTN Mobile Money, Moov Money, Wave</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Pop-up animé de validation immédiat</li>
                  </ul>
                </div>
                <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 text-left">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-emerald-400">✓ Transaction FedaPay Approuvée</span>
                    <span className="text-[10px] text-slate-400">Réf: #8641</span>
                  </div>
                  <p className="text-2xl font-black text-white mb-2">15 000 FCFA</p>
                  <p className="text-xs text-slate-300 font-medium">Compte crédité avec succès • Abonnement / Commande validée.</p>
                </div>
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4">
                    <BarChart3 size={22} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-3">
                    Bénéfices Nets &amp; Suivi Multi-Caissiers
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-5 font-medium">
                    Sachez exactement combien vous gagnez chaque jour. Suivez les performances de chaque vendeur et découvrez vos articles les plus rentables en un clin d&apos;œil.
                  </p>
                  <ul className="space-y-2 text-xs font-bold text-slate-700">
                    <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Calcul automatique des marges bénéficiaires</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Traçabilité nominative de chaque caissier</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Alertes automatiques de stock critique</li>
                  </ul>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-left">
                  <p className="text-xs font-black text-slate-800 mb-3">Statistiques de la semaine</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Chiffre d&apos;affaires :</span>
                      <strong className="text-slate-900">1 420 000 FCFA</strong>
                    </div>
                    <div className="flex justify-between p-2 bg-emerald-50 rounded-lg text-emerald-800">
                      <span>Marge bénéficiaire nette :</span>
                      <strong className="font-bold">+520 000 FCFA</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* 5. Comparatif Synthétique (Sans vs Avec) */}
      <section id="comparatif" className="py-12 sm:py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-3xl font-black text-slate-900 mb-2">
              Le Choix Entre le Stress et la Liberté
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm">
              Voyez concrètement ce qui change dès le premier jour.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm text-xs sm:text-sm">
            <div className="grid grid-cols-2 bg-slate-900 text-white font-black py-3.5 px-4 sm:px-6 uppercase tracking-wider text-[11px] sm:text-xs">
              <div className="text-red-400 flex items-center gap-1.5"><XCircle size={15} /> Sans PosMarket</div>
              <div className="text-emerald-400 flex items-center gap-1.5"><CheckCircle2 size={15} /> Avec PosMarket</div>
            </div>

            <div className="divide-y divide-slate-100">
              {[
                {
                  label: 'Comptes du soir',
                  before: '1h de calculs stressants au cahier',
                  after: 'Rapport instantané en 1 clic',
                },
                {
                  label: 'Absence du magasin',
                  before: 'Peur constante des vols & erreurs',
                  after: 'Suivi des ventes en direct sur smartphone',
                },
                {
                  label: 'Ventes après fermeture',
                  before: '0 franc : rideau baissé',
                  after: 'Commandes 24h/24 sur votre vitrine web',
                },
                {
                  label: 'Paiements Mobile Money',
                  before: 'Risque de fausses captures d\'écran',
                  after: 'Validation automatique MTN / Moov',
                },
              ].map((row, idx) => (
                <div key={idx} className="grid grid-cols-2 p-3.5 sm:p-4 gap-3">
                  <div className="text-slate-600 font-medium">{row.before}</div>
                  <div className="text-emerald-700 font-bold">{row.after}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. Tarifs Clairs et Directs */}
      <section id="tarifs" className="py-12 sm:py-18 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-black uppercase tracking-wider text-[#f56b2a] bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
              Tarification Simple
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 mb-2">
              Des Tarifs Clairs, Rentabilisés Dès le 1er Jour
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm">
              Activation immédiate par Mobile Money. Sans engagement.
            </p>

            {/* Toggle Duration */}
            <div className="mt-6 inline-flex p-1 rounded-2xl bg-slate-100 border border-slate-200">
              {(['monthly', 'quarterly', 'annual'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    duration === d
                      ? 'bg-[#f56b2a] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d === 'monthly' ? 'Mensuel' : d === 'quarterly' ? 'Trimestriel (-10%)' : 'Annuel (-20%)'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            
            {/* STARTER */}
            <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase text-slate-700 bg-white px-3 py-1 rounded-full border border-slate-200">
                    Starter
                  </span>
                  <span className="text-[11px] font-bold text-slate-500">1 Boutique</span>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">
                      {formatCurrency(getPrice(SUBSCRIPTION_PLANS.STARTER)).replace(/\s*FCFA/i, '').trim()}
                    </span>
                    <span className="text-xs font-bold text-slate-500">FCFA / mois</span>
                  </div>
                  {duration !== 'monthly' && (
                    <span className="text-[10px] text-orange-600 font-bold block mt-0.5">
                      Total : {formatCurrency(getTotalPrice(SUBSCRIPTION_PLANS.STARTER))}
                    </span>
                  )}
                </div>

                <ul className="space-y-2.5 text-xs text-slate-700 mb-6 border-t border-slate-200 pt-4 font-medium">
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Caisse POS tactile express</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> 1 Boutique connectée</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Jusqu&apos;à 50 produits</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Reçus imprimables &amp; WhatsApp</li>
                </ul>
              </div>

              <Link
                href={duration === 'monthly' ? '/subscription' : whatsappLink('STARTER')}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs text-center transition-all"
              >
                {duration === 'monthly' ? 'Choisir Starter' : 'Contacter sur WhatsApp'}
              </Link>
            </div>

            {/* PRO (Populaire) */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#f56b2a] flex flex-col justify-between relative shadow-xl shadow-orange-500/10 scale-[1.02]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#f56b2a] text-white text-[10px] font-black uppercase px-3 py-0.5 rounded-full shadow-xs">
                ⭐ Le Plus Choisi
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase text-orange-700 bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
                    Pro
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600">Caisse + Vitrine Web</span>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">
                      {formatCurrency(getPrice(SUBSCRIPTION_PLANS.PRO)).replace(/\s*FCFA/i, '').trim()}
                    </span>
                    <span className="text-xs font-bold text-slate-500">FCFA / mois</span>
                  </div>
                  {duration !== 'monthly' && (
                    <span className="text-[10px] text-orange-600 font-bold block mt-0.5">
                      Total : {formatCurrency(getTotalPrice(SUBSCRIPTION_PLANS.PRO))}
                    </span>
                  )}
                </div>

                <ul className="space-y-2.5 text-xs text-slate-800 mb-6 border-t border-slate-100 pt-4 font-bold">
                  <li className="flex items-center gap-2 text-orange-600"><Check size={15} className="text-[#f56b2a]" /> Vitrine E-Commerce 24/7 incluse</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Jusqu&apos;à 3 Boutiques</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Jusqu&apos;à 500 Produits</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Paiements Mobile Money FedaPay &amp; Kkiapay</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Rapports de marges &amp; best-sellers</li>
                </ul>
              </div>

              <Link
                href={duration === 'monthly' ? '/subscription' : whatsappLink('PRO')}
                className="w-full py-3.5 px-4 rounded-xl bg-[#f56b2a] hover:bg-[#e05a1d] text-white font-black text-xs text-center shadow-md shadow-orange-500/25 transition-all flex items-center justify-center gap-1.5"
              >
                <span>{duration === 'monthly' ? 'Passer à PRO' : 'Contacter sur WhatsApp'}</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* ENTERPRISE */}
            <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                    Entreprise
                  </span>
                  <span className="text-[11px] font-bold text-slate-500">Multi-Boutiques</span>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">
                      {formatCurrency(getPrice(SUBSCRIPTION_PLANS.ENTERPRISE)).replace(/\s*FCFA/i, '').trim()}
                    </span>
                    <span className="text-xs font-bold text-slate-500">FCFA / mois</span>
                  </div>
                  {duration !== 'monthly' && (
                    <span className="text-[10px] text-orange-600 font-bold block mt-0.5">
                      Total : {formatCurrency(getTotalPrice(SUBSCRIPTION_PLANS.ENTERPRISE))}
                    </span>
                  )}
                </div>

                <ul className="space-y-2.5 text-xs text-slate-700 mb-6 border-t border-slate-200 pt-4 font-medium">
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Boutiques illimitées</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Produits illimités</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Factures avec votre logo</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Support dédié WhatsApp 7j/7</li>
                </ul>
              </div>

              <Link
                href={duration === 'monthly' ? '/subscription' : whatsappLink('ENTERPRISE')}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs text-center transition-all"
              >
                {duration === 'monthly' ? 'Choisir Entreprise' : 'Contacter sur WhatsApp'}
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* 7. FAQ Concis & Clair */}
      <section id="faq" className="py-12 sm:py-16 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">
              Questions Fréquentes
            </h2>
            <p className="text-slate-500 text-xs">Tout ce que vous devez savoir pour démarrer sereinement.</p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'Ai-je besoin d\'un ordinateur cher pour utiliser PosMarket ?',
                a: 'Non ! PosMarket fonctionne parfaitement sur votre smartphone Android, iPhone, tablette ou ordinateur portable.',
              },
              {
                q: 'Comment mes clients paient-ils par Mobile Money ?',
                a: 'Ils paient directement par MTN MoMo, Moov Money ou Wave via nos intégrations certifiées FedaPay & Kkiapay. Vous recevez l\'argent directement.',
              },
              {
                q: 'Puis-je arrêter mon abonnement à tout moment ?',
                a: 'Oui, vous êtes totalement libre. Aucun engagement, vous pouvez changer de formule ou suspendre quand vous le souhaitez.',
              },
            ].map((item, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 text-left font-bold text-xs sm:text-sm text-slate-900 flex items-center justify-between gap-3"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-slate-400 transition-transform ${openFaq === idx ? 'rotate-180 text-[#f56b2a]' : ''}`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="p-4 pt-0 text-slate-600 text-xs font-medium border-t border-slate-100">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Mobile Sticky Bottom Action Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 shadow-2xl flex items-center justify-between gap-3">
        <div className="text-left pl-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Formule Starter</span>
          <span className="text-sm font-black text-slate-900">12 000 FCFA <span className="text-[10px] font-bold text-slate-400">/mois</span></span>
        </div>
        <Link
          href="/subscription"
          className="flex-1 max-w-[200px] py-2.5 px-4 rounded-xl bg-[#f56b2a] text-white font-black text-xs text-center shadow-md shadow-orange-500/25 flex items-center justify-center gap-1.5"
        >
          <span>Démarrer</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* 9. Simple Clean Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 text-xs text-slate-500 text-center">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Store size={16} className="text-[#f56b2a]" />
            <span className="font-bold text-slate-900">PosMarket</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4 font-semibold text-slate-600">
            <Link href="/" className="hover:text-[#f56b2a]">Accueil</Link>
            <Link href="/subscription" className="hover:text-[#f56b2a]">Abonnements</Link>
            <Link href="/cgv" className="hover:text-[#f56b2a]">CGV</Link>
            <Link href="/confidentialite" className="hover:text-[#f56b2a]">Confidentialité</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
