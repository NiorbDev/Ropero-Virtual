import { isTauri } from '@tauri-apps/api/core';
import {
  createLocalStorageStateStore,
  type AppStateStore,
} from './app-state-store';
import { createIndexedDbStorage } from './indexeddb-storage';
import {
  createWebPhotoStore,
  type PhotoStore,
} from './photo-store';
import { createTauriPhotoStore } from './tauri-photo-store';
import { createTauriStateStore } from './tauri-state-store';

export interface AppStorage {
  stateStore: AppStateStore;
  photoStore: PhotoStore;
  initializationWarning: string | null;
}

export interface AppStorageDependencies {
  isTauri(): boolean;
  createLocalStateStore(): AppStateStore;
  createWebPhotoStore(): PhotoStore;
  createIndexedDbStorage(): Promise<AppStorage>;
  createTauriPhotoStore(): PhotoStore;
  createTauriStateStore(photoStore: PhotoStore): Promise<AppStateStore>;
}

const defaultDependencies: AppStorageDependencies = {
  isTauri,
  createLocalStateStore: createLocalStorageStateStore,
  createWebPhotoStore,
  createIndexedDbStorage,
  createTauriPhotoStore,
  createTauriStateStore,
};

async function createBrowserStorage(dependencies: AppStorageDependencies): Promise<AppStorage> {
  try {
    return await dependencies.createIndexedDbStorage();
  } catch {
    return {
      stateStore: dependencies.createLocalStateStore(),
      photoStore: dependencies.createWebPhotoStore(),
      initializationWarning: 'IndexedDB no está disponible; el ropero usa almacenamiento local de compatibilidad.',
    };
  }
}

export async function createAppStorage(
  dependencies: AppStorageDependencies = defaultDependencies,
): Promise<AppStorage> {
  if (!dependencies.isTauri()) return createBrowserStorage(dependencies);

  try {
    const photoStore = dependencies.createTauriPhotoStore();
    return {
      stateStore: await dependencies.createTauriStateStore(photoStore),
      photoStore,
      initializationWarning: null,
    };
  } catch {
    const browserStorage = await createBrowserStorage(dependencies);
    return {
      ...browserStorage,
      initializationWarning: 'No se pudo iniciar SQLite; el ropero seguirá funcionando en modo local.',
    };
  }
}
