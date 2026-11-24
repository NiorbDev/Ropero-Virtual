import { useUiText } from "../../ui-language";
import type { Outfit } from '../../core/entities';

interface OutfitNavigatorProps {
  activeOutfitId: string | null;
  outfits: Outfit[];
  onSelect: (outfit: Outfit) => void;
}

export function OutfitNavigator({ activeOutfitId, outfits, onSelect }: OutfitNavigatorProps) {
  const ui = useUiText();
  const activeIndex = outfits.findIndex((outfit) => outfit.id === activeOutfitId);
  const current = activeIndex >= 0 ? outfits[activeIndex] : null;
  const selectOffset = (offset: number) => {
    if (!outfits.length) return;
    const next = activeIndex < 0 ? (offset > 0 ? 0 : outfits.length - 1)
      : (activeIndex + offset + outfits.length) % outfits.length;
    onSelect(outfits[next]);
  };

  return <div className="outfit-navigator">
    <button type="button" aria-label={ui("Conjunto anterior")} disabled={!outfits.length} onClick={() => selectOffset(-1)}>‹</button>
    <div>
      <span>{ui("CONJUNTO ACTUAL")}</span>
      <strong>{current?.name ?? ui("Nuevo conjunto")}</strong>
    </div>
    <button type="button" aria-label={ui("Conjunto siguiente")} disabled={!outfits.length} onClick={() => selectOffset(1)}>›</button>
  </div>;
}
