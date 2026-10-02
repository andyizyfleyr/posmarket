import { Product, WholesaleTier, BusinessVertical } from '@/types';
import {
  normalizeOptions,
  normalizeVariants,
  type ProductOptionDef,
  type ProductVariantDef,
} from '@/utils/variants';

export interface ProductImportItem {
  id?: string;
  name: string;
  price: number;
  originalPrice?: number | null;
  stock: number;
  category?: string;
  mainCategory?: string;
  unit?: string;
  description?: string;
  image?: string;
  images?: string[];
  isOnline?: boolean;
  businessType?: BusinessVertical;
  deliveryTime?: string;
  preparationTime?: string;
  wholesalePrice?: number | null;
  wholesaleMinQty?: number | null;
  wholesaleTiers?: WholesaleTier[];
  options?: ProductOptionDef[];
  variants?: ProductVariantDef[];
}

export interface ImportParseResult {
  valid: ProductImportItem[];
  errors: Array<{ row: number; name?: string; reason: string }>;
  warnings: string[];
  totalRows: number;
}

export interface ExportFilePayload {
  version: number;
  exportedAt: string;
  store?: {
    id?: string;
    name?: string;
    businessType?: string;
  };
  totalProducts: number;
  products: ProductImportItem[];
}

/**
 * Nettoie une chaîne de texte
 */
function cleanStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
 * Parse un nombre avec support virgule ou point
 */
function parseNumeric(val: unknown, fallback: number = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  const s = String(val).replace(/\s+/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Parse un booléen (1, true, oui, yes, on, v)
 */
function parseBool(val: unknown, fallback: boolean = true): boolean {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (['1', 'true', 'oui', 'yes', 'vrai', 'on'].includes(s)) return true;
  if (['0', 'false', 'non', 'no', 'faux', 'off'].includes(s)) return false;
  return fallback;
}

/**
 * Formate un champ pour CSV avec échappement RFC 4180
 */
function escapeCsvCell(val: unknown, delimiter: string = ';'): string {
  if (val === null || val === undefined) return '';
  let str: string;
  if (typeof val === 'object') {
    str = JSON.stringify(val);
  } else {
    str = String(val);
  }

  // Si contient séparateur, guillemets ou saut de ligne, on entoure de guillemets
  if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Parse une ligne CSV selon la norme RFC 4180
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          current += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        current += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === delimiter) {
        result.push(current);
        current = '';
        i++;
        continue;
      } else {
        current += char;
        i++;
        continue;
      }
    }
  }

  result.push(current);
  return result;
}

/**
 * Détecte le séparateur CSV le plus probable (, ou ; ou \t)
 */
function detectDelimiter(firstLine: string): string {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;

  if (semicolons >= commas && semicolons >= tabs && semicolons > 0) return ';';
  if (tabs > commas && tabs > semicolons) return '\t';
  return ',';
}

/**
 * Découpe un texte CSV en respectant les retours à la ligne dans les cellules entre guillemets
 */
