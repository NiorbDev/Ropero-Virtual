import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { Garment, GarmentPhotoAsset, Outfit, Profile } from '../core/entities';
import {
  blankState,
  normalizeSavedState,
  schemaVersion,
  type SavedState,
} from './app-state-store';
import type { AppStorage } from './create-app-storage';
import type { PhotoStore } from './photo-store';

export type WardrobeImportMode = 'new-profiles' | 'merge';
type PhotoKind = 'original' | 'cutout';

interface PackagePhoto {
  assetId: string;
  kind: PhotoKind;
  path: string;
  mimeType: string;
}

export interface WardrobePackageManifest {
  formatVersion: 1;
  schemaVersion: number;
  exportedAt: string;
  state: SavedState;
  photos: PackagePhoto[];
}

export interface WardrobeImportPreview {
  fileName: string;
  profileCount: number;
  garmentCount: number;
  outfitCount: number;
  photoCount: number;
  manifest: WardrobePackageManifest;
  entries: Record<string, Uint8Array>;
}

const archiveMimeType = 'application/x-ropero';
const maxPhotoBytes = 50 * 1024 * 1024;
const maxArchiveBytes = 500 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.startsWith('\\') || /^[a-z]:/i.test(path) || path.includes('\\')) return false;
  return path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

function safeAssetSegment(assetId: string): string {
  const encoded = encodeURIComponent(assetId).replace(/\./g, '%2E');
  if (!encoded || !isSafePath(encoded)) throw new Error('Una fotografía tiene un identificador que no se puede exportar.');
  return encoded;
}

function extensionFor(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
  };
  return extensions[mimeType.toLowerCase()] ?? 'img';
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function parseManifest(value: unknown): WardrobePackageManifest {
  if (!isRecord(value) || value.formatVersion !== 1) {
    throw new Error('El paquete usa una versión de formato no compatible.');
  }
  if (typeof value.schemaVersion !== 'number' || value.schemaVersion < 1 || value.schemaVersion > schemaVersion) {
    throw new Error('El ropero fue creado con una versión de datos no compatible.');
  }
  if (typeof value.exportedAt !== 'string' || !isRecord(value.state) || !Array.isArray(value.photos)) {
    throw new Error('El manifest del ropero está incompleto.');
  }
  const photos: PackagePhoto[] = value.photos.map((photo) => {
    if (!isRecord(photo)
      || typeof photo.assetId !== 'string'
      || (photo.kind !== 'original' && photo.kind !== 'cutout')
      || typeof photo.path !== 'string'
      || typeof photo.mimeType !== 'string'
      || !photo.mimeType.startsWith('image/')) {
      throw new Error('El manifest contiene una fotografía inválida.');
    }
    return photo as unknown as PackagePhoto;
  });
  return {
    formatVersion: 1,
    schemaVersion: value.schemaVersion,
    exportedAt: value.exportedAt,
    state: normalizeSavedState(value.state),
    photos,
  };
}

function validateArchive(manifest: WardrobePackageManifest, entries: Record<string, Uint8Array>): void {
  const paths = Object.keys(entries);
  if (paths.some((path) => !isSafePath(path))) throw new Error('El paquete contiene una ruta de archivo insegura.');
  const totalBytes = Object.values(entries).reduce((total, bytes) => total + bytes.byteLength, 0);
  if (totalBytes > maxArchiveBytes) throw new Error('El paquete de ropero es demasiado grande.');

  const metadataKeys = new Set<string>();
  for (const photo of manifest.photos) {
    const key = `${photo.assetId}:${photo.kind}`;
    if (metadataKeys.has(key)) throw new Error('El manifest repite una fotografía.');
    metadataKeys.add(key);
    if (!isSafePath(photo.path) || !photo.path.startsWith('photos/')) {
      throw new Error('El manifest contiene una ruta de fotografía insegura.');
    }
    const bytes = entries[photo.path];
    if (!bytes) throw new Error(`Falta la fotografía ${photo.path} en el paquete.`);
    if (bytes.byteLength > maxPhotoBytes) throw new Error(`La fotografía ${photo.path} es demasiado grande.`);
  }

  for (const garment of manifest.state.garments) {
    for (const asset of garment.photoAssets) {
      if (!metadataKeys.has(`${asset.id}:original`)) {
        throw new Error(`Falta la fotografía original de ${garment.name}.`);
      }
      if (asset.cutoutRef && !metadataKeys.has(`${asset.id}:cutout`)) {
        throw new Error(`Falta el recorte de ${garment.name}.`);
      }
    }
  }
}

