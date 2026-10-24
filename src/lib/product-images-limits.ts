/**
 * Limites de l'export d'images produits.
 *
 * Module volontairement sans import Node : il est partagé par la logique
 * serveur (récupération, archive) **et** par la modale client, qui doit
 * annoncer les mêmes plafonds avant de lancer le téléchargement.
 */
export const IMAGE_EXPORT_LIMITS = {
  /** Nombre maximal d'images dans une archive (protection CPU/bande passante). */
  maxImages: 500,
  /**
   * Nombre maximal de produits dans une sélection. Les identifiants voyagent
   * dans la query string (téléchargement GET natif côté mobile) : au-delà, la
   * longueur d'URL dépasserait les limites des proxys (Vercel : ~14 Ko).
   */
  maxSelectedProducts: 300,
  /** Taille maximale d'une image (octets). */
  maxImageBytes: 10 * 1024 * 1024,
  /** Taille cumulée maximale de l'archive (octets). */
  maxArchiveBytes: 200 * 1024 * 1024,
  /** Requêtes d'images simultanées. */
  concurrency: 4,
  /** Délai maximal par image (ms). */
  timeoutMs: 15_000,
  /** Produits chargés par requête SQL (limite la mémoire des data URI). */
  productsPerQuery: 15,
} as const;
