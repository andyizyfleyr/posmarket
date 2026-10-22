/**
 * Mise en forme automatique de la description produit — portage fidèle de
 * src/utils/product-description.ts (web) : regroupement en paragraphes,
 * détection des puces / listes numérotées, des titres de sections (lignes en
 * MAJUSCULES) et des lignes "Libellé : valeur".
 */

export type DescriptionBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'label'; label: string; value: string };

const BULLET_RE = /^\s*[-*•–—‣⁃]\s+/;
const ORDERED_RE = /^\s*\d{1,2}[.)]\s+/;
const LABEL_RE = /^\s*([^:：\n]{2,56})\s*[:：]\s*(.+)$/;

function isHeadingLine(line: string): boolean {
  if (line.length < 3 || line.length > 72) return false;
  if (!/[A-ZÀ-ÖØ-Þ]/.test(line)) return false;
  if (line !== line.toUpperCase()) return false;
  if (LABEL_RE.test(line)) return false;
  const letters = line.match(/[A-Za-zÀ-ÿ]/g);
  return !!letters && letters.length >= 3;
}

function isLabelLine(label: string): boolean {
  const clean = label.trim();
  if (clean.length < 2 || clean.length > 40) return false;
  if (/[.!?…]$/.test(clean)) return false;
  if (clean.includes('.')) return false;
  return true;
}

function countSentences(text: string): number {
  const m = text.match(/[.!?…]/g);
  return m ? m.length : 0;
}

function chunkWords(text: string, max = 240): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && cur.length + 1 + w.length > max) {
      out.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function splitIntoParagraphs(text: string): string[] {
  if (!text) return [];
  if (text.length <= 240) return [text];

  const sentences = text.match(/[^.!?…]+[.!?…]+["»”']?\s*|[^.!?…]+$/g) || [text];
  const cleaned = sentences.map((s) => s.trim()).filter(Boolean);

  const out: string[] = [];
  let cur = '';
  for (const s of cleaned) {
    if (cur && (cur.length + s.length + 1 > 260 || countSentences(cur) >= 3)) {
      out.push(cur);
      cur = s;
    } else {
      cur = cur ? `${cur} ${s}` : s;
    }
  }
  if (cur) out.push(cur);

  const final: string[] = [];
  for (const p of out) {
    if (p.length > 420) final.push(...chunkWords(p, 260));
    else final.push(p);
  }
  return final;
}

export function parseDescription(raw?: string | null): DescriptionBlock[] {
  const text = (raw || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (!text) return [];

  const lines = text.split('\n').map((l) => l.trim());
  const blocks: DescriptionBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i += 1;
      continue;
    }

    if (BULLET_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET_RE.test(lines[i])) {
        items.push(lines[i].replace(BULLET_RE, '').trim());
        i += 1;
      }
      const clean = items.filter(Boolean);
      if (clean.length) blocks.push({ type: 'list', ordered: false, items: clean });
      continue;
    }

    if (ORDERED_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && ORDERED_RE.test(lines[i])) {
        items.push(lines[i].replace(ORDERED_RE, '').trim());
        i += 1;
      }
      const clean = items.filter(Boolean);
      if (clean.length) blocks.push({ type: 'list', ordered: true, items: clean });
      continue;
    }

    if (isHeadingLine(line)) {
      blocks.push({ type: 'heading', text: line.replace(/[:\s]+$/, '') });
      i += 1;
      continue;
    }

    const lm = line.match(LABEL_RE);
    if (lm && isLabelLine(lm[1])) {
      blocks.push({ type: 'label', label: lm[1].trim(), value: lm[2].trim() });
      i += 1;
      continue;
    }

    const buf: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i]) {
      const next = lines[i];
      if (BULLET_RE.test(next) || ORDERED_RE.test(next) || isHeadingLine(next) || next.match(LABEL_RE)) {
        break;
      }
      buf.push(next);
      i += 1;
    }

    const joined = buf.join(' ').replace(/\s+/g, ' ').trim();
    if (joined) {
      for (const p of splitIntoParagraphs(joined)) {
        blocks.push({ type: 'paragraph', text: p });
      }
    }
  }

  return blocks;
}

/** Points forts auto-extraits du texte de description. */
const SECTION_WORDS = new Set([
  'DESCRIPTION',
  'CARACTÉRISTIQUES',
  'CARACTERISTIQUES',
  'DÉTAILS',
  'DETAILS',
  'INFORMATIONS',
  'UTILISATION',
  'ENTRETIEN',
  'AVANTAGES',
  'CONTENU',
  'PRÉSENTATION',
  'PRESENTATION',
  'AVIS',
  'COMMANDE',
]);

export function extractDescriptionHighlights(raw?: string | null, max = 6): string[] {
  const text = (raw || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (!text) return [];

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (rawItem: string) => {
    const v = rawItem.replace(/\s+/g, ' ').trim();
    if (!v || v.length < 6 || v.length > 110) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    if (SECTION_WORDS.has(v.toUpperCase())) return;
    seen.add(key);
    out.push(v);
  };

  for (const line of lines) {
    if (BULLET_RE.test(line)) {
      push(line.replace(BULLET_RE, ''));
      continue;
    }
    if (ORDERED_RE.test(line)) {
      push(line.replace(ORDERED_RE, ''));
      continue;
    }
    const lm = line.match(LABEL_RE);
    if (lm && isLabelLine(lm[1])) {
      push(`${lm[1].trim()} : ${lm[2].trim()}`);
      continue;
    }
    if (isHeadingLine(line)) {
      push(line.replace(/[:\s]+$/, ''));
    }
  }

  return out.slice(0, max);
}
