'use client';
import React from 'react';

interface LoaderProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    color?: string;
    className?: string;
}

const Loader: React.FC<LoaderProps> = ({
    size = 'md',
    color = 'text-[#f56b2a]',
    className = ''
}) => {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-8 h-8 border-3',
        lg: 'w-12 h-12 border-4',
        xl: 'w-16 h-16 border-4'
    };

    return (
        <div className={`flex items-center justify-center ${className}`}>
            <div
                className={`
          ${sizeClasses[size]} 
          ${color} 
          border-current 
          border-t-transparent 
          rounded-full 
          animate-spin
        `}
                role="status"
                aria-label="Chargement"
            >
                <span className="sr-only">Chargement...</span>
            </div>
        </div>
    );
};

export default Loader;

