'use client';
import React, { memo, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { ToastNotification } from '@/types';

interface ToastProps {
    notification: ToastNotification;
    onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = memo(({ notification, onRemove }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onRemove(notification.id);
        }, 5000);
        return () => clearTimeout(timer);
    }, [notification.id, onRemove]);

    const icons = {
        success: <CheckCircle className="text-emerald-500" size={24} />,
        error: <XCircle className="text-rose-500" size={24} />,
        warning: <AlertCircle className="text-amber-500" size={24} />,
        info: <Info className="text-[#f56b2a]" size={24} />,
    };

    const bgColors = {
        success: 'bg-emerald-50 border-emerald-100',
        error: 'bg-rose-50 border-rose-100',
        warning: 'bg-amber-50 border-amber-100',
        info: 'bg-orange-50 border-orange-100',
    };

    return (
        <div className={`
      flex items-start gap-4 p-4 rounded-2xl border shadow-xl max-w-sm w-full animate-in fade-in slide-in-from-right-8 duration-300
      ${bgColors[notification.type]}
    `}>
            <div className="flex-shrink-0 mt-0.5">
                {icons[notification.type]}
            </div>
            <div className="flex-grow">
                {notification.title && <h4 className="text-sm font-black text-slate-800 mb-1">{notification.title}</h4>}
                <p className="text-sm font-bold text-slate-600 leading-tight">{notification.message}</p>
            </div>
            <button
                onClick={() => onRemove(notification.id)}
                className="flex-shrink-0 p-1 hover:bg-black/5 rounded-full transition-colors"
            >
                <X size={16} className="text-slate-400" />
            </button>
        </div>
    );
});

Toast.displayName = 'Toast';

export default Toast;

