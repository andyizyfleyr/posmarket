import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rect' }) => {
  const baseClasses = "animate-pulse bg-slate-200 dark:bg-slate-700";
  
  const variants = {
    text: "h-4 w-full rounded",
    rect: "h-32 w-full rounded-lg",
    circle: "h-12 w-12 rounded-full"
  };

  return (
    <div className={`${baseClasses} ${variants[variant]} ${className}`} />
  );
};

export const ProductSkeleton = () => (
  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-4 border border-slate-100 dark:border-slate-700">
    <Skeleton variant="rect" className="h-40 rounded-xl" />
    <Skeleton variant="text" className="w-3/4" />
    <Skeleton variant="text" className="w-1/2" />
    <div className="flex justify-between items-center pt-2">
      <Skeleton variant="text" className="w-20" />
      <Skeleton variant="circle" className="h-8 w-8" />
    </div>
  </div>
);

export const TableRowSkeleton = () => (
  <div className="flex items-center space-x-4 py-4 px-2 border-b border-slate-50 dark:border-slate-800">
    <Skeleton variant="rect" className="h-10 w-10 rounded-md" />
    <div className="flex-1 space-y-2">
      <Skeleton variant="text" className="w-1/3" />
      <Skeleton variant="text" className="w-1/4 h-3" />
    </div>
    <Skeleton variant="text" className="w-16 h-6 rounded-full" />
  </div>
);
