'use client';

import React, { memo } from 'react';
import Loader from './Loader';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'white';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  form?: string;
}

const Button: React.FC<ButtonProps> = memo(({
  children,
  loading = false,
  loadingText,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-black transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed rounded-2xl relative overflow-hidden';

  const variants = {
    primary: 'bg-[#f56b2a] text-white hover:bg-[#e55a1b] shadow-md shadow-orange-100',
    secondary: 'bg-gray-900 text-white hover:bg-black shadow-md shadow-gray-200',
    outline: 'bg-white border-2 border-gray-100 text-gray-700 hover:border-gray-200 hover:bg-gray-50',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-100',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-50',
    white: 'bg-white text-gray-900 border border-gray-100 shadow-sm hover:bg-gray-50',
  };

  const sizes = {
    xs: 'px-2 py-1 text-[9px] gap-1',
    sm: 'px-3 py-1.5 text-[10px] gap-1.5',
    md: 'px-4 py-2.5 text-xs gap-2',
    lg: 'px-6 py-3.5 text-sm gap-2.5',
    xl: 'px-8 py-5 text-base gap-3',
    icon: 'p-2',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyle} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 animate-in fade-in duration-300">
          <Loader size="sm" color="text-current" className="!w-4 !h-4" />
          {loadingText && (
             <span className="animate-in slide-in-from-bottom-1 duration-300">{loadingText}</span>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2">
          {icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>}
          <span className="truncate">{children}</span>
          {icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}
        </div>
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
