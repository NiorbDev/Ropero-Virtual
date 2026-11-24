import type { LaundryState } from './laundry';

export const garmentCategories = [
  'top',
  'bottom',
  'dress-skirt',
  'outerwear',
  'footwear',
  'accessory',
] as const;

export type GarmentCategory = (typeof garmentCategories)[number];
export type Fit = 'fitted' | 'regular' | 'oversized';

export type GarmentLength = 'short' | 'regular' | 'long';
export type GarmentWidth = 'fitted' | 'regular' | 'wide';
export type GarmentSleeve = 'sleeveless' | 'short' | 'three-quarter' | 'long';
export type GarmentAvailability = 'available' | 'borrowed' | 'avoid';

export interface GarmentMeasurements {
  length: GarmentLength;
  width: GarmentWidth;
  sleeve: GarmentSleeve;
  lengthCm?: number;
  widthCm?: number;
  sleeveCm?: number;
}

export interface Profile {
  id: string;
  name: string;
  accentColor: string;
  createdAt: string;
}

export interface GarmentPhotoAsset {
  id: string;
  originalRef: string;
  cutoutRef: string | null;
  createdAt: string;
}

export interface OutfitCanvasItem {
  id: string;
  garmentId: string;
  photoAssetId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  zIndex: number;
}

export interface OutfitCanvasLayout {
  items: OutfitCanvasItem[];
  updatedAt: string;
}

export interface Garment {
  id: string;
  profileId: string;
  importKey?: string;
  name: string;
  category: GarmentCategory;
  colors: string[];
  seasons: string[];
  styles: string[];
  fit: Fit;
  size: string;
  notes: string;
  subtype: string;
  description: string;
  measurements: GarmentMeasurements;
  availability: GarmentAvailability;
  imageUrls: string[];
  photoAssets: GarmentPhotoAsset[];
  laundryState: LaundryState;
  wearCount: number;
  washThreshold: number;
  archivedAt: string | null;
  createdAt: string;
}

export interface Outfit {
  id: string;
  profileId: string;
  name: string;
  garmentIds: string[];
  favorite: boolean;
  notes: string;
  canvas?: OutfitCanvasLayout;
  archivedAt?: string | null;
  createdAt: string;
}

export interface WearEntry {
  id: string;
  profileId: string;
  date: string;
  kind: 'worn' | 'washed';
  garments: Array<{ id: string; name: string }>;
  outfitId?: string;
  outfitName?: string;
  createdAt: string;
}
