'use client';

import React, { useState } from 'react';
import { Store, ArrowRight, Loader2, Plus, LogOut } from 'lucide-react';
import { quickCreateStoreAction, clearStoreCookieAction } from '@/app/actions/store';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function NoStoreFound() {
  const [storeName, setStoreName] = useState('');
  const [businessType, setBusinessType] = useState<'shopping' | 'food' | 'stay'>('shopping');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim() || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const result = await quickCreateStoreAction(storeName.trim(), businessType);
      if (result.success) {
        // Success! Re-validate and reload
        window.location.href = '/dashboard';
      } else {
        setError(result.error || 'Une erreur est survenue');
      }
    } catch (err) {
      setError('Erreur de connexion serveur');
    } finally {
      setIsCreating(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    await clearStoreCookieAction();
    router.push('/login');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 bg-slate-50 text-center min-h-screen">
      <div className="bg-white p-8 md:p-12 rounded-[40px] shadow-2xl max-w-lg w-full border border-slate-100 relative overflow-hidden animate-in fade-in zoom-in duration-500">
        {/* Top Accent */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#f56b2a] via-orange-400 to-[#f56b2a]"></div>
        
        {/* Floating Icon Container */}
        <div className="relative mb-10">
          <div className="w-24 h-24 bg-orange-50 text-[#f56b2a] rounded-[32px] flex items-center justify-center mx-auto shadow-inner transform -rotate-12 transition-transform hover:rotate-0 duration-300">
            <Store size={44} strokeWidth={2.5} />
          </div>
          <div className="absolute -right-2 top-0 w-10 h-10 bg-[#f56b2a] text-white rounded-2xl flex items-center justify-center shadow-lg animate-bounce duration-[2000ms]">
            <Plus size={20} strokeWidth={3} />
          </div>
        </div>
        
        <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">Bienvenue sur votre PDV !</h2>
        <p className="text-slate-500 mb-10 font-medium leading-relaxed max-w-sm mx-auto">
          Pour commencer, donnez un nom à votre première boutique. C'est l'endroit où vous gérerez vos ventes et stocks.
        </p>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="relative group">
            <input
              type="text"
              name="storeName"
              placeholder="Nom de votre boutique (ex: Ma Boutique Pro)"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-[22px] px-6 py-5 text-lg font-bold text-slate-800 focus:outline-none focus:border-[#f56b2a] focus:bg-white transition-all shadow-inner group-hover:border-orange-200"
              autoFocus
              required
              disabled={isCreating}
            />
          </div>

          <div className="space-y-3">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left ml-2">Modèle de boutique</p>
             <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'shopping', label: 'AMAZON', desc: 'Shopping & E-commerce', color: 'orange' },
                  { id: 'food', label: 'UBEREATS', desc: 'Cuisine & Restauration', color: 'yellow' },
                  { id: 'stay', label: 'AIRBNB', desc: 'Séjours & Logements', color: 'blue' }
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setBusinessType(type.id as any)}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${businessType === type.id ? 'border-[#f56b2a] bg-orange-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                  >
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-900 leading-none mb-1">{type.label}</p>
                      <p className="text-[9px] font-bold text-slate-400 leading-none">{type.desc}</p>
                    </div>
                    {businessType === type.id && <div className="w-2 h-2 rounded-full bg-[#f56b2a]" />}
                  </button>
                ))}
             </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm font-bold p-4 rounded-2xl border border-red-100">
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={isCreating || !storeName.trim()}
            className="w-full bg-[#f56b2a] hover:bg-[#d55a20] disabled:bg-orange-200 text-white font-black py-5 px-8 rounded-[24px] transition-all shadow-xl shadow-orange-100 active:scale-[0.98] flex items-center justify-center gap-3 text-lg group"
          >
            {isCreating ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                <span>Création en cours...</span>
              </>
            ) : (
              <>
                <span>Créer ma boutique</span>
                <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
        
        <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-left">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Passer à plus tard ?</p>
              <button 
                onClick={handleLogout}
                className="text-xs text-slate-500 hover:text-red-500 font-bold flex items-center gap-1.5 transition-colors"
                type="button"
              >
                <LogOut size={14} /> Se déconnecter
              </button>
            </div>
            
            <p className="text-[10px] text-slate-300 font-bold max-w-[150px] text-center md:text-right">
              Configuration rapide en moins de 30 secondes.
            </p>
        </div>
      </div>
    </div>
  );
}
