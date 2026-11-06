'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, Loader2, Save, ShieldCheck, Truck, Phone, Smartphone, Info } from 'lucide-react';
import {
  fetchStorePaymentSettingsAction,
  saveStorePaymentMethodAction,
} from '@/app/actions/storePayments';
import type {
  PublicStorePaymentConfig,
  StorePaymentMethodView,
  StorePaymentProvider,
  StorePaymentSecretPayload,
} from '@/lib/store-payments';
import type { NotificationType } from '@/types';

interface Props {
  storeId: string;
  notify?: (message: string, type: NotificationType, title?: string) => void;
}

/** Les paiements boutiques sont en production uniquement (pas de sandbox). */
const PAYMENT_ENV = 'live';

type Draft = {
  enabled: boolean;
  publicKey: string;
  ussdCode: string;
  instructions: string;
  privateKey: string;
  secretKey: string;
  apiKey: string;
  webhookSecret: string;
};

const PROVIDER_META: Record<
  StorePaymentProvider,
  { icon: React.ReactNode; hint: string; secretFields: Array<{ key: keyof StorePaymentSecretPayload; label: string; placeholder: string }> }
> = {
  cod: {
    icon: <Truck size={20} />,
    hint: 'Le client paie en espèces à la livraison. Aucune clé requise.',
    secretFields: [],
  },
  kkiapay: {
    icon: <Smartphone size={20} />,
    hint: 'Widget Mobile Money / carte. Clés depuis votre tableau de bord Kkiapay (mode production).',
    secretFields: [
      { key: 'privateKey', label: 'Clé privée', placeholder: 'sk_live_…' },
      { key: 'secretKey', label: 'Clé secrète', placeholder: 'sk_live_…' },
    ],
  },
  fedapay: {
    icon: <Smartphone size={20} />,
    hint: 'Widget Mobile Money / carte. Clés depuis votre tableau de bord FedaPay (mode production).',
    secretFields: [
      { key: 'secretKey', label: 'Clé secrète', placeholder: 'sk_live_…' },
    ],
  },
  saspay: {
    icon: <CreditCard size={20} />,
    hint: 'Guichet hébergé SasPay : le client est redirigé pour payer, la commande est marquée payée après vérification.',
    secretFields: [
      { key: 'apiKey', label: 'Clé API', placeholder: 'sk_live_…' },
    ],
  },
  ussd: {
    icon: <Phone size={20} />,
    hint: 'Le client compose un code USSD puis paie ; vous vérifiez l’encaissement sur votre compte.',
    secretFields: [],
  },
};

function draftFromView(view: StorePaymentMethodView): Draft {
  return {
    enabled: view.enabled,
    publicKey: view.config.publicKey || '',
    ussdCode: view.config.ussdCode || '',
    instructions: view.config.instructions || '',
    privateKey: '',
    secretKey: '',
    apiKey: '',
    webhookSecret: '',
  };
}

const inputCls =
  'w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand/20 focus:bg-white transition-all';

