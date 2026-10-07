/**
 * Retire les blocs de code Markdown autour d'un JSON collé à la main ou produit
 * par une IA (```json … ```). `JSON.parse` refuse ce décor, alors que la
 * plupart des assistants le renvoient systématiquement.
 */
export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return text;
  return trimmed
    .replace(/^```[a-zA-Z]*[ \t]*\r?\n?/, '')
    .replace(/\r?\n?```[ \t]*$/, '');
}
