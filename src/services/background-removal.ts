export type BackgroundRemovalProgress = (value: number) => void;

export interface BackgroundRemovalWorker {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message' | 'error', listener: EventListener): void;
  removeEventListener(type: 'message' | 'error', listener: EventListener): void;
  terminate(): void;
}

interface PendingRemoval {
  resolve: (blob: Blob) => void;
  reject: (reason: Error) => void;
  onProgress?: BackgroundRemovalProgress;
}

type WorkerResponse =
  | { type: 'progress'; requestId: string; value: number }
  | { type: 'result'; requestId: string; buffer: ArrayBuffer; mimeType: string }
  | { type: 'error'; requestId: string; message: string };

function requestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `remove-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function defaultWorker(): BackgroundRemovalWorker {
  return new Worker(new URL('../workers/background-removal.worker.ts', import.meta.url), {
    type: 'module',
    name: 'ropero-background-removal',
  });
}

export class BackgroundRemovalService {
  private readonly pending = new Map<string, PendingRemoval>();
  private readonly worker: BackgroundRemovalWorker;

  private readonly handleMessage = ((event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const request = this.pending.get(response.requestId);
    if (!request) return;
    if (response.type === 'progress') {
      request.onProgress?.(Math.min(1, Math.max(0, response.value)));
      return;
    }
    this.pending.delete(response.requestId);
    if (response.type === 'error') {
      request.reject(new Error(response.message));
      return;
    }
    request.onProgress?.(1);
    request.resolve(new Blob([response.buffer], { type: response.mimeType || 'image/png' }));
  }) as EventListener;

  private readonly handleWorkerError = ((event: ErrorEvent) => {
    const error = new Error(event.message || 'El procesador local de imágenes dejó de responder.');
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  }) as EventListener;

  constructor(worker?: BackgroundRemovalWorker) {
    this.worker = worker ?? defaultWorker();
    this.worker.addEventListener('message', this.handleMessage);
    this.worker.addEventListener('error', this.handleWorkerError);
  }

  async remove(blob: Blob, onProgress?: BackgroundRemovalProgress): Promise<Blob> {
    const id = requestId();
    const buffer = await blob.arrayBuffer();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      onProgress?.(0);
      try {
        this.worker.postMessage({
          type: 'remove',
          requestId: id,
          buffer,
          mimeType: blob.type || 'application/octet-stream',
        }, [buffer]);
      } catch (reason) {
        this.pending.delete(id);
        reject(reason instanceof Error ? reason : new Error('No fue posible iniciar el recorte automático.'));
      }
    });
  }

  dispose(): void {
    const error = new Error('El recortador automático fue cerrado.');
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
    this.worker.removeEventListener('message', this.handleMessage);
    this.worker.removeEventListener('error', this.handleWorkerError);
    this.worker.terminate();
  }
}
