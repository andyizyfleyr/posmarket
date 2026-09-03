'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShieldCheck, ArrowLeft } from 'lucide-react';
import { adminLogin } from '@/app/actions/admin-auth';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await adminLogin(username, password);
    if (res.success) {
      router.push('/pam');
      router.refresh();
    } else {
      setError(res.error || 'Erreur de connexion');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c1222] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(245,107,42,0.12)_1px,transparent_0)] [background-size:28px_28px]" />
      <div className="absolute top-24 right-20 w-72 h-72 bg-[#f56b2a]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-24 left-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md">
        <a href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#f56b2a] transition-colors mb-6">
          <ArrowLeft size={16} />
          Retour au site
        </a>

        <div className="bg-[#141b2e]/90 backdrop-blur rounded-3xl border border-white/10 p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f56b2a] to-orange-600 flex items-center justify-center mb-4 shadow-lg shadow-[#f56b2a]/30">
              <ShieldCheck size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">Portail Administrateur</h1>
            <p className="text-sm text-gray-400 mt-1">Espace réservé — accès restreint</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-widest mb-2">
                Identifiant
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nom d'utilisateur ou email"
                  required
                  autoComplete="username"
                  className="w-full rounded-xl bg-[#0c1222] border border-white/10 py-3 pl-11 pr-4 text-white text-sm placeholder-gray-500 outline-none focus:border-[#f56b2a] focus:ring-1 focus:ring-[#f56b2a]/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-widest mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl bg-[#0c1222] border border-white/10 py-3 pl-11 pr-4 text-white text-sm placeholder-gray-500 outline-none focus:border-[#f56b2a] focus:ring-1 focus:ring-[#f56b2a]/50 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-[#f56b2a] to-orange-600 py-3 text-white font-black text-sm tracking-wide shadow-lg shadow-[#f56b2a]/25 hover:shadow-[#f56b2a]/40 hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          ⚠️ Accès strictement réservé à l&apos;administration. Toute tentative non autorisée est journalisée.
        </p>
      </div>
    </div>
  );
}