function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let currentRow = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentRow += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        currentRow += '"';
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      if (currentRow.trim().length > 0) {
        rows.push(currentRow);
      }
      currentRow = '';
    } else {
      currentRow += char;
    }
  }

  if (currentRow.trim().length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Normalise un nom d'en-tête CSV pour faciliter le mapping
 */
function normalizeHeaderKey(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime accents
    .replace(/[^a-z0-9]/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Mapping des en-têtes possibles vers nos clés de produit standard
 */
const HEADER_MAPPINGS: Record<string, string> = {
  // name
  name: 'name',
  nom: 'name',
  nom_produit: 'name',
  designation: 'name',
  title: 'name',
  titre: 'name',
  produit: 'name',
  article: 'name',

  // price
  price: 'price',
  prix: 'price',
  prix_unitaire: 'price',
  tarif: 'price',
  pu: 'price',
  montant: 'price',

  // originalPrice
  original_price: 'originalPrice',
  originalprice: 'originalPrice',
  prix_original: 'originalPrice',
  prix_barre: 'originalPrice',
  prix_promo: 'originalPrice',
  ancien_prix: 'originalPrice',

  // stock
  stock: 'stock',
  quantite: 'stock',
  qte: 'stock',
  quantity: 'stock',
  inventaire: 'stock',

  // category
  category: 'category',
  categorie: 'category',
  sous_categorie: 'category',
  subcategory: 'category',
  rayon: 'category',

  // mainCategory
  main_category: 'mainCategory',
  maincategory: 'mainCategory',
  categorie_principale: 'mainCategory',
  verticale: 'mainCategory',
  vertical: 'mainCategory',

  // unit
  unit: 'unit',
  unite: 'unit',
  unite_mesure: 'unit',
  format: 'unit',

  // businessType
  business_type: 'businessType',
  businesstype: 'businessType',
  type_commerce: 'businessType',
  flux: 'businessType',
  type: 'businessType',

  // isOnline
  is_online: 'isOnline',
  isonline: 'isOnline',
  en_ligne: 'isOnline',
  online: 'isOnline',
  visible_marketplace: 'isOnline',
  marketplace: 'isOnline',

  // description
  description: 'description',
  desc: 'description',
  details: 'description',
  detail: 'description',

  // deliveryTime
  delivery_time: 'deliveryTime',
  deliverytime: 'deliveryTime',
  delai_livraison: 'deliveryTime',
  livraison: 'deliveryTime',

  // preparationTime
  preparation_time: 'preparationTime',
  preparationtime: 'preparationTime',
  delai_preparation: 'preparationTime',
  preparation: 'preparationTime',

  // wholesale
  wholesale_price: 'wholesalePrice',
  wholesaleprice: 'wholesalePrice',
  prix_gros: 'wholesalePrice',
  tarif_gros: 'wholesalePrice',

  wholesale_min_qty: 'wholesaleMinQty',
  wholesaleminqty: 'wholesaleMinQty',
  qte_min_gros: 'wholesaleMinQty',
  min_gros: 'wholesaleMinQty',

  wholesale_tiers: 'wholesaleTiers',
  wholesaletiers: 'wholesaleTiers',
  paliers_gros: 'wholesaleTiers',

  // image
  image: 'image',
  image_url: 'image',
  photo: 'image',
  image_principale: 'image',
  visuel: 'image',

  // images
  images: 'images',
  images_urls: 'images',
  photos: 'images',
  galerie: 'images',
  galerie_photos: 'images',

  // options & variants
  options: 'options',
  options_produit: 'options',
  attributs: 'options',

  variants: 'variants',
  variantes: 'variants',
  declinaisons: 'variants',
};

/**
 * Parse un champ de paliers de gros (JSON ou chaîne min:prix|min:prix)
 */
function parseWholesaleTiers(raw: unknown): WholesaleTier[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((t) => ({
        minQty: Math.max(1, Math.round(parseNumeric(t.minQty || t.min_qty || 0))),
        price: parseNumeric(t.price || t.unitPrice || 0),
      }))
      .filter((t) => t.minQty > 0 && t.price > 0);
  }

  const str = cleanStr(raw);
  if (str.startsWith('[') || str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str);
      return parseWholesaleTiers(parsed);
    } catch {
      // format non-JSON
    }
  }

  // Format "5:1000|10:800" ou "5:1000, 10:800"
  const tiers: WholesaleTier[] = [];
  const parts = str.split(/[|;,]/);
  for (const part of parts) {
    const [qStr, pStr] = part.split(':');
    if (qStr && pStr) {
      const minQty = Math.max(1, Math.round(parseNumeric(qStr)));
      const price = parseNumeric(pStr);
      if (minQty > 0 && price > 0) {
        tiers.push({ minQty, price });
      }
    }
  }
  return tiers;
}

/**
 * Parse un champ de galerie d'images
 */
function parseImagesArray(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((img) => cleanStr(img)).filter((img) => img.length > 0);
  }
  const str = cleanStr(raw);
  if (str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parseImagesArray(parsed);
    } catch {
      // format simple
    }
  }
  // URLs séparées par | ou virgule
  return str
    .split(/[|\n]/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:'));
}

/**
 * Parse options produit (JSON ou format "Taille:S,M,L | Couleur:Rouge,Bleu")
 */
function parseOptionsField(raw: unknown): ProductOptionDef[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return normalizeOptions(raw);
  }

  const str = cleanStr(raw);
  if (str.startsWith('[') || str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str);
      return normalizeOptions(Array.isArray(parsed) ? parsed : [parsed]);
    } catch {
      // not JSON
    }
  }

  // Format simplifié: "Taille: S, M, L | Couleur: Rouge, Bleu"
  const optionsList: Array<{ id: string; name: string; values: string[] }> = [];
  const entries = str.split('|');
  for (const entry of entries) {
    const colonIdx = entry.indexOf(':');
    if (colonIdx > 0) {
      const name = entry.slice(0, colonIdx).trim();
      const vals = entry
        .slice(colonIdx + 1)
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
      if (name && vals.length > 0) {
        optionsList.push({
          id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name,
          values: vals,
        });
      }
    }
  }

  return normalizeOptions(optionsList);
}

