'use client';

import React, { useState } from 'react';
import { CheckCircle2, Circle, ChevronUp, ChevronDown, ListTodo, Store, Plus, CreditCard, ShoppingCart, X } from 'lucide-react';
import { useOnboarding } from './OnboardingContext';

export const StartupChecklist: React.FC = () => {
  const { checklist, startTour, isTourActive } = useOnboarding();
  const [isOpen, setIsOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  const handleHide = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsHidden(true);
  };

  const items = [
    { 
      key: 'storeCreated', 
      label: 'Créer votre boutique', 
      done: checklist.storeCreated, 
      icon: <Store size={18} />,
      hint: 'Configurez les détails de votre point de vente.' 
    },
    { 
      key: 'productAdded', 
      label: 'Ajouter votre premier produit', 
      done: checklist.productAdded, 
      icon: <Plus size={18} />,
      hint: 'Remplissez votre inventaire pour commencer à vendre.' 
    },
    { 
      key: 'settingsConfigured', 
      label: 'Paramétrer vos factures', 
      done: checklist.settingsConfigured, 
      icon: <CreditCard size={18} />,
      hint: 'Ajoutez votre NINEA et votre adresse.' 
    },
    { 
      key: 'firstSale', 
      label: 'Réaliser votre première vente', 
      done: checklist.firstSale, 
      icon: <ShoppingCart size={18} />,
      hint: 'Utilisez le POS pour encaisser un client.' 
    },
  ];

  const completedCount = items.filter(i => i.done).length;
  const progress = (completedCount / items.length) * 100;

  if (isTourActive || isHidden) return null;
  if (completedCount === items.length && !isOpen) return null;

  return (
    <div className={`fixed bottom-20 right-2 md:right-6 z-[100] transition-all duration-500 ease-in-out ${isOpen ? 'w-[280px] md:w-[320px]' : 'w-[160px] md:w-[180px]'}`}>
      <div className="bg-white/95 backdrop-blur-sm rounded-[24px] shadow-2xl border border-gray-100/50 overflow-hidden relative group">
        {/* Quick Hide Button (X) */}
        {!isOpen && (
          <button 
            onClick={handleHide}
            className="absolute -top-1 -right-1 w-5 h-5 bg-slate-800 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <X size={10} />
          </button>
        )}

        {/* Header/Toggle */}
        <div className="flex items-center bg-slate-900 text-white">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="flex-grow flex items-center gap-3 p-3.5 hover:bg-slate-800 transition-colors"
          >
            <div className={`p-1.5 rounded-lg ${completedCount === items.length ? 'bg-green-500' : 'bg-[#f56b2a]'}`}>
              <ListTodo size={14} />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#f56b2a]">Checklist</p>
              <p className="text-[11px] font-bold leading-none mt-0.5">{completedCount}/{items.length} Terminés</p>
            </div>
            <div className="ml-auto">
              {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </div>
          </button>
          
          {isOpen && (
            <button 
              onClick={handleHide}
              className="p-3.5 hover:bg-red-500 transition-colors border-l border-slate-800"
              title="Masquer définitivement"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gray-100 w-full">
          <div 
            className="h-full bg-[#f56b2a] transition-all duration-1000" 
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Items List */}
        {isOpen && (
          <div className="p-4 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.key} className="flex gap-3 group">
                  <div className={`mt-0.5 flex-shrink-0 ${item.done ? 'text-green-500' : 'text-gray-300'}`}>
                    {item.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold ${item.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {item.label}
                    </h4>
                    {!item.done && (
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{item.hint}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-50">
              <button 
                onClick={() => { startTour(); setIsOpen(false); }}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-[10px] font-black uppercase tracking-widest hover:border-[#f56b2a] hover:text-[#f56b2a] hover:bg-orange-50 transition-all"
              >
                Relancer la visite guidée
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

