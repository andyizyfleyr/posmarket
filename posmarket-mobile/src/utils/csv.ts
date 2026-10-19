/**
 * Aides CSV — mêmes règles que le web (`generateProductsCSV`, modèle
 * d'import/export) : séparateur « ; », guillemets doublés, BOM à l'export.
 */

/** Cellule CSV : entoure de guillemets si elle contient un séparateur. */
export function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Détecte le séparateur dominant (point-virgule ou virgule). */
export function detectDelimiter(text: string): ';' | ',' {
  const firstLine = text.replace(/^\ufeff/, '').split(/\r?\n/)[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas ? ';' : ',';
}

/**
 * Parse un CSV (guillemets, retours ligne dans les cellules) et renvoie les
 * lignes de cellules. Les lignes vides sont ignorées.
 */
export function parseDelimited(text: string, delimiter: ';' | ','): string[][] {
  const source = text.replace(/^\ufeff/, '');
  const rows: string[][] = [];
  let cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      cells.push(current.trim());
      current = '';
    } else if (char === '\n') {
      cells.push(current.trim());
      rows.push(cells);
      cells = [];
      current = '';
    } else if (char === '\r') {
      // ignoré
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  rows.push(cells);

  return rows.filter((row) => row.some((cell) => cell !== ''));
}

/** Assemble des lignes de cellules en un document CSV (séparateur « ; »). */
export function buildCsv(rows: Array<Array<unknown>>, withBom = true): string {
  const body = rows.map((line) => line.map(csvCell).join(';')).join('\n');
  return (withBom ? '\ufeff' : '') + body;
}