/**
 * Parse variantes produit (JSON)
 */
function parseVariantsField(raw: unknown, options: ProductOptionDef[]): ProductVariantDef[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return normalizeVariants(raw, options);
  }

  const str = cleanStr(raw);
  if (str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      return normalizeVariants(parsed, options);
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Convertit un ensemble de produits en fichier CSV (avec BOM UTF-8)
 */
export function generateProductsCSV(products: Product[], options?: { delimiter?: string }): string {
  const delim = options?.delimiter || ';';
  const headers = [
    'Nom',
    'Prix',
    'Prix_Barre',
    'Stock',
    'Categorie',
    'Categorie_Principale',
    'Unite',
    'Flux',
    'En_Ligne',
    'Description',
    'Delai_Livraison',
    'Delai_Preparation',
    'Prix_Gros',
    'Qte_Min_Gros',
    'Paliers_Gros_JSON',
    'Image_Principale',
    'Images_Galerie_JSON',
    'Options_JSON',
    'Variantes_JSON',
  ];

  const rows: string[] = [headers.join(delim)];

  for (const p of products) {
    const cleanOpts = normalizeOptions(p.options);
    const cleanVars = cleanOpts.length > 0 ? normalizeVariants(p.variants, cleanOpts) : [];

    const cells = [
      escapeCsvCell(p.name || '', delim),
      escapeCsvCell(p.price !== undefined ? p.price : 0, delim),
      escapeCsvCell(p.originalPrice || '', delim),
      escapeCsvCell(p.stock !== undefined ? p.stock : 0, delim),
      escapeCsvCell(p.category || 'Général', delim),
      escapeCsvCell(p.mainCategory || 'Divers', delim),
      escapeCsvCell(p.unit || 'pièce', delim),
      escapeCsvCell(p.businessType || 'shopping', delim),
      escapeCsvCell(p.isOnline !== false ? 'OUI' : 'NON', delim),
      escapeCsvCell(p.description || '', delim),
      escapeCsvCell(p.deliveryTime || '', delim),
      escapeCsvCell(p.preparationTime || '', delim),
      escapeCsvCell(p.wholesalePrice || '', delim),
      escapeCsvCell(p.wholesaleMinQty || '', delim),
      escapeCsvCell(Array.isArray(p.wholesaleTiers) && p.wholesaleTiers.length > 0 ? JSON.stringify(p.wholesaleTiers) : '', delim),
      escapeCsvCell(p.image || '', delim),
      escapeCsvCell(Array.isArray(p.images) && p.images.length > 0 ? JSON.stringify(p.images) : '', delim),
      escapeCsvCell(cleanOpts.length > 0 ? JSON.stringify(cleanOpts) : '', delim),
      escapeCsvCell(cleanVars.length > 0 ? JSON.stringify(cleanVars) : '', delim),
    ];

    rows.push(cells.join(delim));
  }

  // Ajout du BOM UTF-8 (\uFEFF) pour compatibilité optimale Excel
  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Convertit un ensemble de produits en fichier JSON structuré
 */
export function generateProductsJSON(products: Product[], storeInfo?: { id?: string; name?: string; businessType?: string }): string {
  const exportPayload: ExportFilePayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    store: storeInfo,
    totalProducts: products.length,
    products: products.map((p) => {
      const cleanOpts = normalizeOptions(p.options);
      const cleanVars = cleanOpts.length > 0 ? normalizeVariants(p.variants, cleanOpts) : [];
      return {
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
        stock: Number(p.stock) || 0,
        category: p.category || 'Général',
        mainCategory: p.mainCategory || 'Divers',
        unit: p.unit || 'pièce',
        businessType: p.businessType || 'shopping',
        isOnline: p.isOnline !== false,
        description: p.description || '',
        deliveryTime: p.deliveryTime || '',
        preparationTime: p.preparationTime || '',
        wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : null,
        wholesaleMinQty: p.wholesaleMinQty || null,
        wholesaleTiers: Array.isArray(p.wholesaleTiers) ? p.wholesaleTiers : [],
        image: p.image || '',
        images: Array.isArray(p.images) ? p.images : [],
        options: cleanOpts,
        variants: cleanVars,
      };
    }),
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Parse un fichier CSV de produits
 */
export function parseProductsCSV(csvContent: string): ImportParseResult {
  const cleanContent = csvContent.replace(/^\uFEFF/, ''); // Enlève BOM
  const rows = splitCsvRows(cleanContent);

  if (rows.length < 2) {
    return {
      valid: [],
      errors: [{ row: 0, reason: 'Le fichier CSV est vide ou ne contient aucun produit.' }],
      warnings: [],
      totalRows: 0,
    };
  }

  const firstLine = rows[0];
  const delimiter = detectDelimiter(firstLine);
  const rawHeaders = parseCsvLine(firstLine, delimiter);

  // Index mapping
  const colMap: Record<string, number> = {};
  rawHeaders.forEach((header, index) => {
    const normalized = normalizeHeaderKey(header);
    const standardKey = HEADER_MAPPINGS[normalized] || normalized;
    colMap[standardKey] = index;
  });

  if (colMap['name'] === undefined && colMap['nom'] === undefined) {
    return {
      valid: [],
      errors: [{ row: 1, reason: "Colonne 'Nom' ou 'name' introuvable dans l'en-tête du CSV." }],
      warnings: [],
      totalRows: rows.length - 1,
    };
  }

  const valid: ProductImportItem[] = [];
  const errors: Array<{ row: number; name?: string; reason: string }> = [];
  const warnings: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const rowLine = rows[i];
    if (!rowLine || rowLine.trim().length === 0) continue;

    const cells = parseCsvLine(rowLine, delimiter);
    const getVal = (key: string): string => {
      const idx = colMap[key];
      if (idx !== undefined && idx < cells.length) {
        return cells[idx];
      }
      return '';
    };

    const name = cleanStr(getVal('name'));
    if (!name) {
      errors.push({ row: i + 1, reason: 'Nom du produit manquant ou vide.' });
      continue;
    }

    const priceRaw = getVal('price');
    const price = parseNumeric(priceRaw, -1);
    if (price < 0) {
      errors.push({ row: i + 1, name, reason: `Prix invalide ou manquant: "${priceRaw}"` });
      continue;
    }

    const origPriceRaw = getVal('originalPrice');
    const originalPrice = origPriceRaw ? parseNumeric(origPriceRaw, null as unknown as number) : null;

    const stockRaw = getVal('stock');
    const stock = Math.max(0, Math.round(parseNumeric(stockRaw, 0)));

    const category = cleanStr(getVal('category')) || 'Général';
    const mainCategory = cleanStr(getVal('mainCategory')) || 'Divers';
    const unit = cleanStr(getVal('unit')) || 'pièce';
    const rawBusinessType = cleanStr(getVal('businessType')).toLowerCase();
    const businessType: BusinessVertical = rawBusinessType === 'food' || rawBusinessType === 'resto' ? 'food' : 'shopping';
    const isOnline = parseBool(getVal('isOnline'), true);
    const description = cleanStr(getVal('description'));
    const deliveryTime = cleanStr(getVal('deliveryTime'));
    const preparationTime = cleanStr(getVal('preparationTime'));

    const wholesalePriceRaw = getVal('wholesalePrice');
    const wholesalePrice = wholesalePriceRaw ? parseNumeric(wholesalePriceRaw, null as unknown as number) : null;
    const wholesaleMinQtyRaw = getVal('wholesaleMinQty');
    const wholesaleMinQty = wholesaleMinQtyRaw ? Math.max(1, Math.round(parseNumeric(wholesaleMinQtyRaw, 1))) : null;
    const wholesaleTiers = parseWholesaleTiers(getVal('wholesaleTiers'));

    const image = cleanStr(getVal('image'));
    const images = parseImagesArray(getVal('images'));
    if (image && !images.includes(image)) {
      images.unshift(image);
    }

    const options = parseOptionsField(getVal('options'));
    const variants = parseVariantsField(getVal('variants'), options);

    valid.push({
      name,
      price,
      originalPrice: originalPrice && originalPrice > 0 ? originalPrice : null,
      stock,
      category,
      mainCategory,
      unit,
      businessType,
      isOnline,
      description,
      deliveryTime,
      preparationTime,
      wholesalePrice: wholesalePrice && wholesalePrice > 0 ? wholesalePrice : null,
      wholesaleMinQty,
      wholesaleTiers,
      image: image || (images[0] ?? ''),
      images,
      options,
      variants,
    });
  }

  return {
    valid,
    errors,
    warnings,
    totalRows: rows.length - 1,
  };
}

/**
 * Parse un fichier JSON de produits (format complet ou tableau brut)
 */
export function parseProductsJSON(jsonContent: string): ImportParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (err: unknown) {
    return {
      valid: [],
      errors: [{ row: 0, reason: `Format JSON invalide: ${err instanceof Error ? err.message : String(err)}` }],
      warnings: [],
      totalRows: 0,
    };
  }

  let rawList: unknown[] = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (parsed && typeof parsed === 'object' && 'products' in parsed && Array.isArray((parsed as { products: unknown[] }).products)) {
    rawList = (parsed as { products: unknown[] }).products;
  } else {
    return {
      valid: [],
      errors: [{ row: 0, reason: "Le JSON ne contient ni liste de produits, ni propriété 'products'." }],
      warnings: [],
      totalRows: 0,
    };
  }

  const valid: ProductImportItem[] = [];
  const errors: Array<{ row: number; name?: string; reason: string }> = [];
  const warnings: string[] = [];

  rawList.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push({ row: index + 1, reason: "L'élément n'est pas un objet produit valide." });
      return;
    }

    const p = item as Record<string, unknown>;
    const name = cleanStr(p.name || p.nom);
    if (!name) {
      errors.push({ row: index + 1, reason: 'Nom du produit manquant ou vide.' });
      return;
    }

    const price = parseNumeric(p.price || p.prix, -1);
    if (price < 0) {
      errors.push({ row: index + 1, name, reason: `Prix manquant ou invalide: ${p.price || p.prix}` });
      return;
    }

    const origPrice = parseNumeric(p.originalPrice || p.original_price || p.prix_original, null as unknown as number);
    const stock = Math.max(0, Math.round(parseNumeric(p.stock || p.quantite, 0)));
    const category = cleanStr(p.category || p.categorie) || 'Général';
    const mainCategory = cleanStr(p.mainCategory || p.main_category || p.categorie_principale) || 'Divers';
    const unit = cleanStr(p.unit || p.unite) || 'pièce';
    const rawType = cleanStr(p.businessType || p.business_type).toLowerCase();
    const businessType: BusinessVertical = rawType === 'food' || rawType === 'resto' ? 'food' : 'shopping';
    const isOnline = parseBool(p.isOnline !== undefined ? p.isOnline : p.is_online, true);
    const description = cleanStr(p.description);
    const deliveryTime = cleanStr(p.deliveryTime || p.delivery_time);
    const preparationTime = cleanStr(p.preparationTime || p.preparation_time);

    const wholesalePrice = parseNumeric(p.wholesalePrice || p.wholesale_price, null as unknown as number);
    const wholesaleMinQty = p.wholesaleMinQty || p.wholesale_min_qty ? Math.max(1, Math.round(parseNumeric(p.wholesaleMinQty || p.wholesale_min_qty, 1))) : null;
    const wholesaleTiers = parseWholesaleTiers(p.wholesaleTiers || p.wholesale_tiers);

    const image = cleanStr(p.image || p.image_url);
    const images = parseImagesArray(p.images || p.images_urls);
    if (image && !images.includes(image)) {
      images.unshift(image);
    }

    const options = normalizeOptions(p.options);
    const variants = normalizeVariants(p.variants, options);

    valid.push({
      name,
      price,
      originalPrice: origPrice && origPrice > 0 ? origPrice : null,
      stock,
      category,
      mainCategory,
      unit,
      businessType,
      isOnline,
      description,
      deliveryTime,
      preparationTime,
      wholesalePrice: wholesalePrice && wholesalePrice > 0 ? wholesalePrice : null,
      wholesaleMinQty,
      wholesaleTiers,
      image: image || (images[0] ?? ''),
      images,
      options,
      variants,
    });
  });

  return {
    valid,
    errors,
    warnings,
    totalRows: rawList.length,
  };
}

