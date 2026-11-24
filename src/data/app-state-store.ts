import type {
  Garment,
  GarmentPhotoAsset,
  Outfit,
  OutfitCanvasItem,
  OutfitCanvasLayout,
  Profile,
  WearEntry,
} from '../core/entities';
import { validDate } from '../core/wardrobe-history';

export const storageKey = 'ropero-virtual-foundation';
export const schemaVersion = 2;

export interface SavedState {
  profiles: Profile[];
  garments: Garment[];
  outfits: Outfit[];
  selectedGarmentIdsByProfile: Record<string, string[]>;
  wearHistory?: WearEntry[];
}

export const blankState: SavedState = {
  profiles: [],
  garments: [],
  outfits: [],
  selectedGarmentIdsByProfile: {},
};

export interface LoadStateResult {
  state: SavedState;
  source: 'primary' | 'legacy';
  warning: string | null;
}

export interface AppStateStore {
  load(legacyFallback: SavedState): Promise<LoadStateResult>;
  save(state: SavedState): Promise<void>;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

interface StateEnvelope {
  schemaVersion: number;
  state: SavedState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCanvasItem(value: unknown): value is OutfitCanvasItem {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.garmentId === 'string'
    && typeof value.photoAssetId === 'string'
    && typeof value.x === 'number'
    && Number.isFinite(value.x)
    && value.x >= 0
    && value.x <= 1
    && typeof value.y === 'number'
    && Number.isFinite(value.y)
    && value.y >= 0
    && value.y <= 1
    && typeof value.scale === 'number'
    && Number.isFinite(value.scale)
    && value.scale >= 0.2
    && value.scale <= 3
    && typeof value.rotation === 'number'
    && Number.isFinite(value.rotation)
    && value.rotation >= -180
    && value.rotation <= 180
    && typeof value.flipX === 'boolean'
    && typeof value.zIndex === 'number'
    && Number.isInteger(value.zIndex)
    && value.zIndex >= 0;
}

function normalizeCanvas(value: unknown): OutfitCanvasLayout | undefined {
  if (!isRecord(value) || !Array.isArray(value.items) || typeof value.updatedAt !== 'string') {
    return undefined;
  }
  return {
    items: value.items.filter(isCanvasItem),
    updatedAt: value.updatedAt,
  };
}

function isPhotoAsset(value: unknown): value is GarmentPhotoAsset {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.originalRef === 'string'
    && (typeof value.cutoutRef === 'string' || value.cutoutRef === null)
    && typeof value.createdAt === 'string';
}

function normalizeProfile(value: unknown): Profile | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  const profile = { ...value };
  delete profile.avatar;
  return profile as unknown as Profile;
}

function normalizeGarment(value: unknown): Garment | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  const imageUrls = Array.isArray(value.imageUrls)
    ? value.imageUrls.filter((reference): reference is string => typeof reference === 'string')
    : [];
  const createdAt = typeof value.createdAt === 'string'
    ? value.createdAt
    : '1970-01-01T00:00:00.000Z';
  const savedAssets = Array.isArray(value.photoAssets)
    ? value.photoAssets.filter(isPhotoAsset)
    : [];
  const photoAssets = savedAssets.length > 0
    ? savedAssets
    : imageUrls.map((originalRef, index) => ({
        id: `${value.id}-photo-${index}`,
        originalRef,
        cutoutRef: null,
        createdAt,
      }));
  const garment = { ...value };
  delete garment.threeD;
  delete garment.visualStyle;
  return { ...garment, imageUrls, photoAssets } as unknown as Garment;
}

function normalizeOutfit(value: unknown): Outfit | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  const canvas = normalizeCanvas(value.canvas);
  return {
    ...value,
    ...(canvas ? { canvas } : {}),
  } as unknown as Outfit;
}

function isWearEntry(value: unknown): value is WearEntry {
  return isRecord(value) && typeof value.id === 'string' && typeof value.profileId === 'string'
    && typeof value.date === 'string' && validDate(value.date)
    && (value.kind === 'worn' || value.kind === 'washed')
    && typeof value.createdAt === 'string'
    && (value.outfitId === undefined || typeof value.outfitId === 'string')
    && (value.outfitName === undefined || typeof value.outfitName === 'string')
    && Array.isArray(value.garments) && value.garments.every((item) => isRecord(item) && typeof item.id === 'string' && typeof item.name === 'string');
}

export function normalizeSavedState(value: unknown): SavedState {
  if (!isRecord(value)) return { ...blankState };

  const selectedGarmentIdsByProfile = isRecord(value.selectedGarmentIdsByProfile)
    ? Object.fromEntries(
        Object.entries(value.selectedGarmentIdsByProfile).filter(
          (entry): entry is [string, string[]] => Array.isArray(entry[1])
            && entry[1].every((garmentId) => typeof garmentId === 'string'),
        ),
      )
    : {};

  return {
    profiles: Array.isArray(value.profiles)
      ? value.profiles.map(normalizeProfile).filter((profile): profile is Profile => profile !== null)
      : [],
    garments: Array.isArray(value.garments)
      ? value.garments.map(normalizeGarment).filter((garment): garment is Garment => garment !== null)
      : [],
    outfits: Array.isArray(value.outfits)
      ? value.outfits.map(normalizeOutfit).filter((outfit): outfit is Outfit => outfit !== null)
      : [],
    selectedGarmentIdsByProfile,
    ...(Array.isArray(value.wearHistory) ? { wearHistory: value.wearHistory.filter(isWearEntry) } : {}),
  };
}

function isStateEnvelope(value: unknown): value is StateEnvelope {
  return isRecord(value)
    && typeof value.schemaVersion === 'number'
    && 'state' in value;
}

export function readLocalStateSnapshot(
  storage: Pick<Storage, 'getItem'> = globalThis.localStorage,
): SavedState {
  try {
    const serialized = storage.getItem(storageKey);
    if (serialized === null) return { ...blankState };

    const parsed: unknown = JSON.parse(serialized);
    return normalizeSavedState(isStateEnvelope(parsed) ? parsed.state : parsed);
  } catch {
    return { ...blankState };
  }
}

export function createLocalStorageStateStore(
  storage: StorageLike = globalThis.localStorage,
): AppStateStore {
  return {
    async load(legacyFallback) {
      const serialized = storage.getItem(storageKey);
      if (serialized === null) {
        return { state: legacyFallback, source: 'legacy', warning: null };
      }

      try {
        const parsed: unknown = JSON.parse(serialized);
        if (isStateEnvelope(parsed)) {
          return {
            state: normalizeSavedState(parsed.state),
            source: 'primary',
            warning: parsed.schemaVersion === schemaVersion
              ? null
              : 'El ropero usa una versión de datos distinta; se cargaron los campos compatibles.',
          };
        }

        return {
          state: normalizeSavedState(parsed),
          source: 'legacy',
          warning: null,
        };
      } catch {
        return {
          state: legacyFallback,
          source: 'legacy',
          warning: 'No se pudo leer el almacenamiento guardado; se mantuvo el ropero disponible en memoria.',
        };
      }
    },

    async save(state) {
      storage.setItem(storageKey, JSON.stringify({ schemaVersion, state }));
    },
  };
}
