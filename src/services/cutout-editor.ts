import { framePhoto, type PhotoFrame } from './photo-frame';

export type MaskStrokeMode = 'erase' | 'restore';

export interface MaskStroke {
  mode: MaskStrokeMode;
  x: number;
  y: number;
  radius: number;
  from?: { x: number; y: number };
}

function makeImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  if (typeof ImageData !== 'undefined') return new ImageData(data, width, height);
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

export function cloneImageData(image: ImageData): ImageData {
  return makeImageData(new Uint8ClampedArray(image.data), image.width, image.height);
}

export function createOpaqueMask(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = 255;
    data[offset + 1] = 255;
    data[offset + 2] = 255;
    data[offset + 3] = 255;
  }
  return makeImageData(data, width, height);
}

export function applyMaskStroke(mask: ImageData, stroke: MaskStroke): ImageData {
  const result = cloneImageData(mask);
  const radius = Math.max(0.5, stroke.radius);
  const from = stroke.from ?? stroke;
  const dx = stroke.x - from.x;
  const dy = stroke.y - from.y;
  const segmentLengthSquared = dx * dx + dy * dy;
  const minX = Math.max(0, Math.floor(Math.min(from.x, stroke.x) - radius));
  const maxX = Math.min(mask.width - 1, Math.ceil(Math.max(from.x, stroke.x) + radius));
  const minY = Math.max(0, Math.floor(Math.min(from.y, stroke.y) - radius));
  const maxY = Math.min(mask.height - 1, Math.ceil(Math.max(from.y, stroke.y) + radius));
  const alpha = stroke.mode === 'erase' ? 0 : 255;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const fraction = segmentLengthSquared
        ? Math.max(0, Math.min(1, ((x - from.x) * dx + (y - from.y) * dy) / segmentLengthSquared))
        : 0;
      const distance = Math.hypot(x - from.x - fraction * dx, y - from.y - fraction * dy);
      if (distance <= radius) result.data[(y * mask.width + x) * 4 + 3] = alpha;
    }
  }
  return result;
}

export function maskFromCutout(cutout: ImageData): ImageData {
  const mask = createOpaqueMask(cutout.width, cutout.height);
  for (let offset = 0; offset < cutout.data.length; offset += 4) {
    mask.data[offset + 3] = cutout.data[offset + 3];
  }
  return mask;
}

export function resizeMask(mask: ImageData, width: number, height: number): ImageData {
  if (mask.width === width && mask.height === height) return cloneImageData(mask);
  const result = createOpaqueMask(width, height);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(mask.height - 1, Math.floor((y / height) * mask.height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(mask.width - 1, Math.floor((x / width) * mask.width));
      const sourceOffset = (sourceY * mask.width + sourceX) * 4;
      const targetOffset = (y * width + x) * 4;
      result.data[targetOffset + 3] = mask.data[sourceOffset + 3];
    }
  }
  return result;
}

export function composeMaskedImageData(original: ImageData, mask: ImageData): ImageData {
  if (original.width !== mask.width || original.height !== mask.height) {
    throw new Error('La máscara debe tener las mismas dimensiones que la foto.');
  }
  const result = cloneImageData(original);
  for (let offset = 0; offset < result.data.length; offset += 4) {
    result.data[offset + 3] = Math.round((original.data[offset + 3] * mask.data[offset + 3]) / 255);
  }
  return result;
}

function imageDataCanvas(image: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Este navegador no permite editar imágenes en un lienzo.');
  context.putImageData(image, 0, 0);
  return canvas;
}

export function createPreviewImageData(original: ImageData, maxDimension = 1024): ImageData {
  const largest = Math.max(original.width, original.height);
  if (largest <= maxDimension) return cloneImageData(original);
  const ratio = maxDimension / largest;
  const width = Math.max(1, Math.round(original.width * ratio));
  const height = Math.max(1, Math.round(original.height * ratio));
  const source = imageDataCanvas(original);
  const preview = document.createElement('canvas');
  preview.width = width;
  preview.height = height;
  const context = preview.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Este navegador no permite crear la vista previa.');
  context.drawImage(source, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

async function loadWithImageElement(blob: Blob): Promise<ImageData> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('No fue posible leer la fotografía.');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadBlobImageData(blob: Blob): Promise<ImageData> {
  if (typeof createImageBitmap !== 'function') return loadWithImageElement(blob);
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('No fue posible leer la fotografía.');
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    bitmap.close();
  }
}

export async function composeCutout(original: ImageData, mask: ImageData, frame?: PhotoFrame): Promise<Blob> {
  const composed = composeMaskedImageData(original, mask);
  let canvas = imageDataCanvas(composed);
  if (frame) {
    const framed = document.createElement('canvas');
    const angle = frame.angle * Math.PI / 180;
    const cosine = Math.abs(Math.cos(angle));
    const sine = Math.abs(Math.sin(angle));
    const width = Math.max(composed.width, (composed.width * cosine + composed.height * sine) * frame.zoom + 2 * Math.abs(frame.x * composed.width));
    const height = Math.max(composed.height, (composed.width * sine + composed.height * cosine) * frame.zoom + 2 * Math.abs(frame.y * composed.height));
    // Keep the transformed photo inside the PNG and cap memory on mobile.
    const scale = Math.min(1, 4096 / Math.max(width, height));
    framed.width = Math.ceil(width * scale);
    framed.height = Math.ceil(height * scale);
    const context = framed.getContext('2d');
    if (!context) throw new Error('No fue posible ajustar la foto.');
    context.translate((framed.width - composed.width * scale) / 2, (framed.height - composed.height * scale) / 2);
    context.imageSmoothingQuality = 'high';
    framePhoto(context, canvas, composed.width * scale, composed.height * scale, frame);
    canvas = framed;
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('No fue posible guardar el recorte como PNG.'));
    }, 'image/png');
  });
}

export function hasMaskSelection(mask: ImageData | null): boolean {
  return mask?.data.some((value, index) => index % 4 === 3 && value !== 0) ?? false;
}

export function intersectGuidedCutout(automatic: ImageData, selection: ImageData, margin: number): ImageData {
  const { width, height } = selection;
  const automaticMask = resizeMask(maskFromCutout(automatic), width, height);
  const horizontal = new Uint8Array(width * height);
  const result = createOpaqueMask(width, height);
  // Dilate in two passes to keep the cost linear even with a wide margin.
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = -margin; x < width; x++) {
      if (x + margin < width && selection.data[(y * width + x + margin) * 4 + 3]) count++;
      if (x - margin - 1 >= 0 && selection.data[(y * width + x - margin - 1) * 4 + 3]) count--;
      if (x >= 0) horizontal[y * width + x] = count > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = -margin; y < height; y++) {
      if (y + margin < height) count += horizontal[(y + margin) * width + x];
      if (y - margin - 1 >= 0) count -= horizontal[(y - margin - 1) * width + x];
      if (y >= 0) {
        const alpha = (y * width + x) * 4 + 3;
        result.data[alpha] = count > 0 ? automaticMask.data[alpha] : 0;
      }
    }
  }
  return result;
}