/**
 * Génère un modèle CSV vierge avec en-têtes
 */
export function generateCSVTemplate(_businessType: BusinessVertical = 'shopping'): string {
  const delim = ';';
  const headers = [
    'Nom',
    'Prix',
    'Prix_Barre',
    'Stock',
    'Categorie',
    'Categorie_Principale',
    'Unite',
    'Flux',
    'En_Ligne',
    'Description',
    'Delai_Livraison',
    'Delai_Preparation',
    'Prix_Gros',
    'Qte_Min_Gros',
    'Paliers_Gros_JSON',
    'Image_Principale',
    'Images_Galerie_JSON',
    'Options_JSON',
    'Variantes_JSON',
  ];

  return '\uFEFF' + headers.join(delim) + '\r\n';
}

/**
 * Génère un exemple CSV complet avec données types pour test immédiat
 */
export function generateCSVExample(businessType: BusinessVertical = 'shopping'): string {
  const delim = ';';
  const headers = [
    'Nom',
    'Prix',
    'Prix_Barre',
    'Stock',
    'Categorie',
    'Categorie_Principale',
    'Unite',
    'Flux',
    'En_Ligne',
    'Description',
    'Delai_Livraison',
    'Delai_Preparation',
    'Prix_Gros',
    'Qte_Min_Gros',
    'Paliers_Gros_JSON',
    'Image_Principale',
    'Images_Galerie_JSON',
    'Options_JSON',
    'Variantes_JSON',
  ];

  const rows: string[] = [headers.join(delim)];

  if (businessType === 'food') {
    rows.push(
      [
        'Thieboudienne Penda Mbaye Royal',
        '3500',
        '4000',
        '25',
        'Plats Traditionnels',
        'Restauration & Livraison Rapide',
        'plat',
        'food',
        'OUI',
        'Riz rouge au poisson frais, légumes du terroir, nététou et piment.',
        '30 min',
        '15 min',
        '',
        '',
        '',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
        '["https://images.unsplash.com/photo-1546069901-ba9599a7e63c"]',
        '[{"id":"opt1","name":"Portion","values":["Normale","Grande"]}]',
        '[{"id":"v1","name":"Normale","optionValues":{"opt1":"Normale"},"price":3500,"stock":15},{"id":"v2","name":"Grande","optionValues":{"opt1":"Grande"},"price":4500,"stock":10}]',
      ].map((c) => escapeCsvCell(c, delim)).join(delim)
    );
    rows.push(
      [
        'Jus de Bissap Maison Menthe 50cl',
        '1000',
        '',
        '50',
        'Boissons',
        'Restauration & Livraison Rapide',
        'bouteille',
        'food',
        'OUI',
        'Infusion fraîche de fleurs d\'hibiscus avec une touche de menthe fraîche.',
        '20 min',
        '5 min',
        '800',
        '10',
        '[{"minQty":10,"price":800},{"minQty":25,"price":700}]',
        'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd',
        '',
        '',
        '',
      ].map((c) => escapeCsvCell(c, delim)).join(delim)
    );
  } else {
    rows.push(
      [
        'Robe Soie Wax Élégance',
        '18500',
        '22000',
        '20',
        'Robes',
        'Mode & Vêtements',
        'pièce',
        'shopping',
        'OUI',
        'Robe longue en soie ornée de motifs Wax raffinés, coupe moderne et fluide.',
        '24h - 48h',
        '',
        '15000',
        '5',
        '[{"minQty":5,"price":15000},{"minQty":12,"price":13500}]',
        'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446',
        '["https://images.unsplash.com/photo-1515372039744-b8f02a3ae446"]',
        '[{"id":"opt1","name":"Taille","values":["M","L","XL"]},{"id":"opt2","name":"Couleur","values":["Bleu","Orange"]}]',
        '[{"id":"v1","name":"Bleu / M","optionValues":{"opt1":"M","opt2":"Bleu"},"price":18500,"stock":5,"sku":"ROBE-BL-M"},{"id":"v2","name":"Orange / L","optionValues":{"opt1":"L","opt2":"Orange"},"price":18500,"stock":10,"sku":"ROBE-OR-L"}]',
      ].map((c) => escapeCsvCell(c, delim)).join(delim)
    );
    rows.push(
      [
        'Sac à Main Cuir Dakar Artisanal',
        '25000',
        '30000',
        '12',
        'Accessoires',
        'Mode & Vêtements',
        'pièce',
        'shopping',
        'OUI',
        'Cuir véritable tanné localement avec finitions soignées en laiton doré.',
        '24h - 48h',
        '',
        '20000',
        '3',
        '',
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3',
        '',
        '',
        '',
      ].map((c) => escapeCsvCell(c, delim)).join(delim)
    );
  }

  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Déclenche le téléchargement d'un fichier texte/CSV/JSON dans le navigateur
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
