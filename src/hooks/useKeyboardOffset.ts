'use client';

import { useEffect, useState } from 'react';

/**
 * Décalage du clavier virtuel (px) via VisualViewport.
 * Permet de faire remonter les barres fixes au-dessus du clavier.
 */
export function useKeyboardOffset(minHidden = 120) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const hidden = window.innerHeight - vv.height - vv.offsetTop;
      setOffset(hidden > minHidden ? Math.max(0, Math.round(hidden)) : 0);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [minHidden]);

  return offset;
}
