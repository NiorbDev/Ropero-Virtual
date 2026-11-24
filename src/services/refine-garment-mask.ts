import type { U2NetMask } from './u2net-image-processor';

export function refineGarmentMask(mask: U2NetMask): U2NetMask {
  const { width, height } = mask;
  const data = new Uint8ClampedArray(mask.data);
  const count = width * height;
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);

  function components(accept: (alpha: number) => boolean, inspect: (size: number, min: number, max: number, mean: number, touchesEdge: boolean) => void) {
    visited.fill(0);
    for (let start = 0; start < count; start++) {
      if (visited[start] || !accept(mask.data[start])) continue;
      let size = 1, min = 255, max = 0, sum = 0, touchesEdge = false;
      queue[0] = start;
      visited[start] = 1;
      for (let head = 0; head < size; head++) {
        const pixel = queue[head], x = pixel % width, y = Math.floor(pixel / width);
        const alpha = mask.data[pixel];
        min = Math.min(min, alpha); max = Math.max(max, alpha); sum += alpha;
        touchesEdge ||= x === 0 || y === 0 || x === width - 1 || y === height - 1;
        // Diagonal connections count as open: otherwise a sleeve gap could be filled.
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, next = ny * width + nx;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height || visited[next] || !accept(mask.data[next])) continue;
          visited[next] = 1;
          queue[size++] = next;
        }
      }
      inspect(size, min, max, sum / size, touchesEdge);
    }
  }

  // Repair only small, enclosed uncertain patches. Near-zero pixels are evidence
  // of real openings (handles, lace, necklines), so those regions stay untouched.
  components(alpha => alpha < 230, (size, min, _max, mean, touchesEdge) => {
    if (touchesEdge || min <= 4 || mean < 64 || size > count * 0.03) return;
    for (let i = 0; i < size; i++) data[queue[i]] = 255;
  });

  // Do not keep only the largest object: pairs of shoes/earrings are valid.
  // Remove just tiny, faint, detached components, never confident small pieces.
  components(alpha => alpha > 4, (size, _min, max) => {
    if (size > Math.max(1, Math.floor(count * 0.0002)) || max >= 128) return;
    for (let i = 0; i < size; i++) data[queue[i]] = 0;
  });
  return { data, width, height };
}
