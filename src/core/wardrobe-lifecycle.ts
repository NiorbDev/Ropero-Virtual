import type { SavedState } from '../data/app-state-store';

export function deleteGarment(state: SavedState, profileId: string, id: string): SavedState {
  if (!state.garments.some((item) => item.id === id && item.profileId === profileId)) return state;
  return {
    ...state,
    garments: state.garments.filter((item) => item.id !== id),
    outfits: state.outfits.map((outfit) => ({
      ...outfit,
      garmentIds: outfit.garmentIds.filter((garmentId) => garmentId !== id),
      ...(outfit.canvas ? { canvas: { ...outfit.canvas, items: outfit.canvas.items.filter((item) => item.garmentId !== id) } } : {}),
    })),
    selectedGarmentIdsByProfile: Object.fromEntries(Object.entries(state.selectedGarmentIdsByProfile).map(([key, ids]) => [key, ids.filter((garmentId) => garmentId !== id)])),
    // Dated name snapshots remain meaningful after a garment is removed.
  };
}
