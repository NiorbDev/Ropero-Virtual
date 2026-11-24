import { BaseDirectory } from '@tauri-apps/api/path';
import { mkdir, writeTextFile } from '@tauri-apps/plugin-fs';
import Database from '@tauri-apps/plugin-sql';
import {
  normalizeSavedState,
  schemaVersion,
  type AppStateStore,
  type LoadStateResult,
  type SavedState,
} from './app-state-store';
import type { PhotoStore } from './photo-store';
import { migrateLegacyState } from './state-migration';

const databaseUrl = 'sqlite:ropero-virtual.db';
const backupDirectory = 'ropero-virtual/backups';

interface StateRow {
  schema_version: number;
  state_json: string;
}

export interface StateDatabase {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
}

export interface SqliteStateDependencies {
  database: StateDatabase;
  backup(state: SavedState): Promise<void>;
  externalizePhotos(state: SavedState): Promise<SavedState>;
  now(): string;
}

const upsertStateSql = `
  INSERT INTO app_state (id, schema_version, state_json, updated_at)
  VALUES (1, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    schema_version = excluded.schema_version,
    state_json = excluded.state_json,
    updated_at = excluded.updated_at
`;

export function createSqliteStateStore(
  dependencies: SqliteStateDependencies,
): AppStateStore {
  const save = async (state: SavedState) => {
    await dependencies.database.execute(upsertStateSql, [
      schemaVersion,
      JSON.stringify(state),
      dependencies.now(),
    ]);
  };

  return {
    async load(legacyFallback): Promise<LoadStateResult> {
      const rows = await dependencies.database.select<StateRow[]>(
        'SELECT schema_version, state_json FROM app_state WHERE id = 1',
      );

      if (rows.length > 0) {
        if (rows[0].schema_version !== schemaVersion) {
          return {
            state: legacyFallback,
            source: 'legacy',
            warning: 'SQLite usa una versión de datos no compatible; se mantuvo el respaldo local sin sobrescribirlo.',
          };
        }

        try {
          return {
            state: normalizeSavedState(JSON.parse(rows[0].state_json)),
            source: 'primary',
            warning: null,
          };
        } catch {
          return {
            state: legacyFallback,
            source: 'legacy',
            warning: 'No se pudo leer el estado de SQLite; se mantuvo el respaldo local sin sobrescribirlo.',
          };
        }
      }

      const migration = await migrateLegacyState(legacyFallback, {
        backup: dependencies.backup,
        externalizePhotos: dependencies.externalizePhotos,
        savePrimary: save,
      });

      return {
        state: migration.state,
        source: migration.migrated ? 'primary' : 'legacy',
        warning: migration.warning,
      };
    },
    save,
  };
}

function extensionFromMime(mimeType: string): string {
  const subtype = mimeType.split('/')[1]?.toLowerCase();
  if (subtype === 'jpeg') return 'jpg';
  return subtype || 'img';
}

function fileFromDataUrl(dataUrl: string, index: number): File {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('La foto heredada no tiene un formato compatible.');

  const binary = atob(match[2]);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new File(
    [bytes],
    `foto-importada-${index}.${extensionFromMime(match[1])}`,
    { type: match[1] },
  );
}

export async function externalizeLegacyPhotos(
  state: SavedState,
  photoStore: PhotoStore,
): Promise<SavedState> {
  const garments = await Promise.all(state.garments.map(async (garment) => {
    const nextReferences = [...garment.imageUrls];
    const dataUrlIndexes = garment.imageUrls
      .map((reference, index) => reference.startsWith('data:image/') ? index : -1)
      .filter((index) => index >= 0);

    if (dataUrlIndexes.length === 0) return garment;

    const files = dataUrlIndexes.map((index) => fileFromDataUrl(garment.imageUrls[index], index));
    const storedReferences = await photoStore.saveFiles(files);
    const replacements = new Map<string, string>();
    dataUrlIndexes.forEach((imageIndex, resultIndex) => {
      replacements.set(garment.imageUrls[imageIndex], storedReferences[resultIndex]);
      nextReferences[imageIndex] = storedReferences[resultIndex];
    });

    return {
      ...garment,
      imageUrls: nextReferences,
      photoAssets: garment.photoAssets.map((asset) => ({
        ...asset,
        originalRef: replacements.get(asset.originalRef) ?? asset.originalRef,
      })),
    };
  }));

  return { ...state, garments };
}

async function backupLegacyState(state: SavedState, timestamp: string): Promise<void> {
  await mkdir(backupDirectory, { baseDir: BaseDirectory.AppData, recursive: true });
  const safeTimestamp = timestamp.replace(/[:.]/g, '-');
  await writeTextFile(
    `${backupDirectory}/pre-sqlite-${safeTimestamp}.json`,
    JSON.stringify({ schemaVersion, state }, null, 2),
    { baseDir: BaseDirectory.AppData },
  );
}

export async function createTauriStateStore(photoStore: PhotoStore): Promise<AppStateStore> {
  const database = await Database.load(databaseUrl);

  return createSqliteStateStore({
    database,
    backup: (state) => backupLegacyState(state, new Date().toISOString()),
    externalizePhotos: (state) => externalizeLegacyPhotos(state, photoStore),
    now: () => new Date().toISOString(),
  });
}
