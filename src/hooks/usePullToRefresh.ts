'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Pull-to-refresh natif : tire vers le bas en haut de page pour rafraîchir.
 * Retourne la distance de pull (px) pour l'indicateur visuel + état refreshing.
 */
export function usePullToRefresh(
  enabled: boolean,
  onRefresh: () => void,
  threshold = 70,
) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const startY = useRef(0);
  const startX = useRef(0);
  const gesture = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const atTop = () =>
      (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing || !atTop()) return;
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      gesture.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!gesture.current || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      const dx = e.touches[0].clientX - startX.current;
      // Intention verticale uniquement + résistance élastique
      if (dy <= 0 || dy < Math.abs(dx)) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      const d = Math.min(110, Math.round(dy * 0.45));
      pullRef.current = d;
      setPull(d);
    };

    const onTouchEnd = () => {
      if (!gesture.current) return;
      gesture.current = false;
      if (pullRef.current >= threshold) {
        setRefreshing(true);
        setPull(threshold);
        window.setTimeout(() => {
          onRefresh();
        }, 300);
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled, refreshing, onRefresh, threshold]);

  return { pull, refreshing, done: () => setRefreshing(false) };
}
