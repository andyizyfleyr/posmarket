'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CreditCard,
  Loader2,
  Save,
  ShieldCheck,
  Truck,
  Phone,
  Smartphone,
  Info,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
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
  {
    icon: React.ReactNode;
    shortLabel: string;
    secretFields: Array<{ key: keyof StorePaymentSecretPayload; label: string; placeholder: string }>;
  }
> = {
  cod: {
    icon: <Truck size={20} />,
    shortLabel: 'Espèces',
    secretFields: [],
  },
  kkiapay: {
    icon: <Smartphone size={20} />,
    shortLabel: 'Mobile Money / carte',
    secretFields: [
      { key: 'privateKey', label: 'Clé privée', placeholder: 'sk_live_…' },
      { key: 'secretKey', label: 'Clé secrète', placeholder: 'sk_live_…' },
    ],
  },
  fedapay: {
    icon: <Smartphone size={20} />,
    shortLabel: 'Mobile Money / carte',
    secretFields: [
      { key: 'secretKey', label: 'Clé secrète', placeholder: 'sk_live_…' },
    ],
  },
  saspay: {
    icon: <CreditCard size={20} />,
    shortLabel: 'Guichet hébergé',
    secretFields: [
      { key: 'apiKey', label: 'Clé API', placeholder: 'sk_live_…' },
    ],
  },
  ussd: {
    icon: <Phone size={20} />,
    shortLabel: 'Code USSD',
    secretFields: [],
  },
};

const PROVIDER_ORDER: StorePaymentProvider[] = ['cod', 'kkiapay', 'fedapay', 'saspay', 'ussd'];

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

const DEFAULT_LABELS: Record<StorePaymentProvider, string> = {
  cod: 'Paiement à la livraison',
  kkiapay: 'Kkiapay (Mobile Money / carte)',
  fedapay: 'FedaPay (Mobile Money / carte)',
  saspay: 'SasPay (Mobile Money)',
  ussd: 'Paiement USSD',
};

const emptyView = (provider: StorePaymentProvider): StorePaymentMethodView => ({
  provider,
  label: DEFAULT_LABELS[provider],
  enabled: false,
  config: { env: PAYMENT_ENV },
  hasSecret: false,
  keyHint: null,
});

