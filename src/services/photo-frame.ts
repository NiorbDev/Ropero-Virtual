import { zlibSync, unzlibSync } from 'fflate';

export interface PhotoFrame {
  x: number;
  y: number;
  angle: number;
  zoom: number;
}

export const defaultPhotoFrame: PhotoFrame = { x: 0, y: 0, angle: 0, zoom: 1 };

const chunkType = new TextEncoder().encode('roPe');

function photoEditChecksum(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Keep the editable mask and framing inside the PNG so backups carry both.
export function attachPhotoEdit(png: Blob, mask: ImageData, frame: PhotoFrame): Blob {
  const alpha = Uint8Array.from({ length: mask.width * mask.height }, (_, index) => mask.data[index * 4 + 3]);
  const compressed = zlibSync(alpha);
  const chunk = new Uint8Array(24 + compressed.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, chunk.length - 12);
  chunk.set(chunkType, 4);
  view.setUint32(8, mask.width);
  view.setUint32(12, mask.height);
  [frame.x, frame.y, frame.angle, frame.zoom].forEach((value, index) => view.setFloat32(16 + index * 4, value));
  chunk.set(compressed, 32);
  view.setUint32(chunk.length - 4, photoEditChecksum(chunk.subarray(4, chunk.length - 4)));
  return new Blob([png.slice(0, -12), chunk, png.slice(-12)], { type: 'image/png' });
}

export async function readPhotoEdit(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length < 20 || bytes[0] !== 137 || bytes[1] !== 80) return null;
  const view = new DataView(bytes.buffer);
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const size = view.getUint32(offset);
    if (offset + size + 12 > bytes.length) return null;
    if (size >= 24 && chunkType.every((value, index) => value === bytes[offset + 4 + index])) {
      const checksum = view.getUint32(offset + 8 + size);
      if (photoEditChecksum(bytes.subarray(offset + 4, offset + 8 + size)) !== checksum) return null;
      const width = view.getUint32(offset + 8);
      const height = view.getUint32(offset + 12);
      if (!width || !height || width > 1024 || height > 1024) return null;
      const [x, y, angle, zoom] = Array.from({ length: 4 }, (_, index) => view.getFloat32(offset + 16 + index * 4));
      if (![x, y, angle, zoom].every(Number.isFinite) || zoom < .5 || zoom > 3) return null;
      try {
        const alpha = unzlibSync(bytes.subarray(offset + 32, offset + 8 + size), { out: new Uint8Array(width * height) });
        if (alpha.length !== width * height) return null;
        const mask = new ImageData(width, height);
        alpha.forEach((value, index) => { mask.data[index * 4 + 3] = value; });
        return { mask, frame: { x, y, angle, zoom } };
      } catch {
        return null;
      }
    }
    offset += size + 12;
  }
  return null;
}

export function framePhoto(context: CanvasRenderingContext2D, image: CanvasImageSource, width: number, height: number, frame: PhotoFrame) {
  context.save();
  context.translate(width * (.5 + frame.x), height * (.5 + frame.y));
  context.rotate(frame.angle * Math.PI / 180);
  context.scale(frame.zoom, frame.zoom);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
}
