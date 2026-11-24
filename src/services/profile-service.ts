import type { Profile } from '../core/entities';
import type { MemoryRepository } from '../data/memory-repository';

export function createProfileService(repository: MemoryRepository) {
  return {
    create(name: string): Profile {
      const normalizedName = name.trim();
      if (!normalizedName) {
        throw new Error('Profile name is required.');
      }

      const profile: Profile = {
        id: crypto.randomUUID(),
        name: normalizedName,
        accentColor: '#ff91b7',
        createdAt: new Date().toISOString(),
      };

      return repository.profiles.create(profile);
    },
  };
}
