/**
 * Loader d'images Next.js : AUCUNE image n'est optimisée côté Vercel.
 *
 * Les visuels produits sont déjà compressés en WebP (max 1600 px) à l'upload
 * (`src/utils/image-optimization.ts`). Le passage par l'optimiseur Vercel
 * ne produisait donc qu'un double encodage — et surtout des octets facturés
 * en « Fast Data Transfer » pour chaque vignette, à chaque visite.
 *
 * Les images sont servies directement depuis R2 (préconnecté dans
 * `src/app/layout.tsx`) ou depuis Unsplash ; les URLs historiques
 * `/api/image/*` continuent de fonctionner telles quelles.
 */
export default function imageLoader({ src }: { src: string; width?: number; quality?: number }) {
  return src;
}
