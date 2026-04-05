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
    children?: React.ReactNode;
}

const ProductImage: React.FC<ProductImageProps> = ({
    src,
    alt,
    className = "",
    containerClassName = "",
    showZoomEffect = true,
    objectFit = 'cover',
    children
}) => {
    const [error, setError] = useState(false);

    const isImageValid = src && src.trim() !== "" && !error;

    const shouldApplyAspectSquare = !containerClassName.includes('aspect') && !containerClassName.includes('h-full');

    return (
        <div className={`relative overflow-hidden bg-white flex items-center justify-center w-full h-full ${shouldApplyAspectSquare ? 'aspect-square' : ''} ${containerClassName}`}>
            {isImageValid ? (
                <>
                    <img
                        src={src}
                        alt={alt}
                        onError={() => setError(true)}
                        className={`relative z-10 w-full h-full object-contain transition-transform duration-700 ease-in-out ${
                            showZoomEffect ? 'group-hover:scale-110' : ''
                        } ${className}`}
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

