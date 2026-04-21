'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Image as ImageIcon } from 'lucide-react';

interface ProductImageProps {
    src: string | undefined;
    alt: string;
    className?: string;
    containerClassName?: string;
    showZoomEffect?: boolean;
    objectFit?: 'cover' | 'contain';
    shouldApplyAspectSquare?: boolean;
    children?: React.ReactNode;
}

const ProductImage: React.FC<ProductImageProps> = ({
    src,
    alt,
    className = "",
    containerClassName = "",
    showZoomEffect = true,
    objectFit = 'cover',
    shouldApplyAspectSquare = true,
    children
}) => {
    const [error, setError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    const isImageValid = src && src.trim() !== "" && !error;

    return (
        <div className={`relative overflow-hidden bg-gray-50 flex items-center justify-center w-full h-full ${shouldApplyAspectSquare ? 'aspect-square' : ''} ${containerClassName}`}>
            {isImageValid ? (
                <>
                    {/* Skeleton Pulse during loading handled by Next.js or manual overlay */}
                    {!isLoaded && (
                        <div className="absolute inset-0 bg-slate-200 animate-pulse z-20" />
                    )}
                    <Image
                        src={src!}
                        alt={alt}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className={`relative z-10 transition-all duration-700 ease-in-out ${
                            isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                        } ${showZoomEffect && isLoaded ? 'group-hover:scale-110' : ''} ${className}`}
                        style={{ objectFit: objectFit }}
                        onLoadingComplete={() => setIsLoaded(true)}
                        onError={() => setError(true)}
                    />
                </>
            ) : (
                <div className="flex flex-col items-center justify-center text-gray-300">
                    <ImageIcon size={32} strokeWidth={1.5} />
                </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            {children}
        </div>
    );
};

export default ProductImage;
