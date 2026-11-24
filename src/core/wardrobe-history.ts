import type { Garment, WearEntry } from './entities';

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function recordWearEntry(garments: Garment[], history: WearEntry[], entry: WearEntry) {
  if (!validDate(entry.date) || entry.date > localDate()) throw new Error('Elige una fecha válida, hasta hoy.');
  const chosen = new Set(entry.garments.map((garment) => garment.id));
  const available = garments.filter((garment) => garment.profileId === entry.profileId && !garment.archivedAt && chosen.has(garment.id));
  if (available.length !== chosen.size || available.length === 0) throw new Error('Selecciona prendas disponibles de este ropero.');
  const matching = history.filter((event) => event.profileId === entry.profileId && event.date === entry.date && event.kind === entry.kind);
  const alreadyCounted = new Set(matching.flatMap((event) => event.garments.map((garment) => garment.id)));
  if (entry.outfitId ? matching.some((event) => event.outfitId === entry.outfitId) : available.every((garment) => alreadyCounted.has(garment.id))) {
    throw new Error('Ese uso o lavado ya está registrado para esa fecha.');
  }
  const nextGarments = garments.map((garment) => {
    if (garment.profileId !== entry.profileId || !chosen.has(garment.id)) return garment;
    const laterWash = history.some((event) => event.profileId === entry.profileId && event.kind === 'washed' && event.date > entry.date && event.garments.some((item) => item.id === garment.id));
    if (laterWash || alreadyCounted.has(garment.id)) return garment;
    if (entry.kind === 'washed') {
      const laterUses = new Set(history.filter((event) => event.profileId === entry.profileId && event.kind === 'worn' && event.date > entry.date && event.garments.some((item) => item.id === garment.id)).map((event) => event.date)).size;
      return { ...garment, wearCount: laterUses, laundryState: laterUses ? 'used' as const : 'clean' as const };
    }
    return { ...garment, wearCount: garment.wearCount + 1, laundryState: garment.laundryState === 'dirty' ? 'dirty' as const : 'used' as const };
  });
  return { garments: nextGarments, wearHistory: [...history, entry] };
}
