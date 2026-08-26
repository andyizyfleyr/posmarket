'use client';
import React, { useState, useMemo } from 'react';
import { SUBSCRIPTION_PLANS } from '@/constants';
import { UserSubscription, SubscriptionDuration, SubscriptionTier, SubscriptionPlan, NotificationType, StaffRole } from '@/types';
import { Check, X as XIcon, Info, Award, Star, Zap, Users, Clock, Shield } from 'lucide-react';
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
    const daysLeft = getDaysRemaining(currentSubscription.endDate);
    const [duration, setDuration] = useState<SubscriptionDuration>(currentSubscription.duration || 'monthly');
    const [loading, setLoading] = useState<string | null>(null);

    const plans = [SUBSCRIPTION_PLANS.STARTER, SUBSCRIPTION_PLANS.PRO, SUBSCRIPTION_PLANS.ENTERPRISE];

    // Calculate dynamic savings for each plan
    const savings = useMemo(() => {
        const result: Record<string, { quarterly: number; annual: number; quarterlyPct: number; annualPct: number }> = {};
        plans.forEach(plan => {
            const monthlyCost = plan.priceMonthly;
            const quarterlyCost = plan.priceQuarterly;
            const annualCost = plan.priceAnnual;
            // Quarterly: what you'd pay monthly for 3 months vs quarterly price
            const quarterlySave = (monthlyCost * 3) - quarterlyCost;
            const quarterlyPct = Math.round((quarterlySave / (monthlyCost * 3)) * 100);
            // Annual: what you'd pay monthly for 12 months vs annual price
            const annualSave = (monthlyCost * 12) - annualCost;
            const annualPct = Math.round((annualSave / (monthlyCost * 12)) * 100);
            result[plan.tier] = { quarterly: quarterlySave, annual: annualSave, quarterlyPct, annualPct };
        });
        return result;
    }, []);

    const handleSubscribe = async (plan: SubscriptionPlan) => {
        if (plan.tier === currentSubscription.tier && currentSubscription.status === 'ACTIVE' && !isExpired) {
            return;
        }

        setLoading(plan.tier);
        try {
            if (onUpdateSubscription) {
                const result = await onUpdateSubscription(plan.tier, duration);
                if (result.success) {
                    router.refresh();
                    if (notify) notify(`Abonnement ${plan.name} activé avec succès !`, 'success', 'Succès');
                } else {
                    if (notify) notify(result.error || 'Erreur lors de l\'activation', 'error', 'Erreur');
                }
            }
        } catch {
            if (notify) notify('Une erreur est survenue.', 'error', 'Erreur');
        } finally {
            setLoading(null);
        }
    };

    const planIcons: Record<string, { Icon: any; colorClass: string; bgClass: string }> = {
        'STARTER': { Icon: Star, colorClass: 'text-green-600', bgClass: 'bg-green-50' },
        'PRO': { Icon: Award, colorClass: 'text-[#f56b2a]', bgClass: 'bg-orange-50' },
        'ENTERPRISE': { Icon: Zap, colorClass: 'text-purple-600', bgClass: 'bg-purple-50' }
    };

    const getButtonText = (plan: SubscriptionPlan) => {
        if (loading === plan.tier) return 'Traitement...';
        if (isSeller) return 'Accès Restreint';
        if (plan.tier === currentSubscription.tier && currentSubscription.status === 'ACTIVE' && !isExpired) return 'Plan Actuel';
        if (plan.tier === currentSubscription.tier && isExpired) return 'Réactiver';
        return `Passer à ${plan.name}`;
    };

    return (
        <div className="flex-grow bg-slate-50 flex flex-col items-center p-4 md:p-12 overflow-y-auto">
            {/* Current Subscription Status */}
            <div className="w-full max-w-2xl mb-6 md:mb-10">
                <div className={`rounded-2xl md:rounded-3xl p-4 md:p-6 border ${
                    isExpired
                        ? 'bg-red-50 border-red-100'
                        : daysLeft <= 7
                            ? 'bg-amber-50 border-amber-100'
                            : 'bg-white border-slate-200'
                }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${
                                isExpired ? 'bg-red-100 text-red-500' : daysLeft <= 7 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                            }`}>
                                {isExpired ? <XIcon size={20} /> : <Shield size={20} />}
                            </div>
                            <div>
                                <p className="text-xs md:text-sm font-bold text-slate-500">Abonnement actuel</p>
                                <p className={`text-sm md:text-lg font-black ${
                                    isExpired ? 'text-red-600' : 'text-slate-900'
                                }`}>
                                    {SUBSCRIPTION_PLANS[currentSubscription.tier]?.name || 'Aucun'}
                                    {isExpired && ' (Expiré)'}
                                </p>
                            </div>
                        </div>
                        {!isExpired && (
                            <div className="text-right">
                                <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase">Expire dans</p>
                                <p className={`text-lg md:text-2xl font-black ${
                                    daysLeft <= 7 ? 'text-amber-600' : 'text-slate-900'
                                }`}>
                                    {daysLeft}j
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="text-center max-w-2xl mb-6 md:mb-10">
                <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 mb-2 md:mb-3">
                    Choisissez votre formule
                </h1>
                <p className="text-slate-500 text-sm md:text-base">
                    Des fonctionnalités adaptées à la taille de votre commerce.
                </p>

                {isSeller && (
                    <div className="mt-6 bg-orange-50 border border-orange-100 p-4 md:p-5 rounded-2xl flex items-center gap-3 max-w-md mx-auto">
                        <Users size={20} className="text-[#f56b2a] shrink-0" />
                        <p className="text-xs md:text-sm text-slate-600 text-left">
                            En tant que vendeur, l'abonnement est géré par le propriétaire de la boutique.
                        </p>
                    </div>
                )}
            </div>

            {/* Duration Toggle */}
            <div className="mb-8 md:mb-12 flex justify-center">
                <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 inline-flex">
                    {([
                        { value: 'monthly' as const, label: 'Mensuel' },
                        { value: 'quarterly' as const, label: 'Trimestriel' },
                        { value: 'annual' as const, label: 'Annuel' },
                    ]).map(d => (
                        <button
                            key={d.value}
                            onClick={() => setDuration(d.value)}
                            className={`px-3 py-1.5 md:px-5 md:py-2 rounded-lg font-bold text-[11px] md:text-sm transition-all whitespace-nowrap relative ${
                                duration === d.value
                                    ? 'bg-[#f56b2a] text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            {d.label}
                            {d.value === 'annual' && duration !== 'annual' && savings.PRO && (
                                <span className="absolute -top-2.5 -right-2 bg-red-500 text-white text-[7px] md:text-[9px] px-1.5 py-0.5 rounded-full font-black">
                                    -{savings.PRO.annualPct}%
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full max-w-5xl mb-8">
                {plans.map((plan) => {
                    const isCurrent = currentSubscription.tier === plan.tier && currentSubscription.status === 'ACTIVE' && !isExpired;
                    const price = duration === 'monthly' ? plan.priceMonthly : duration === 'quarterly' ? plan.priceQuarterly : plan.priceAnnual;
                    const displayPrice = price > 0 ? formatCurrency(price) : 'Gratuit';
                    const iconData = planIcons[plan.tier];
                    const planSaving = savings[plan.tier];
                    const isBestValue = plan.tier === 'PRO';
                    const isDowngrade = plans.findIndex(p => p.tier === plan.tier) < plans.findIndex(p => p.tier === currentSubscription.tier);

                    return (
                        <div
                            key={plan.tier}
                            className={`bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 flex flex-col relative transition-all duration-300 ${
                                isCurrent && !isExpired
                                    ? 'ring-2 ring-[#f56b2a] shadow-lg shadow-orange-100/30'
                                    : 'border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1'
                            }`}
                        >
                            {/* Badges */}
                            {isCurrent && !isExpired && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#f56b2a] text-white px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black tracking-widest uppercase whitespace-nowrap">
                                    Actuel
                                </div>
                            )}
                            {isBestValue && !isCurrent && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black tracking-widest uppercase whitespace-nowrap">
                                    Populaire
                                </div>
                            )}

                            {/* Plan Header */}
                            <div className="mb-4 md:mb-5 pt-2">
                                <div className="flex items-center gap-2.5 mb-2">
                                    <div className={`p-2 rounded-lg ${iconData.bgClass}`}>
                                        <iconData.Icon size={18} className={iconData.colorClass} />
                                    </div>
                                    <h3 className="text-base md:text-lg font-black text-slate-900">{plan.name}</h3>
                                </div>
                                <p className="text-slate-400 text-xs md:text-sm">{plan.description}</p>
                            </div>

                            {/* Price */}
                            <div className="mb-4 md:mb-5">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl md:text-3xl font-extrabold text-slate-900">{displayPrice}</span>
                                    {price > 0 && (
                                        <span className="text-slate-400 text-xs md:text-sm font-medium">
                                            /{duration === 'monthly' ? 'mois' : duration === 'quarterly' ? '3 mois' : 'an'}
                                        </span>
                                    )}
                                </div>
                                {duration !== 'monthly' && price > 0 && planSaving && (
                                    <p className="text-[10px] md:text-xs text-green-600 font-bold mt-1">
                                        Vous économisez {formatCurrency(duration === 'quarterly' ? planSaving.quarterly : planSaving.annual)} vs mensuel
                                    </p>
                                )}
                            </div>

                            {/* Limits */}
                            <div className="space-y-2.5 mb-5 md:mb-6">
                                <div className="flex items-center gap-2">
                                    <Check size={14} className="text-green-500 shrink-0" />
                                    <span className="text-xs md:text-sm text-slate-600">
                                        <span className="font-bold text-slate-900">{plan.features.maxStores === 999 ? 'Illimité' : plan.features.maxStores}</span> boutique{plan.features.maxStores > 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check size={14} className="text-green-500 shrink-0" />
                                    <span className="text-xs md:text-sm text-slate-600">
                                        <span className="font-bold text-slate-900">{plan.features.maxProducts === 999999 ? 'Illimité' : plan.features.maxProducts}</span> produit{plan.features.maxProducts > 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="space-y-2 mb-5 md:mb-6 flex-grow">
                                {[
                                    { label: 'Point de Vente (POS)', included: true },
                                    { label: 'Gestion stocks & clients', included: true },
                                    { label: 'Boutique en ligne', included: plan.features.enableStorefront },
                                    { label: 'Rapports avancés', included: plan.features.enableAdvancedReports },
                                    { label: 'Tickets personnalisés', included: plan.features.enableCustomReceipts },
                                ].map((feature, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        {feature.included ? (
                                            <Check size={12} className="text-green-500 shrink-0" />
                                        ) : (
                                            <XIcon size={12} className="text-slate-300 shrink-0" />
                                        )}
                                        <span className={`text-[11px] md:text-xs ${feature.included ? 'text-slate-600 font-medium' : 'text-slate-300'}`}>
                                            {feature.label}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* CTA */}
                            <button
                                onClick={() => handleSubscribe(plan)}
                                disabled={(isCurrent && !isExpired) || loading !== null || isSeller}
                                className={`w-full py-3 rounded-xl font-black text-xs md:text-sm transition-all ${
                                    isCurrent && !isExpired
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : isSeller
                                            ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                            : isDowngrade
                                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                : 'bg-[#f56b2a] text-white hover:bg-[#d55a20] hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]'
                                }`}
                            >
                                {loading === plan.tier ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Activation...
                                    </span>
                                ) : getButtonText(plan)}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
