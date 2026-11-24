import { convertFileSrc } from '@tauri-apps/api/core';
import { appDataDir, BaseDirectory, join } from '@tauri-apps/api/path';
import { mkdir, readFile, remove as removeFile, writeFile } from '@tauri-apps/plugin-fs';
import type { PhotoStore } from './photo-store';
import { readExternalPhoto, validateImageFiles } from './photo-store';

const photoDirectory = 'ropero-virtual/photos';
const referencePrefix = 'app-photo://';

function extensionFor(mimeType: string): string {
  const subtype = mimeType.split('/')[1]?.toLowerCase();
  if (subtype === 'jpeg') return 'jpg';
  if (subtype === 'png' || subtype === 'webp' || subtype === 'gif') return subtype;
  return 'img';
}

function fileNameFrom(reference: string): string {
  if (!reference.startsWith(referencePrefix)) {
    throw new Error('La referencia de foto no pertenece al ropero.');
  }

  const fileName = reference.slice(referencePrefix.length);
  if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    throw new Error('La referencia de foto no es segura.');
  }
  return fileName;
}

function mimeTypeFrom(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  return 'image/png';
}

async function saveBlob(blob: Blob): Promise<string> {
  if (!blob.type.startsWith('image/')) throw new Error('El recurso no es una imagen.');
  await mkdir(photoDirectory, { baseDir: BaseDirectory.AppData, recursive: true });
  const fileName = `${crypto.randomUUID()}.${extensionFor(blob.type)}`;
  await writeFile(
    `${photoDirectory}/${fileName}`,
    new Uint8Array(await blob.arrayBuffer()),
    { baseDir: BaseDirectory.AppData },
  );
  return `${referencePrefix}${fileName}`;
}

export function createTauriPhotoStore(): PhotoStore {
  return {
    async saveFiles(files) {
      validateImageFiles(files);
      if (files.length === 0) return [];

      await mkdir(photoDirectory, { baseDir: BaseDirectory.AppData, recursive: true });
      const references: string[] = [];
      for (const file of files) {
        references.push(await saveBlob(file));
      }
      return references;
    },
    async saveBlob(blob) {
      return saveBlob(blob);
    },
    async readBlob(reference) {
      if (!reference.startsWith(referencePrefix)) return readExternalPhoto(reference);
      const fileName = fileNameFrom(reference);
      const bytes = await readFile(`${photoDirectory}/${fileName}`, { baseDir: BaseDirectory.AppData });
      return new Blob([bytes], { type: mimeTypeFrom(fileName) });
    },
    async remove(reference) {
      if (!reference.startsWith(referencePrefix)) return;
      await removeFile(`${photoDirectory}/${fileNameFrom(reference)}`, { baseDir: BaseDirectory.AppData });
    },
    async resolveUrl(reference) {
      if (!reference.startsWith(referencePrefix)) return reference;
      const fullPath = await join(await appDataDir(), photoDirectory, fileNameFrom(reference));
      return convertFileSrc(fullPath);
    },
  };
}
