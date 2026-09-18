'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  Smartphone,
  CheckCircle2,
  XCircle,
  Store,
  ArrowRight,
  MessageCircle,
  ChevronDown,
  Receipt,
  ShoppingBag,
  BarChart3,
  Flame,
  Check,
  Truck,
  Sun,
  Moon,
  PackageCheck,
  UserCheck,
  FileText,
  Users,
  BellRing
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@/constants';
import { formatCurrency } from '@/utils';

export default function BeOpenClient() {
  const [duration, setDuration] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [timelineTab, setTimelineTab] = useState<'seller' | 'customer'>('seller');

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
      
      {/* 1. Navigation Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#f56b2a] flex items-center justify-center shadow-md shadow-orange-500/20 text-white font-extrabold shrink-0">
              <Store size={22} />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-slate-900 leading-none">
                Pos<span className="text-[#f56b2a]">Market</span>
              </span>
              <span className="text-[10px] font-bold text-orange-600 mt-0.5">
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
              href="/subscription"
              className="px-4 py-2.5 rounded-xl bg-[#f56b2a] hover:bg-[#e05a1d] active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-md shadow-orange-500/25 flex items-center gap-1.5 transition-all"
            >
              <span>Démarrer</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="pt-6 pb-10 sm:pt-14 sm:pb-18 bg-gradient-to-b from-orange-50/70 via-white to-slate-50 border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Copywriting */}
            <div className="lg:col-span-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-orange-100 border border-orange-200 text-orange-800 text-[11px] sm:text-xs font-bold mb-4">
                <Flame size={14} className="text-[#f56b2a] shrink-0" />
                <span>Pour les commerçants qui veulent avoir l&apos;esprit tranquille</span>
              </div>

              <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight mb-4 tracking-tight">
                Fini le cahier et les erreurs de caisse.
                <span className="text-[#f56b2a] block mt-1">
                  Vendez en boutique et en ligne sans prise de tête.
                </span>
              </h1>

              <p className="text-sm sm:text-base md:text-lg text-slate-600 mb-6 font-normal leading-relaxed max-w-xl mx-auto lg:mx-0">
                Transformez votre simple téléphone en caisse enregistreuse et en boutique en ligne ouverte jour et nuit. Encaissez par Mobile Money ou à la livraison, évitez les erreurs et suivez vos ventes en temps réel.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-6 sm:mb-8">
                <Link
                  href="/subscription"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#f56b2a] hover:bg-[#e05a1d] active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                >
                  <span>Démarrer avec ma boutique</span>
                  <ArrowRight size={16} />
                </Link>
                <a
                  href={whatsappLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-300 text-slate-800 font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-xs"
                >
                  <MessageCircle size={18} className="text-emerald-600" />
                  <span>Aide WhatsApp</span>
                </a>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 text-[11px] sm:text-xs font-semibold text-slate-600 max-w-md mx-auto lg:mx-0">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                  <span className="text-emerald-600 block font-bold text-xs sm:text-sm">Mobile Money</span>
                  <span className="text-[10px] sm:text-xs text-slate-500">Et livraison</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                  <span className="text-[#f56b2a] block font-bold text-xs sm:text-sm">Zéro machine</span>
                  <span className="text-[10px] sm:text-xs text-slate-500">Votre téléphone</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                  <span className="text-purple-600 block font-bold text-xs sm:text-sm">Prêt en 5 min</span>
                  <span className="text-[10px] sm:text-xs text-slate-500">Simple & rapide</span>
                </div>
              </div>
            </div>

            {/* Right: Real Photography Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-slate-900 group max-w-md mx-auto lg:max-w-none">
                <div className="relative h-64 sm:h-80 md:h-96 w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/beopen/hero_pos_shop.jpg"
                    alt="Commerçante souriante avec caisse enregistreuse PosMarket"
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                </div>

                {/* Floating Top Badge */}
                <div className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl p-2 sm:p-3 shadow-lg border border-slate-100 flex items-center gap-2 sm:gap-2.5">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                    ✓
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-emerald-600 leading-tight">Vente validée</p>
                    <p className="text-[11px] sm:text-xs font-bold text-slate-900 leading-tight">15 000 FCFA (Mobile Money)</p>
                  </div>
                </div>

                {/* Floating Bottom Badge */}
                <div className="absolute bottom-2.5 left-2.5 sm:bottom-4 sm:left-4 bg-slate-950/90 backdrop-blur-md text-white rounded-xl sm:rounded-2xl p-2 sm:p-3 border border-slate-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span className="text-[10px] sm:text-xs font-semibold">Caisse et boutique synchronisées</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. Section 3 Piliers Visuels avec Vraies Photos */}
      <section id="features" className="py-10 sm:py-18 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16">
            <span className="text-xs font-bold text-[#f56b2a] bg-orange-50 border border-orange-200 px-3.5 py-1.5 rounded-full">
              Ce que PosMarket fait pour votre quotidien
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 mt-4 mb-2 tracking-tight">
              Votre commerce géré simplement, sans fatigue ni stress
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-normal">
              Des outils concrets et faciles à utiliser pour vous soulager du matin au soir.
            </p>
          </div>

          <div className="space-y-12 sm:space-y-20">
            
            {/* Feature 1 : Caisse Tactile & Reçus WhatsApp */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
              <div className="lg:col-span-6 order-2 lg:order-1">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#f56b2a] flex items-center justify-center mb-3 sm:mb-4 font-bold">
                  <Zap size={20} />
                </div>
                <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 mb-2 sm:mb-3">
                  1. Une caisse facile sur votre téléphone et reçus sur WhatsApp
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-5 font-normal">
                  Quand un client arrive, choisissez son article en 3 secondes. L&apos;application calcule la monnaie exacte sans que vous ayez à sortir une calculatrice. Envoyez un joli reçu par WhatsApp ou imprimez un ticket de caisse en un clin d&apos;œil.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 text-xs font-semibold text-slate-700">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Ajout au panier en 1 toucher</span>
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
                    <span>Tickets de caisse imprimables</span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-6 order-1 lg:order-2">
                <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border-4 border-white bg-slate-100 max-w-md mx-auto lg:max-w-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/beopen/pos_checkout_touch.jpg"
                    alt="Caisse tactile et imprimante de reçus"
                    className="w-full h-56 sm:h-72 md:h-80 object-cover object-center"
                  />
                </div>
              </div>
            </div>

            {/* Feature 2 : Boutique en Ligne 24/7 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
              <div className="lg:col-span-6">
                <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border-4 border-white bg-slate-100 max-w-md mx-auto lg:max-w-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/beopen/storefront_online_order.jpg"
                    alt="Commande en ligne sur vitrine e-commerce 24/7"
                    className="w-full h-56 sm:h-72 md:h-80 object-cover object-center"
                  />
                </div>
              </div>
              <div className="lg:col-span-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 sm:mb-4 font-bold">
                  <ShoppingBag size={20} />
                </div>
                <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 mb-2 sm:mb-3">
                  2. Votre boutique en ligne ouverte même pendant votre sommeil
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-5 font-normal">
                  Partagez votre lien de boutique dans votre statut WhatsApp, sur Facebook ou TikTok. Vos clients découvrent vos nouveautés à toute heure, passent commande et paient. Le stock en magasin se met à jour tout seul.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 text-xs font-semibold text-slate-700">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Lien boutique à votre nom</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Bouton commander sur WhatsApp</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Paiements Mobile Money et livraison</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Stock synchronisé en direct</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 3 : Tableau de bord & Ventes en direct */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
              <div className="lg:col-span-6 order-2 lg:order-1">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3 sm:mb-4 font-bold">
                  <BarChart3 size={20} />
                </div>
                <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 mb-2 sm:mb-3">
                  3. Suivi de vos ventes en direct et articles les plus vendus
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-5 font-normal">
                  Suivez votre chiffre d&apos;affaires en direct depuis votre téléphone. Visualisez vos commandes du jour, le montant total encaissé et découvrez quels sont vos produits qui se vendent le mieux.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 text-xs font-semibold text-slate-700">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Chiffre d&apos;affaires en direct</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Top des produits les plus vendus</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Nombre de commandes et panier moyen</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Alerte avant d&apos;être en rupture</span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-6 order-1 lg:order-2">
                <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border-4 border-white bg-slate-100 max-w-md mx-auto lg:max-w-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/beopen/merchant_dashboard_growth.jpg"
                    alt="Commerçant confiant avec tableau de bord et ventes"
                    className="w-full h-56 sm:h-72 md:h-80 object-cover object-center"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. Section Grand Guide des Fonctionnalités */}
      <section className="py-10 sm:py-18 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
            <span className="text-xs font-bold text-[#f56b2a] bg-orange-100 border border-orange-200 px-3.5 py-1.5 rounded-full">
              Toutes les fonctionnalités expliquées simplement
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 mt-4 mb-2 tracking-tight">
              Tout ce dont votre commerce a besoin, sans jargon technique
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-normal">
              Fini les cahiers brouillons, les calculatrices égarées et les doutes sur vos chiffres. Voici tout ce que vous faites avec l&apos;application.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
            
            {/* 1. Caisse tactile */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs hover:border-orange-200 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#f56b2a] flex items-center justify-center mb-3 sm:mb-4">
                <Zap size={20} />
              </div>
              <h4 className="font-bold text-sm sm:text-base text-slate-900 mb-1.5 sm:mb-2">
                Caisse tactile et calcul de monnaie
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Touchez un produit pour l&apos;ajouter au panier. L&apos;application calcule immédiatement le montant total et la monnaie exacte à rendre à votre client.
              </p>
            </div>

            {/* 2. Boutique en ligne */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs hover:border-orange-200 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 sm:mb-4">
                <ShoppingBag size={20} />
              </div>
              <h4 className="font-bold text-sm sm:text-base text-slate-900 mb-1.5 sm:mb-2">
                Boutique en ligne à votre nom
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Présentez tout votre catalogue avec photos et prix. Vos clients commandent en ligne avec paiement sécurisé ou via le bouton direct WhatsApp.
              </p>
            </div>

            {/* 3. Reçus WhatsApp */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs hover:border-orange-200 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3 sm:mb-4">
                <Receipt size={20} />
              </div>
              <h4 className="font-bold text-sm sm:text-base text-slate-900 mb-1.5 sm:mb-2">
                Reçus par WhatsApp et tickets imprimables
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Envoyez un reçu clair et élégant directement sur le WhatsApp du client ou imprimez un ticket sur petite imprimante de caisse thermique.
              </p>
            </div>

            {/* 4. Alertes de stock */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs hover:border-orange-200 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3 sm:mb-4">
                <BellRing size={20} />
              </div>
              <h4 className="font-bold text-sm sm:text-base text-slate-900 mb-1.5 sm:mb-2">
                Alertes de stock faible et inventaire
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Repérez d&apos;un coup d&apos;œil les articles bientôt épuisés pour vous réapprovisionner à temps et ne jamais décevoir un client venu acheter.
              </p>
            </div>

            {/* 5. Tarifs de gros */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs hover:border-orange-200 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3 sm:mb-4">
                <PackageCheck size={20} />
              </div>
              <h4 className="font-bold text-sm sm:text-base text-slate-900 mb-1.5 sm:mb-2">
                Tarifs de gros et prix par quantité
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Définissez des réductions automatiques selon le nombre d&apos;articles achetés (par exemple à partir de 3, 5 ou 10 pièces) pour vos clients grossistes.
              </p>
            </div>

            {/* 6. Fichier clients */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs hover:border-orange-200 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mb-3 sm:mb-4">
                <Users size={20} />
              </div>
              <h4 className="font-bold text-sm sm:text-base text-slate-900 mb-1.5 sm:mb-2">
                Fichier clients et historique d&apos;achats
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Conservez les coordonnées de vos clients (téléphone, adresse), visualisez l&apos;historique de leurs commandes et identifiez vos meilleurs acheteurs.
              </p>
            </div>

            {/* 7. Factures PDF */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs hover:border-orange-200 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3 sm:mb-4">
                <FileText size={20} />
              </div>
              <h4 className="font-bold text-sm sm:text-base text-slate-900 mb-1.5 sm:mb-2">
                Factures et devis professionnels
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Créez des factures numérotées au format PDF avec le détail des produits, les montants et le statut (payé, en attente ou impayé).
              </p>
            </div>

            {/* 8. Tableau de bord */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs hover:border-orange-200 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mb-3 sm:mb-4">
                <BarChart3 size={20} />
              </div>
              <h4 className="font-bold text-sm sm:text-base text-slate-900 mb-1.5 sm:mb-2">
                Tableau de bord et meilleures ventes
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Consultez les statistiques de votre boutique : total encaissé par jour, semaine ou mois, nombre de commandes et classement de vos best-sellers.
              </p>
            </div>

            {/* 9. Comptes vendeurs */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs hover:border-orange-200 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center mb-3 sm:mb-4">
                <UserCheck size={20} />
              </div>
              <h4 className="font-bold text-sm sm:text-base text-slate-900 mb-1.5 sm:mb-2">
                Comptes vendeurs et autorisations
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                Ajoutez vos collaborateurs avec des droits personnalisés pour enregistrer les ventes tout en protégeant les paramètres de votre boutique.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Section Timeline : Cas d'Étude en Conditions Réelles avec 2 Tabs */}
      <section id="timeline" className="py-10 sm:py-18 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            <span className="text-xs font-bold text-[#f56b2a] bg-orange-50 border border-orange-200 px-3.5 py-1.5 rounded-full">
              Cas d&apos;étude en conditions réelles
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 mt-4 mb-2 tracking-tight">
              Comment ça se passe concrètement ?
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-normal">
              Découvrez le déroulement d&apos;une journée, du point de vue du commerçant et du client.
            </p>

            {/* 2 Tabs Toggle : Vendeur vs Client */}
            <div className="mt-6 sm:mt-8 grid grid-cols-2 max-w-xs sm:max-w-md mx-auto p-1 rounded-2xl bg-slate-100 border border-slate-200 gap-1 min-h-[44px]">
              <button
                type="button"
                onClick={() => setTimelineTab('seller')}
                className={`py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                  timelineTab === 'seller'
                    ? 'bg-[#f56b2a] text-white shadow-md shadow-orange-500/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Store size={15} />
                <span>Côté vendeur</span>
              </button>
              <button
                type="button"
                onClick={() => setTimelineTab('customer')}
                className={`py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                  timelineTab === 'customer'
                    ? 'bg-[#f56b2a] text-white shadow-md shadow-orange-500/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <ShoppingBag size={15} />
                <span>Côté client</span>
              </button>
            </div>
          </div>

          {/* Tab 1 : En tant que Vendeur */}
          {timelineTab === 'seller' && (
            <div className="relative border-l-2 border-orange-200 pl-5 sm:pl-8 ml-3 sm:ml-5 space-y-6 sm:space-y-8">
              
              {/* Étape 1 : 07h30 */}
              <div className="relative">
                <div className="absolute -left-[31px] sm:-left-[43px] top-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#f56b2a] text-white flex items-center justify-center font-bold text-xs shadow-xs ring-4 ring-white">
                  <Sun size={13} />
                </div>
                <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-[#f56b2a]">07h30 • Ouverture de la boutique</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">Magasin</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                    Ouverture de l&apos;application et vérification du stock
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                    Le commerçant ouvre PosMarket sur son téléphone ou sa tablette. D&apos;un seul coup d&apos;œil, il consulte les commandes reçues pendant la nuit et l&apos;état de ses stocks sans aucun papier à préparer.
                  </p>
                </div>
              </div>

              {/* Étape 2 : 11h15 */}
              <div className="relative">
                <div className="absolute -left-[31px] sm:-left-[43px] top-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs ring-4 ring-white">
                  <Zap size={13} />
                </div>
                <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-emerald-600">11h15 • Pic d&apos;affluence au comptoir</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">Caisse tactile</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                    12 clients servis rapidement en 3 clics
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                    Les clients s&apos;enchaînent. Le vendeur sélectionne les articles en un toucher, l&apos;application calcule immédiatement la monnaie exacte à rendre. Il encaisse en espèces ou Mobile Money et envoie le reçu directement sur le WhatsApp du client.
                  </p>
                </div>
              </div>

              {/* Étape 3 : 14h40 */}
              <div className="relative">
                <div className="absolute -left-[31px] sm:-left-[43px] top-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-xs ring-4 ring-white">
                  <Truck size={13} />
                </div>
                <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-blue-600">14h40 • Préparation d&apos;une commande web</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">En ligne</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                    Commande en ligne reçue avec adresse de livraison
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                    Une commande passée sur la vitrine web est préparée pour l&apos;expédition. Le stock du magasin s&apos;est mis à jour tout seul pour éviter de vendre le même article deux fois.
                  </p>
                </div>
              </div>

              {/* Étape 4 : 19h00 */}
              <div className="relative">
                <div className="absolute -left-[31px] sm:-left-[43px] top-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-xs shadow-xs ring-4 ring-white">
                  <BarChart3 size={13} />
                </div>
                <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-purple-600">19h00 • Bilan de fin de journée</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">Statistiques</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                    Chiffre d&apos;affaires et commandes visibles en 1 clic
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                    À la fermeture, le commerçant ouvre son tableau de bord : total encaissé de la journée, nombre de commandes et articles les plus vendus. Aucun calcul au stylo nécessaire.
                  </p>
                </div>
              </div>

              {/* Étape 5 : 23h30 */}
              <div className="relative">
                <div className="absolute -left-[31px] sm:-left-[43px] top-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-xs ring-4 ring-white">
                  <Moon size={13} />
                </div>
                <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-slate-700">23h30 • Ventes automatiques la nuit</span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded shrink-0">24h/24</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                    La boutique vend pendant votre sommeil
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                    Pendant que le magasin est fermé, des clients continuent de commander et payer sur la boutique en ligne. Au réveil, les commandes sont prêtes pour la journée.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* Tab 2 : En tant que Client */}
          {timelineTab === 'customer' && (
            <div className="relative border-l-2 border-emerald-200 pl-5 sm:pl-8 ml-3 sm:ml-5 space-y-6 sm:space-y-8">
              
              {/* Étape 1 : Découverte */}
              <div className="relative">
                <div className="absolute -left-[31px] sm:-left-[43px] top-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs ring-4 ring-white">
                  <Smartphone size={13} />
                </div>
                <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-emerald-600">Étape 1 • Découverte de la boutique</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">Accès direct</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                    Le client clique sur votre lien dans votre statut ou réseaux
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                    En voyant votre lien sur WhatsApp, Facebook ou TikTok, le client l&apos;ouvre directement sur son téléphone. Il accède à votre catalogue complet avec photos nettes, prix clairs et descriptions.
                  </p>
                </div>
              </div>

              {/* Étape 2 : Sélection */}
              <div className="relative">
                <div className="absolute -left-[31px] sm:-left-[43px] top-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#f56b2a] text-white flex items-center justify-center font-bold text-xs shadow-xs ring-4 ring-white">
                  <ShoppingBag size={13} />
                </div>
                <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-[#f56b2a]">Étape 2 • Choix des articles et remises</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">Panier</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                    Sélection des variantes et réduction par quantité
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                    Le client choisit ses tailles ou modèles préférés. S&apos;il prend plusieurs articles, la remise de gros s&apos;applique automatiquement sur son panier sans qu&apos;il ait besoin de négocier.
                  </p>
                </div>
              </div>

              {/* Étape 3 : Commande */}
              <div className="relative">
                <div className="absolute -left-[31px] sm:-left-[43px] top-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-xs ring-4 ring-white">
                  <MessageCircle size={13} />
                </div>
                <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-blue-600">Étape 3 • Validation de commande</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">Facile</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                    Paiement en ligne ou bouton direct WhatsApp
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                    Le client peut payer directement par Mobile Money ou choisir le paiement à la livraison. S&apos;il préfère finaliser par message, il clique sur « Commander sur WhatsApp » pour vous envoyer son panier pré-rempli.
                  </p>
                </div>
              </div>

              {/* Étape 4 : Reçu */}
              <div className="relative">
                <div className="absolute -left-[31px] sm:-left-[43px] top-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-xs shadow-xs ring-4 ring-white">
                  <Receipt size={13} />
                </div>
                <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-purple-600">Étape 4 • Preuve d&apos;achat instantanée</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">Reçu</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                    Reçu reçu directement sur WhatsApp
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                    Que l&apos;achat ait eu lieu en boutique physique ou sur la vitrine en ligne, le client reçoit immédiatement son reçu propre avec la liste de ses achats et le montant réglé.
                  </p>
                </div>
              </div>

              {/* Étape 5 : Réception */}
              <div className="relative">
                <div className="absolute -left-[31px] sm:-left-[43px] top-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-xs shadow-xs ring-4 ring-white">
                  <CheckCircle2 size={13} />
                </div>
                <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-teal-600">Étape 5 • Réception et suivi de commande</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">Livraison</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                    Livraison à domicile et historique dans son compte
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                    Le colis est livré à son adresse. Le client peut à tout moment se reconnecter à son espace pour revoir ses commandes passées et recommander ses produits préférés en un clic.
                  </p>
                </div>
              </div>

            </div>
          )}

        </div>
      </section>

      {/* 6. Comparatif Synthétique (Sans vs Avec) */}
      <section id="comparatif" className="py-10 sm:py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
              Le choix entre le stress et la sérénité
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-normal">
              Voyez concrètement ce qui change dès le premier jour.
            </p>
          </div>

          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="grid grid-cols-2 bg-slate-900 text-white font-bold py-3.5 px-3 sm:px-6 text-[11px] sm:text-xs">
              <div className="text-red-400 flex items-center gap-1.5"><XCircle size={14} className="shrink-0" /> <span>Sans PosMarket</span></div>
              <div className="text-emerald-400 flex items-center gap-1.5"><CheckCircle2 size={14} className="shrink-0" /> <span>Avec PosMarket</span></div>
            </div>

            <div className="divide-y divide-slate-100">
              {[
                {
                  before: 'Calculatrice manuelle et risque d\'erreurs',
                  after: 'Caisse tactile et monnaie calculée en 1 seconde',
                },
                {
                  before: 'Reçus papier perdus ou illisibles',
                  after: 'Envoi direct du reçu sur le WhatsApp du client',
                },
                {
                  before: '0 franc dès que le rideau est baissé',
                  after: 'Commandes 24h sur 24 sur votre boutique web',
                },
                {
                  before: 'Risque de vendre 2 fois le même article',
                  after: 'Stock synchronisé en temps réel automatiquement',
                },
              ].map((row, idx) => (
                <div key={idx} className="grid grid-cols-2 p-3 sm:p-4 gap-2.5 sm:gap-4 items-center">
                  <div className="text-slate-600 font-normal leading-relaxed text-[11px] sm:text-xs md:text-sm">{row.before}</div>
                  <div className="text-emerald-700 font-semibold leading-relaxed text-[11px] sm:text-xs md:text-sm">{row.after}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7. Tarifs Clairs et Directs */}
      <section id="tarifs" className="py-10 sm:py-18 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
            <span className="text-xs font-bold text-[#f56b2a] bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
              Tarification simple
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3 mb-2 tracking-tight">
              Des tarifs clairs, rentabilisés dès le premier jour
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-normal">
              Activation immédiate par Mobile Money. Sans engagement.
            </p>

            {/* Toggle Duration */}
            <div className="mt-6 grid grid-cols-3 max-w-xs sm:max-w-md mx-auto p-1 rounded-2xl bg-slate-100 border border-slate-200 min-h-[44px]">
              {(['monthly', 'quarterly', 'annual'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`py-2 px-1 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                    duration === d
                      ? 'bg-[#f56b2a] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d === 'monthly' ? 'Mensuel' : d === 'quarterly' ? '3 mois (-10%)' : '1 an (-20%)'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 items-stretch">
            
            {/* STARTER */}
            <div className="bg-slate-50 rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-700 bg-white px-3 py-1 rounded-full border border-slate-200">
                    Starter
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">1 boutique</span>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
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
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600 shrink-0" /> Caisse tactile sur téléphone et tablette</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600 shrink-0" /> 1 boutique ou point de vente</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600 shrink-0" /> Jusqu&apos;à 50 articles</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600 shrink-0" /> Reçus WhatsApp et tickets imprimables</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600 shrink-0" /> Fichier clients et historique d&apos;achats</li>
                </ul>
              </div>

              <Link
                href={duration === 'monthly' ? '/subscription' : whatsappLink('STARTER')}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-semibold text-xs text-center transition-all min-h-[42px] flex items-center justify-center"
              >
                {duration === 'monthly' ? 'Choisir Starter' : 'Contacter sur WhatsApp'}
              </Link>
            </div>

            {/* PRO (Populaire) */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 border-2 border-[#f56b2a] flex flex-col justify-between relative shadow-xl shadow-orange-500/10 md:scale-[1.02]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#f56b2a] text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-xs">
                ⭐ Le plus choisi
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-orange-700 bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
                    Pro
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-600">Caisse & web</span>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
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
                  <li className="flex items-center gap-2 text-orange-600"><Check size={15} className="text-[#f56b2a] shrink-0" /> Boutique en ligne ouverte 24h sur 24</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600 shrink-0" /> Jusqu&apos;à 3 boutiques connectées</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600 shrink-0" /> Jusqu&apos;à 500 articles</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600 shrink-0" /> Paiements Mobile Money et à la livraison</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600 shrink-0" /> Tarifs de gros et réductions automatiques</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600 shrink-0" /> Alertes automatiques de stock faible</li>
                </ul>
              </div>

              <Link
                href={duration === 'monthly' ? '/subscription' : whatsappLink('PRO')}
                className="w-full py-3.5 px-4 rounded-xl bg-[#f56b2a] hover:bg-[#e05a1d] active:scale-[0.98] text-white font-bold text-xs text-center shadow-md shadow-orange-500/25 transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
              >
                <span>{duration === 'monthly' ? 'Passer à Pro' : 'Contacter sur WhatsApp'}</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* ENTERPRISE */}
            <div className="bg-slate-50 rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                    Entreprise
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">Multi-magasins</span>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
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
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600 shrink-0" /> Boutiques et magasins illimités</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600 shrink-0" /> Nombre d&apos;articles illimité</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600 shrink-0" /> Factures et devis avec votre logo</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600 shrink-0" /> Gestion des employés et vendeurs</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-emerald-600 shrink-0" /> Accompagnement direct WhatsApp 7j sur 7</li>
                </ul>
              </div>

              <Link
                href={duration === 'monthly' ? '/subscription' : whatsappLink('ENTERPRISE')}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-semibold text-xs text-center transition-all min-h-[42px] flex items-center justify-center"
              >
                {duration === 'monthly' ? 'Choisir Entreprise' : 'Contacter sur WhatsApp'}
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* 8. FAQ Complète et Détaillée */}
      <section id="faq" className="py-12 sm:py-18 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-10">
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
                  type="button"
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

      {/* 9. Mobile Sticky Bottom Action Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 shadow-2xl flex items-center justify-between gap-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="text-left pl-1">
          <span className="text-[10px] font-semibold text-slate-500 block leading-tight">Formule Starter</span>
          <span className="text-sm font-bold text-slate-900 leading-tight">12 000 FCFA <span className="text-[10px] font-normal text-slate-500">/mois</span></span>
        </div>
        <Link
          href="/subscription"
          className="flex-1 max-w-[190px] py-2.5 px-4 rounded-xl bg-[#f56b2a] active:scale-[0.98] text-white font-bold text-xs text-center shadow-md shadow-orange-500/25 flex items-center justify-center gap-1.5 min-h-[42px]"
        >
          <span>Démarrer</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* 10. Simple Clean Footer */}
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
