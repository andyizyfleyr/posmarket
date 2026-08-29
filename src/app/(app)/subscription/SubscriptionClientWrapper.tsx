'use client';

import React, { useState, useCallback } from 'react';
import { SubscriptionView } from '@/views/SubscriptionView';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { UserSubscription, SubscriptionDuration, SubscriptionTier, NotificationType, StaffRole } from '@/types';

interface SubscriptionClientWrapperProps {
  currentSubscription: UserSubscription;
  onUpdateSubscription: (tier: SubscriptionTier, duration: SubscriptionDuration) => Promise<{ success: boolean; error?: string | undefined }>;
  userRole?: string;
}

export default function SubscriptionClientWrapper({ currentSubscription, onUpdateSubscription, userRole }: SubscriptionClientWrapperProps) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const notify = useCallback((message: string, type: NotificationType, _title?: string) => {
    setToast({ message, type: type === 'error' ? 'error' : 'success' });
    setTimeout(() => setToast(null), 3500);
  }, []);

  return (
    <>
      <SubscriptionView
        currentSubscription={currentSubscription}
        userRole={userRole as StaffRole}
        onUpdateSubscription={onUpdateSubscription}
        notify={notify}
      />

      {toast && (
        <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
          <div className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl border ${
            toast.type === 'success'
              ? 'bg-green-600 text-white border-green-500'
              : 'bg-red-600 text-white border-red-500'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span className="text-xs font-black tracking-tight whitespace-nowrap">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
