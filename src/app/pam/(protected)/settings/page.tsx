'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  RefreshCcw,
  CheckCircle2,
  CreditCard,
  Lock,
  Mail,
  Send,
  ClipboardList
} from 'lucide-react';
import { getSystemSettings, updateSystemSettings, getEmailTestEventsAction, sendTestEmailAction, sendAllTestEmailsAction } from '@/app/actions/admin';
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
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from?: string;
  smtp_from_name?: string;
  mail_reply_to?: string;
  mail_brand_name?: string;
  mail_tagline?: string;
  mail_logo_url?: string;
  mail_footer?: string;
  admin_emails?: string;
  smtp_pass_set?: boolean;
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

  const [testEvents, setTestEvents] = useState<{ key: string; label: string; audience: string }[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [allResult, setAllResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await getSystemSettings();
      if (mounted && res.success) {
        setSettings(res.settings);
        setInitial(res.settings);
        setTestEmail(res.settings.admin_emails?.split(',')[0]?.trim() || res.settings.smtp_user || '');
      }
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const events = await getEmailTestEventsAction();
      if (mounted && events.length) {
        setTestEvents(events);
        setSelectedEvent(events[0].key);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSendTest = async () => {
    if (!selectedEvent) return;
    setSendingTest(true);
    setTestResult(null);
    const res = await sendTestEmailAction(selectedEvent, testEmail);
    setSendingTest(false);
    if (res.success) {
      setTestResult({ ok: true, message: `Envoyé avec succès${res.messageId ? ` (${res.messageId.replace(/@.+/, '')})` : ''}` });
    } else {
      const msg = res.error === 'Unauthorized' ? 'Session expirée' : res.error || 'Échec de l\'envoi';
      setTestResult({ ok: false, message: msg });
    }
  };

  const handleSendAll = async () => {
    setSendingAll(true);
    setAllResult(null);
    const res = await sendAllTestEmailsAction(testEmail);
    setSendingAll(false);
    if (res.error) {
      const msg = res.error === 'Unauthorized' ? 'Session expirée' : res.error;
      setAllResult({ ok: false, message: msg });
    } else {
      setAllResult({ ok: res.success, message: `${res.sent}/${res.sent + res.failures.length} emails envoyés${res.failures.length ? ` — échecs : ${res.failures.map(f => f.key).join(', ')}` : ''}` });
    }
  };

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
    settings.fedapay_env !== initial.fedapay_env ||
    settings.smtp_host !== initial.smtp_host ||
    settings.smtp_port !== initial.smtp_port ||
    settings.smtp_user !== initial.smtp_user ||
    settings.smtp_from !== initial.smtp_from ||
    settings.smtp_from_name !== initial.smtp_from_name ||
    settings.mail_reply_to !== initial.mail_reply_to ||
    settings.mail_brand_name !== initial.mail_brand_name ||
    settings.mail_tagline !== initial.mail_tagline ||
    settings.mail_logo_url !== initial.mail_logo_url ||
    settings.mail_footer !== initial.mail_footer ||
    settings.admin_emails !== initial.admin_emails ||
    (settings.smtp_pass || '') !== ''
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
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 uppercase tracking-tighter">Paramètres Système</h1>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mt-1">Niveau d&apos;Administration : Suprême</p>
      </div>

      {/* Protocoles */}
      <div className="bg-white rounded-[32px] border border-gray-100 p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-[#f56b2a] shadow-inner border border-orange-100">
            <Shield size={28} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Protocoles Système</h3>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mt-0.5">Configurations persistées en base de données</p>
          </div>
        </div>

        <div className="space-y-3">
          {SETTINGS_DEFS.map((item) => (
            <div key={item.key} className="flex items-center justify-between p-5 rounded-2xl bg-gray-50 border border-gray-100 group cursor-pointer hover:bg-orange-50/20 transition-all">
              <div className="flex-1 mr-4">
                <p className="text-xs font-bold text-gray-900 uppercase tracking-tight group-hover:text-[#f56b2a] transition-colors">{item.title}</p>
                <p className="text-[10px] text-gray-400 font-normal mt-0.5">{item.description}</p>
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
            <h3 className="text-lg font-bold text-gray-900">Passerelle de Paiement</h3>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mt-0.5">Configuration manuelle des clés et du fournisseur actif</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Provider selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => updateField('payment_provider', 'kkiapay')}
              className={`p-5 rounded-2xl border text-xs font-bold uppercase tracking-tight transition-all text-left ${settings.payment_provider === 'kkiapay' ? 'bg-[#f56b2a]/10 border-[#f56b2a] text-[#f56b2a]' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={16} />
                Kkiapay
              </div>
              <span className="text-[10px] font-normal normal-case">Active</span>
            </button>
            <button
              type="button"
              onClick={() => updateField('payment_provider', 'fedapay')}
              className={`p-5 rounded-2xl border text-xs font-bold uppercase tracking-tight transition-all text-left ${settings.payment_provider === 'fedapay' ? 'bg-blue-600/10 border-blue-600 text-blue-600' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={16} />
                FedaPay
              </div>
              <span className="text-[10px] font-normal normal-case">Active</span>
            </button>
          </div>

          {/* Kkiapay config */}
          <div className={`rounded-2xl border p-5 transition-colors ${settings.payment_provider === 'kkiapay' ? 'bg-orange-50/30 border-orange-200' : 'bg-gray-50/50 border-gray-100'}`}>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-tight mb-4 flex items-center gap-2">Kkiapay</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Public Key</label>
                <input
                  type="text"
                  value={settings.kkiapay_public_key || ''}
                  onChange={e => updateField('kkiapay_public_key', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:border-[#f56b2a]"
                  placeholder="pk_..."
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Private Key</label>
                <input
                  type="text"
                  value={settings.kkiapay_private_key || ''}
                  onChange={e => updateField('kkiapay_private_key', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:border-[#f56b2a]"
                  placeholder="sk_..."
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Secret Key</label>
                <input
                  type="text"
                  value={settings.kkiapay_secret_key || ''}
                  onChange={e => updateField('kkiapay_secret_key', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:border-[#f56b2a]"
                  placeholder="secret_..."
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Environnement</label>
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
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-tight mb-4 flex items-center gap-2">FedaPay</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Public Key</label>
                <input
                  type="text"
                  value={settings.fedapay_public_key || ''}
                  onChange={e => updateField('fedapay_public_key', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="YOUR_PUBLIC_KEY"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Secret Key</label>
                <input
                  type="text"
                  value={settings.fedapay_secret_key || ''}
                  onChange={e => updateField('fedapay_secret_key', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="YOUR_SECRET_KEY"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Webhook Secret Key (wh_...)</label>
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
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Environnement</label>
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
                  <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-tight mb-1">Endpoint API</p>
                  <p className="text-xs text-gray-600 font-mono">{settings.fedapay_env === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email / SMTP (Gmail) */}
      <div className="bg-white rounded-[32px] border border-gray-100 p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner border border-emerald-100">
            <Mail size={28} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Notifications Email (SMTP)</h3>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mt-0.5">Serveur SMTP — Gmail recommandé (mot de passe d&apos;application)</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Serveur SMTP</label>
            <input
              type="text"
              value={settings.smtp_host || 'smtp.gmail.com'}
              onChange={e => updateField('smtp_host', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="smtp.gmail.com"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Port</label>
            <input
              type="text"
              value={settings.smtp_port || '465'}
              onChange={e => updateField('smtp_port', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="465"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Utilisateur (adresse Gmail)</label>
            <input
              type="text"
              value={settings.smtp_user || ''}
              onChange={e => updateField('smtp_user', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="votre@gmail.com"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Mot de passe d&apos;application</label>
            <input
              type="password"
              value={settings.smtp_pass || ''}
              onChange={e => updateField('smtp_pass', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
              placeholder={settings.smtp_pass_set ? '•••••••• (déjà configuré — laisser vide pour conserver)' : 'Mot de passe d\'application'}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Emails admins (séparés par des virgules)</label>
            <input
              type="text"
              value={settings.admin_emails || ''}
              onChange={e => updateField('admin_emails', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="admin@posmarket.app, support@posmarket.app"
            />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-6 mb-6">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Identité de l&apos;expéditeur &amp; marque</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Nom de l&apos;expéditeur</label>
              <input
                type="text"
                value={settings.smtp_from_name || ''}
                onChange={e => updateField('smtp_from_name', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="PosMarket"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Adresse d&apos;expéditeur (from)</label>
              <input
                type="text"
                value={settings.smtp_from || ''}
                onChange={e => updateField('smtp_from', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="andyizyfleur@gmail.com"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Adresse de réponse (Reply-To)</label>
              <input
                type="text"
                value={settings.mail_reply_to || ''}
                onChange={e => updateField('mail_reply_to', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="support@posmarket.app"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Nom de la marque (entête des emails)</label>
              <input
                type="text"
                value={settings.mail_brand_name || ''}
                onChange={e => updateField('mail_brand_name', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="PosMarket"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Slogan (sous le logo)</label>
              <input
                type="text"
                value={settings.mail_tagline || ''}
                onChange={e => updateField('mail_tagline', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="Votre marketplace de proximité"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">URL du logo (remplace le texte de la marque)</label>
              <input
                type="text"
                value={settings.mail_logo_url || ''}
                onChange={e => updateField('mail_logo_url', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="https://posmarket-eight.vercel.app/logo.png"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Pied de page (mentions légales / adresse)</label>
              <textarea
                value={settings.mail_footer || ''}
                onChange={e => updateField('mail_footer', e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                placeholder={`© ${new Date().getFullYear()} PosMarket — Bénin / Côte d'Ivoire`}
              />
            </div>
          </div>
        </div>

        <div className="bg-emerald-50/40 rounded-xl p-4 border border-emerald-100 flex items-start gap-3">
          <Lock size={16} className="text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-emerald-700 font-semibold leading-relaxed">
            Pour Gmail : activez la validation en deux étapes puis créez un « mot de passe d&apos;application »
            (myaccount.google.com &gt; Sécurité). Il est stocké chiffré en base et jamais réaffiché dans cette page.
          </p>
        </div>
      </div>

      {/* Test des emails */}
      <div className="bg-white rounded-[32px] border border-gray-100 p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600 shadow-inner border border-violet-100">
            <Send size={28} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Test des emails</h3>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mt-0.5">Envoi d&apos;un échantillon de chaque notification</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Adresse de réception</label>
            <input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              placeholder="vous@exemple.com"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Cas d&apos;action</label>
            <select
              value={selectedEvent}
              onChange={e => setSelectedEvent(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            >
              {testEvents.reduce((groups: Array<{ audience: string; items: typeof testEvents }>, ev) => {
                const g = groups.find(x => x.audience === ev.audience);
                if (g) g.items.push(ev);
                else groups.push({ audience: ev.audience, items: [ev] });
                return groups;
              }, []).map(group => (
                <optgroup key={group.audience} label={group.audience}>
                  {group.items.map(ev => (
                    <option key={ev.key} value={ev.key}>{ev.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <button
            onClick={handleSendTest}
            disabled={sendingTest || !selectedEvent || !testEmail}
            className="flex-1 py-3.5 text-white font-bold text-[10px] uppercase tracking-[0.18em] rounded-2xl transition-all bg-[#f56b2a] hover:bg-[#d55a20] shadow-xl shadow-orange-100 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sendingTest ? <RefreshCcw size={15} className="animate-spin" /> : <Send size={15} />}
            {sendingTest ? 'Envoi en cours...' : 'Envoyer ce test'}
          </button>
          <button
            onClick={handleSendAll}
            disabled={sendingAll || !testEmail}
            className="flex-1 py-3.5 text-white font-bold text-[10px] uppercase tracking-[0.18em] rounded-2xl transition-all bg-violet-600 hover:bg-violet-500 shadow-xl shadow-violet-100 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sendingAll ? <RefreshCcw size={15} className="animate-spin" /> : <ClipboardList size={15} />}
            {sendingAll ? 'Envoi en cours...' : `Tout envoyer (${testEvents.length})`}
          </button>
        </div>

        {testResult && (
          <div className={`rounded-xl p-4 border flex items-start gap-3 mb-3 ${testResult.ok ? 'bg-emerald-50/40 border-emerald-100' : 'bg-red-50/40 border-red-100'}`}>
            <CheckCircle2 size={16} className={`${testResult.ok ? 'text-emerald-500' : 'text-red-500'} shrink-0 mt-0.5`} />
            <p className={`text-[11px] font-semibold leading-relaxed ${testResult.ok ? 'text-emerald-700' : 'text-red-700'}`}>{testResult.message}</p>
          </div>
        )}
        {allResult && (
          <div className={`rounded-xl p-4 border flex items-start gap-3 ${allResult.ok ? 'bg-emerald-50/40 border-emerald-100' : 'bg-red-50/40 border-red-100'}`}>
            <ClipboardList size={16} className={`${allResult.ok ? 'text-emerald-500' : 'text-red-500'} shrink-0 mt-0.5`} />
            <p className={`text-[11px] font-semibold leading-relaxed ${allResult.ok ? 'text-emerald-700' : 'text-red-700'}`}>{allResult.message}</p>
          </div>
        )}

        <div className="bg-violet-50/40 rounded-xl p-4 border border-violet-100 flex items-start gap-3">
          <Lock size={16} className="text-violet-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-violet-700 font-semibold leading-relaxed">
            Chaque email de test est préfixé « [TEST] ». L&apos;envoi utilise la configuration SMTP ci-dessus et ne cible que l&apos;adresse saisie.
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !dirty}
        className={`w-full max-w-md mx-auto block py-4 text-white font-bold text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 ${
          saved ? 'bg-emerald-500 shadow-lg shadow-emerald-100' : 'bg-[#f56b2a] hover:bg-[#d55a20] shadow-xl shadow-orange-100'
        }`}
      >
        {saving ? <RefreshCcw size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : null}
        {saving ? 'Synchronisation...' : saved ? 'Configurations enregistrées' : dirty ? 'Enregistrer les Protocoles' : 'Aucune modification'}
      </button>
    </div>
  );
}