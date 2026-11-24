export interface OutfitDraft {
  garmentIds: string[];
}

export function validateOutfit(outfit: OutfitDraft): void {
  if (outfit.garmentIds.length === 0) {
    throw new Error('An outfit needs at least one garment.');
  }

  if (new Set(outfit.garmentIds).size !== outfit.garmentIds.length) {
    throw new Error('An outfit can only contain unique garments.');
  }
}
