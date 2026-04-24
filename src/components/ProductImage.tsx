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

    const isImageValid = src && src.trim() !== "" && !error;

    return (
        <div className={`relative overflow-hidden bg-gray-50 flex items-center justify-center w-full h-full ${shouldApplyAspectSquare ? 'aspect-square' : ''} ${containerClassName}`}>
            {isImageValid ? (
                <Image
                    src={src!}
                    alt={alt}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className={`relative z-10 ${showZoomEffect ? 'group-hover:scale-105' : ''} ${className}`}
                    style={{ objectFit: objectFit }}
                    onError={() => setError(true)}
                    priority={false}
                />
            ) : (
                <div className="flex flex-col items-center justify-center text-gray-300">
                    <ImageIcon size={32} strokeWidth={1.5} />
                </div>
            )}

            {showZoomEffect && isImageValid && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 pointer-events-none" />
            )}

            {children}
        </div>
    );
};

export default ProductImage;
