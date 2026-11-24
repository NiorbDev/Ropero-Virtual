import type { Fit, Garment, GarmentCategory, GarmentMeasurements, GarmentAvailability, GarmentPhotoAsset } from '../core/entities';
import type { LaundryState } from '../core/laundry';
import type { MemoryRepository } from '../data/memory-repository';

export interface GarmentInput {
  importKey?: string;
  name: string;
  category: GarmentCategory;
  colors: string[];
  fit?: Fit;
  seasons?: string[];
  styles?: string[];
  size?: string;
  notes?: string;
  subtype?: string;
  description?: string;
  measurements?: Partial<GarmentMeasurements>;
  availability?: GarmentAvailability;
  imageUrls?: string[];
  photoAssets?: GarmentPhotoAsset[];
  washThreshold?: number;
  laundryState?: LaundryState;
}

export function createWardrobeService(repository: MemoryRepository) {
  return {
    save(profileId: string, input: GarmentInput): Garment {
      const name = input.name.trim();
      if (!name) {
        throw new Error('Garment name is required.');
      }

      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const imageUrls = input.imageUrls ?? [];
      const garment: Garment = {
        id,
        profileId,
        ...(input.importKey ? { importKey: input.importKey } : {}),
        name,
        category: input.category,
        colors: input.colors,
        seasons: input.seasons ?? [],
        styles: input.styles ?? [],
        fit: input.fit ?? 'regular',
        size: input.size ?? '',
        notes: input.notes ?? '',
        subtype: input.subtype?.trim() ?? '',
        description: input.description?.trim() ?? '',
        measurements: {
          length: input.measurements?.length ?? 'regular',
          width: input.measurements?.width ?? 'regular',
          sleeve: input.measurements?.sleeve ?? 'long',
          ...(input.measurements?.lengthCm ? { lengthCm: input.measurements.lengthCm } : {}),
          ...(input.measurements?.widthCm ? { widthCm: input.measurements.widthCm } : {}),
          ...(input.measurements?.sleeveCm ? { sleeveCm: input.measurements.sleeveCm } : {}),
        },
        availability: input.availability ?? 'available',
        imageUrls,
        photoAssets: input.photoAssets ?? imageUrls.map((originalRef, index) => ({
          id: `${id}-photo-${index}`,
          originalRef,
          cutoutRef: null,
          createdAt,
        })),
        laundryState: input.laundryState ?? 'clean',
        wearCount: 0,
        washThreshold: input.washThreshold ?? 3,
        archivedAt: null,
        createdAt,
      };

      return repository.garments.create(garment);
    },
    update(existing: Garment, input: GarmentInput): Garment {
      const name = input.name.trim();
      if (!name) {
        throw new Error('Garment name is required.');
      }

      const measurements = input.measurements
        ? {
            length: input.measurements.length ?? existing.measurements.length,
            width: input.measurements.width ?? existing.measurements.width,
            sleeve: input.measurements.sleeve ?? existing.measurements.sleeve,
            ...(input.measurements.lengthCm ? { lengthCm: input.measurements.lengthCm } : {}),
            ...(input.measurements.widthCm ? { widthCm: input.measurements.widthCm } : {}),
            ...(input.measurements.sleeveCm ? { sleeveCm: input.measurements.sleeveCm } : {}),
          }
        : existing.measurements;
      const colors = input.colors ?? existing.colors;

      const imageUrls = input.imageUrls ?? existing.imageUrls;
      const photoAssets = input.photoAssets ?? imageUrls.map((originalRef, index) => {
        const saved = existing.photoAssets?.find((asset) => asset.originalRef === originalRef);
        return saved ?? {
          id: `${existing.id}-photo-${index}`,
          originalRef,
          cutoutRef: null,
          createdAt: new Date().toISOString(),
        };
      });

      return repository.garments.create({
        ...existing,
        name,
        category: input.category,
        colors,
        seasons: input.seasons ?? existing.seasons,
        styles: input.styles ?? existing.styles,
        fit: input.fit ?? existing.fit,
        size: input.size ?? existing.size,
        notes: input.notes ?? existing.notes,
        subtype: input.subtype?.trim() ?? existing.subtype,
        description: input.description?.trim() ?? existing.description,
        measurements,
        availability: input.availability ?? existing.availability,
        imageUrls,
        photoAssets,
        laundryState: input.laundryState ?? existing.laundryState,
        washThreshold: input.washThreshold ?? existing.washThreshold,
      });
    },
    list(profileId: string): Garment[] {
      return repository.garments.listByProfile(profileId).filter((garment) => garment.archivedAt === null);
    },
  };
}
