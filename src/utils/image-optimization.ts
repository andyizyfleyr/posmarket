import imageCompression from 'browser-image-compression';

/**
 * Optimise une image avant l'upload :
 * 1. Réduction de la résolution (max 1200px)
 * 2. Compression de la qualité
 * 3. Conversion en WebP
 */
export async function optimizeImage(file: File): Promise<File> {
  // Options de compression
  const options = {
    maxSizeMB: 0.8, // Max 800Ko (très léger pour du WebP)
    maxWidthOrHeight: 1200, // Résolution max pour le web
    useWebWorker: true,
    fileType: 'image/webp', // Conversion en WebP
    initialQuality: 0.8, // 80% de qualité initiale
  };

  try {
    console.log(`[ImageOptimization] Original: ${file.size / 1024 / 1024} Mo`);
    
    // Compression et conversion
    const compressedFile = await imageCompression(file, options);
    
    console.log(`[ImageOptimization] Optimisée: ${compressedFile.size / 1024 / 1024} Mo (WebP)`);
    
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
