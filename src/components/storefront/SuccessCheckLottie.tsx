'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import lottie from 'lottie-web';
import type { AnimationItem } from 'lottie-web';
import animationData from '@/assets/success.json';

export type SuccessCheckLottieHandle = {
  /** Rejoue l'animation depuis la première image. */
  replay: () => void;
};

/**
 * Animation « commande réussie » (Lottie, jouée une fois).
 * La relance se fait via la ref exposée (bouton « Revoir l'animation »).
 * L'asset est embarqué dans le bundle — aucun réseau requis à l'affichage.
 */
const SuccessCheckLottie = forwardRef<
  SuccessCheckLottieHandle,
  { className?: string }
>(function SuccessCheckLottie({ className }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<AnimationItem | null>(null);

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
    animationRef.current = animation;
    return () => {
      animation.destroy();
      animationRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      replay: () => {
        animationRef.current?.goToAndPlay(0, true);
      },
    }),
    [],
  );

  return <div ref={containerRef} className={className} aria-hidden="true" />;
});

export default SuccessCheckLottie;
