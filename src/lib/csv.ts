/**
 * Export CSV — échappe correctement les valeurs et encapsule en UTF-8.
 * Séparateur « ; » : Excel français (FR) ouvre directement le fichier sans
 * passer par l'assistant d'import. BOM UTF-8 inclus pour les accents.
 */

/** Échappe une valeur pour une cellule CSV. */
export function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  if (/[",;\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/** Construit un document CSV complet (avec BOM UTF-8). */
export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(escapeCsv).join(';')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(';'));
  }
  return '\uFEFF' + lines.join('\r\n');
}
