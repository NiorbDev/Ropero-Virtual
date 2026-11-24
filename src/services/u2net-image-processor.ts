export interface U2NetImageProcessorConfig {
  do_convert_rgb: boolean;
  do_normalize: boolean;
  do_pad: boolean;
  do_rescale: boolean;
  do_resize: boolean;
  keep_aspect_ratio: boolean;
  image_mean: number[];
  image_std: number[];
  size: { width: number; height: number };
}

interface ImageProcessorRuntime<TProcessor> {
  ImageProcessor: new (config: U2NetImageProcessorConfig) => TProcessor;
}

const U2NETP_IMAGE_PROCESSOR_CONFIG: U2NetImageProcessorConfig = {
  do_convert_rgb: true,
  do_normalize: true,
  do_pad: false,
  do_rescale: true,
  do_resize: true,
  keep_aspect_ratio: false,
  image_mean: [0.485, 0.456, 0.406],
  image_std: [0.229, 0.224, 0.225],
  // U2Net's reference RescaleT maps the complete photo to 320 × 320.
  // Padding here would also need unpadding the mask before restoring its size.
  size: { width: 320, height: 320 },
};

export function createU2NetImageProcessor<TProcessor>(runtime: ImageProcessorRuntime<TProcessor>): TProcessor {
  return new runtime.ImageProcessor(U2NETP_IMAGE_PROCESSOR_CONFIG);
}

export function createU2NetModelInputs<TPixelValues>(pixelValues: TPixelValues): { 'input.1': TPixelValues } {
  return { 'input.1': pixelValues };
}

export interface U2NetOutputTensor {
  dims: number[];
  data: ArrayLike<number>;
}

export interface U2NetMask {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export function extractU2NetMask(output: Record<string, U2NetOutputTensor | undefined>): U2NetMask {
  const tensor = output['1959'] ?? Object.values(output).find((candidate) => candidate !== undefined);
  if (!tensor || tensor.dims.length < 2) {
    throw new Error('El modelo de recorte no devolvió una máscara válida.');
  }

  const width = tensor.dims[tensor.dims.length - 1];
  const height = tensor.dims[tensor.dims.length - 2];
  const pixelCount = width * height;
  if (tensor.data.length < pixelCount) {
    throw new Error('La máscara devuelta por el modelo está incompleta.');
  }

  let containsLogits = false;
  for (let index = 0; index < pixelCount; index += 1) {
    const value = tensor.data[index];
    if (value < -1e-5 || value > 1 + 1e-5) {
      containsLogits = true;
      break;
    }
  }

  const data = new Uint8ClampedArray(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    const source = tensor.data[index];
    const probability = containsLogits ? 1 / (1 + Math.exp(-source)) : source;
    data[index] = Math.round(Math.min(1, Math.max(0, probability)) * 255);
  }

  return { data, width, height };
}
