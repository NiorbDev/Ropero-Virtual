import type {
  GarmentCategory,
  GarmentPhotoAsset,
  OutfitCanvasItem,
  OutfitCanvasLayout,
} from './entities';

export interface CanvasGarment {
  id: string;
  category: GarmentCategory;
  photoAssets: GarmentPhotoAsset[];
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export type LayerDestination = 'front' | 'back';

const categoryOrder: Record<GarmentCategory, number> = {
  top: 0,
  outerwear: 1,
  'dress-skirt': 2,
  bottom: 3,
  footwear: 4,
  accessory: 5,
};

const categoryY: Record<GarmentCategory, number> = {
  top: 0.22,
  outerwear: 0.22,
  'dress-skirt': 0.5,
  bottom: 0.53,
  footwear: 0.82,
  accessory: 0.12,
};

export function clampNormalized(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeRotation(rotation: number): number {
  const positive = ((rotation % 360) + 360) % 360;
  return positive > 180 ? positive - 360 : positive;
}

function normalizedLayers(items: OutfitCanvasItem[]): OutfitCanvasItem[] {
  return [...items]
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((item, zIndex) => ({ ...item, zIndex }));
}

function updateItem(
  layout: OutfitCanvasLayout,
  itemId: string,
  updatedAt: string,
  transform: (item: OutfitCanvasItem) => OutfitCanvasItem,
): OutfitCanvasLayout {
  if (!layout.items.some((item) => item.id === itemId)) return layout;
  return {
    items: layout.items.map((item) => item.id === itemId ? transform(item) : item),
    updatedAt,
  };
}

function itemFor(garment: CanvasGarment, zIndex: number): OutfitCanvasItem {
  return {
    id: `canvas-${garment.id}`,
    garmentId: garment.id,
    photoAssetId: garment.photoAssets[0]?.id ?? '',
    x: 0.5,
    y: categoryY[garment.category],
    scale: 1,
    rotation: 0,
    flipX: false,
    zIndex,
  };
}

export function createDefaultLayout(
  garments: readonly CanvasGarment[],
  updatedAt: string,
): OutfitCanvasLayout {
  const sorted = [...garments].sort((left, right) => (
    categoryOrder[left.category] - categoryOrder[right.category]
  ));
  return {
    items: sorted.map(itemFor),
    updatedAt,
  };
}

export function moveCanvasItem(
  layout: OutfitCanvasLayout,
  itemId: string,
  point: CanvasPoint,
  updatedAt: string,
): OutfitCanvasLayout {
  return updateItem(layout, itemId, updatedAt, (item) => ({
    ...item,
    x: clampNormalized(point.x),
    y: clampNormalized(point.y),
  }));
}

export function scaleCanvasItem(
  layout: OutfitCanvasLayout,
  itemId: string,
  scale: number,
  updatedAt: string,
): OutfitCanvasLayout {
  return updateItem(layout, itemId, updatedAt, (item) => ({
    ...item,
    scale: Math.min(3, Math.max(0.2, scale)),
  }));
}

export function rotateCanvasItem(
  layout: OutfitCanvasLayout,
  itemId: string,
  rotation: number,
  updatedAt: string,
): OutfitCanvasLayout {
  return updateItem(layout, itemId, updatedAt, (item) => ({
    ...item,
    rotation: normalizeRotation(rotation),
  }));
}

export function flipCanvasItem(
  layout: OutfitCanvasLayout,
  itemId: string,
  updatedAt: string,
): OutfitCanvasLayout {
  return updateItem(layout, itemId, updatedAt, (item) => ({ ...item, flipX: !item.flipX }));
}

export function addCanvasGarment(
  layout: OutfitCanvasLayout,
  garment: CanvasGarment,
  updatedAt: string,
): OutfitCanvasLayout {
  if (layout.items.some((item) => item.garmentId === garment.id)) return layout;
  return {
    items: [...layout.items, itemFor(garment, layout.items.length)],
    updatedAt,
  };
}

export function removeCanvasItem(
  layout: OutfitCanvasLayout,
  itemId: string,
  updatedAt: string,
): OutfitCanvasLayout {
  if (!layout.items.some((item) => item.id === itemId)) return layout;
  return {
    items: normalizedLayers(layout.items.filter((item) => item.id !== itemId)),
    updatedAt,
  };
}

export function reorderCanvasItem(
  layout: OutfitCanvasLayout,
  itemId: string,
  destination: LayerDestination,
  updatedAt: string,
): OutfitCanvasLayout {
  const selected = layout.items.find((item) => item.id === itemId);
  if (!selected) return layout;
  const remaining = normalizedLayers(layout.items.filter((item) => item.id !== itemId));
  const reordered = destination === 'front'
    ? [...remaining, selected]
    : [selected, ...remaining];
  return { items: normalizedLayers(reordered), updatedAt };
}
