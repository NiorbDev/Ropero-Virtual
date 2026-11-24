import type { SavedState } from './app-state-store';

export interface MigrationDependencies {
  backup(state: SavedState): Promise<void>;
  externalizePhotos(state: SavedState): Promise<SavedState>;
  savePrimary(state: SavedState): Promise<void>;
}

export interface MigrationResult {
  state: SavedState;
  migrated: boolean;
  warning: string | null;
}

export async function migrateLegacyState(
  legacyState: SavedState,
  dependencies: MigrationDependencies,
): Promise<MigrationResult> {
  try {
    await dependencies.backup(legacyState);
    const migratedState = await dependencies.externalizePhotos(legacyState);
    await dependencies.savePrimary(migratedState);

    return {
      state: migratedState,
      migrated: true,
      warning: null,
    };
  } catch {
    return {
      state: legacyState,
      migrated: false,
      warning: 'No se pudo completar la migración; el respaldo local original seguirá disponible.',
    };
  }
}