function nextId(prefix: string): string {
  const unique = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${unique}`;
}

export async function exportWardrobePackage(state: SavedState, photoStore: PhotoStore): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  const photos: PackagePhoto[] = [];
  const usedPaths = new Set<string>();
  const exportedAssets = new Set<string>();

  for (const garment of state.garments) {
    for (const asset of garment.photoAssets) {
      if (exportedAssets.has(asset.id)) continue;
      exportedAssets.add(asset.id);
      const segment = safeAssetSegment(asset.id);
      const addPhoto = async (kind: PhotoKind, reference: string) => {
        const blob = await photoStore.readBlob(reference);
        if (!blob.type.startsWith('image/')) throw new Error(`La foto de ${garment.name} no tiene un formato de imagen válido.`);
        const path = `photos/${segment}/${kind}.${kind === 'cutout' ? 'png' : extensionFor(blob.type)}`;
        if (usedPaths.has(path)) throw new Error('Dos fotografías intentan usar la misma ruta del paquete.');
        usedPaths.add(path);
        entries[path] = await blobBytes(blob);
        photos.push({ assetId: asset.id, kind, path, mimeType: blob.type });
      };
      await addPhoto('original', asset.originalRef);
      if (asset.cutoutRef) await addPhoto('cutout', asset.cutoutRef);
    }
  }

  const manifest: WardrobePackageManifest = {
    formatVersion: 1,
    schemaVersion,
    exportedAt: new Date().toISOString(),
    state: structuredClone(state),
    photos,
  };
  entries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  const compressed = zipSync(entries, { level: 6 });
  const bytes = new Uint8Array(compressed.byteLength);
  bytes.set(compressed);
  return new Blob([bytes.buffer], { type: archiveMimeType });
}

export async function inspectWardrobePackage(file: File): Promise<WardrobeImportPreview> {
  if (!file.name.toLowerCase().endsWith('.ropero')) {
    throw new Error('Selecciona un archivo con extensión .ropero.');
  }
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error('El archivo .ropero no es un paquete ZIP válido.');
  }
  if (Object.keys(entries).some((path) => !isSafePath(path))) {
    throw new Error('El paquete contiene una ruta de archivo insegura.');
  }
  const manifestBytes = entries['manifest.json'];
  if (!manifestBytes) throw new Error('El paquete no contiene manifest.json.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new Error('El manifest del ropero no contiene JSON válido.');
  }
  const manifest = parseManifest(parsed);
  validateArchive(manifest, entries);
  return {
    fileName: file.name,
    profileCount: manifest.state.profiles.length,
    garmentCount: manifest.state.garments.length,
    outfitCount: manifest.state.outfits.length,
    photoCount: manifest.photos.length,
    manifest,
    entries,
  };
}

interface ImportedAsset {
  id: string;
  originalRef: string;
  cutoutRef: string | null;
}

function importedProfileName(profile: Profile, current: SavedState, mode: WardrobeImportMode): string {
  if (mode === 'merge') return profile.name;
  const names = new Set(current.profiles.map((item) => item.name.toLocaleLowerCase()));
  return names.has(profile.name.toLocaleLowerCase()) ? `${profile.name} (importado)` : profile.name;
}

export async function importWardrobePackage(
  preview: WardrobeImportPreview,
  mode: WardrobeImportMode,
  storage: AppStorage,
): Promise<SavedState> {
  validateArchive(preview.manifest, preview.entries);
  const loaded = await storage.stateStore.load(blankState);
  const current = loaded.state;
  const savedReferences: string[] = [];

  try {
    const assets = new Map<string, ImportedAsset>();
    for (const photo of preview.manifest.photos) {
      const currentAsset = assets.get(photo.assetId) ?? {
        id: nextId('photo'), originalRef: '', cutoutRef: null,
      };
      const blob = new Blob([preview.entries[photo.path]], { type: photo.mimeType });
      const reference = await storage.photoStore.saveBlob(blob, photo.path.split('/').pop() ?? 'photo');
      savedReferences.push(reference);
      if (photo.kind === 'original') currentAsset.originalRef = reference;
      else currentAsset.cutoutRef = reference;
      assets.set(photo.assetId, currentAsset);
    }

    const profileIds = new Map<string, string>();
    const newProfiles: Profile[] = [];
    for (const profile of preview.manifest.state.profiles) {
      const matching = mode === 'merge'
        ? current.profiles.find((item) => item.name.localeCompare(profile.name, undefined, { sensitivity: 'accent' }) === 0)
        : undefined;
      if (matching) {
        profileIds.set(profile.id, matching.id);
      } else {
        const id = nextId('profile');
        profileIds.set(profile.id, id);
        newProfiles.push({ ...profile, id, name: importedProfileName(profile, current, mode) });
      }
    }

    const garmentIds = new Map<string, string>();
    for (const garment of preview.manifest.state.garments) garmentIds.set(garment.id, nextId('garment'));

    const newGarments: Garment[] = preview.manifest.state.garments.map((garment) => {
      const photoAssets: GarmentPhotoAsset[] = garment.photoAssets.map((asset) => {
        const imported = assets.get(asset.id);
        if (!imported?.originalRef) throw new Error(`No se pudo reconstruir una foto de ${garment.name}.`);
        return { ...asset, ...imported };
      });
      return {
        ...garment,
        id: garmentIds.get(garment.id)!,
        profileId: profileIds.get(garment.profileId) ?? nextId('profile-orphan'),
        imageUrls: photoAssets.map((asset) => asset.originalRef),
        photoAssets,
      };
    });

    const outfitIds = new Map(preview.manifest.state.outfits.map((outfit) => [outfit.id, nextId('outfit')]));
    const newOutfits: Outfit[] = preview.manifest.state.outfits.map((outfit) => ({
      ...outfit,
      id: outfitIds.get(outfit.id)!,
      profileId: profileIds.get(outfit.profileId) ?? nextId('profile-orphan'),
      garmentIds: outfit.garmentIds.map((id) => garmentIds.get(id)).filter((id): id is string => Boolean(id)),
      canvas: outfit.canvas ? {
        ...outfit.canvas,
        items: outfit.canvas.items.map((item) => ({
          ...item,
          id: nextId('canvas'),
          garmentId: garmentIds.get(item.garmentId) ?? item.garmentId,
          photoAssetId: assets.get(item.photoAssetId)?.id ?? item.photoAssetId,
        })),
      } : undefined,
    }));

    const selected = { ...current.selectedGarmentIdsByProfile };
    for (const [oldProfileId, oldGarmentIds] of Object.entries(preview.manifest.state.selectedGarmentIdsByProfile)) {
      const profileId = profileIds.get(oldProfileId);
      if (!profileId) continue;
      const importedIds = oldGarmentIds.map((id) => garmentIds.get(id)).filter((id): id is string => Boolean(id));
      selected[profileId] = [...new Set([...(selected[profileId] ?? []), ...importedIds])];
    }

    const imported: SavedState = {
      profiles: [...current.profiles, ...newProfiles],
      garments: [...current.garments, ...newGarments],
      outfits: [...current.outfits, ...newOutfits],
      selectedGarmentIdsByProfile: selected,
      ...((current.wearHistory || preview.manifest.state.wearHistory) ? { wearHistory: [
        ...(current.wearHistory ?? []),
        ...(preview.manifest.state.wearHistory ?? []).filter((entry) => profileIds.has(entry.profileId)).map((entry) => ({
          ...entry,
          id: nextId('history'),
          profileId: profileIds.get(entry.profileId)!,
          outfitId: entry.outfitId ? outfitIds.get(entry.outfitId) : undefined,
          garments: entry.garments.map((item) => ({ ...item, id: garmentIds.get(item.id) ?? nextId('removed-garment') })),
        })),
      ] } : {}),
    };
    await storage.stateStore.save(imported);
    return imported;
  } catch (reason) {
    await Promise.allSettled(savedReferences.reverse().map((reference) => storage.photoStore.remove(reference)));
    throw reason;
  }
}
