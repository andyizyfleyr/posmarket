import { useEffect, useRef, type RefObject } from 'react';

type Scrollable = {
  scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => void;
};

/**
 * Remet une vue scrollable en haut quand le paramètre d'une route dynamique
 * change (ex. `/product/a` → `/product/b`).
 *
 * Expo Router peut réutiliser l'écran courant lorsqu'on ouvre une autre fiche
 * de la même route. Sans ce reset, la nouvelle fiche conserve la position de
 * scroll de la précédente et s'ouvre tout en bas.
 */
export function useScrollToTopOnChange(
  scrollRef: RefObject<Scrollable | null>,
  param: string | string[] | undefined,
) {
  const key = Array.isArray(param) ? param.join('/') : param;
  const previousKey = useRef(key);

  useEffect(() => {
    // Au premier montage, l'écran démarre déjà en haut.
    if (previousKey.current === key) return;
    previousKey.current = key;

    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, x: 0, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [key, scrollRef]);
}
