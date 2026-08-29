'use client';

import React from 'react';
import Image from 'next/image';
import {
  CheckCircle2,
  Clock,
  Truck,
  X,
  AlertCircle,
  Package,
  Star,
} from 'lucide-react';

export const normalizeImage = (uri?: string | null): string => {
  if (!uri) return '';
  if (uri.startsWith('data:')) return '';
  return uri;
};

export const getStatusInfo = (status: string, businessType?: string) => {
  const isFood = businessType === 'food';

  switch (status) {
    case 'COMPLETED':
      return {
        label: isFood ? 'Dégusté' : 'Livré',
        color: 'bg-green-100 text-green-700',
        icon: <CheckCircle2 size={12} />,
      };
    case 'READY':
      return {
        label: isFood ? 'Prêt' : 'Prêt pour retrait',
        color: 'bg-blue-100 text-blue-700',
        icon: <Clock size={12} />,
      };
    case 'SHIPPED':
      return {
        label: isFood ? 'En cours de livraison' : 'Expédié',
        color: 'bg-purple-100 text-purple-700',
        icon: <Truck size={12} />,
      };
    case 'PENDING':
      return {
        label: isFood ? 'En cuisine' : 'En attente',
        color: 'bg-amber-100 text-amber-700',
        icon: <Clock size={12} />,
      };
    case 'CANCELLED':
      return {
        label: 'Annulé',
        color: 'bg-red-100 text-red-700',
        icon: <X size={12} />,
      };
    default:
      return {
        label: 'Statut inconnu',
        color: 'bg-gray-100 text-gray-700',
        icon: <AlertCircle size={12} />,
      };
  }
};

export const StatusBadge: React.FC<{
  status: string;
  businessType?: string;
}> = ({ status, businessType }) => {
  const info = getStatusInfo(status, businessType);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black whitespace-nowrap ${info.color}`}
    >
      {info.icon}
      {info.label}
    </span>
  );
};

export const ProductThumb: React.FC<{
  src?: string | null;
  alt?: string;
  className?: string;
  sizes?: string;
  iconSize?: number;
}> = ({ src, alt, className = 'w-12 h-12', sizes = '48px', iconSize = 20 }) => {
  const image = normalizeImage(src);
  if (!image) {
    return (
      <div
        className={`${className} bg-gray-100 rounded-xl flex items-center justify-center text-gray-300 shrink-0`}
      >
        <Package size={iconSize} />
      </div>
    );
  }
  return (
    <div
      className={`${className} bg-gray-100 rounded-xl overflow-hidden relative shrink-0 border border-gray-50`}
    >
      <Image
        src={image}
        alt={alt || 'Produit'}
        fill
        className="object-cover"
        sizes={sizes}
      />
    </div>
  );
};

export const StarRating: React.FC<{ value: number; size?: number }> = ({
  value,
  size = 14,
}) => (
  <div className="flex gap-0.5">
    {[...Array(5)].map((_, i) => (
      <Star
        key={i}
        size={size}
        fill={i < value ? '#fbbf24' : 'none'}
        className={i < value ? 'text-amber-400' : 'text-gray-200'}
        strokeWidth={i < value ? 0 : 2.5}
      />
    ))}
  </div>
);

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ icon, title, subtitle, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white rounded-[28px] border border-gray-100 shadow-sm">
    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-5 text-gray-300">
      {icon}
    </div>
    <p className="text-sm font-black text-gray-600 tracking-tight">{title}</p>
    {subtitle && (
      <p className="text-[11px] font-medium text-gray-400 mt-1.5 max-w-[260px] leading-relaxed">
        {subtitle}
      </p>
    )}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export const PanelSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="space-y-3 animate-pulse">
    {[...Array(rows)].map((_, i) => (
      <div
        key={i}
        className="bg-white rounded-2xl h-28 border border-gray-100"
      />
    ))}
  </div>
);