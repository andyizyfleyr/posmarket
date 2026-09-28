import imageCompression from 'browser-image-compression';

/**
 * Optimise une image avant l'upload :
 * 1. Réduction de la résolution (max 1600px)
 * 2. Compression de la qualité
 * 3. Conversion en WebP
 */
export async function optimizeImage(file: File): Promise<File> {
  // Options de compression
  const options = {
    maxSizeMB: 2.5, // Plafond de taille (garde-fou, rarely atteint en WebP)
    maxWidthOrHeight: 1600, // Résolution max pour le web + zoom
    useWebWorker: true,
    fileType: 'image/webp', // Conversion en WebP
    initialQuality: 0.92, // Qualité initiale élevée
    alwaysKeepResolution: true, // Empêche la boucle de sous-échantillonner
    preserveExif: false, // Supprime les métadonnées (poids)
  };

  try {
    if (process.env.NODE_ENV !== 'production') console.log(`[ImageOptimization] Original: ${file.size / 1024 / 1024} Mo`);
    
    // Compression et conversion
    const compressedFile = await imageCompression(file, options);
    
    if (process.env.NODE_ENV !== 'production') console.log(`[ImageOptimization] Optimisée: ${compressedFile.size / 1024 / 1024} Mo (WebP)`);
    
    // Retourne le nouveau fichier WebP
    return compressedFile;
  } catch (error) {
    console.error('[ImageOptimization] Erreur:', error);
    return file; // Retourne le fichier original en cas d'erreur
  }
}

/**
 * Convertit un File en Base64 (si nécessaire pour votre stockage actuel)
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}
