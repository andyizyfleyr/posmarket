/**
 * Générateur d'archives ZIP sans dépendance externe.
 *
 * Pourquoi pas `archiver`/`jszip` ? Le serveur doit seulement empaqueter des
 * images déjà compressées (JPEG/WebP/PNG…) : la compression ZIP n'apporte rien
 * et coûterait du CPU. On écrit donc des entrées « stored » (méthode 0), ce qui
 * tient en quelques dizaines de lignes, fonctionne dans le runtime Node de
 * Next.js et n'ajoute aucun paquet au bundle.
 *
 * Le writer est volontairement incrémental : `addFile()` renvoie les octets de
 * l'en-tête local et des données, que la route peut envoyer immédiatement dans
 * un flux (contourne la limite de 4,5 Mo de réponse des fonctions Vercel).
 * `finalize()` produit le répertoire central et l'enregistrement de fin.
 */

/** Table CRC-32 (polynôme 0xEDB88320), construite une seule fois. */
let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  crcTable = table;
  return table;
}

/** CRC-32 d'un bloc d'octets, tel qu'attendu par le format ZIP. */
export function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();

/** Date au format MS-DOS (heure locale, résolution 2 s). */
function toDosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * Normalise un nom de fichier d'archive : ASCII, séparateurs `/`, pas de
 * composant vide ni de `..`. Les noms produits viennent du vendeur — les
 * écrire tels quels dans un ZIP permettrait des chemins inattendus à
 * l'extraction (`../../etc/passwd`).
 */
export function sanitizeZipPath(path: string, maxLength = 180): string {
  const parts = path
    .replace(/\\/g, '/')
    .split('/')
    .map((part) =>
      part
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9._ -]+/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^\.+$/, ''),
    )
    .filter((part) => part.length > 0 && part !== '.' && part !== '..');
  const cleaned = parts.join('/');
  return (cleaned.length > 0 ? cleaned : 'fichier').slice(0, maxLength);
}

export class ZipWriter {
  /** Enregistrements du répertoire central, dans l'ordre d'écriture. */
  private central: Uint8Array[] = [];
  /** Position (en octets) à laquelle commence l'en-tête local courant. */
  private offset = 0;
  private entries = 0;

  get size(): number {
    return this.offset;
  }

  get count(): number {
    return this.entries;
  }

  /**
   * Ajoute un fichier et renvoie les octets à envoyer au client :
   * `[en-tête local, données]`.
   */
  addFile(name: string, data: Uint8Array, modifiedAt = new Date()): Uint8Array[] {
    const path = sanitizeZipPath(name);
    const nameBytes = encoder.encode(path);
    const crc = crc32(data);
    const { time, date } = toDosDateTime(modifiedAt);

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); // signature « local file header »
    localView.setUint16(4, 20, true); // version nécessaire (2.0)
    localView.setUint16(6, 0x0800, true); // bit 11 : noms UTF-8
    localView.setUint16(8, 0, true); // méthode 0 : stored
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true); // taille compressée
    localView.setUint32(22, data.length, true); // taille réelle
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true); // pas de champ « extra »
    local.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true); // signature « central directory »
    centralView.setUint16(4, 20, true); // version d'écriture
    centralView.setUint16(6, 20, true); // version nécessaire
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    // 30–37 : extra, commentaire, disque, attributs internes → 0
    centralView.setUint32(42, this.offset, true); // position de l'en-tête local
    central.set(nameBytes, 46);

    this.central.push(central);
    this.offset += local.length + data.length;
    this.entries += 1;

    return [local, data];
  }

  /** Répertoire central + enregistrement de fin (à envoyer en dernier). */
  finalize(): Uint8Array[] {
    const centralSize = this.central.reduce((total, chunk) => total + chunk.length, 0);
    const end = new Uint8Array(22);
    const view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true); // signature « end of central directory »
    view.setUint16(4, 0, true); // numéro de disque
    view.setUint16(6, 0, true); // disque du répertoire central
    view.setUint16(8, this.entries, true); // entrées de ce disque
    view.setUint16(10, this.entries, true); // entrées au total
    view.setUint32(12, centralSize, true);
    view.setUint32(16, this.offset, true);
    view.setUint16(20, 0, true); // pas de commentaire
    return [...this.central, end];
  }
}

/** Construit une archive complète en mémoire (tests, petits exports). */
export function buildZipArchive(
  files: Array<{ name: string; data: Uint8Array }>,
): Uint8Array {
  const writer = new ZipWriter();
  const chunks: Uint8Array[] = [];
  for (const file of files) chunks.push(...writer.addFile(file.name, file.data));
  chunks.push(...writer.finalize());
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const archive = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    archive.set(chunk, offset);
    offset += chunk.length;
  }
  return archive;
}
