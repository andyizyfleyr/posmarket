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
  DollarSign,
  Users,
  Store,
  ArrowRight,
  MessageCircle,
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
  HeartHandshake,
  Check,
  BarChart3,
  Flame,
  HelpCircle,
  PhoneCall
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-[#f56b2a] selection:text-white overflow-x-hidden">
      
      {/* 1. Top Announcement Header */}
      <div className="bg-gradient-to-r from-orange-600 via-[#f56b2a] to-amber-500 text-white text-xs md:text-sm py-2.5 px-4 text-center font-bold flex items-center justify-center gap-2 shadow-sm sticky top-0 z-50">
        <Sparkles size={16} className="animate-spin duration-3000 text-amber-200" />
        <span>🎁 <strong>Accompagnement VIP offert :</strong> Notre équipe configure votre boutique &amp; votre caisse en 10 minutes !</span>
        <a
          href={whatsappLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-orange-100 hidden sm:inline ml-2 font-black"
        >
          En profiter maintenant &rarr;
        </a>
      </div>

      {/* 2. Main Navigation */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-[41px] z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#f56b2a] to-orange-400 flex items-center justify-center shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <Store size={24} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-2xl tracking-tight text-slate-900">
                Pos<span className="text-[#f56b2a]">Market</span>
              </span>
              <span className="text-[10px] font-extrabold text-orange-600 uppercase tracking-widest -mt-1">
                L&apos;Espace Commerçant
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-8 text-sm font-bold text-slate-600">
            <a href="#defis" className="hover:text-[#f56b2a] transition-colors">Vos défis</a>
            <a href="#solution" className="hover:text-[#f56b2a] transition-colors">La Solution</a>
            <a href="#comparatif" className="hover:text-[#f56b2a] transition-colors">Avant / Après</a>
            <a href="#tarifs" className="hover:text-[#f56b2a] transition-colors">Tarifs &amp; Plans</a>
            <a href="#temoignages" className="hover:text-[#f56b2a] transition-colors">Témoignages</a>
            <a href="#faq" className="hover:text-[#f56b2a] transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-xs md:text-sm font-bold text-slate-700 hover:text-[#f56b2a] transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/subscription"
              className="px-5 py-3 rounded-2xl bg-[#f56b2a] hover:bg-[#e05a1d] text-white text-xs md:text-sm font-black shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] transition-all flex items-center gap-2"
            >
              <span>Lancer ma boutique</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      {/* 3. Hero Section (Vibrant, Illustrated, Emotional) */}
      <section className="relative pt-12 pb-20 md:pt-16 md:pb-28 overflow-hidden bg-gradient-to-b from-orange-50/60 via-white to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Emotional Copywriting */}
            <div className="lg:col-span-7 text-center lg:text-left">
              {/* Emotional Pill Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100/80 border border-orange-200 text-orange-700 text-xs sm:text-sm font-black mb-6 shadow-xs">
                <HeartHandshake size={16} className="text-[#f56b2a]" />
                <span>Pour les commerçants ambitieux d&apos;Afrique</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.12] mb-6">
                Vous travaillez dur pour votre boutique. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f56b2a] via-orange-500 to-amber-600">
                  Il est temps qu&apos;elle travaille enfin pour vous.
                </span>
              </h1>

              {/* Sweet Subtitle */}
              <p className="text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed mb-8 max-w-2xl mx-auto lg:mx-0 font-medium">
                Vous méritez de dormir sereinement sans avoir la boule au ventre : la caisse est-elle juste ? Y a-t-il eu des erreurs ? Des clients perdus la nuit ? <strong className="text-slate-900 font-extrabold">PosMarket</strong> transforme votre téléphone en <span className="text-[#f56b2a] font-black underline decoration-orange-300">Caisse Tactile Express</span> et en <span className="text-emerald-600 font-black underline decoration-emerald-300">Vitrine Web ouverte 24h/24</span> avec paiement Mobile Money automatique.
              </p>

              {/* Dual Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10">
                <Link
                  href="/subscription"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#f56b2a] to-orange-500 hover:from-orange-500 hover:to-[#f56b2a] text-white font-black text-base shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] transition-all flex items-center justify-center gap-2.5"
                >
                  <span>Ouvrir ma boutique &amp; Caisse</span>
                  <ArrowRight size={18} />
                </Link>
                <a
                  href={whatsappLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-emerald-500 text-slate-800 font-bold text-base transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <MessageCircle size={20} className="text-emerald-600" />
                  <span>Discuter sur WhatsApp</span>
                </a>
              </div>

              {/* Key Trust Signals */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs sm:text-sm font-bold text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span>Paiements MTN &amp; Moov Money</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span>Zéro matériel cher à acheter</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span>Prise en main en 5 minutes</span>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Showcase (Image + Floating Badges) */}
            <div className="lg:col-span-5 relative">
              {/* Glow background */}
              <div className="absolute -inset-4 bg-gradient-to-tr from-orange-400/20 to-emerald-400/20 rounded-3xl blur-2xl -z-10" />

              {/* Main Photo Card */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-slate-900">
                {/* Real Commercial Photography */}
                <div className="relative h-[380px] sm:h-[460px] w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1556742049-0a67c5574f73?q=80&w=1000&auto=format&fit=crop"
                    alt="Paiement express et encaissement en boutique"
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                </div>

                {/* Floating Live Badge 1: Top Right - Mobile Money Notification */}
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-slate-100 flex items-center gap-3 animate-bounce-subtle">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={22} />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Vente Encaissée</p>
                    <p className="text-sm font-black text-slate-900">18 500 FCFA <span className="text-[10px] font-bold text-slate-500">(MTN MoMo)</span></p>
                  </div>
                </div>

                {/* Floating Live Badge 2: Bottom Left - Stock Sync */}
                <div className="absolute bottom-4 left-4 bg-slate-950/90 backdrop-blur-md rounded-2xl p-3.5 shadow-xl border border-slate-700/80 text-left max-w-[240px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[11px] font-black text-white">Stock Synchronisé</span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-300">
                    Vente en boutique = stock mis à jour instantanément sur votre vitrine web.
                  </p>
                </div>

                {/* Bottom Bar inside image */}
                <div className="absolute bottom-4 right-4 bg-gradient-to-r from-[#f56b2a] to-orange-500 text-white rounded-xl px-3 py-1.5 text-xs font-black shadow-lg">
                  📈 CA : +42% ce mois-ci
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. Section Douleurs : Le Calvaire Quotidien Sans PosMarket */}
      <section id="defis" className="py-16 md:py-24 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-red-600 bg-red-50 border border-red-200 px-3.5 py-1.5 rounded-full">
              La réalité sans outil moderne
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-4 mb-4">
              Reconnaissez-vous l&apos;un de ces cauchemars du quotidien ?
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Gérer un commerce physique ne devrait jamais être synonyme d&apos;épuisement, de méfiance et de perte d&apos;argent.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Douleur 1 */}
            <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-200 hover:border-red-300 transition-all group flex flex-col justify-between shadow-xs hover:shadow-md">
              <div>
                <div className="relative h-44 w-full rounded-2xl overflow-hidden mb-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1450133064473-71024230f91b?q=80&w=600&auto=format&fit=crop"
                    alt="Cahier de comptes et calculs pénibles"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-lg">
                    Le Cahier Froissé
                  </div>
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">
                  1. Le calvaire des comptes à 21h
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  Après 12 heures debout, vous passez encore 1h30 à recompter avec la calculatrice, à essayer de comprendre pourquoi il manque 15 000 FCFA dans la caisse. Cette fatigue mentale gâche vos soirées en famille.
                </p>
              </div>
            </div>

            {/* Douleur 2 */}
            <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-200 hover:border-red-300 transition-all group flex flex-col justify-between shadow-xs hover:shadow-md">
              <div>
                <div className="relative h-44 w-full rounded-2xl overflow-hidden mb-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1580828343064-fde4fc206bc6?q=80&w=600&auto=format&fit=crop"
                    alt="Boutique fermée et angoisse du commerçant"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-lg">
                    Prisonnier du Magasin
                  </div>
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">
                  2. L&apos;angoisse dès que vous vous absentez
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  Impossible d&apos;aller à un mariage, des obsèques ou de prendre du repos sans angoisser : <em>&quot;Est-ce que les employés encaissent correctement ? Est-ce qu&apos;un article va disparaître sans trace ?&quot;</em>
                </p>
              </div>
            </div>

            {/* Douleur 3 */}
            <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-200 hover:border-red-300 transition-all group flex flex-col justify-between shadow-xs hover:shadow-md">
              <div>
                <div className="relative h-44 w-full rounded-2xl overflow-hidden mb-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=600&auto=format&fit=crop"
                    alt="Fausses captures de paiement mobile"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-lg">
                    Arnaques Mobile Money
                  </div>
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">
                  3. Les faux SMS et fausses captures
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  Des clients pressés vous montrent un SMS de transfert falsifié ou une capture d&apos;écran truquée et repartent avec vos produits. Le temps de vérifier, l&apos;argent n&apos;est jamais arrivé et vous perdez votre marge.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Section Solution : Les 4 Piliers Illustrés (Zig-Zag avec Vraies Images) */}
      <section id="solution" className="py-16 md:py-24 bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-20">
            <span className="text-xs font-black uppercase tracking-widest text-[#f56b2a] bg-orange-100 border border-orange-200 px-3.5 py-1.5 rounded-full">
              La Solution Tout-en-Un
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-4 mb-4">
              Comment PosMarket transforme votre quotidien
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Votre caisse enregistreuse tactile, votre stock et votre boutique en ligne réunis dans un outil ultra-simple.
            </p>
          </div>

          {/* Pilier 1 : Caisse Tactile Express */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center mb-20">
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#f56b2a] flex items-center justify-center mb-5 font-black text-xl">
                01
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-4">
                Une Caisse Tactile Express dans votre poche
              </h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6 font-medium">
                Encaissez n&apos;importe quel client en <strong>3 clics</strong> depuis votre smartphone ou votre tablette. Recherche instantanée d&apos;articles, gestion des remises, impression de tickets thermiques ou envoi direct de reçus professionnels sur WhatsApp.
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-700">
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Recherche ultra-rapide</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Reçus WhatsApp &amp; Ticket</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Compatible code-barres</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Clôture de caisse en 1 clic</span>
                </div>
              </div>
            </div>
            <div className="lg:col-span-6 order-1 lg:order-2">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1556740758-90de374c12ad?q=80&w=900&auto=format&fit=crop"
                  alt="Commerçant souriant avec caisse enregistreuse tactile"
                  className="w-full h-80 sm:h-96 object-cover object-center"
                />
                <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 shadow-xl border border-slate-200 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#f56b2a] flex items-center justify-center">
                    <Receipt size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black text-slate-900">Reçu WhatsApp envoyé</p>
                    <p className="text-[10px] font-bold text-slate-500">Ticket #0492 • Validé</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pilier 2 : Vitrine E-Commerce 24/7 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center mb-20">
            <div className="lg:col-span-6">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=900&auto=format&fit=crop"
                  alt="Client commandant en ligne sur sa vitrine web 24/7"
                  className="w-full h-80 sm:h-96 object-cover object-center"
                />
                <div className="absolute top-4 left-4 bg-emerald-600 text-white rounded-xl px-3.5 py-1.5 text-xs font-black shadow-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span>Boutique ouverte 24h/24</span>
                </div>
                <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 shadow-xl border border-slate-200 text-left">
                  <p className="text-[10px] font-extrabold uppercase text-emerald-600">Commande Reçue à 23h45</p>
                  <p className="text-xs font-black text-slate-900">Robe Wax Soie • 25 000 FCFA</p>
                </div>
              </div>
            </div>
            <div className="lg:col-span-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5 font-black text-xl">
                02
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-4">
                Votre Vitrine E-Commerce Ouverte 24h/24
              </h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6 font-medium">
                Pendant que vous dormez ou passez du temps en famille, vos clients consultent votre catalogue en ligne, passent commande et paient directement. Le stock de votre boutique physique se met à jour automatiquement !
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-700">
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Lien boutique personnalisé</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Zéro frais de commission</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Commandes WhatsApp en 1 clic</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Présence marketplace PosMarket</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pilier 3 : Validation Mobile Money Certifiée */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center mb-20">
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-5 font-black text-xl">
                03
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-4">
                Validation Mobile Money Sécurisée (FedaPay / Kkiapay)
              </h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6 font-medium">
                Finies les arnaques aux faux SMS. Grâce aux passerelles bancaires intégrées <strong>FedaPay</strong> (MTN MoMo, Moov Money) et <strong>Kkiapay</strong> (Wave, CB), la transaction est confirmée directement par les serveurs de l&apos;opérateur avant de valider la commande.
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-700">
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Zéro faux transfert possible</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>MTN MoMo &amp; Moov Money</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Pop-up de validation immédiat</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Rapprochement bancaire auto</span>
                </div>
              </div>
            </div>
            <div className="lg:col-span-6 order-1 lg:order-2">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?q=80&w=900&auto=format&fit=crop"
                  alt="Paiement Mobile Money sécurisé et sans contact"
                  className="w-full h-80 sm:h-96 object-cover object-center"
                />
                <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 text-white border border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black">
                      ✓
                    </div>
                    <div>
                      <p className="text-xs font-black">Paiement FedaPay Validé</p>
                      <p className="text-[10px] text-slate-400">Réf : FEDAPAY-8641 • MTN Bénin</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-emerald-400">+15 000 F</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pilier 4 : Suivi à Distance & Liberté Retrouvée */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=900&auto=format&fit=crop"
                  alt="Commerçante souriante consultant ses ventes sur smartphone à distance"
                  className="w-full h-80 sm:h-96 object-cover object-center"
                />
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-slate-200 text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                    <BarChart3 size={16} className="text-[#f56b2a]" />
                    <span className="text-xs font-black text-slate-900">Bilan en direct</span>
                  </div>
                  <p className="text-[11px] font-bold text-emerald-600">Bénéfice net : +84 000 FCFA</p>
                </div>
              </div>
            </div>
            <div className="lg:col-span-6">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-5 font-black text-xl">
                04
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-4">
                Pilotez votre boutique à distance, en toute liberté
              </h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6 font-medium">
                Vous pouvez enfin assister à vos réunions, voyager ou vous reposer le week-end : chaque vente enregistrée par vos vendeurs apparaît en direct sur votre smartphone. Vous contrôlez tout sans être enfermé au magasin.
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-700">
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Suivi multi-caissiers</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Alertes de stock faible</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Calcul automatique des marges</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Export des rapports de vente</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 6. Section Tableau Comparatif : Le Choc Avant vs Après */}
      <section id="comparatif" className="py-16 md:py-24 bg-white border-y border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full">
              Le Comparatif Net
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-4 mb-3">
              Votre quotidien : Avant vs Après PosMarket
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Voyez concrètement comment votre commerce passe du chaos à la sérénité.
            </p>
          </div>

          <div className="bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="grid grid-cols-2 bg-slate-900 text-xs sm:text-sm font-black text-white uppercase tracking-wider py-4 px-6">
              <div className="text-red-400 flex items-center gap-2">
                <XCircle size={18} />
                <span>Méthode Traditionnelle (Cahier)</span>
              </div>
              <div className="text-emerald-400 flex items-center gap-2">
                <CheckCircle2 size={18} />
                <span>Avec PosMarket</span>
              </div>
            </div>

            <div className="divide-y divide-slate-200 text-xs sm:text-sm">
              {[
                {
                  label: 'Clôture de caisse le soir',
                  before: '1h à 2h d\'angoisse et de calculs manuels avec risque d\'erreur.',
                  after: '1 clic : rapport de caisse instantané, juste au centime près.',
                },
                {
                  label: 'Quand vous quittez le magasin',
                  before: 'Peur constante des vols, des erreurs de caisse et du manque de sérieux.',
                  after: 'Vous suivez chaque vente en direct sur votre smartphone en temps réel.',
                },
                {
                  label: 'Ventes après fermeture',
                  before: 'Zéro franc : votre boutique s\'arrête dès que le rideau est baissé.',
                  after: 'Vos clients commandent et paient en ligne 24h/24 sur votre vitrine web.',
                },
                {
                  label: 'Gestion des ruptures de stock',
                  before: 'Vous découvrez la rupture devant un client mécontent et perdez la vente.',
                  after: 'Alertes automatiques dès qu\'un produit atteint le seuil d\'alerte.',
                },
                {
                  label: 'Paiements Mobile Money',
                  before: 'Vérification manuelle stressante avec risque de fausses captures d\'écran.',
                  after: 'Validation bancaire sécurisée automatique par FedaPay & Kkiapay.',
                },
                {
                  label: 'Visibilité sur vos bénéfices',
                  before: 'Flou total : vous mélangez chiffre d\'affaires et bénéfice net réel.',
                  after: 'Calcul précis de la marge nette et des produits les plus rentables.',
                },
              ].map((row, idx) => (
                <div key={idx} className="grid grid-cols-2 p-5 sm:p-6 gap-4 hover:bg-white transition-colors">
                  <div className="text-slate-600 pr-2">
                    <p className="font-extrabold text-slate-900 text-[11px] uppercase mb-1">{row.label}</p>
                    <p className="text-red-600/90 font-medium leading-snug">{row.before}</p>
                  </div>
                  <div className="text-emerald-700 pl-2">
                    <p className="font-extrabold text-slate-900 text-[11px] uppercase mb-1">{row.label}</p>
                    <p className="font-bold leading-snug">{row.after}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7. Le Calculateur de Rentabilité (ROI) */}
      <section className="py-16 md:py-24 bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900 text-white relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="w-16 h-16 rounded-3xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 mx-auto mb-6 shadow-xl">
            <TrendingUp size={32} />
          </div>

          <h2 className="text-2xl sm:text-4xl font-black mb-4">
            Combien vous coûte réellement le fait de ne pas être équipé ?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            Faisons un calcul mathématique simple, sans détour :
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mb-10">
            <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
              <span className="text-red-400 font-black text-xl block mb-1">- 20 000 FCFA</span>
              <p className="text-xs text-slate-300 font-medium">Pertes moyennes mensuelles dues aux erreurs de caisse et oublis de saisie.</p>
            </div>
            <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
              <span className="text-red-400 font-black text-xl block mb-1">- 45 000 FCFA</span>
              <p className="text-xs text-slate-300 font-medium">Ventes perdues chaque mois par manque de vitrine web accessible la nuit.</p>
            </div>
            <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
              <span className="text-red-400 font-black text-xl block mb-1">- 30 Heures</span>
              <p className="text-xs text-slate-300 font-medium">Temps perdu chaque mois à recompter, vérifier les stocks et chercher les erreurs.</p>
            </div>
          </div>

          <div className="bg-emerald-950/60 border border-emerald-500/40 p-5 rounded-2xl text-emerald-300 text-sm sm:text-base font-bold mb-10">
            👉 L&apos;abonnement PosMarket Starter ne vous coûte que <span className="text-white font-black text-lg underline decoration-orange-500">400 FCFA par jour</span> (12 000 FCFA/mois). Moins cher qu&apos;une bouteille d&apos;eau pour sécuriser des dizaines de milliers de francs !
          </div>

          <Link
            href="/subscription"
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-[#f56b2a] to-orange-500 hover:from-orange-500 hover:to-[#f56b2a] text-white font-black text-base shadow-xl shadow-orange-500/30 hover:scale-[1.02] transition-all"
          >
            <span>Sécuriser ma boutique dès maintenant</span>
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* 8. Tarifs Clairs et Transparents */}
      <section id="tarifs" className="py-16 md:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-[#f56b2a] bg-orange-100 border border-orange-200 px-3.5 py-1.5 rounded-full">
              Tarification Transparente
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-4 mb-3">
              Investissez dans la sérénité de votre commerce
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Pas de frais cachés. Aucun engagement long terme. Paiement Mobile Money direct.
            </p>

            {/* Toggle Duration */}
            <div className="mt-8 inline-flex p-1.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              {(['monthly', 'quarterly', 'annual'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
                    duration === d
                      ? 'bg-[#f56b2a] text-white shadow-md shadow-orange-500/25'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d === 'monthly' ? 'Mensuel' : d === 'quarterly' ? 'Trimestriel (-10%)' : 'Annuel (-20%)'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            
            {/* STARTER */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all shadow-xs hover:shadow-lg">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                    <Star size={20} />
                  </div>
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                    Pour démarrer
                  </span>
                </div>

                <h3 className="text-2xl font-black text-slate-900 mb-1">STARTER</h3>
                <p className="text-xs text-slate-500 mb-6 font-medium">Idéal pour sécuriser et automatiser votre boutique physique.</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-slate-900">
                      {formatCurrency(getPrice(SUBSCRIPTION_PLANS.STARTER)).replace(/\s*FCFA/i, '').trim()}
                    </span>
                    <span className="text-xs font-bold text-slate-500">FCFA / mois</span>
                  </div>
                  {duration !== 'monthly' && (
                    <span className="text-[11px] text-orange-600 font-bold block mt-1">
                      Facturé {formatCurrency(getTotalPrice(SUBSCRIPTION_PLANS.STARTER))} par période
                    </span>
                  )}
                </div>

                <ul className="space-y-3 text-xs text-slate-700 mb-8 border-t border-slate-100 pt-6 font-medium">
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> 1 Boutique physique connectée</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Caisse POS tactile express</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Jusqu&apos;à 50 produits en catalogue</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Suivi des ventes &amp; clôture de caisse</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Reçus imprimables et WhatsApp</li>
                </ul>
              </div>

              <Link
                href={duration === 'monthly' ? '/subscription' : whatsappLink('STARTER')}
                className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs text-center transition-all flex items-center justify-center gap-2"
              >
                <span>{duration === 'monthly' ? 'Choisir Starter' : 'Contacter sur WhatsApp'}</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* PRO (Highlighted) */}
            <div className="bg-white rounded-3xl p-8 border-2 border-[#f56b2a] flex flex-col justify-between relative shadow-xl shadow-orange-500/10 scale-[1.03]">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#f56b2a] to-orange-500 text-white text-[11px] font-black uppercase tracking-wider px-4 py-1 rounded-full shadow-md flex items-center gap-1">
                <Flame size={13} fill="currentColor" />
                <span>Le Choix N°1 des Commerçants</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#f56b2a] flex items-center justify-center">
                    <Award size={22} />
                  </div>
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
                    Caisse + Vitrine Web
                  </span>
                </div>

                <h3 className="text-2xl font-black text-slate-900 mb-1">PRO</h3>
                <p className="text-xs text-slate-500 mb-6 font-medium">La formule complète pour multiplier vos ventes en magasin et en ligne.</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-slate-900">
                      {formatCurrency(getPrice(SUBSCRIPTION_PLANS.PRO)).replace(/\s*FCFA/i, '').trim()}
                    </span>
                    <span className="text-xs font-bold text-slate-500">FCFA / mois</span>
                  </div>
                  {duration !== 'monthly' && (
                    <span className="text-[11px] text-orange-600 font-bold block mt-1">
                      Facturé {formatCurrency(getTotalPrice(SUBSCRIPTION_PLANS.PRO))} par période
                    </span>
                  )}
                </div>

                <ul className="space-y-3 text-xs text-slate-800 mb-8 border-t border-slate-100 pt-6 font-bold">
                  <li className="flex items-center gap-2.5 text-orange-600"><CheckCircle2 size={16} className="text-[#f56b2a] shrink-0" /> Vitrine E-Commerce 24/7 incluse</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Jusqu&apos;à 3 Boutiques gérées</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Jusqu&apos;à 500 Produits en stock</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Paiements FedaPay &amp; Kkiapay automatiques</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Rapports de marges &amp; best-sellers</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Multi-vendeurs &amp; gestion des caissiers</li>
                </ul>
              </div>

              <Link
                href={duration === 'monthly' ? '/subscription' : whatsappLink('PRO')}
                className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-[#f56b2a] to-orange-500 hover:from-orange-500 hover:to-[#f56b2a] text-white font-black text-sm text-center shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2"
              >
                <span>{duration === 'monthly' ? 'Passer à PRO' : 'Contacter sur WhatsApp'}</span>
                <ArrowRight size={16} />
              </Link>
            </div>

            {/* ENTERPRISE */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all shadow-xs hover:shadow-lg">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Zap size={20} />
                  </div>
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                    Multi-Établissements
                  </span>
                </div>

                <h3 className="text-2xl font-black text-slate-900 mb-1">ENTREPRISE</h3>
                <p className="text-xs text-slate-500 mb-6 font-medium">Pour les réseaux de boutiques, franchises et supermarchés.</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-slate-900">
                      {formatCurrency(getPrice(SUBSCRIPTION_PLANS.ENTERPRISE)).replace(/\s*FCFA/i, '').trim()}
                    </span>
                    <span className="text-xs font-bold text-slate-500">FCFA / mois</span>
                  </div>
                  {duration !== 'monthly' && (
                    <span className="text-[11px] text-orange-600 font-bold block mt-1">
                      Facturé {formatCurrency(getTotalPrice(SUBSCRIPTION_PLANS.ENTERPRISE))} par période
                    </span>
                  )}
                </div>

                <ul className="space-y-3 text-xs text-slate-700 mb-8 border-t border-slate-100 pt-6 font-medium">
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Boutiques illimitées</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Produits illimités</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Reçus et factures personnalisés à votre logo</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Support dédié WhatsApp prioritaire 7j/7</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Formation d&apos;équipe sur site ou visio</li>
                </ul>
              </div>

              <Link
                href={duration === 'monthly' ? '/subscription' : whatsappLink('ENTERPRISE')}
                className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs text-center transition-all flex items-center justify-center gap-2"
              >
                <span>{duration === 'monthly' ? 'Choisir Entreprise' : 'Contacter sur WhatsApp'}</span>
                <ArrowRight size={14} />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* 9. Témoignages Visuels avec Vraies Photos */}
      <section id="temoignages" className="py-16 md:py-24 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full">
              Témoignages Réels
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-4 mb-3">
              Ils ont retrouvé le sommeil grâce à PosMarket
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Découvrez les retours authentiques de commerçants qui ont développé leur chiffre d&apos;affaires.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Témoignage 1 */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-400 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop"
                      alt="Fatima Z. - Boutique Mode Cotonou"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">Fatima Z.</h4>
                    <p className="text-[11px] font-bold text-slate-500">Boutique Wax &amp; Mode (Cotonou)</p>
                  </div>
                </div>

                <div className="flex gap-1 text-amber-400 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={15} fill="currentColor" />
                  ))}
                </div>

                <p className="text-slate-700 text-xs sm:text-sm leading-relaxed italic font-medium">
                  &quot;Avant PosMarket, chaque fin de mois était une source de dispute avec mes vendeuses pour des trous de 40 000 FCFA. Aujourd’hui, chaque vente est enregistrée avec son nom. La caisse est nette tous les soirs et mes clientes commandent en ligne même le dimanche !&quot;
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200/80 mt-6 flex items-center justify-between text-[11px] font-extrabold text-emerald-600">
                <span>✓ Compte certifié</span>
                <span>+38% de CA</span>
              </div>
            </div>

            {/* Témoignage 2 */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-400 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop"
                      alt="Serge K. - Supérette Abidjan"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">Serge K.</h4>
                    <p className="text-[11px] font-bold text-slate-500">Supérette &amp; Épicerie (Abidjan)</p>
                  </div>
                </div>

                <div className="flex gap-1 text-amber-400 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={15} fill="currentColor" />
                  ))}
                </div>

                <p className="text-slate-700 text-xs sm:text-sm leading-relaxed italic font-medium">
                  &quot;Ce qui a tout changé pour moi, c’est de pouvoir assister aux obsèques de mon oncle sans fermer la boutique et sans avoir peur. J’ouvrais mon téléphone et je voyais les encaissements en direct. PosMarket m’a redonné ma liberté.&quot;
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200/80 mt-6 flex items-center justify-between text-[11px] font-extrabold text-emerald-600">
                <span>✓ Compte certifié</span>
                <span>Zéro écart de caisse</span>
              </div>
            </div>

            {/* Témoignage 3 */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-400 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=400&auto=format&fit=crop"
                      alt="Awa D. - Cosmétiques & Soins Lomé"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">Awa D.</h4>
                    <p className="text-[11px] font-bold text-slate-500">Cosmétiques &amp; Soins (Lomé)</p>
                  </div>
                </div>

                <div className="flex gap-1 text-amber-400 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={15} fill="currentColor" />
                  ))}
                </div>

                <p className="text-slate-700 text-xs sm:text-sm leading-relaxed italic font-medium">
                  &quot;Le système de paiement Mobile Money avec FedaPay est magique. Finies les arnaques de faux SMS de transfert. Dès que le client paie, mon téléphone valide la vente. Je ne reviendrai plus jamais au cahier en papier.&quot;
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200/80 mt-6 flex items-center justify-between text-[11px] font-extrabold text-emerald-600">
                <span>✓ Compte certifié</span>
                <span>100% sécurisé</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 10. FAQ Accordéon Interactive */}
      <section id="faq" className="py-16 md:py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-[#f56b2a] bg-orange-100 border border-orange-200 px-3.5 py-1.5 rounded-full">
              Foire Aux Questions
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-4 mb-3">
              Toutes vos questions, des réponses simples
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Tout ce que vous devez savoir avant de lancer votre boutique moderne.
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
                a: 'Il vous suffit de cliquer sur le bouton "Lancer ma boutique", de choisir votre formule (ex: Pro à 15 000 FCFA) et de valider votre paiement Mobile Money. Votre compte est activé instantanément !',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs transition-all"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 text-left font-black text-slate-900 flex items-center justify-between gap-4 hover:text-[#f56b2a] transition-colors"
                >
                  <span className="text-sm sm:text-base">{item.q}</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                      openFaq === idx ? 'rotate-180 text-[#f56b2a]' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="p-5 pt-0 text-slate-600 text-xs sm:text-sm leading-relaxed border-t border-slate-100 font-medium">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 11. Final Hero CTA */}
      <section className="py-20 md:py-28 bg-gradient-to-tr from-[#f56b2a] via-orange-500 to-amber-500 text-white text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mx-auto mb-8 shadow-2xl border border-white/30 animate-bounce-subtle">
            <Store size={40} />
          </div>

          <h2 className="text-3xl sm:text-5xl font-black mb-6 leading-tight">
            Votre réussite mérite les meilleurs outils. <br />
            Passez au commerce moderne aujourd&apos;hui.
          </h2>

          <p className="text-base sm:text-lg text-orange-100 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            Rejoignez des centaines de commerçants qui ont éliminé le stress des erreurs de caisse et font fructifier leur boutique 24h/24.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <Link
              href="/subscription"
              className="w-full sm:w-auto px-10 py-4 rounded-2xl bg-white hover:bg-slate-50 text-[#f56b2a] font-black text-base shadow-2xl hover:scale-[1.03] transition-all flex items-center justify-center gap-2"
            >
              <span>Lancer ma boutique maintenant</span>
              <ArrowRight size={18} />
            </Link>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-orange-950/30 hover:bg-orange-950/50 border border-white/30 text-white font-bold text-base transition-all flex items-center justify-center gap-2"
            >
              <MessageCircle size={20} className="text-white" />
              <span>Contacter un conseiller</span>
            </a>
          </div>
        </div>
      </section>

      {/* 12. Clean Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#f56b2a] flex items-center justify-center text-white">
              <Store size={18} />
            </div>
            <span className="font-black text-lg text-white">PosMarket</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 font-medium">La plateforme des commerçants gagnants</span>
          </div>

          <div className="flex items-center gap-6 font-bold text-slate-300">
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <Link href="/subscription" className="hover:text-white transition-colors">Abonnements</Link>
            <Link href="/cgv" className="hover:text-white transition-colors">CGV</Link>
            <Link href="/confidentialite" className="hover:text-white transition-colors">Confidentialité</Link>
          </div>

          <p className="text-slate-500 font-medium">
            &copy; {new Date().getFullYear()} PosMarket. Tous droits réservés.
          </p>
        </div>
      </footer>

    </div>
  );
}