export function StorePaymentsSettings({ storeId, notify }: Props) {
  const [methods, setMethods] = useState<StorePaymentMethodView[]>([]);
  const [drafts, setDrafts] = useState<Partial<Record<StorePaymentProvider, Draft>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<StorePaymentProvider | null>(null);

  const load = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      setMethods([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchStorePaymentSettingsAction(storeId);
      if (res.success && res.methods && res.methods.length > 0) {
        setMethods(res.methods);
        setDrafts(
          Object.fromEntries(res.methods.map((m) => [m.provider, draftFromView(m)])),
        );
      } else {
        // Affichage dégradé : on propose quand même les 5 moyens par défaut
        // pour que le vendeur puisse les activer et enregistrer ses clés.
        const defaults: StorePaymentMethodView[] = (['cod', 'kkiapay', 'fedapay', 'saspay', 'ussd'] as StorePaymentProvider[]).map((provider) => ({
          provider,
          label: {
            cod: 'Paiement à la livraison',
            kkiapay: 'Kkiapay (Mobile Money / carte)',
            fedapay: 'FedaPay (Mobile Money / carte)',
            saspay: 'SasPay (Mobile Money)',
            ussd: 'Paiement USSD',
          }[provider],
          enabled: false,
          config: { env: PAYMENT_ENV },
          hasSecret: false,
          keyHint: null,
        }));
        setMethods(defaults);
        setDrafts(
          Object.fromEntries(defaults.map((m) => [m.provider, draftFromView(m)])),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (provider: StorePaymentProvider, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [provider]: { ...(prev[provider] || draftFromView(methods.find((m) => m.provider === provider)!)), ...patch },
    }));
  };

  const save = async (provider: StorePaymentProvider) => {
    const draft = drafts[provider];
    if (!draft) return;
    setSaving(provider);
    try {
      const secrets: StorePaymentSecretPayload = {};
      if (draft.privateKey.trim()) secrets.privateKey = draft.privateKey.trim();
      if (draft.secretKey.trim()) secrets.secretKey = draft.secretKey.trim();
      if (draft.apiKey.trim()) secrets.apiKey = draft.apiKey.trim();
      if (draft.webhookSecret.trim()) secrets.webhookSecret = draft.webhookSecret.trim();

      const config: PublicStorePaymentConfig = {
        env: PAYMENT_ENV,
      };
      if (draft.publicKey.trim()) config.publicKey = draft.publicKey.trim();
      if (draft.ussdCode.trim()) config.ussdCode = draft.ussdCode.trim();
      if (draft.instructions.trim()) config.instructions = draft.instructions.trim();

      const res = await saveStorePaymentMethodAction(storeId, provider, {
        enabled: draft.enabled,
        config,
        secrets,
      });
      if (res.success) {
        if (notify) notify('Moyen de paiement enregistré.', 'success');
        await load();
      } else if (notify) {
        notify(res.error || 'Enregistrement impossible.', 'error');
      }
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 size={22} className="animate-spin spinner-always" />
      </div>
    );
  }

  if (!storeId) {
    return (
      <p className="text-xs md:text-sm text-gray-500 font-semibold">
        Créez d’abord votre boutique pour configurer ses moyens de paiement.
      </p>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-2.5 md:gap-3 mb-2">
        <div className="p-1.5 md:p-2 bg-brand rounded-lg md:rounded-xl text-white">
          <CreditCard size={14} className="md:size-[18px]" />
        </div>
        <h3 className="text-[10px] md:text-sm font-bold text-gray-900 uppercase tracking-widest leading-none">
          Moyens de paiement de la boutique
        </h3>
      </div>

      <p className="text-xs md:text-sm text-gray-500 leading-relaxed">
        Encaissez directement sur vos comptes : chaque moyen activé est proposé à vos clients
        à l’étape paiement. Les clés secrètes sont chiffrées et ne sont jamais affichées.
      </p>

      {methods.map((method) => {
        const meta = PROVIDER_META[method.provider];
        const draft = drafts[method.provider];
        if (!draft) return null;
        const needsPublicKey = method.provider === 'kkiapay' || method.provider === 'fedapay';
        return (
          <div
            key={method.provider}
            className={`rounded-3xl border p-4 md:p-6 space-y-4 transition-all ${
              draft.enabled ? 'border-brand/30 bg-orange-50/30' : 'border-gray-100 bg-gray-50/50'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${draft.enabled ? 'bg-brand/15 text-brand' : 'bg-white border border-gray-100 text-gray-400'}`}>
                  {meta.icon}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs md:text-sm font-bold text-gray-900 truncate">{method.label}</h4>
                  <p className="text-[10px] md:text-xs text-gray-500 leading-snug">{meta.hint}</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={draft.enabled}
                  onChange={(e) => update(method.provider, { enabled: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
              </label>
            </div>

            {draft.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {needsPublicKey && (
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Clé publique</label>
                    <input
                      className={inputCls}
                      value={draft.publicKey}
                      onChange={(e) => update(method.provider, { publicKey: e.target.value })}
                      placeholder="pk_live_…"
                      autoComplete="off"
                    />
                  </div>
                )}
                {meta.secretFields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      {field.label}
                      {method.hasSecret && <span className="normal-case font-semibold text-green-600"> · enregistré{method.keyHint ? ` (${method.keyHint})` : ''}</span>}
                    </label>
                    <input
                      type="password"
                      className={inputCls}
                      value={draft[field.key] || ''}
                      onChange={(e) => update(method.provider, { [field.key]: e.target.value } as Partial<Draft>)}
                      placeholder={method.hasSecret ? 'Laisser vide pour conserver' : field.placeholder}
                      autoComplete="off"
                    />
                  </div>
                ))}
                {method.provider === 'ussd' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Code USSD à composer</label>
                      <input
                        className={inputCls}
                        value={draft.ussdCode}
                        onChange={(e) => update(method.provider, { ussdCode: e.target.value })}
                        placeholder="Ex : *123*45#"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Instructions (optionnel)</label>
                      <input
                        className={inputCls}
                        value={draft.instructions}
                        onChange={(e) => update(method.provider, { instructions: e.target.value })}
                        placeholder="Ex : Composez le code puis suivez les instructions"
                        autoComplete="off"
                      />
                    </div>
                  </>
                )}
                {method.provider === 'cod' && (
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Instructions (optionnel)</label>
                    <input
                      className={inputCls}
                      value={draft.instructions}
                      onChange={(e) => update(method.provider, { instructions: e.target.value })}
                      placeholder="Ex : Payez en espèces à la réception"
                      autoComplete="off"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400">
                <ShieldCheck size={12} className="text-green-500" />
                Secrets chiffrés, jamais exposés au navigateur · Mode production
              </span>
              <button
                onClick={() => save(method.provider)}
                disabled={saving === method.provider}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-xl text-[11px] font-bold shadow-lg shadow-orange-100 hover:bg-[#d55a20] disabled:opacity-50 transition-all active:scale-95"
              >
                {saving === method.provider ? <Loader2 size={14} className="animate-spin spinner-always" /> : <Save size={14} />}
                Enregistrer
              </button>
            </div>
          </div>
        );
      })}

      <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100/50 flex gap-3">
        <Info size={18} className="text-brand flex-shrink-0" />
        <p className="text-brand text-[10px] md:text-xs font-normal leading-relaxed">
          <strong>Conseil :</strong> activez au moins le paiement à la livraison si vous ne
          disposez pas encore de compte Mobile Money. Les paiements boutiques sont en
          <strong>mode production (live)</strong> uniquement et les clés de test
          (pk_test_, sk_test_, …) sont refusées. Les paiements en ligne sont
          marqués « payés » seulement après vérification par le serveur auprès du fournisseur.
        </p>
      </div>
    </div>
  );
}

export default StorePaymentsSettings;
