'use client';

import React, { useState } from 'react';
import {
  Store,
  ArrowRight,
  Loader2,
  ShoppingBag,
  UtensilsCrossed,
  Check,
  CircleAlert,
} from 'lucide-react';
import { quickCreateStoreAction } from '@/app/actions/store';

const TEMPLATES = [
  {
    id: 'shopping' as const,
    label: 'SHOP',
    desc: 'Shopping & E-commerce',
    icon: ShoppingBag,
    chips: ['Stocks', 'Livraison'],
  },
  {
    id: 'food' as const,
    label: 'RESTO',
    desc: 'Cuisine & Restauration',
    icon: UtensilsCrossed,
    chips: ['Menu', 'Préparation'],
  },
];

export default function NoStoreFound() {
  const [storeName, setStoreName] = useState('');
  const [businessType, setBusinessType] = useState<'shopping' | 'food'>('shopping');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch {
      setError('Erreur de connexion serveur');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#f7f8fa] overflow-hidden">
      {/* Décor : halo marque en haut à droite, encre en bas à gauche, grille fine */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-48 -right-40 h-[460px] w-[460px] rounded-full blur-[80px]"
          style={{ background: 'radial-gradient(circle, rgba(245,107,42,.22), transparent 65%)' }}
        />
        <div
          className="absolute -bottom-52 -left-40 h-[420px] w-[420px] rounded-full blur-[80px]"
          style={{ background: 'radial-gradient(circle, rgba(0,47,52,.12), transparent 65%)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(16,24,40,.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,24,40,.05) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 78%)',
          }}
        />
      </div>

      <div className="relative w-full max-w-[560px] animate-in fade-in slide-in-from-bottom-5 duration-500">
        {/* Carte principale */}
        <div
          className="bg-white border border-line rounded-[28px] p-5 sm:p-8"
          style={{ boxShadow: '0 1px 2px rgba(16,24,40,.04), 0 28px 56px -28px rgba(16,24,40,.22)' }}
        >
          {/* Marque */}
          <div className="flex items-center gap-2.5 mb-6">
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg, #f56b2a, #e55a1b)' }}
            >
              <Store size={17} strokeWidth={2.5} />
            </span>
            <span className="text-[13px] font-semibold tracking-[-0.01em] text-ink">PosMarket</span>
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Étape 1 / 1
            </span>
          </div>

          <h1 className="text-[24px] sm:text-[28px] leading-[1.12] font-semibold tracking-[-0.03em] text-ink">
            Bienvenue sur votre PDV !
          </h1>
          <p className="mt-2.5 text-[14px] leading-relaxed text-slate-500 max-w-[440px]">
            Pour commencer, donnez un nom à votre première boutique. C&apos;est l&apos;endroit où vous
            gérerez vos ventes et stocks.
          </p>

          <form onSubmit={handleCreate} className="mt-6 space-y-5">
            {/* Nom */}
            <div>
              <label
                htmlFor="storeName"
                className="block text-[12.5px] font-semibold text-ink mb-2"
              >
                Nom de votre boutique
              </label>
              <div className="relative">
                <Store
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  id="storeName"
                  type="text"
                  name="storeName"
                  placeholder="ex: Ma Boutique Pro"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full rounded-2xl border border-line bg-white pl-11 pr-4 py-4 text-[15px] font-medium text-ink placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all"
                  autoFocus
                  required
                  disabled={isCreating}
                />
              </div>
            </div>

            {/* Modèle */}
            <div>
              <p className="text-[12.5px] font-semibold text-ink mb-2">Modèle de boutique</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Modèle de boutique">
                {TEMPLATES.map((type) => {
                  const Icon = type.icon;
                  const selected = businessType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setBusinessType(type.id)}
                      disabled={isCreating}
                      className={`group relative flex items-start gap-3 p-4 rounded-2xl border text-left transition-all focus:outline-none focus:ring-4 focus:ring-brand/10 ${
                        selected
                          ? 'border-brand bg-brand-soft/60'
                          : 'border-line bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <span
                        className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
                          selected ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                        }`}
                      >
                        <Icon size={18} strokeWidth={2.2} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[12.5px] font-bold tracking-[0.08em] text-ink">
                            {type.label}
                          </span>
                          {selected && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand/12 px-1.5 py-0.5 text-[9.5px] font-bold text-brand">
                              <Check size={9} strokeWidth={3.5} /> CHOISI
                            </span>
                          )}
                        </span>
                        <span className="block text-[11.5px] font-medium text-slate-500 mt-0.5">
                          {type.desc}
                        </span>
                        <span className="flex flex-wrap gap-1.5 mt-2">
                          {type.chips.map((chip) => (
                            <span
                              key={chip}
                              className="text-[10px] font-semibold text-slate-500 bg-white border border-line rounded-md px-1.5 py-0.5"
                            >
                              {chip}
                            </span>
                          ))}
                        </span>
                      </span>

                      <span
                        className={`mt-0.5 w-[18px] h-[18px] shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                          selected ? 'border-brand bg-brand' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {selected && <Check size={11} strokeWidth={3.5} className="text-white" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 text-red-600 text-[13.5px] font-medium p-4 rounded-2xl border border-red-100">
                <CircleAlert size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isCreating || !storeName.trim()}
              className={`group w-full rounded-full py-4 px-6 text-[15px] font-semibold text-white transition-all flex items-center justify-center gap-2.5 active:scale-[0.985] disabled:cursor-not-allowed ${
                isCreating || !storeName.trim()
                  ? 'bg-[#f7c9b0]'
                  : 'bg-brand hover:bg-brand-hover shadow-[0_14px_28px_-14px_rgba(245,107,42,.7)] hover:shadow-[0_18px_32px_-14px_rgba(245,107,42,.8)]'
              }`}
            >
              {isCreating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Création en cours...</span>
                </>
              ) : (
                <>
                  <span>Créer ma boutique</span>
                  <ArrowRight
                    size={17}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
