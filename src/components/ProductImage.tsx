'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Image as ImageIcon } from 'lucide-react';
import { needsNoOptimization } from '@/lib/imageOptimizer';

interface ProductImageProps {
    src: string | undefined;
    alt: string;
    className?: string;
    containerClassName?: string;
    showZoomEffect?: boolean;
    objectFit?: 'cover' | 'contain';
    shouldApplyAspectSquare?: boolean;
    /**
     * Attribut `sizes` de `next/image`.
     *
     * Il était figé à « 33vw » pour tous les contextes. Or la grille de vente
     * affiche 6 à 7 colonnes (~16vw) : le navigateur demandait une image deux
     * fois plus large que nécessaire, sur chaque vignette, à chaque ouverture
     * de la caisse. Chaque appelant annonce désormais sa propre largeur.
     */
    sizes?: string;
    children?: React.ReactNode;
}

// LQIP 1px réutilisable : placeholder="blur" sans import statique (images distantes)
export const PRODUCT_BLUR_DATA_URL =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

/** Valeur historique, conservée pour les fiches produit et les listes larges. */
export const DEFAULT_SIZES = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';

/** Préréglages : chaque contexte annonce sa vraie largeur d'affichage. */
export const IMAGE_SIZES = {
    /** Grille de vente : 3 → 7 colonnes selon la largeur. */
    posGrid: '(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 15vw',
    /** Inventaire : 2 → 5 colonnes. */
    inventoryGrid: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw',
    /** Panier : vignette de 48 à 64 px. */
    cartThumb: '64px',
    /** Fiche produit : plein écran sur mobile, moitié sur desktop. */
    detail: '(max-width: 768px) 100vw, 50vw',
} as const;

const ProductImage: React.FC<ProductImageProps> = ({
    src,
    alt,
    className = "",
    containerClassName = "",
    showZoomEffect = true,
    objectFit = 'cover',
    shouldApplyAspectSquare = true,
    sizes = DEFAULT_SIZES,
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
                    sizes={sizes}
                    className={`relative z-10 ${showZoomEffect ? 'group-hover:scale-105' : ''} ${className}`}
                    style={{ objectFit: objectFit }}
                    onError={() => setError(true)}
                    priority={false}
                    placeholder="blur"
                    blurDataURL={PRODUCT_BLUR_DATA_URL}
                    unoptimized={needsNoOptimization(src)}
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
