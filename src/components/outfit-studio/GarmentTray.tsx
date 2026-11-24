import type { Garment } from '../../core/entities';
import { PhotoPreview } from './PhotoPreview';

interface GarmentTrayProps {
  garments: Garment[];
  selectedGarmentIds: Set<string>;
  onAdd: (garment: Garment) => void;
  resolvePhoto: (reference: string) => Promise<string>;
}

function previewReference(garment: Garment): string | null {
  const photo = garment.photoAssets[0];
  return photo ? photo.cutoutRef ?? photo.originalRef : garment.imageUrls[0] ?? null;
}

export function GarmentTray({ garments, selectedGarmentIds, onAdd, resolvePhoto }: GarmentTrayProps) {
  return <aside className="outfit-tray" aria-label="Tus prendas">
    <div className="outfit-tray-heading">
      <div>
        <span className="outfit-studio-eyebrow">TU ROPERO</span>
        <h3>Elige una prenda</h3>
      </div>
      <span className="outfit-tray-count">{garments.length}</span>
    </div>
    <div className="outfit-tray-list">
      {garments.map((garment) => {
        const reference = previewReference(garment);
        const added = selectedGarmentIds.has(garment.id);
        return <button
          className={`outfit-tray-card${added ? ' added' : ''}`}
          disabled={added}
          key={garment.id}
          type="button"
          aria-label={`Agregar ${garment.name}`}
          onClick={() => onAdd(garment)}
        >
          <span className="outfit-tray-photo" aria-hidden="true">
            {reference
              ? <PhotoPreview alt="" reference={reference} resolvePhoto={resolvePhoto} />
              : <span className="outfit-tray-placeholder">♡</span>}
          </span>
          <span className="outfit-tray-details">
            <span className="outfit-tray-name">{garment.name}</span>
            <span className="outfit-tray-color">{garment.colors.join(', ') || 'Sin color'}</span>
          </span>
          <span className="outfit-tray-add" aria-hidden="true">{added ? '✓' : '+'}</span>
        </button>;
      })}
    </div>
  </aside>;
}
