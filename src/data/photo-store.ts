export interface PhotoStore {
  saveFiles(files: File[]): Promise<string[]>;
  saveBlob(blob: Blob, fileName: string): Promise<string>;
  readBlob(reference: string): Promise<Blob>;
  remove(reference: string): Promise<void>;
  resolveUrl(reference: string): Promise<string>;
}

export function validateImageFiles(files: File[]): void {
  const invalid = files.find((file) => !file.type.startsWith('image/'));
  if (invalid) {
    throw new Error(`El archivo ${invalid.name} no es una imagen.`);
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(reference: string): Blob {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(reference);
  if (!match) throw new Error('La referencia de foto no tiene un formato compatible.');
  const binary = atob(match[2]);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: match[1] });
}

export async function readExternalPhoto(reference: string): Promise<Blob> {
  if (reference.startsWith('data:')) return dataUrlToBlob(reference);
  const response = await fetch(reference);
  if (!response.ok) throw new Error('No se pudo leer la fotografía.');
  return response.blob();
}

export function createWebPhotoStore(): PhotoStore {
  return {
    async saveFiles(files) {
      validateImageFiles(files);
      return Promise.all(files.map(blobToDataUrl));
    },
    async saveBlob(blob) {
      if (!blob.type.startsWith('image/')) throw new Error('El recurso no es una imagen.');
      return blobToDataUrl(blob);
    },
    async readBlob(reference) {
      return readExternalPhoto(reference);
    },
    async remove() {
      // Data URLs belong to the state snapshot and have no separate file to remove.
    },
    async resolveUrl(reference) {
      return reference;
    },
  };
}
