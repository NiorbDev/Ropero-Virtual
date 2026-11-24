import type { Outfit, OutfitCanvasLayout } from '../core/entities';
import { validateOutfit } from '../core/outfits';
import type { MemoryRepository } from '../data/memory-repository';

export interface OutfitInput {
  name: string;
  garmentIds: string[];
  favorite?: boolean;
  notes?: string;
  canvas?: OutfitCanvasLayout;
}

export function createOutfitService(repository: MemoryRepository) {
  return {
    save(profileId: string, input: OutfitInput): Outfit {
      const name = input.name.trim();
      if (!name) {
        throw new Error('Outfit name is required.');
      }

      validateOutfit({ garmentIds: input.garmentIds });

      return repository.outfits.create({
        id: crypto.randomUUID(),
        profileId,
        name,
        garmentIds: input.garmentIds,
        favorite: input.favorite ?? false,
        notes: input.notes ?? '',
        ...(input.canvas ? { canvas: input.canvas } : {}),
        createdAt: new Date().toISOString(),
      });
    },
    list(profileId: string): Outfit[] {
      return repository.outfits.listByProfile(profileId);
    },
  };
}
