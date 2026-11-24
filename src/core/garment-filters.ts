import type { LaundryState } from './laundry';
import type { Garment, GarmentAvailability, GarmentCategory } from './entities';

export interface GarmentFilters {
  query: string;
  category: GarmentCategory | 'all';
  laundryState: LaundryState | 'all';
  availability: GarmentAvailability | 'all';
}

export const emptyGarmentFilters: GarmentFilters = {
  query: '',
  category: 'all',
  laundryState: 'all',
  availability: 'all',
};

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function hasActiveGarmentFilters(filters: GarmentFilters): boolean {
  return Boolean(filters.query.trim())
    || filters.category !== 'all'
    || filters.laundryState !== 'all'
    || filters.availability !== 'all';
}

export function filterGarments(garments: Garment[], filters: GarmentFilters): Garment[] {
  const query = normalizeSearchText(filters.query);

  return garments.filter((garment) => {
    const searchableText = normalizeSearchText([
      garment.name,
      garment.subtype,
      garment.description,
      garment.notes,
      ...garment.colors,
      ...garment.styles,
    ].join(' '));

    return (!query || searchableText.includes(query))
      && (filters.category === 'all' || garment.category === filters.category)
      && (filters.laundryState === 'all' || garment.laundryState === filters.laundryState)
      && (filters.availability === 'all' || garment.availability === filters.availability);
  });
}
