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
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(ONBOARDING_KEY) : null;
    return saved ? JSON.parse(saved) : [];
  });

  const [checklist, setChecklist] = useState({
    storeCreated: storesCount > 0,
    productAdded: productsCount > 0,
    firstSale: ordersCount > 0,
    settingsConfigured: settingsConfigured
  });

  useEffect(() => {
    setChecklist(prev => ({
      ...prev,
      storeCreated: storesCount > 0,
      productAdded: productsCount > 0,
      firstSale: ordersCount > 0,
      settingsConfigured: settingsConfigured
    }));
  }, [storesCount, productsCount, ordersCount, settingsConfigured]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(completedSteps));
    }
  }, [completedSteps]);

  useEffect(() => {
    // Auto-start tour only if never completed and not on a public path
    const isPublicPath = typeof window !== 'undefined' ? (window.location.pathname.startsWith('/store') || window.location.pathname.startsWith('/product')) : false;
    const hasCompletedTour = completedSteps.includes('full_tour_completed');
    
    if (!hasCompletedTour && !isPublicPath) {
      setIsTourActive(true);
    }
  }, []);

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

