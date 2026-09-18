'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  Check,
  HelpCircle,
  Truck,
  Sun,
  Moon,
  PackageCheck,
  UserCheck,
  BookOpen,
  FileText,
  Users,
  BellRing
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
      ? `Bonjour l'équipe PosMarket, je souhaite activer mon abonnement ${planName}. Pouvez-vous m'accompagner ?`
      : `Bonjour l'équipe PosMarket, je suis commerçant et je souhaite être accompagné pour lancer ma boutique et ma caisse.`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-[#f56b2a] selection:text-white pb-24 md:pb-0">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-orange-600 via-[#f56b2a] to-amber-500 text-white text-xs py-2.5 px-3 text-center font-bold flex items-center justify-center gap-2 shadow-xs sticky top-0 z-50">
        <Sparkles size={15} className="text-amber-200 shrink-0" />
        <span className="truncate">Accompagnement offert : Boutique et caisse configurées en 10 minutes avec notre équipe</span>
        <a
          href={whatsappLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-orange-100 shrink-0 font-extrabold ml-1"
        >
          En profiter &rarr;
        </a>
      </div>

      {/* 2. Navigation */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-[37px] z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#f56b2a] flex items-center justify-center shadow-md shadow-orange-500/20 text-white font-extrabold">
              <Store size={22} />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-slate-900">
                Pos<span className="text-[#f56b2a]">Market</span>
              </span>
              <span className="text-[10px] font-bold text-orange-600 -mt-1">
                Espace commerçant
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-[#f56b2a] transition-colors">Ce que vous gagnez</a>
            <a href="#timeline" className="hover:text-[#f56b2a] transition-colors">Une journée type</a>
            <a href="#comparatif" className="hover:text-[#f56b2a] transition-colors">Comparatif</a>
            <a href="#tarifs" className="hover:text-[#f56b2a] transition-colors">Tarifs</a>
            <a href="#faq" className="hover:text-[#f56b2a] transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-[#f56b2a]"
            >
              Connexion
            </Link>
            <Link
              href="/subscription"
              className="px-4 py-2.5 rounded-xl bg-[#f56b2a] hover:bg-[#e05a1d] text-white text-xs sm:text-sm font-bold shadow-md shadow-orange-500/25 flex items-center gap-1.5 transition-all"
            >
              <span>Démarrer</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* 3. Hero Section (Langage simple, concret et humain) */}
      <section className="pt-8 pb-14 sm:pt-14 sm:pb-20 bg-gradient-to-b from-orange-50/70 via-white to-slate-50 border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Copywriting */}
            <div className="lg:col-span-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100 border border-orange-200 text-orange-800 text-xs font-bold mb-4">
                <Flame size={15} className="text-[#f56b2a]" />
                <span>Pour les commerçants qui veulent avoir l&apos;esprit tranquille</span>
              </div>

              <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight mb-4">
                Fini le cahier et les erreurs de caisse. <br />
                <span className="text-[#f56b2a]">
                  Vendez en boutique et en ligne sans prise de tête.
                </span>
              </h1>

              <p className="text-sm sm:text-base md:text-lg text-slate-600 mb-6 font-normal leading-relaxed max-w-xl mx-auto lg:mx-0">
                Transformez votre simple téléphone en caisse enregistreuse et en boutique en ligne ouverte jour et nuit. Encaissez par Mobile Money ou à la livraison, évitez les vols et sachez exactement ce que vous gagnez chaque jour.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-8">
                <Link
                  href="/subscription"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#f56b2a] hover:bg-[#e05a1d] text-white font-bold text-sm shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                >
                  <span>Démarrer avec ma boutique</span>
                  <ArrowRight size={16} />
                </Link>
                <a
                  href={whatsappLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-xs"
                >
                  <MessageCircle size={18} className="text-emerald-600" />
                  <span>Aide WhatsApp</span>
                </a>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-2 text-[11px] sm:text-xs font-semibold text-slate-600 max-w-md mx-auto lg:mx-0">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                  <span className="text-emerald-600 block font-bold text-xs sm:text-sm">Mobile Money</span>
                  <span>Et livraison</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                  <span className="text-[#f56b2a] block font-bold text-xs sm:text-sm">Zéro machine chère</span>
                  <span>Votre téléphone suffit</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                  <span className="text-purple-600 block font-bold text-xs sm:text-sm">Prêt en 5 min</span>
                  <span>Simple comme bonjour</span>
                </div>
              </div>
            </div>

            {/* Right: Real Photography Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-slate-900 group">
                <div className="relative h-80 sm:h-96 w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/beopen/hero_pos_shop.jpg"
                    alt="Commerçante souriante avec caisse enregistreuse PosMarket"
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                </div>

                {/* Floating Top Badge */}
                <div className="absolute top-3.5 right-3.5 bg-white/95 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 shadow-lg border border-slate-100 flex items-center gap-2.5 animate-bounce-subtle">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    ✓
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-emerald-600">Vente validée</p>
                    <p className="text-xs font-bold text-slate-900">15 000 FCFA (Mobile Money)</p>
                  </div>
                </div>

                {/* Floating Bottom Badge */}
                <div className="absolute bottom-3.5 left-3.5 bg-slate-950/90 backdrop-blur-md text-white rounded-2xl p-3 border border-slate-700 flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-semibold">Caisse et boutique synchronisées</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. Section 3 Piliers Visuels avec Vraies Photos */}
      <section id="features" className="py-14 sm:py-20 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-[#f56b2a] bg-orange-50 border border-orange-200 px-3.5 py-1.5 rounded-full">
              Ce que PosMarket fait pour votre quotidien
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 mt-4 mb-2">
              Votre commerce géré simplement, sans fatigue ni stress
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-normal">
              Des outils concrets et faciles à utiliser pour vous soulager du matin au soir.
            </p>
          </div>

          <div className="space-y-16">
            
            {/* Feature 1 : Caisse Tactile & Reçus WhatsApp */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 order-2 lg:order-1">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#f56b2a] flex items-center justify-center mb-4 font-bold">
                  <Zap size={20} />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-3">
                  1. Une caisse facile sur votre téléphone et reçus sur WhatsApp
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-5 font-normal">
                  Quand un client arrive, trouvez son article en 3 secondes. L&apos;application calcule la monnaie exacte sans que vous ayez à sortir une calculatrice. Envoyez un joli reçu par WhatsApp ou imprimez un ticket de caisse en un clin d&apos;œil.
                </p>
                <div className="grid grid-cols-2 gap-2.5 text-xs font-semibold text-slate-700">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Recherche d&apos;article en 1 clic</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Reçus WhatsApp instantanés</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Calcul de monnaie sans erreur</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Scanner code-barres avec caméra</span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-6 order-1 lg:order-2">
                <div className="rounded-3xl overflow-hidden shadow-xl border-4 border-white bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/beopen/pos_checkout_touch.jpg"
                    alt="Caisse tactile et imprimante de reçus"
                    className="w-full h-72 sm:h-80 object-cover object-center"
                  />
                </div>
              </div>
            </div>

            {/* Feature 2 : Boutique en Ligne 24/7 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6">
                <div className="rounded-3xl overflow-hidden shadow-xl border-4 border-white bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/beopen/storefront_online_order.jpg"
                    alt="Commande en ligne sur vitrine e-commerce 24/7"
                    className="w-full h-72 sm:h-80 object-cover object-center"
                  />
                </div>
              </div>
              <div className="lg:col-span-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 font-bold">
                  <ShoppingBag size={20} />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-3">
                  2. Votre boutique en ligne ouverte même pendant votre sommeil
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-5 font-normal">
                  Partagez votre lien de boutique dans votre statut WhatsApp, sur Facebook ou TikTok. Vos clients découvrent vos nouveautés à toute heure, passent commande et paient. Le stock en magasin se met à jour tout seul.
                </p>
                <div className="grid grid-cols-2 gap-2.5 text-xs font-semibold text-slate-700">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Lien boutique à votre nom</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Commandes directes WhatsApp</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Zéro commission sur vos ventes</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Stock synchronisé en direct</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 3 : Bénéfices & Paiements Sécurisés */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 order-2 lg:order-1">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4 font-bold">
                  <BarChart3 size={20} />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-3">
                  3. Vos vrais bénéfices en poche et zéro faux SMS
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-5 font-normal">
                  Chaque paiement Mobile Money est vérifié automatiquement, fini les fausses captures d&apos;écran ou les arnaques. Le soir, découvrez votre vrai bénéfice net après déduction de vos prix d&apos;achat et de vos dépenses du magasin.
                </p>
                <div className="grid grid-cols-2 gap-2.5 text-xs font-semibold text-slate-700">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Zéro faux SMS Mobile Money</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Paiement à la livraison suivi</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Calcul automatique de votre bénéfice</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Alerte avant d&apos;être en rupture</span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-6 order-1 lg:order-2">
                <div className="rounded-3xl overflow-hidden shadow-xl border-4 border-white bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/beopen/merchant_dashboard_growth.jpg"
                    alt="Commerçant confiant avec tableau de bord et marges nettes"
                    className="w-full h-72 sm:h-80 object-cover object-center"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Section Grand Guide des Fonctionnalités : Langage Simple et Concret */}
      <section className="py-14 sm:py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold text-[#f56b2a] bg-orange-100 border border-orange-200 px-3.5 py-1.5 rounded-full">
              Toutes les fonctionnalités expliquées simplement
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 mt-4 mb-2">
              Tout ce dont votre commerce a besoin, sans jargon technique
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-normal">
              Fini les cahiers brouillons, les calculatrices perdues et les doutes sur vos chiffres. Voici tout ce que vous pouvez faire avec votre téléphone.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. Carnet de dettes & crédits */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#f56b2a] flex items-center justify-center mb-4">
                <BookOpen size={20} />
              </div>
              <h4 className="font-bold text-base text-slate-900 mb-2">
                Carnet de dettes et crédits clients
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Notez les ardoises de vos clients en 2 secondes. Vous savez exactement qui vous doit de l&apos;argent, depuis quelle date, et pouvez leur envoyer un rappel poli sur WhatsApp en un clic.
              </p>
            </div>

            {/* 2. Surveillance des vendeurs à distance */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-4">
                <Users size={20} />
              </div>
              <h4 className="font-bold text-base text-slate-900 mb-2">
                Surveillance de vos vendeurs à distance
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Créez un accès avec code pour chaque employé. Même depuis chez vous ou en voyage, vous voyez en direct qui encaisse chaque vente et évitez les vols et les erreurs de caisse.
              </p>
            </div>

            {/* 3. Reçus WhatsApp & Impression ticket */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                <Receipt size={20} />
              </div>
              <h4 className="font-bold text-base text-slate-900 mb-2">
                Reçus par WhatsApp et tickets imprimés
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Donnez une image professionnelle à votre boutique. Envoyez le ticket propre directement sur le téléphone de votre client ou imprimez-le sur petite imprimante thermique.
              </p>
            </div>

            {/* 4. Alertes de stock faible */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
                <BellRing size={20} />
              </div>
              <h4 className="font-bold text-base text-slate-900 mb-2">
                Alertes automatiques avant rupture de stock
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Ne perdez plus de clients parce qu&apos;un article manque. L&apos;application vous avertit dès qu&apos;un produit approche de la fin pour que vous puissiez vous réapprovisionner à temps.
              </p>
            </div>

            {/* 5. Suivi des dépenses du magasin */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mb-4">
                <TrendingUp size={20} />
              </div>
              <h4 className="font-bold text-base text-slate-900 mb-2">
                Enregistrement des dépenses de la boutique
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Notez facilement le loyer, l&apos;électricité, le transport ou les petits achats quotidiens. À la fin du mois, vous connaissez votre vrai bénéfice restant dans votre poche.
              </p>
            </div>

            {/* 6. Suivi des livraisons et colis */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
                <Truck size={20} />
              </div>
              <h4 className="font-bold text-base text-slate-900 mb-2">
                Suivi des livraisons et colis à domicile
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Calculez les frais de livraison automatiquement, donnez les coordonnées du client au livreur et suivez les commandes en cours jusqu&apos;au paiement en main propre.
              </p>
            </div>

            {/* 7. Factures et devis avec logo */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-4">
                <FileText size={20} />
              </div>
              <h4 className="font-bold text-base text-slate-900 mb-2">
                Factures et devis avec votre logo
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Pour vos gros clients, entreprises ou commandes spéciales, générez en 1 clic de superbes factures PDF avec votre logo, adresse et conditions de règlement.
              </p>
            </div>

            {/* 8. Clôture de caisse du soir */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mb-4">
                <Clock size={20} />
              </div>
              <h4 className="font-bold text-base text-slate-900 mb-2">
                Clôture de caisse du soir en 1 clic
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                À la fermeture du magasin, appuyez sur « Clôturer ». Le total en espèces, en Mobile Money et en livraisons est dressé instantanément. Vous rentrez chez vous l&apos;esprit léger.
              </p>
            </div>

            {/* 9. Mode Boutique ou Mode Restaurant */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center mb-4">
                <Store size={20} />
              </div>
              <h4 className="font-bold text-base text-slate-900 mb-2">
                Adapté aux boutiques et aux restaurants
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Que vous vendiez des vêtements, cosmétiques, quincaillerie ou que vous gériez un fast-food, maquis ou salon de thé (avec gestion de tables et cuisine), l&apos;application s&apos;adapte parfaitement.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 6. Section Timeline : Cas d'Étude en Conditions Réelles */}
      <section id="timeline" className="py-14 sm:py-20 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold text-[#f56b2a] bg-orange-50 border border-orange-200 px-3.5 py-1.5 rounded-full">
              Cas d&apos;étude en conditions réelles
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-4 mb-2">
              Une journée type avec PosMarket
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-normal">
              Découvrez pas à pas comment se passe le quotidien d&apos;un commerce équipé, du matin au coucher.
            </p>
          </div>

          <div className="relative border-l-2 border-orange-200 pl-6 sm:pl-8 ml-4 sm:ml-6 space-y-10">
            
            {/* Étape 1 : 07h30 */}
            <div className="relative">
              <div className="absolute -left-[35px] sm:-left-[43px] top-0 w-8 h-8 rounded-full bg-[#f56b2a] text-white flex items-center justify-center font-bold text-xs shadow-md">
                <Sun size={15} />
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#f56b2a]">07h30 • Ouverture de la boutique</span>
                  <span className="text-[10px] font-semibold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">Matin</span>
                </div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                  Ouverture de caisse en 10 secondes
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                  Le gérant ou le premier vendeur ouvre l&apos;application sur son téléphone ou sa tablette. Il saisit le fond de caisse initial et commence la journée sans aucun papier à préparer.
                </p>
              </div>
            </div>

            {/* Étape 2 : 11h15 */}
            <div className="relative">
              <div className="absolute -left-[35px] sm:-left-[43px] top-0 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-md">
                <Zap size={15} />
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-emerald-600">11h15 • Pic d&apos;affluence en magasin</span>
                  <span className="text-[10px] font-semibold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">Encaissement</span>
                </div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                  12 clients servis en 15 minutes
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                  Les clients s&apos;enchaînent. Chaque vente est enregistrée en 3 clics avec encaissement en espèces ou Mobile Money. Le reçu de caisse est transmis directement sur le WhatsApp du client.
                </p>
              </div>
            </div>

            {/* Étape 3 : 14h40 */}
            <div className="relative">
              <div className="absolute -left-[35px] sm:-left-[43px] top-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-md">
                <Truck size={15} />
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-blue-600">14h40 • Commande web et livraison</span>
                  <span className="text-[10px] font-semibold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">Livraison</span>
                </div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                  Commande en ligne expédiée avec paiement à la livraison
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                  Une commande passée sur la vitrine en ligne est préparée. Le livreur part livrer avec l&apos;option paiement à la livraison. Le stock en magasin a déjà été déduit automatiquement.
                </p>
              </div>
            </div>

            {/* Étape 4 : 19h00 */}
            <div className="relative">
              <div className="absolute -left-[35px] sm:-left-[43px] top-0 w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-xs shadow-md">
                <CheckCircle2 size={15} />
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-purple-600">19h00 • Clôture de fin de journée</span>
                  <span className="text-[10px] font-semibold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">Bilan</span>
                </div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                  Rapport de caisse sans aucun calcul manuel
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                  À la fermeture, le caissier appuie sur « Clôturer ». Le rapport complet détaille les espèces, les encaissements Mobile Money et les paiements à la livraison. Zéro erreur, zéro dispute.
                </p>
              </div>
            </div>

            {/* Étape 5 : 23h30 */}
            <div className="relative">
              <div className="absolute -left-[35px] sm:-left-[43px] top-0 w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-md">
                <Moon size={15} />
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700">23h30 • La boutique vend pendant la nuit</span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Actif</span>
                </div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                  Nouvelles ventes enregistrées pendant le sommeil
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                  Pendant que le propriétaire dort, deux clients commandent sur la vitrine en ligne et paient par Mobile Money. Au réveil, les commandes sont prêtes pour l&apos;expédition du matin.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 7. Comparatif Synthétique (Sans vs Avec) */}
      <section id="comparatif" className="py-12 sm:py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 mb-2">
              Le choix entre le stress et la liberté
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-normal">
              Voyez concrètement ce qui change dès le premier jour.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs text-xs sm:text-sm">
            <div className="grid grid-cols-2 bg-slate-900 text-white font-bold py-3.5 px-4 sm:px-6 text-xs">
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
                  before: 'Peur constante des vols et erreurs',
                  after: 'Suivi des ventes en direct sur smartphone',
                },
                {
                  label: 'Ventes après fermeture',
                  before: '0 franc : rideau fermé',
                  after: 'Commandes 24h sur 24 sur votre vitrine web',
                },
                {
                  label: 'Paiements',
                  before: 'Risque de fausses captures d\'écran',
                  after: 'Validation automatique Mobile Money et livraison',
                },
              ].map((row, idx) => (
                <div key={idx} className="grid grid-cols-2 p-3.5 sm:p-4 gap-3">
                  <div className="text-slate-600 font-normal">{row.before}</div>
                  <div className="text-emerald-700 font-semibold">{row.after}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8. Tarifs Clairs et Directs */}
      <section id="tarifs" className="py-12 sm:py-18 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold text-[#f56b2a] bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
              Tarification simple
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3 mb-2">
              Des tarifs clairs, rentabilisés dès le premier jour
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-normal">
              Activation immédiate par Mobile Money. Sans engagement.
            </p>

            {/* Toggle Duration */}
            <div className="mt-6 inline-flex p-1 rounded-2xl bg-slate-100 border border-slate-200">
              {(['monthly', 'quarterly', 'annual'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
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
                  <span className="text-xs font-bold text-slate-700 bg-white px-3 py-1 rounded-full border border-slate-200">
                    Starter
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">1 boutique</span>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {formatCurrency(getPrice(SUBSCRIPTION_PLANS.STARTER)).replace(/\s*FCFA/i, '').trim()}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">FCFA par mois</span>
                  </div>
                  {duration !== 'monthly' && (
                    <span className="text-[10px] text-orange-600 font-semibold block mt-0.5">
                      Total : {formatCurrency(getTotalPrice(SUBSCRIPTION_PLANS.STARTER))}
                    </span>
                  )}
                </div>

                <ul className="space-y-2.5 text-xs text-slate-700 mb-6 border-t border-slate-200 pt-4 font-normal">
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Caisse facile sur téléphone et tablette</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> 1 boutique ou point de vente</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Jusqu&apos;à 50 articles</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Reçus WhatsApp et tickets imprimables</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Carnet de dettes et crédits clients</li>
                </ul>
              </div>

              <Link
                href={duration === 'monthly' ? '/subscription' : whatsappLink('STARTER')}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs text-center transition-all"
              >
                {duration === 'monthly' ? 'Choisir Starter' : 'Contacter sur WhatsApp'}
              </Link>
            </div>

            {/* PRO (Populaire) */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#f56b2a] flex flex-col justify-between relative shadow-xl shadow-orange-500/10 scale-[1.02]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#f56b2a] text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-xs">
                ⭐ Le plus choisi
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-orange-700 bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
                    Pro
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-600">Caisse et boutique en ligne</span>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {formatCurrency(getPrice(SUBSCRIPTION_PLANS.PRO)).replace(/\s*FCFA/i, '').trim()}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">FCFA par mois</span>
                  </div>
                  {duration !== 'monthly' && (
                    <span className="text-[10px] text-orange-600 font-semibold block mt-0.5">
                      Total : {formatCurrency(getTotalPrice(SUBSCRIPTION_PLANS.PRO))}
                    </span>
                  )}
                </div>

                <ul className="space-y-2.5 text-xs text-slate-800 mb-6 border-t border-slate-100 pt-4 font-semibold">
                  <li className="flex items-center gap-2 text-orange-600"><Check size={15} className="text-[#f56b2a]" /> Boutique en ligne ouverte 24h sur 24</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Jusqu&apos;à 3 boutiques connectées</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Jusqu&apos;à 500 articles</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Paiements Mobile Money et à la livraison</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Calcul du bénéfice net et clôture du soir</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Alertes automatiques de stock faible</li>
                </ul>
              </div>

              <Link
                href={duration === 'monthly' ? '/subscription' : whatsappLink('PRO')}
                className="w-full py-3.5 px-4 rounded-xl bg-[#f56b2a] hover:bg-[#e05a1d] text-white font-bold text-xs text-center shadow-md shadow-orange-500/25 transition-all flex items-center justify-center gap-1.5"
              >
                <span>{duration === 'monthly' ? 'Passer à Pro' : 'Contacter sur WhatsApp'}</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* ENTERPRISE */}
            <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                    Entreprise
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">Multi-établissements</span>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {formatCurrency(getPrice(SUBSCRIPTION_PLANS.ENTERPRISE)).replace(/\s*FCFA/i, '').trim()}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">FCFA par mois</span>
                  </div>
                  {duration !== 'monthly' && (
                    <span className="text-[10px] text-orange-600 font-semibold block mt-0.5">
                      Total : {formatCurrency(getTotalPrice(SUBSCRIPTION_PLANS.ENTERPRISE))}
                    </span>
                  )}
                </div>

                <ul className="space-y-2.5 text-xs text-slate-700 mb-6 border-t border-slate-200 pt-4 font-normal">
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Boutiques et magasins illimités</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Nombre d&apos;articles illimité</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Factures et devis avec votre logo</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Surveillance et comptes vendeurs illimités</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Accompagnement direct WhatsApp 7j sur 7</li>
                </ul>
              </div>

              <Link
                href={duration === 'monthly' ? '/subscription' : whatsappLink('ENTERPRISE')}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs text-center transition-all"
              >
                {duration === 'monthly' ? 'Choisir Entreprise' : 'Contacter sur WhatsApp'}
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* 9. FAQ Complète et Détaillée */}
      <section id="faq" className="py-14 sm:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-[#f56b2a] bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
              Foire aux questions
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3 mb-2">
              Toutes vos questions, des réponses simples
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-normal">Tout ce que vous devez savoir pour démarrer sereinement.</p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'Est-ce difficile à utiliser si je ne m\'y connais pas en informatique ?',
                a: 'Pas du tout. PosMarket a été conçu pour être aussi intuitif qu\'une application de messagerie. Si vous savez envoyer un message sur votre téléphone, vous saurez enregistrer une vente en moins de 3 minutes.',
              },
              {
                q: 'De quel matériel ai-je besoin pour faire tourner mon commerce ?',
                a: 'Aucun matériel coûteux n\'est obligatoire. PosMarket fonctionne sur n\'importe quel smartphone Android, iPhone, tablette ou ordinateur que vous possédez déjà.',
              },
              {
                q: 'Comment fonctionnent les paiements par Mobile Money et le paiement à la livraison ?',
                a: 'Vos clients peuvent payer directement par Mobile Money en ligne avec confirmation bancaire automatique, ou bien choisir l\'option de paiement à la livraison lorsque le livreur leur apporte le colis.',
              },
              {
                q: 'Que se passe-t-il si la connexion internet est lente ou coupée ?',
                a: 'L\'application est ultra-légère et optimisée pour consommer un minimum de données mobiles. Vos données restent synchronisées et sécurisées sur des serveurs protégés.',
              },
              {
                q: 'Puis-je créer des accès séparés pour mes vendeurs ou caissiers ?',
                a: 'Oui. Vous pouvez attribuer des comptes vendeurs avec des permissions adaptées. Chaque vente est signée avec le nom du caissier pour une traçabilité totale.',
              },
              {
                q: 'Comment mes clients accèdent-ils à ma vitrine de vente en ligne ?',
                a: 'Vous disposez d\'un lien unique vers votre boutique en ligne. Vous pouvez le partager dans votre statut WhatsApp, sur Facebook, TikTok ou l\'imprimer sur vos cartes de visite.',
              },
              {
                q: 'Mes données de ventes et mes stocks sont-ils confidentiels et sécurisés ?',
                a: 'Vos données sont strictement privées, chiffrées et sauvegardées quotidiennement dans le cloud. Seul vous (et les personnes que vous autorisez) y avez accès.',
              },
              {
                q: 'Puis-je changer de formule ou arrêter quand je le souhaite ?',
                a: 'Oui, vous êtes totalement libre. Vous pouvez passer d\'une formule à une autre à tout moment ou suspendre votre abonnement sans pénalité.',
              },
              {
                q: 'Y a-t-il une assistance pour m\'aider à ajouter mes premiers produits ?',
                a: 'Oui, notre équipe d\'assistance vous guide par WhatsApp ou téléphone pour vous aider à enregistrer vos articles et démarrer sans stress.',
              },
            ].map((item, idx) => (
              <div key={idx} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 sm:p-5 text-left font-bold text-xs sm:text-sm text-slate-900 flex items-center justify-between gap-3 cursor-pointer hover:text-[#f56b2a] transition-colors"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-slate-400 transition-transform ${openFaq === idx ? 'rotate-180 text-[#f56b2a]' : ''}`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="p-4 sm:p-5 pt-0 text-slate-600 text-xs sm:text-sm font-normal leading-relaxed border-t border-slate-200/60">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. Mobile Sticky Bottom Action Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 shadow-2xl flex items-center justify-between gap-3">
        <div className="text-left pl-1">
          <span className="text-[10px] font-semibold text-slate-500 block">Formule Starter</span>
          <span className="text-sm font-bold text-slate-900">12 000 FCFA <span className="text-[10px] font-normal text-slate-500">/mois</span></span>
        </div>
        <Link
          href="/subscription"
          className="flex-1 max-w-[190px] py-2.5 px-4 rounded-xl bg-[#f56b2a] text-white font-bold text-xs text-center shadow-md shadow-orange-500/25 flex items-center justify-center gap-1.5"
        >
          <span>Démarrer</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* 11. Simple Clean Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 text-xs text-center">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Store size={16} className="text-[#f56b2a]" />
            <span className="font-bold text-white">PosMarket</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4 font-medium text-slate-400">
            <Link href="/" className="hover:text-white">Accueil</Link>
            <Link href="/subscription" className="hover:text-white">Abonnements</Link>
            <Link href="/cgv" className="hover:text-white">CGV</Link>
            <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
