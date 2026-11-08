'use client';

import { useEffect, useRef } from 'react';
import lottie from 'lottie-web';
import animationData from '@/assets/success.json';

/**
 * Animation « commande réussie » (Lottie, jouée une fois au chargement).
 * L'asset est embarqué dans le bundle — aucun réseau requis à l'affichage.
 */
export default function SuccessCheckLottie({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const animation = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop: false,
      autoplay: true,
      animationData,
      rendererSettings: {
        progressiveLoad: true,
        preserveAspectRatio: 'xMidYMid meet',
      },
    });
    return () => {
      animation.destroy();
    };
  }, []);

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}
