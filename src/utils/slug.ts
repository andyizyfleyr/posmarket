export function generateProductSlug(product: any): string {
    if (!product || !product.id) return '';
    
    // Si pas de nom public, on retourne juste l'ID
    if (!product.name) return product.id;
    
    // Normalisation du nom (minuscules, sans accents, espaces -> tirets)
    const cleanName = product.name
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Supprime les accents
        .replace(/[^a-z0-9]+/g, '-') // Remplace caractères spéciaux par tiret
        .replace(/^-+|-+$/g, ''); // Retire les tirets aux extrémités
        
    // L'identifiant final = nom_propre + 6_premiers_caracteres_de_id
    // Exemple = iphone-14-pro-52d06e
    const shortId = product.id.split('-')[0];
    
    if (!cleanName) return product.id;
    return `${cleanName}-${shortId}`;
}
