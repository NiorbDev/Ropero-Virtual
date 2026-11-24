import {
  createU2NetImageProcessor,
  createU2NetModelInputs,
  extractU2NetMask,
  type U2NetOutputTensor,
} from '../services/u2net-image-processor';
import { refineGarmentMask } from '../services/refine-garment-mask';

interface RemoveRequest {
  type: 'remove';
  requestId: string;
  buffer: ArrayBuffer;
  mimeType: string;
}

interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<RemoveRequest>) => void): void;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

interface ProcessedImage {
  pixel_values: unknown;
}

type SegmentationOutput = Record<string, U2NetOutputTensor | undefined>;

interface RuntimeImage {
  width: number;
  height: number;
  rgba(): RuntimeImage;
  putAlpha(mask: RuntimeImage): RuntimeImage;
  resize(width: number, height: number): Promise<RuntimeImage>;
  toBlob(type?: string): Promise<Blob>;
}

interface RuntimeImageConstructor {
  new(data: Uint8Array | Uint8ClampedArray, width: number, height: number, channels: 1): RuntimeImage;
  read(input: Blob): Promise<RuntimeImage>;
}

interface RemovalResources {
  processor: (image: RuntimeImage) => Promise<ProcessedImage>;
  model: (inputs: { 'input.1': unknown }) => Promise<SegmentationOutput>;
  RawImage: RuntimeImageConstructor;
}

interface ModelProgress {
  status?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

const MODEL_ID = 'BritishWerewolf/U-2-Netp';
const scope = self as unknown as WorkerScope;
const loadingListeners = new Set<(value: number) => void>();
let resourcesPromise: Promise<RemovalResources> | null = null;

function notifyLoading(value: number): void {
  const normalized = Math.min(1, Math.max(0, value));
  for (const listener of loadingListeners) listener(normalized);
}

function modelProgress(event: ModelProgress): number | null {
  if (typeof event.progress === 'number') return event.progress > 1 ? event.progress / 100 : event.progress;
  if (typeof event.loaded === 'number' && typeof event.total === 'number' && event.total > 0) {
    return event.loaded / event.total;
  }
  return null;
}

async function loadResources(): Promise<RemovalResources> {
  const runtime = await import('@huggingface/transformers');
  runtime.env.useBrowserCache = true;
  runtime.env.allowRemoteModels = true;
  const options = {
    progress_callback: (event: ModelProgress) => {
      const value = modelProgress(event);
      if (value !== null) notifyLoading(value);
    },
  };
  const processor = createU2NetImageProcessor(runtime);
  const model = await runtime.AutoModel.from_pretrained(MODEL_ID, { ...options, dtype: 'fp32' });
  notifyLoading(1);
  return {
    processor: processor as unknown as RemovalResources['processor'],
    model: model as unknown as RemovalResources['model'],
    RawImage: runtime.RawImage as unknown as RuntimeImageConstructor,
  };
}

async function resources(onProgress: (value: number) => void): Promise<RemovalResources> {
  loadingListeners.add(onProgress);
  if (!resourcesPromise) {
    resourcesPromise = loadResources().catch((error) => {
      resourcesPromise = null;
      throw error;
    });
  }
  try {
    return await resourcesPromise;
  } finally {
    loadingListeners.delete(onProgress);
  }
}

function progress(requestId: string, value: number): void {
  scope.postMessage({ type: 'progress', requestId, value });
}

function friendlyError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (/fetch|network|download|offline|internet/i.test(message)) {
    return 'No se pudo descargar el modelo de recorte. Conéctate a internet una vez y vuelve a intentarlo.';
  }
  return message || 'No fue posible quitar el fondo de esta fotografía.';
}

async function removeBackground(request: RemoveRequest): Promise<void> {
  try {
    progress(request.requestId, 0.02);
    const loaded = await resources((value) => progress(request.requestId, 0.05 + value * 0.55));
    progress(request.requestId, 0.64);
    const image = await loaded.RawImage.read(new Blob([request.buffer], { type: request.mimeType }));
    const processed = await loaded.processor(image);
    progress(request.requestId, 0.74);
    const output = await loaded.model(createU2NetModelInputs(processed.pixel_values));
    const extractedMask = refineGarmentMask(extractU2NetMask(output));
    const mask = new loaded.RawImage(extractedMask.data, extractedMask.width, extractedMask.height, 1);
    const resizedMask = await mask.resize(image.width, image.height);
    progress(request.requestId, 0.9);
    const cutout = image.rgba().putAlpha(resizedMask);
    const blob = await cutout.toBlob('image/png');
    const buffer = await blob.arrayBuffer();
    progress(request.requestId, 1);
    scope.postMessage({ type: 'result', requestId: request.requestId, buffer, mimeType: 'image/png' }, [buffer]);
  } catch (reason) {
    scope.postMessage({ type: 'error', requestId: request.requestId, message: friendlyError(reason) });
  }
}

scope.addEventListener('message', (event) => {
  if (event.data?.type === 'remove') void removeBackground(event.data);
});
