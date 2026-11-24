import {
  normalizeSavedState,
  schemaVersion,
  type AppStateStore,
  type SavedState,
} from './app-state-store';
import type { AppStorage } from './create-app-storage';
import {
  readExternalPhoto,
  type PhotoStore,
  validateImageFiles,
} from './photo-store';

const databaseVersion = 1;
const stateStoreName = 'state';
const photoStoreName = 'photos';
const currentStateKey = 'current';
const photoReferencePrefix = 'idb-photo://';

interface StoredStateEnvelope {
  schemaVersion: number;
  state: SavedState;
}

interface StoredPhoto {
  blob: Blob;
  fileName: string;
  createdAt: string;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB rechazó la operación.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo guardar en IndexedDB.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB canceló la operación.'));
  });
}

function openDatabase(databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(stateStoreName)) database.createObjectStore(stateStoreName);
      if (!database.objectStoreNames.contains(photoStoreName)) database.createObjectStore(photoStoreName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB no está disponible.'));
  });
}

function photoIdFrom(reference: string): string {
  if (!reference.startsWith(photoReferencePrefix)) {
    throw new Error('La referencia de foto no pertenece a IndexedDB.');
  }
  const id = reference.slice(photoReferencePrefix.length);
  if (!id || id.includes('/') || id.includes('\\') || id.includes('..')) {
    throw new Error('La referencia de foto no es segura.');
  }
  return id;
}

export async function createIndexedDbStorage(
  databaseName = 'ropero-virtual',
): Promise<AppStorage> {
  const database = await openDatabase(databaseName);
  const objectUrls = new Map<string, string>();

  const stateStore: AppStateStore = {
    async load(legacyFallback) {
      const transaction = database.transaction(stateStoreName, 'readonly');
      const envelope = await requestResult(
        transaction.objectStore(stateStoreName).get(currentStateKey),
      ) as StoredStateEnvelope | undefined;
      await transactionDone(transaction);

      if (!envelope) {
        await stateStore.save(legacyFallback);
        return { state: legacyFallback, source: 'legacy', warning: null };
      }

      return {
        state: normalizeSavedState(envelope.state),
        source: 'primary',
        warning: envelope.schemaVersion === schemaVersion
          ? null
          : 'El ropero usa una versión de datos distinta; se cargaron los campos compatibles.',
      };
    },
    async save(state) {
      const transaction = database.transaction(stateStoreName, 'readwrite');
      transaction.objectStore(stateStoreName).put({ schemaVersion, state }, currentStateKey);
      await transactionDone(transaction);
    },
  };

  const photoStore: PhotoStore = {
    async saveFiles(files) {
      validateImageFiles(files);
      return Promise.all(files.map((file) => photoStore.saveBlob(file, file.name)));
    },
    async saveBlob(blob, fileName) {
      if (!blob.type.startsWith('image/')) throw new Error('El recurso no es una imagen.');
      const id = crypto.randomUUID();
      const transaction = database.transaction(photoStoreName, 'readwrite');
      const stored: StoredPhoto = { blob, fileName, createdAt: new Date().toISOString() };
      transaction.objectStore(photoStoreName).put(stored, id);
      await transactionDone(transaction);
      return `${photoReferencePrefix}${id}`;
    },
    async readBlob(reference) {
      if (!reference.startsWith(photoReferencePrefix)) return readExternalPhoto(reference);
      const transaction = database.transaction(photoStoreName, 'readonly');
      const stored = await requestResult(
        transaction.objectStore(photoStoreName).get(photoIdFrom(reference)),
      ) as StoredPhoto | undefined;
      await transactionDone(transaction);
      if (!stored) throw new Error('La fotografía guardada no existe.');
      return stored.blob;
    },
    async remove(reference) {
      if (!reference.startsWith(photoReferencePrefix)) return;
      const transaction = database.transaction(photoStoreName, 'readwrite');
      transaction.objectStore(photoStoreName).delete(photoIdFrom(reference));
      await transactionDone(transaction);
      const objectUrl = objectUrls.get(reference);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrls.delete(reference);
    },
    async resolveUrl(reference) {
      if (!reference.startsWith(photoReferencePrefix)) return reference;
      const cached = objectUrls.get(reference);
      if (cached) return cached;
      const objectUrl = URL.createObjectURL(await photoStore.readBlob(reference));
      objectUrls.set(reference, objectUrl);
      return objectUrl;
    },
  };

  return { stateStore, photoStore, initializationWarning: null };
}
