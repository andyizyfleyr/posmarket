/**
 * Sérialise une donnée destinée à un bloc `<script type="application/ld+json">`.
 *
 * `JSON.stringify` n'échappe ni `<` ni `/` : une valeur contenant `</script>`
 * (un nom de produit ou de boutique, contrôlé par le vendeur) fermerait le bloc
 * et permettrait l'injection de balises. On échappe les caractères qui rendent ces
 * séquences impossibles à former.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}