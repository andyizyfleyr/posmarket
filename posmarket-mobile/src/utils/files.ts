/**
 * Aides fichiers de l'app mobile : écrire un contenu texte dans le cache puis
 * ouvrir la feuille de partage (remplace le « téléchargement navigateur » du
 * web : le fichier peut être enregistré, envoyé par e-mail, WhatsApp, etc.).
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

export interface PickedFile {
  name: string;
  uri: string;
  content: string;
}

/** Écrit `content` dans le cache et ouvre la feuille de partage. */
export async function shareTextFile(
  filename: string,
  content: string,
  mimeType: string,
  dialogTitle?: string,
): Promise<boolean> {
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType, dialogTitle, UTI: mimeType });
  return true;
}

/** Ouvre le sélecteur de fichier et lit le contenu texte du fichier choisi. */
export async function pickTextFile(options?: {
  mimeTypes?: string[];
  base64?: boolean;
}): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: options?.mimeTypes ?? ['text/csv', 'application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  const asset = result.assets[0];
  const content = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: options?.base64 ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8,
  });
  return { name: asset.name || 'fichier', uri: asset.uri, content };
}

/**
 * Télécharge un fichier binaire dans le cache puis ouvre la feuille de partage.
 * Renvoie le statut HTTP en cas d'échec, avec le corps de la réponse (les
 * routes API renvoient un JSON `{ success, error }` explicite).
 */
export async function downloadAndShareFile(
  url: string,
  filename: string,
  headers: Record<string, string>,
  options?: {
    mimeType?: string;
    dialogTitle?: string;
    /**
     * Type MIME attendu. Les routes vendeur répondent 200 avec un JSON
     * `{ success: false, error: 'Unauthorized' }` quand la session a expiré :
     * sans ce contrôle, l'application partagerait ce JSON comme une archive.
     */
    expectedMimeType?: string;
  },
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const uri = `${FileSystem.cacheDirectory}${filename}`;

  const result = await FileSystem.downloadAsync(url, uri, { headers });
  if (result.status < 200 || result.status >= 300) {
    const body = await FileSystem.readAsStringAsync(result.uri).catch(() => '');
    await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
    return { ok: false, status: result.status, body };
  }

  const responseType = (
    result.mimeType ||
    result.headers?.['content-type'] ||
    result.headers?.['Content-Type'] ||
    ''
  ).toLowerCase();
  if (options?.expectedMimeType && !responseType.includes(options.expectedMimeType)) {
    const body = await FileSystem.readAsStringAsync(result.uri).catch(() => '');
    await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
    return { ok: false, status: result.status, body };
  }

  const info = await FileSystem.getInfoAsync(result.uri);
  if (!info.exists || (info.size ?? 0) === 0) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
    return { ok: false, status: result.status, body: '' };
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: options?.mimeType ?? 'application/octet-stream',
      dialogTitle: options?.dialogTitle,
      UTI: options?.mimeType === 'application/zip' ? 'public.zip-archive' : undefined,
    });
  }

  return { ok: true };
}
