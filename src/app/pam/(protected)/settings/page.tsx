'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  RefreshCcw,
  CheckCircle2,
  CreditCard,
  Key,
  Globe,
  Lock
} from 'lucide-react';
import { getSystemSettings, updateSystemSettings } from '@/app/actions/admin';
import Loader from '@/components/Loader';

interface SystemSettings {
  maintenance: boolean;
  auto_indexing: boolean;
  weekly_reports: boolean;
  payment_provider?: 'kkiapay' | 'fedapay';
  kkiapay_public_key?: string;
  kkiapay_private_key?: string;
  kkiapay_secret_key?: string;
  kkiapay_env?: 'sandbox' | 'live';
  fedapay_public_key?: string;
  fedapay_secret_key?: string;
  fedapay_webhook_secret?: string;
  fedapay_env?: 'sandbox' | 'live';
}

const SETTINGS_DEFS: { key: keyof SystemSettings; title: string; description: string }[] = [
  { key: 'maintenance', title: 'Maintenance Civile', description: 'Suspend l\'activité publique globale' },
  { key: 'auto_indexing', title: 'Indexation Automatique', description: 'Optimisation continue du catalogue' },
  { key: 'weekly_reports', title: 'Rapports Hebdo', description: 'Envoi automatique aux commerçants' },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [initial, setInitial] = useState<SystemSettings | null>(null);

  const fetchData = async () => {
    const res = await getSystemSettings();
    if (res.success) {
      setSettings(res.settings);
      setInitial(res.settings);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    const res = await updateSystemSettings(settings);
    setSaving(false);
    if (res.success) {
      setSaved(true);
      setInitial(settings);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const dirty = settings && initial && (
    settings.maintenance !== initial.maintenance ||
    settings.auto_indexing !== initial.auto_indexing ||
    settings.weekly_reports !== initial.weekly_reports ||
    settings.payment_provider !== initial.payment_provider ||
    settings.kkiapay_public_key !== initial.kkiapay_public_key ||
    settings.kkiapay_private_key !== initial.kkiapay_private_key ||
    settings.kkiapay_secret_key !== initial.kkiapay_secret_key ||
    settings.kkiapay_env !== initial.kkiapay_env ||
    settings.fedapay_public_key !== initial.fedapay_public_key ||
    settings.fedapay_secret_key !== initial.fedapay_secret_key ||
    settings.fedapay_webhook_secret !== initial.fedapay_webhook_secret ||
    settings.fedapay_env !== initial.fedapay_env
  );

  if (loading || !settings) {
    return <div className="flex-1 flex items-center justify-center min-h-[60vh]"><Loader size="lg" /></div>;
  }

  const toggle = (key: keyof SystemSettings) => {
    setSettings(prev => prev ? { ...prev, [key]: !prev[key] } : prev);
  };

  const updateField = (key: keyof SystemSettings, value: string | boolean | 'kkiapay' | 'fedapay' | 'sandbox' | 'live') => {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter">Paramètres Système</h1>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Niveau d&apos;Administration : Suprême</p>
      </div>

      {/* Protocoles */}
      <div className="bg-white rounded-[32px] border border-gray-100 p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-[#f56b2a] shadow-inner border border-orange-100">
            <Shield size={28} />
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900">Protocoles Système</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Configurations persistées en base de données</p>
          </div>
        </div>

        <div className="space-y-3">
          {SETTINGS_DEFS.map((item) => (
            <div key={item.key} className="flex items-center justify-between p-5 rounded-2xl bg-gray-50 border border-gray-100 group cursor-pointer hover:bg-orange-50/20 transition-all">
              <div className="flex-1 mr-4">
                <p className="text-xs font-black text-gray-900 uppercase tracking-tight group-hover:text-[#f56b2a] transition-colors">{item.title}</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">{item.description}</p>
              </div>
              <button
                role="switch"
                aria-checked={!!settings[item.key]}
                onClick={() => toggle(item.key)}
                className={`w-12 h-7 rounded-full relative p-1 transition-all ${settings[item.key] ? 'bg-[#f56b2a] shadow-lg shadow-orange-100' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${settings[item.key] ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Paiements */}
      <div className="bg-white rounded-[32px] border border-gray-100 p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner border border-blue-100">
            <CreditCard size={28} />
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900">Passerelle de Paiement</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Configuration manuelle des clés et du fournisseur actif</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Provider selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => updateField('payment_provider', 'kkiapay')}
              className={`p-5 rounded-2xl border text-xs font-black uppercase tracking-tight transition-all text-left ${settings.payment_provider === 'kkiapay' ? 'bg-[#f56b2a]/10 border-[#f56b2a] text-[#f56b2a]' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={16} />
                Kkiapay
              </div>
              <span className="text-[10px] font-medium normal-case">Active</span>
            </button>
            <button
              type="button"
              onClick={() => updateField('payment_provider', 'fedapay')}
              className={`p-5 rounded-2xl border text-xs font-black uppercase tracking-tight transition-all text-left ${settings.payment_provider === 'fedapay' ? 'bg-blue-600/10 border-blue-600 text-blue-600' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={16} />
                FedaPay
              </div>
              <span className="text-[10px] font-medium normal-case">Active</span>
            </button>
          </div>

          {/* Kkiapay config */}
          <div className={`rounded-2xl border p-5 transition-colors ${settings.payment_provider === 'kkiapay' ? 'bg-orange-50/30 border-orange-200' : 'bg-gray-50/50 border-gray-100'}`}>
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-tight mb-4 flex items-center gap-2">Kkiapay</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Public Key</label>
                <input
                  type="text"
                  value={settings.kkiapay_public_key || ''}
                  onChange={e => updateField('kkiapay_public_key', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:border-[#f56b2a]"
                  placeholder="pk_..."
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Private Key</label>
                <input
                  type="text"
                  value={settings.kkiapay_private_key || ''}
                  onChange={e => updateField('kkiapay_private_key', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:border-[#f56b2a]"
                  placeholder="sk_..."
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Secret Key</label>
                <input
                  type="text"
                  value={settings.kkiapay_secret_key || ''}
                  onChange={e => updateField('kkiapay_secret_key', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:border-[#f56b2a]"
                  placeholder="secret_..."
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Environnement</label>
                <select
                  value={settings.kkiapay_env || 'sandbox'}
                  onChange={e => updateField('kkiapay_env', e.target.value as 'sandbox' | 'live')}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:border-[#f56b2a]"
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="live">Live</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fedapay config */}
          <div className={`rounded-2xl border p-5 transition-colors ${settings.payment_provider === 'fedapay' ? 'bg-blue-50/30 border-blue-200' : 'bg-gray-50/50 border-gray-100'}`}>
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-tight mb-4 flex items-center gap-2">FedaPay</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Public Key</label>
                <input
                  type="text"
                  value={settings.fedapay_public_key || ''}
                  onChange={e => updateField('fedapay_public_key', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="YOUR_PUBLIC_KEY"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Secret Key</label>
                <input
                  type="text"
                  value={settings.fedapay_secret_key || ''}
                  onChange={e => updateField('fedapay_secret_key', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="YOUR_SECRET_KEY"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Webhook Secret Key (wh_...)</label>
                <input
                  type="text"
                  value={settings.fedapay_webhook_secret || ''}
                  onChange={e => updateField('fedapay_webhook_secret', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                  placeholder="wh_live_... ou wh_sandbox_..."
                />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Environnement</label>
                  <select
                    value={settings.fedapay_env || 'sandbox'}
                    onChange={e => updateField('fedapay_env', e.target.value as 'sandbox' | 'live')}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="live">Live</option>
                  </select>
                </div>
                <div className="flex-1 bg-blue-50/40 rounded-xl p-3 border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tight mb-1">Endpoint API</p>
                  <p className="text-xs text-gray-600 font-mono">{settings.fedapay_env === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !dirty}
        className={`w-full max-w-md mx-auto block py-4 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 ${
          saved ? 'bg-emerald-500 shadow-lg shadow-emerald-100' : 'bg-[#f56b2a] hover:bg-[#d55a20] shadow-xl shadow-orange-100'
        }`}
      >
        {saving ? <RefreshCcw size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : null}
        {saving ? 'Synchronisation...' : saved ? 'Configurations enregistrées' : dirty ? 'Enregistrer les Protocoles' : 'Aucune modification'}
      </button>
    </div>
  );
}