export function StorePaymentsSettings({ storeId, notify }: Props) {
  const [methods, setMethods] = useState<StorePaymentMethodView[]>([]);
  const [drafts, setDrafts] = useState<Partial<Record<StorePaymentProvider, Draft>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<StorePaymentProvider | null>(null);
  const [openProvider, setOpenProvider] = useState<StorePaymentProvider | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

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
        const defaults = PROVIDER_ORDER.map(emptyView);
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

  // Échap ferme la popup ; on verrouille le défilement de l’arrière-plan.
  useEffect(() => {
    if (!openProvider) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenProvider(null);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [openProvider]);

  const update = (provider: StorePaymentProvider, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [provider]: { ...(prev[provider] || draftFromView(methods.find((m) => m.provider === provider) || emptyView(provider))), ...patch },
    }));
  };

  const openEditor = (provider: StorePaymentProvider) => {
    setModalError(null);
    setOpenProvider(provider);
  };

  const save = async () => {
    const provider = openProvider;
    if (!provider) return;
    const draft = drafts[provider];
    if (!draft) return;
    setSaving(provider);
    setModalError(null);
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
        setOpenProvider(null);
        await load();
      } else {
        setModalError(res.error || 'Enregistrement impossible.');
        if (notify) notify(res.error || 'Enregistrement impossible.', 'error');
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

  const enabledCount = methods.filter((m) => m.enabled).length;
  const activeMethod = openProvider ? methods.find((m) => m.provider === openProvider) || null : null;
  const activeDraft = openProvider ? drafts[openProvider] : undefined;
  const activeMeta = openProvider ? PROVIDER_META[openProvider] : null;
  const needsPublicKey = openProvider === 'kkiapay' || openProvider === 'fedapay';
  const isOnline = openProvider === 'kkiapay' || openProvider === 'fedapay' || openProvider === 'saspay';

  return (
    <div className="space-y-5 md:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 md:p-2.5 bg-brand rounded-xl md:rounded-2xl text-white shrink-0">
            <CreditCard size={16} className="md:size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs md:text-sm font-bold text-gray-900 uppercase tracking-widest leading-tight">
              Moyens de paiement
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 pl-11 sm:pl-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-[9px] md:text-[10px] font-bold text-brand uppercase tracking-wider">
            <ShieldCheck size={12} />
            Production uniquement
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gray-50 border border-gray-100 text-[9px] md:text-[10px] font-bold text-gray-600 uppercase tracking-wider">
            {enabledCount} actif{enabledCount > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Liste des moyens */}
      <div className="grid grid-cols-1 gap-2.5 md:gap-3">
        {methods.map((method) => {
          const meta = PROVIDER_META[method.provider];
          const isActive = method.enabled;
          const online = method.provider === 'kkiapay' || method.provider === 'fedapay' || method.provider === 'saspay';
          return (
            <button
              key={method.provider}
              type="button"
              onClick={() => openEditor(method.provider)}
              className={`group flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-2xl border text-left transition-all active:scale-[0.99] ${
                isActive
                  ? 'border-brand/30 bg-orange-50/40 hover:border-brand/50 hover:shadow-md hover:shadow-orange-50'
                  : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-white hover:shadow-md hover:shadow-gray-100'
              }`}
            >
              <div
                className={`w-11 h-11 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? 'bg-brand text-white shadow-lg shadow-orange-100'
                    : 'bg-white border border-gray-100 text-gray-400 group-hover:text-brand'
                }`}
              >
                {meta.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] md:text-[13px] font-bold text-gray-900 truncate">{method.label}</p>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-green-700 bg-green-100 border border-green-200 rounded-full px-1.5 py-0.5">
                      <CheckCircle2 size={9} /> Actif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-1.5 py-0.5">
                      Inactif
                    </span>
                  )}
                </div>
                <p className="text-[9px] md:text-[10px] text-gray-400 md:text-gray-500 font-medium leading-snug mt-1">
                  {meta.shortLabel}
                  {online && (method.hasSecret
                    ? <> · <span className="text-green-600">Clés{method.keyHint ? ` ${method.keyHint}` : ''}</span></>
                    : ' · Aucune clé')}
                  {!online && method.config.ussdCode ? ` · ${method.config.ussdCode}` : ''}
                </p>
              </div>
              <span className="flex items-center gap-1 text-[9px] md:text-[10px] font-bold text-gray-400 group-hover:text-brand uppercase tracking-wider shrink-0">
                <span className="hidden sm:inline">Configurer</span>
                <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </div>

      {/* Note de bas de page */}
      <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100/50 flex gap-3">
        <Info size={18} className="text-brand flex-shrink-0" />
        <p className="text-brand text-[10px] md:text-xs font-normal leading-relaxed">
          <strong>Conseil :</strong> activez au moins le paiement à la livraison.
        </p>
      </div>

      {/* Popup de configuration */}
      {openProvider && activeMethod && activeDraft && activeMeta && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setOpenProvider(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Configurer ${activeMethod.label}`}
        >
          <div
            className="bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh] border border-white/20 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300"
            onClick={(event) => event.stopPropagation()}
          >
            {/* En-tête de la popup */}
            <div className="p-4 md:p-6 border-b border-gray-100 flex items-center gap-3 bg-gray-50/60">
              <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 ${activeDraft.enabled ? 'bg-brand text-white' : 'bg-white border border-gray-100 text-gray-400'}`}>
                {activeMeta.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm md:text-base font-bold text-gray-900 truncate">{activeMethod.label}</h2>
              </div>
              <button
                onClick={() => setOpenProvider(null)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-white rounded-xl transition-all shrink-0"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corps */}
            <div className="p-4 md:p-6 space-y-4 md:space-y-5 overflow-y-auto custom-scrollbar">
              {/* Interrupteur Activer */}
              <label className="flex items-center justify-between gap-4 p-3 md:p-4 rounded-2xl border border-gray-100 bg-gray-50/60 cursor-pointer select-none">
                <div className="min-w-0">
                  <p className="text-[11px] md:text-xs font-bold text-gray-900">Activer ce moyen</p>
                </div>
                <span className="relative inline-flex items-center shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={activeDraft.enabled}
                    onChange={(e) => update(openProvider, { enabled: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-brand transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                </span>
              </label>

              {activeDraft.enabled && (
                <div className="grid grid-cols-1 gap-3 md:gap-4">
                  {needsPublicKey && (
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-1.5">Clé publique</label>
                      <input
                        className={inputCls}
                        value={activeDraft.publicKey}
                        onChange={(e) => update(openProvider, { publicKey: e.target.value })}
                        placeholder="pk_live_…"
                        autoComplete="off"
                      />
                    </div>
                  )}
                  {activeMeta.secretFields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-1.5">
                        {field.label}
                        {activeMethod.hasSecret && (
                          <span className="normal-case font-semibold text-green-600"> · enregistré{activeMethod.keyHint ? ` (${activeMethod.keyHint})` : ''}</span>
                        )}
                      </label>
                      <input
                        type="password"
                        className={inputCls}
                        value={activeDraft[field.key] || ''}
                        onChange={(e) => update(openProvider, { [field.key]: e.target.value } as Partial<Draft>)}
                        placeholder={activeMethod.hasSecret ? 'Laisser vide pour conserver' : field.placeholder}
                        autoComplete="off"
                      />
                    </div>
                  ))}
                  {isOnline && (
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-1.5">
                        Secret webhook <span className="normal-case font-semibold text-gray-400">(facultatif)</span>
                      </label>
                      <input
                        type="password"
                        className={inputCls}
                        value={activeDraft.webhookSecret}
                        onChange={(e) => update(openProvider, { webhookSecret: e.target.value })}
                        placeholder={activeMethod.hasSecret ? 'Laisser vide pour conserver' : 'wh_live_…'}
                        autoComplete="off"
                      />
                    </div>
                  )}
                  {openProvider === 'ussd' && (
                    <>
                      <div>
                        <label className="block text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-1.5">Code USSD à composer</label>
                        <input
                          className={inputCls}
                          value={activeDraft.ussdCode}
                          onChange={(e) => update(openProvider, { ussdCode: e.target.value })}
                          placeholder="Ex : *123*45#"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-1.5">Instructions (optionnel)</label>
                        <input
                          className={inputCls}
                          value={activeDraft.instructions}
                          onChange={(e) => update(openProvider, { instructions: e.target.value })}
                          placeholder="Ex : *123*45# puis suivez les instructions"
                        />
                      </div>
                    </>
                  )}
                  {openProvider === 'cod' && (
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-1.5">Instructions (optionnel)</label>
                      <input
                        className={inputCls}
                        value={activeDraft.instructions}
                        onChange={(e) => update(openProvider, { instructions: e.target.value })}
                        placeholder="Ex : Payez en espèces à la réception"
                      />
                    </div>
                  )}
                </div>
              )}

              {modalError && (
                <div className="flex items-start gap-2 p-3 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-[10px] md:text-xs font-semibold leading-snug">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {modalError}
                </div>
              )}
            </div>

            {/* Pied de la popup */}
            <div className="p-3 md:p-4 border-t border-gray-100 bg-white flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[8px] md:text-[9px] font-semibold text-gray-400 min-w-0">
                <KeyRound size={11} className="shrink-0 text-green-500" />
                <span className="truncate">Secrets chiffrés</span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenProvider(null)}
                  className="px-4 py-2.5 md:px-5 md:py-3 border border-gray-200 rounded-xl font-bold text-[10px] md:text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all active:scale-95"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving === openProvider}
                  className="flex items-center gap-1.5 px-4 py-2.5 md:px-5 md:py-3 bg-brand text-white rounded-xl text-[10px] md:text-xs font-bold shadow-lg shadow-orange-100 hover:bg-[#d55a20] disabled:opacity-50 transition-all active:scale-95"
                >
                  {saving === openProvider ? <Loader2 size={14} className="animate-spin spinner-always" /> : <Save size={14} />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StorePaymentsSettings;
