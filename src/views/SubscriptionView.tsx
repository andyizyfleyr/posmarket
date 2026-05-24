'use client';
import React, { useState } from 'react';
import { SUBSCRIPTION_PLANS } from '@/constants';
import { UserSubscription, SubscriptionDuration, SubscriptionTier, SubscriptionPlan, NotificationType, StaffRole } from '@/types';
import { Check, Info, Award, Star, Zap, Users } from 'lucide-react';
import { formatCurrency, getDaysRemaining } from '@/utils';
import { useRouter } from '@/components/RouterPolyfill';

interface SubscriptionViewProps {
    currentSubscription: UserSubscription;
    onUpdateSubscription?: (tier: SubscriptionTier, duration: SubscriptionDuration) => Promise<any>;
    notify?: (message: string, type: NotificationType, title?: string) => void;
    userRole?: StaffRole;
}

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({ currentSubscription, onUpdateSubscription, notify, userRole }) => {
    const router = useRouter();
    const isSeller = userRole === 'SELLER';
    const isExpired = new Date(currentSubscription.endDate) < new Date();
    const [duration, setDuration] = useState<SubscriptionDuration>(currentSubscription.duration || 'monthly');
    const [loading, setLoading] = useState(false);

    const plans = [SUBSCRIPTION_PLANS.PRO, SUBSCRIPTION_PLANS.ENTERPRISE];

    const handleSubscribe = async (plan: SubscriptionPlan) => {
        // Allow reactivation if same plan but expired, or if different plan
        if (plan.tier === currentSubscription.tier && currentSubscription.status === 'ACTIVE' && !isExpired) {
            return;
        }

        setLoading(true);
        try {
            if (onUpdateSubscription) {
                const result = await onUpdateSubscription(plan.tier, duration);
                if (result.success) {
                    router.refresh();
                    if (notify) notify(`Félicitations ! Votre abonnement ${plan.name} est maintenant actif.`, 'success', 'Succès');
                } else {
                    if (notify) notify(`Erreur: ${result.error}`, 'error', 'Erreur');
                }
            }
        } catch (err: any) {
            if (notify) notify(`Une erreur est survenue lors de l'abonnement.`, 'error', 'Erreur');
        } finally {
            setLoading(false);
        }
    };

    const planIcons: Record<string, { Icon: any, colorClass: string }> = {
        'PRO': { Icon: Award, colorClass: 'text-[#f56b2a]' },
        'ENTERPRISE': { Icon: Zap, colorClass: 'text-purple-500' }
    };

    return (
        <div className="flex-grow bg-slate-50 flex flex-col items-center p-4 md:p-12 overflow-y-auto">
            <div className="text-center max-w-2xl mb-8 md:mb-12">
                <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 mb-3 md:mb-4">
                    Boostez votre commerce
                </h1>
                <p className="text-slate-600 text-sm md:text-lg">
                    Choisissez la formule idéale pour votre activité.
                </p>

                {isSeller && (
                    <div className="mt-8 bg-orange-50 border border-orange-100 p-6 rounded-[32px] flex flex-col md:flex-row items-center gap-6 max-w-2xl mx-auto shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-[#f56b2a] shrink-0">
                            <Users size={32} />
                        </div>
                        <div className="text-left">
                            <h3 className="text-lg font-black text-slate-900 mb-1">Abonnement Partagé</h3>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                En tant que vendeur, vous bénéficiez de l'abonnement souscrit par le propriétaire de la boutique. 
                                {isExpired ? (
                                    <span className="text-red-500 font-bold block mt-1">L'abonnement du chef boutique a expiré. Veuillez le contacter pour le renouveler.</span>
                                ) : (
                                    <span> Cet abonnement restera actif tant que celui du chef boutique est valide ({getDaysRemaining(currentSubscription.endDate)} jours restants).</span>
                                )}
                            </p>
                        </div>
                    </div>
                )}

                <div className="mt-8 md:mt-12 flex justify-center">
                    <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 inline-flex overflow-visible max-w-full">
                        <button
                            onClick={() => setDuration('demo')}
                            className={`px-3 py-1.5 md:px-6 md:py-2 rounded-lg font-bold text-[10px] md:text-sm transition-colors relative whitespace-nowrap ${duration === 'demo' ? 'bg-[#f56b2a] text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            Démo
                            <span className="absolute -top-3 -right-2 bg-purple-500 text-white text-[8px] md:text-[10px] px-1.5 md:px-2 py-0.5 rounded-full font-black animate-pulse z-10">
                                1min
                            </span>
                        </button>
                        <button
                            onClick={() => setDuration('monthly')}
                            className={`px-3 py-1.5 md:px-6 md:py-2 rounded-lg font-bold text-[10px] md:text-sm transition-colors whitespace-nowrap ${duration === 'monthly' ? 'bg-[#f56b2a] text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            Mensuel
                        </button>
                        <button
                            onClick={() => setDuration('quarterly')}
                            className={`px-3 py-1.5 md:px-6 md:py-2 rounded-lg font-bold text-[10px] md:text-sm transition-colors whitespace-nowrap ${duration === 'quarterly' ? 'bg-[#f56b2a] text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            Trimestriel
                        </button>
                        <button
                            onClick={() => setDuration('annual')}
                            className={`px-3 py-1.5 md:px-6 md:py-2 rounded-lg font-bold text-[10px] md:text-sm transition-colors relative whitespace-nowrap ${duration === 'annual' ? 'bg-[#f56b2a] text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            Annuel
                            <span className="absolute -top-3 -right-2 bg-red-500 text-white text-[8px] md:text-[10px] px-1.5 md:px-2 py-0.5 rounded-full font-black animate-pulse z-10">
                                -20%
                            </span>
                        </button>
                    </div>
                </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
                {plans.map((plan) => {
                    const isCurrent = currentSubscription.tier === plan.tier && currentSubscription.status === 'ACTIVE' && !isExpired;
                    const price = (duration === 'demo' || duration === 'monthly') ? plan.priceMonthly : duration === 'quarterly' ? plan.priceQuarterly : plan.priceAnnual;
                    const displayPrice = price > 0 ? formatCurrency(price) : 'Gratuit';

                    return (
                        <div
                            key={plan.tier}
                            className={`bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 flex flex-col relative transition-transform duration-300 hover:-translate-y-2 ${isCurrent && !isExpired ? 'ring-4 ring-[#f56b2a] shadow-xl' : 'border border-slate-200 shadow-lg'}`}
                        >
                            {isCurrent && !isExpired && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#f56b2a] text-white px-4 py-1 rounded-full text-xs font-black tracking-widest uppercase">
                                    Plan Actuel
                                </div>
                            )}

                             <div className="mb-5 md:mb-6">
                                <div className="flex items-center gap-3 mb-3 md:mb-4">
                                    <div className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl ${plan.tier === 'PRO' ? 'bg-orange-50' : plan.tier === 'ENTERPRISE' ? 'bg-purple-50' : 'bg-slate-100'}`}>
                                        {(() => {
                                            const iconData = planIcons[plan.tier];
                                            if (!iconData) return null;
                                            const { Icon, colorClass } = iconData;
                                            return <Icon size={24} className={`${colorClass} md:size-8`} />;
                                        })()}
                                    </div>
                                    <div>
                                        <h3 className="text-lg md:text-xl font-bold text-slate-900">{plan.name}</h3>
                                    </div>
                                </div>
                                <p className="text-slate-500 text-xs md:text-sm h-auto md:h-10 truncate md:whitespace-normal">{plan.description}</p>
                            </div>

                            <div className="mb-8">
                                <span className="text-4xl font-extrabold text-slate-900">{displayPrice}</span>
                                {price > 0 && <span className="text-slate-500 font-medium ml-1">/{duration === 'demo' ? '1 min' : duration === 'monthly' ? 'mois' : duration === 'quarterly' ? '3 mois' : 'an'}</span>}
                            </div>

                            <div className="space-y-3 md:space-y-4 mb-6 md:mb-8 flex-grow">
                                <div className="flex items-start gap-2.5 md:gap-3">
                                    <Check className="text-green-500 size-4 md:size-5 flex-shrink-0 mt-0.5" />
                                    <span className="text-xs md:text-sm text-slate-700 font-medium whitespace-nowrap">Jusqu'à <span className="font-bold text-slate-900">{plan.features.maxStores === 999 ? 'illimité' : plan.features.maxStores}</span> boutiques</span>
                                </div>
                                <div className="flex items-start gap-2.5 md:gap-3">
                                    <Check className="text-green-500 size-4 md:size-5 flex-shrink-0 mt-0.5" />
                                    <span className="text-xs md:text-sm text-slate-700 font-medium whitespace-nowrap">Jusqu'à <span className="font-bold text-slate-900">{plan.features.maxProducts === 999999 ? 'illimité' : plan.features.maxProducts}</span> produits</span>
                                </div>
                                <div className="flex items-start gap-2.5 md:gap-3 opacity-90">
                                    <Check className="text-green-500 size-4 md:size-5 flex-shrink-0 mt-0.5" />
                                    <span className="text-xs md:text-sm text-slate-700 whitespace-nowrap">Vente / Point de vente</span>
                                </div>
                                <div className="flex items-start gap-2.5 md:gap-3 opacity-90">
                                    <Check className="text-green-500 size-4 md:size-5 flex-shrink-0 mt-0.5" />
                                    <span className="text-xs md:text-sm text-slate-700 whitespace-nowrap">Gestion stocks & clients</span>
                                </div>
                                <div className={`flex items-start gap-2.5 md:gap-3 ${plan.features.enableCustomReceipts ? '' : 'opacity-40 grayscale'}`}>
                                    {plan.features.enableCustomReceipts ? <Check className="text-green-500 size-4 md:size-5 flex-shrink-0 mt-0.5" /> : <Info className="text-slate-400 size-4 md:size-5 flex-shrink-0 mt-0.5" />}
                                    <span className="text-xs md:text-sm text-slate-700 whitespace-nowrap">Tickets personnalisés</span>
                                </div>
                                <div className={`flex items-start gap-2.5 md:gap-3 ${plan.features.enableAdvancedReports ? '' : 'opacity-40 grayscale'}`}>
                                    {plan.features.enableAdvancedReports ? <Check className="text-green-500 size-4 md:size-5 flex-shrink-0 mt-0.5" /> : <Info className="text-slate-400 size-4 md:size-5 flex-shrink-0 mt-0.5" />}
                                    <span className="text-xs md:text-sm text-slate-700 whitespace-nowrap">Rapports & Stats avancées</span>
                                </div>
                                <div className={`flex items-start gap-2.5 md:gap-3 ${plan.features.enableStorefront ? '' : 'opacity-40 grayscale'}`}>
                                    {plan.features.enableStorefront ? <Check className="text-green-500 size-4 md:size-5 flex-shrink-0 mt-0.5" /> : <Info className="text-slate-400 size-4 md:size-5 flex-shrink-0 mt-0.5" />}
                                    <span className="text-xs md:text-sm text-slate-700 whitespace-nowrap">Boutique en ligne</span>
                                </div>
                            </div>

                            <button
                                onClick={() => handleSubscribe(plan)}
                                disabled={isCurrent || loading || isSeller}
                                className={`w-full py-3 md:py-4 rounded-xl font-bold transition-all text-xs md:text-base ${isCurrent
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : isSeller
                                        ? 'bg-slate-50 text-slate-300 cursor-not-allowed opacity-50'
                                        : plan.tier === 'PRO' || plan.tier === 'ENTERPRISE'
                                            ? 'bg-[#f56b2a] text-white hover:bg-[#d55a20] hover:shadow-lg hover:-translate-y-0.5'
                                            : 'bg-slate-900 text-white hover:bg-slate-800'
                                    }`}
                            >
                                {loading ? 'Traitement...' : isCurrent ? 'Plan Actuel' : isSeller ? 'Accès Restreint' : (currentSubscription.tier === plan.tier && isExpired) ? 'Réactiver' : `Passer à ${plan.name}`}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
