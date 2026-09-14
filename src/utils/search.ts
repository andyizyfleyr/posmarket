/**
 * Search utility helpers — accent-insensitive highlight + normalization
 */

/**
 * Normalize a string for accent-insensitive comparison (client-side mirror of
 * the server's immutable_unaccent function).
 */
export function normalizeSearchTerm(str: string): string {
  return str
    .normalize('NFD')                        // decompose accented chars
    .replace(/[\u0300-\u036f]/g, '')         // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

type HighlightSegment = { text: string; highlight: boolean };

/**
 * Split `text` into segments where portions matching `query` are flagged
 * for highlighting. Accent- and case-insensitive.
 *
 * @example
 * highlightSegments("Café Écharpe", "echarpe")
 * // → [{ text: "Café ", highlight: false }, { text: "Écharpe", highlight: true }]
 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  if (!query || !text) return [{ text, highlight: false }];

  const normText  = normalizeSearchTerm(text);
  const normQuery = normalizeSearchTerm(query);

  if (!normQuery) return [{ text, highlight: false }];

  const segments: HighlightSegment[] = [];
  let origIdx = 0;    // cursor in original text
  let normIdx = 0;    // cursor in normalized text

  // Build a mapping: normIdx → origIdx (skipping diacritics that were removed)
  // We walk both strings char by char using normalize so positions align
  const normToOrig: number[] = [];
  {
    const decomposed = text.normalize('NFD');
    let di = 0; // index in decomposed
    let oi = 0; // index in original text (code points)
    const origCodePoints = [...text];
    const origLengths: number[] = origCodePoints.map(c => c.length);
    let cumOrig = 0;

    for (let ci = 0; ci < decomposed.length; ci++) {
      const ch = decomposed[ci];
      const isCombining = ch >= '\u0300' && ch <= '\u036f';
      if (!isCombining) {
        normToOrig.push(cumOrig);
      }
      // Advance original pointer when we've consumed all bytes of a char
      while (oi < origCodePoints.length && cumOrig + origLengths[oi] <= decomposed.slice(0, ci + 1).normalize('NFC').length) {
        cumOrig += origLengths[oi];
        oi++;
      }
    }
  }

  // Simple approach: find all occurrences in normalized text, map back to original
  let searchFrom = 0;
  const queryLen = normQuery.length;

  while (searchFrom <= normText.length) {
    const matchIdx = normText.indexOf(normQuery, searchFrom);
    if (matchIdx === -1) break;

    // Before match
    const origStart = matchIdx < normToOrig.length ? normToOrig[matchIdx] : text.length;
    const matchEndNorm = matchIdx + queryLen;
    const origEnd = matchEndNorm < normToOrig.length ? normToOrig[matchEndNorm] : text.length;

    if (origStart > origIdx) {
      segments.push({ text: text.slice(origIdx, origStart), highlight: false });
    }
    segments.push({ text: text.slice(origStart, origEnd), highlight: true });

    origIdx = origEnd;
    searchFrom = matchEndNorm;
  }

  // Remainder
  if (origIdx < text.length) {
    segments.push({ text: text.slice(origIdx), highlight: false });
  }

  return segments.length > 0 ? segments : [{ text, highlight: false }];
}
