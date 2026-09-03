'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  RefreshCcw,
  CheckCircle2
} from 'lucide-react';
import { getSystemSettings, updateSystemSettings } from '@/app/actions/admin';
import Loader from '@/components/Loader';

interface SystemSettings {
  maintenance: boolean;
  auto_indexing: boolean;
  weekly_reports: boolean;
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
    settings.weekly_reports !== initial.weekly_reports
  );

  if (loading || !settings) {
    return <div className="flex-1 flex items-center justify-center min-h-[60vh]"><Loader size="lg" /></div>;
  }

  const toggle = (key: keyof SystemSettings) => {
    setSettings(prev => prev ? { ...prev, [key]: !prev[key] } : prev);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter">Paramètres Système</h1>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Niveau d&apos;Administration : Suprême</p>
      </div>

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
                aria-checked={settings[item.key]}
                onClick={() => toggle(item.key)}
                className={`w-12 h-7 rounded-full relative p-1 transition-all ${settings[item.key] ? 'bg-[#f56b2a] shadow-lg shadow-orange-100' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${settings[item.key] ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className={`w-full mt-8 py-4 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 ${
            saved ? 'bg-emerald-500 shadow-lg shadow-emerald-100' : 'bg-[#f56b2a] hover:bg-[#d55a20] shadow-xl shadow-orange-100'
          }`}
        >
          {saving ? <RefreshCcw size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : null}
          {saving ? 'Synchronisation...' : saved ? 'Configurations enregistrées' : dirty ? 'Enregistrer les Protocoles' : 'Aucune modification'}
        </button>
      </div>
    </div>
  );
}
