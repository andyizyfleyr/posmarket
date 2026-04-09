'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'white';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
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
  const baseStyles = 'inline-flex items-center justify-center font-black transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none rounded-2xl';
  
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
    xl: 'px-8 py-4 text-base gap-3',
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
        <>
          <Loader2 className="animate-spin" size={size === 'xs' || size === 'sm' || size === 'icon' ? 14 : 18} />
          {loadingText ? <span>{loadingText}</span> : children}
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          {children}
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </button>
  );
};

export default Button;
