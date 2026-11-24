import type { Garment, Outfit, Profile } from '../core/entities';

export interface ProfileRepository {
  create(profile: Profile): Profile;
  list(): Profile[];
  get(profileId: string): Profile | undefined;
}

export interface GarmentRepository {
  create(garment: Garment): Garment;
  listByProfile(profileId: string): Garment[];
}

export interface OutfitRepository {
  create(outfit: Outfit): Outfit;
  listByProfile(profileId: string): Outfit[];
}

export interface MemoryRepository {
  profiles: ProfileRepository;
  garments: GarmentRepository;
  outfits: OutfitRepository;
}

export function createMemoryRepository(): MemoryRepository {
  const profiles = new Map<string, Profile>();
  const garments = new Map<string, Garment>();
  const outfits = new Map<string, Outfit>();

  return {
    profiles: {
      create(profile) {
        profiles.set(profile.id, profile);
        return profile;
      },
      list() {
        return [...profiles.values()];
      },
      get(profileId) {
        return profiles.get(profileId);
      },
    },
    garments: {
      create(garment) {
        garments.set(garment.id, garment);
        return garment;
      },
      listByProfile(profileId) {
        return [...garments.values()].filter((garment) => garment.profileId === profileId);
      },
    },
    outfits: {
      create(outfit) {
        outfits.set(outfit.id, outfit);
        return outfit;
      },
      listByProfile(profileId) {
        return [...outfits.values()].filter((outfit) => outfit.profileId === profileId);
      },
    },
  };
}
