import { isTauri } from '@tauri-apps/api/core';

export interface PwaCallbacks {
  onOfflineReady(): void;
  onNeedRefresh(): void;
  onRegisterError?(error: unknown): void;
}

interface RegisterOptions extends PwaCallbacks {
  immediate: boolean;
  onRegisterError(error: unknown): void;
}

export type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;
export type ServiceWorkerRegistrar = (options: RegisterOptions) => UpdateServiceWorker;

export async function registerRoperoServiceWorker(
  callbacks: PwaCallbacks,
  injectedRegistrar?: ServiceWorkerRegistrar,
): Promise<UpdateServiceWorker | null> {
  if (isTauri()) return null;

  const registrar = injectedRegistrar
    ?? (await import('virtual:pwa-register')).registerSW as ServiceWorkerRegistrar;

  return registrar({
    immediate: true,
    onOfflineReady: callbacks.onOfflineReady,
    onNeedRefresh: callbacks.onNeedRefresh,
    onRegisterError: callbacks.onRegisterError ?? ((error) => {
      console.error('No se pudo registrar el modo offline.', error);
    }),
  });
}
