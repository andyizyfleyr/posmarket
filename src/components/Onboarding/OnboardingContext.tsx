'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface OnboardingContextType {
  isTourActive: boolean;
  startTour: () => void;
  stopTour: () => void;
  currentStepIndex: number;
  setCurrentStepIndex: (index: number) => void;
  completedSteps: string[];
  completeStep: (stepId: string) => void;
  completeTour: () => void;
  checklist: {
    storeCreated: boolean;
    productAdded: boolean;
    firstSale: boolean;
    settingsConfigured: boolean;
  };
}

const ONBOARDING_KEY = 'pos_onboarding_completed';

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ 
  children: React.ReactNode, 
  storesCount: number, 
  productsCount: number, 
  ordersCount: number,
  settingsConfigured: boolean
}> = ({ 
  children,
  storesCount,
  productsCount,
  ordersCount,
  settingsConfigured
}) => {
  const [isTourActive, setIsTourActive] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem(ONBOARDING_KEY);
    const steps = saved ? (JSON.parse(saved) as string[]) : [];
    if (steps.includes('full_tour_completed')) return false;
    const path = window.location.pathname;
    if (path.startsWith('/store') || path.startsWith('/product')) return false;
    return true;
  });
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(ONBOARDING_KEY) : null;
    return saved ? (JSON.parse(saved) as string[]) : [];
  });

  const checklist = {
    storeCreated: storesCount > 0,
    productAdded: productsCount > 0,
    firstSale: ordersCount > 0,
    settingsConfigured: settingsConfigured,
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(completedSteps));
    }
  }, [completedSteps]);

  const startTour = () => {
    if (!completedSteps.includes('full_tour_completed')) {
      setCurrentStepIndex(0);
      setIsTourActive(true);
    }
  };
  
  const stopTour = () => {
    if (!completedSteps.includes('full_tour_completed')) {
      const newSteps = [...completedSteps, 'full_tour_completed'];
      setCompletedSteps(newSteps);
      if (typeof window !== 'undefined') localStorage.setItem(ONBOARDING_KEY, JSON.stringify(newSteps));
    }
    setIsTourActive(false);
  };
  
  const completeTour = () => {
    if (!completedSteps.includes('full_tour_completed')) {
      const newSteps = [...completedSteps, 'full_tour_completed'];
      setCompletedSteps(newSteps);
      if (typeof window !== 'undefined') localStorage.setItem(ONBOARDING_KEY, JSON.stringify(newSteps));
    }
    stopTour();
  };

  const completeStep = (stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps(prev => [...prev, stepId]);
    }
  };

  return (
    <OnboardingContext.Provider value={{ 
      isTourActive, 
      startTour, 
      stopTour, 
      currentStepIndex,
      setCurrentStepIndex,
      completedSteps, 
      completeStep,
      completeTour,
      checklist
    }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return context;
};

