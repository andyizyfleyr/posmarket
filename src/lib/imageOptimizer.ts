/**
 * L'optimiseur d'images de Next n'arrive pas a lire le corps renvoye par notre
 * route `/api/image` : il journalise « the requested resource isn't a valid
 * image - received null » et repond 400. Il ne suit pas non plus la
 * redirection que la route renvoyait auparavant vers R2.
 *
 * Consequence : toute image servie par cette route doit bypasser l'optimiseur,
 * sinon le navigateur affiche une image cassee. Les autres sources (URL
 * distantes autorisees par `images.remotePatterns`) continuent d'etre
 * optimisees, car elles passent par l'optimiseur sans probleme.
 */
export function needsNoOptimization(
  src: string | null | undefined,
): boolean {
  return typeof src === 'string' && src.startsWith('/api/image/');
}
