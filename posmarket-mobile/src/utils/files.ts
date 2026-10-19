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
