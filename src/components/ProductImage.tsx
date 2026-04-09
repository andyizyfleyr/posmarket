'use client';

import React, { useState } from 'react';
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
                    {/* Skeleton Pulse during loading */}
                    {!isLoaded && (
                        <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-[shimmer_2s_infinite_linear]" />
                    )}
                    <img
                        src={src}
                        alt={alt}
                        onLoad={() => setIsLoaded(true)}
                        onError={() => setError(true)}
                        className={`relative z-10 w-full h-full object-contain transition-all duration-700 ease-in-out ${
                            isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                        } ${showZoomEffect && isLoaded ? 'group-hover:scale-110' : ''} ${className}`}
                        loading="lazy"
                        decoding="async"
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

