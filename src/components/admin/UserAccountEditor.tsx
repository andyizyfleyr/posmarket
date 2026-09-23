'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Pencil, Loader2, Building2, Hash, IdCard, ShieldCheck } from 'lucide-react';
import { updateSellerAccountAction } from '@/app/actions/admin';

type UserAccountEditorProps = {
  userId: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  companyName: string | null;
  ninea: string | null;
  accountType: string | null;
  isSuperAdmin: boolean;
};

export default function UserAccountEditor(user: UserAccountEditorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: user.fullName || '',
    email: user.email || '',
    phone: user.phone || '',
    companyName: user.companyName || '',
    ninea: user.ninea || '',
    accountType: user.accountType === 'seller' ? 'seller' : 'buyer',
    isSuperAdmin: user.isSuperAdmin,
  });

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await updateSellerAccountAction(user.userId, {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        companyName: form.companyName,
        ninea: form.ninea,
        accountType: form.accountType,
        isSuperAdmin: form.isSuperAdmin,
      });
      if (!result.success) {
        setError(result.error || 'Erreur lors de la mise à jour.');
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError('Erreur lors de la mise à jour du compte.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setForm({
          fullName: user.fullName || '',
          email: user.email || '',
          phone: user.phone || '',
          companyName: user.companyName || '',
          ninea: user.ninea || '',
          accountType: user.accountType === 'seller' ? 'seller' : 'buyer',
          isSuperAdmin: user.isSuperAdmin,
        }); setError(null); setOpen(true); }}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#f56b2a] hover:bg-[#d55a20] text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-orange-100"
      >
        <Pencil size={14} /> Modifier le compte
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">Modifier le compte</h3>
                <p className="text-[11px] text-gray-400 font-semibold mt-0.5">{user.email}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-50 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Nom complet</label>
                <input
                  value={form.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-[#f56b2a]/10 focus:bg-white outline-none transition-all shadow-inner"
                  placeholder="Nom du commerçant"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Email</label>
                <input
                  required type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-[#f56b2a]/10 focus:bg-white outline-none transition-all shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Téléphone</label>
                <input
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-[#f56b2a]/10 focus:bg-white outline-none transition-all shadow-inner"
                  placeholder="+225 07 00 00 00 00"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Entreprise</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                    <input
                      value={form.companyName}
                      onChange={(e) => set('companyName', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-[#f56b2a]/10 focus:bg-white outline-none transition-all shadow-inner"
                      placeholder="Nom de la société"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">NINEA</label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                    <input
                      value={form.ninea}
                      onChange={(e) => set('ninea', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-[#f56b2a]/10 focus:bg-white outline-none transition-all shadow-inner"
                      placeholder="NINEA"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Type de compte</label>
                  <select
                    value={form.accountType}
                    onChange={(e) => set('accountType', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-[#f56b2a]/10 focus:bg-white outline-none appearance-none cursor-pointer transition-all shadow-inner"
                  >
                    <option value="buyer">Acheteur</option>
                    <option value="seller">Vendeur</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Super admin</label>
                  <button
                    type="button"
                    onClick={() => set('isSuperAdmin', !form.isSuperAdmin)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-sm font-bold transition-all ${
                      form.isSuperAdmin
                        ? 'bg-orange-50 border-orange-200 text-[#f56b2a]'
                        : 'bg-gray-50 border-gray-100 text-gray-400'
                    }`}
                  >
                    <span className="flex items-center gap-2"><ShieldCheck size={16} /> {form.isSuperAdmin ? 'Activé' : 'Désactivé'}</span>
                    <span className={`w-9 h-5 rounded-full transition-colors ${form.isSuperAdmin ? 'bg-[#f56b2a]' : 'bg-gray-300'}`} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-3.5 border-2 border-gray-100 rounded-2xl font-bold text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all active:scale-95"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white bg-[#f56b2a] hover:bg-[#d55a20] transition-all active:scale-95 shadow-lg shadow-orange-100 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <IdCard size={16} />}
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}