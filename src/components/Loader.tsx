'use client';
import React from 'react';

interface LoaderProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    color?: string;
    className?: string;
    /** Texte lu par les lecteurs d'écran (vide = décoration pure). */
    label?: string;
}

/**
 * Indicateur de chargement circulaire.
 *
 * Deux garde-fous pour qu'il tourne *toujours* :
 * - `spinner-always` (globals.css) porte `animation: spin … !important`, ce qui
 *   le protège d'un `animation: none` hérité ou d'une remise à zéro globale ;
 * - le tracé est géré par la classe utilitaire `animate-spin`, dont la durée est
 *   explicitement préservée sous `prefers-reduced-motion: reduce` (voir
 *   globals.css : un spinner n'est pas une animation décorative).
 *
 * Le spinner n'est jamais rendu dans un élément qui change de taille : le
 * conteneur réserve la place (`shrink-0`) pour éviter tout recalcul de layout
 * pendant la rotation.
 */
const Loader: React.FC<LoaderProps> = ({
    size = 'md',
    color = 'text-brand',
    className = '',
    label = 'Chargement...'
}) => {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-8 h-8 border-[3px]',
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
          shrink-0
          rounded-full
          animate-spin
          spinner-always
          will-change-transform
        `}
                role="status"
                aria-live="polite"
                aria-label={label || undefined}
                aria-hidden={label ? undefined : true}
            >
                {label ? <span className="sr-only">{label}</span> : null}
            </div>
        </div>
    );
};

export default Loader;
