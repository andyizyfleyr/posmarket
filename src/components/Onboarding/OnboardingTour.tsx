'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useOnboarding } from './OnboardingContext';
import { ChevronRight, ChevronLeft, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { useRouter } from '@/components/RouterPolyfill';

interface TourStep {
  targetId: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  route?: string;
}

const steps: TourStep[] = [
  {
    targetId: 'center',
    title: 'Bienvenue sur POS Pro !',
    content: 'Prêt à propulser votre activité ? Laissez-nous vous faire découvrir les outils essentiels pour gérer votre boutique.',
    position: 'center',
    route: '/dashboard'
  },
  {
    targetId: 'tour-sidebar-dashboard',
    title: 'Tableau de Bord',
    content: 'Suivez vos performances en temps réel : chiffre d\'affaires, paniers moyens et croissance.',
    position: 'right',
    route: '/dashboard'
  },
  {
    targetId: 'tour-sidebar-inventory',
    title: 'Gestion des Stocks',
    content: 'Organisez vos produits, gérez les variantes et suivez vos niveaux de stock ici.',
    position: 'right',
    route: '/inventory'
  },
  {
    targetId: 'tour-inventory-add',
    title: 'Ajout Rapide',
    content: 'Ajoutez un nouveau produit en quelques clics grâce à notre formulaire intelligent en étapes.',
    position: 'bottom',
    route: '/inventory'
  },
  {
    targetId: 'tour-sidebar-pos',
    title: 'Point de Vente (POS)',
    content: 'C\'est ici que la magie opère. Encaissez vos clients rapidement avec une interface tactile optimisée.',
    position: 'right',
    route: '/pos'
  },
  {
    targetId: 'tour-pos-cart',
    title: 'Panier Intelligent',
    content: 'Ajoutez des remises, sélectionnez vos clients et gérez plusieurs types de commandes.',
    position: 'left',
    route: '/pos'
  },
  {
    targetId: 'center',
    title: 'Vous êtes prêt !',
    content: 'Explorez le reste des fonctionnalités par vous-même ou consultez la checklist de démarrage pour ne rien oublier.',
    position: 'center'
  }
];

export const OnboardingTour: React.FC = () => {
  const { isTourActive, stopTour, currentStepIndex, setCurrentStepIndex, completeTour } = useOnboarding();
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    // Mobile targeting adjustment
    const isMobile = window.innerWidth < 768;
    let targetId = currentStep.targetId;
    
    if (isMobile) {
        if (targetId === 'tour-sidebar-dashboard') targetId = 'tour-mobile-dashboard';
        if (targetId === 'tour-sidebar-inventory') targetId = 'tour-mobile-inventory';
        if (targetId === 'tour-sidebar-pos') targetId = 'tour-mobile-pos';
    }

    const updatePosition = () => {
      if (targetId === 'center') {
        setCoords({ top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 });
        return;
      }

      const element = document.getElementById(targetId);
      if (element) {
        const rect = element.getBoundingClientRect();
        setCoords({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
        // Only scroll if element is not visible
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        setCoords({ top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 });
      }
    };

    if (!isTourActive) return;

    const navigateIfNecessary = async () => {
      if (currentStep.route && window.location.pathname !== currentStep.route) {
        router.push(currentStep.route);
        // Wait for route to change and component to mount
        await new Promise(r => setTimeout(r, 600));
      }
    };

    navigateIfNecessary().then(() => {
      updatePosition();
      // Double check after a small delay for finishing animations
      const timer = setTimeout(updatePosition, 300);
      return () => clearTimeout(timer);
    });
  }, [currentStepIndex, isTourActive, currentStep.targetId, currentStep.route, router]);

  if (!isTourActive) return null;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      completeTour();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const getTooltipPosition = () => {
    if (currentStep.position === 'center' || window.innerWidth < 768) {
      if (window.innerWidth < 768) {
         // On mobile, stick to bottom of spotlight or center
         if (currentStep.position === 'top' || currentStep.position === 'center') {
            return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'calc(100% - 2rem)' };
         }
         return { bottom: '100px', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 2rem)' };
      }
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const gap = 16;
    let top = coords.top;
    let left = coords.left;

    switch (currentStep.position) {
      case 'right':
        left = coords.left + coords.width + gap;
        top = coords.top + coords.height / 2;
        return { top, left, transform: 'translateY(-50%)' };
      case 'left':
        left = coords.left - gap;
        top = coords.top + coords.height / 2;
        return { top, left, transform: 'translate(-100%, -50%)' };
      case 'bottom':
        top = coords.top + coords.height + gap;
        left = coords.left + coords.width / 2;
        return { top, left, transform: 'translate(-50%, 0)' };
      case 'top':
        top = coords.top - gap;
        left = coords.left + coords.width / 2;
        return { top, left, transform: 'translate(-50%, -100%)' };
      default:
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Dim Overlay with Spotlight Effect - Lightened for better visibility */}
      <div className="absolute inset-0 bg-slate-900/30 transition-opacity duration-500 pointer-events-auto" onClick={stopTour} />
      
      {currentStep.targetId !== 'center' && (
        <div 
          className="absolute z-[10000] border-2 border-[#f56b2a] rounded-xl shadow-[0_0_0_9999px_rgba(15,23,42,0.3)] transition-all duration-500 ease-in-out pointer-events-none"
          style={{
            top: coords.top - 4,
            left: coords.left - 4,
            width: coords.width + 8,
            height: coords.height + 8,
          }}
        />
      )}

      {/* Tooltip Card */}
      <div 
        ref={tooltipRef}
        className="absolute z-[10001] w-[calc(100%-2rem)] md:w-[320px] bg-white rounded-3xl shadow-2xl p-6 pointer-events-auto transition-all duration-500 animate-in zoom-in-95"
        style={getTooltipPosition()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-orange-50 rounded-lg text-[#f56b2a]">
              <Sparkles size={16} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#f56b2a]">{currentStepIndex + 1} / {steps.length}</span>
          </div>
          <button onClick={stopTour} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <h3 className="text-lg font-black text-gray-900 mb-2">{currentStep.title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          {currentStep.content}
        </p>

        <div className="flex items-center justify-between">
          <button 
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-700 disabled:opacity-0 transition-all"
          >
            <ChevronLeft size={16} /> <span className="hidden sm:inline">Retour</span>
          </button>

          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentStepIndex ? 'bg-[#f56b2a] w-4' : 'bg-gray-200'}`} />
            ))}
          </div>

          <button 
            onClick={handleNext}
            className="flex items-center gap-2 px-6 sm:px-8 py-2.5 bg-[#f56b2a] text-white rounded-xl text-xs font-black hover:bg-[#d55a20] transition-all shadow-lg shadow-orange-100"
          >
            {currentStepIndex === steps.length - 1 ? 'Terminer' : 'Suivant'} <ChevronRight size={16} />
          </button>
        </div>

        {/* Arrow pointer */}
        {currentStep.position !== 'center' && window.innerWidth >= 768 && (
            <div 
                className={`absolute w-3 h-3 bg-white rotate-45 border-gray-100 ${
                    currentStep.position === 'right' ? 'left-[-6px] top-1/2 -translate-y-1/2 border-l border-b' :
                    currentStep.position === 'left' ? 'right-[-6px] top-1/2 -translate-y-1/2 border-r border-t' :
                    currentStep.position === 'top' ? 'bottom-[-6px] left-1/2 -translate-x-1/2 border-r border-b' :
                    'top-[-6px] left-1/2 -translate-x-1/2 border-l border-t'
                }`}
            />
        )}
      </div>
    </div>
  );
};

