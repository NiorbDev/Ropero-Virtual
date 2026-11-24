import { useEffect, useMemo, useRef, useState } from 'react';
import type { Garment, Outfit, OutfitCanvasLayout } from '../../core/entities';
import {
  addCanvasGarment,
  flipCanvasItem,
  removeCanvasItem,
  reorderCanvasItem,
  rotateCanvasItem,
  scaleCanvasItem,
} from '../../core/outfit-canvas';
import { GarmentTray } from './GarmentTray';
import { OutfitCanvas } from './OutfitCanvas';
import { OutfitNavigator } from './OutfitNavigator';
import { OutfitToolbar } from './OutfitToolbar';
import './outfit-studio.css';

export interface OutfitStudioProps {
  garments: Garment[];
  outfits: Outfit[];
  activeOutfitId: string | null;
  layout: OutfitCanvasLayout;
  resolvePhoto: (reference: string) => Promise<string>;
  onLayoutChange: (layout: OutfitCanvasLayout) => void;
  onSelectOutfit: (outfit: Outfit) => void;
  onSave: (name: string, garmentIds: string[], layout: OutfitCanvasLayout) => void;
}

function timestamp(): string {
  return new Date().toISOString();
}

export function OutfitStudio({
  garments,
  outfits,
  activeOutfitId,
  layout,
  resolvePhoto,
  onLayoutChange,
  onSelectOutfit,
  onSave,
}: OutfitStudioProps) {
  const [draft, setDraft] = useState(layout);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(layout.items[0]?.id ?? null);
  const [undoStack, setUndoStack] = useState<OutfitCanvasLayout[]>([]);
  const [redoStack, setRedoStack] = useState<OutfitCanvasLayout[]>([]);
  const [name, setName] = useState('');
  const emittedLayout = useRef<OutfitCanvasLayout | null>(null);

  useEffect(() => {
    // A parent echo acknowledges our edit; only an external layout starts a new history.
    if (layout === emittedLayout.current) return;
    emittedLayout.current = null;
    setDraft(layout);
    setSelectedItemId((selected) => layout.items.some((item) => item.id === selected)
      ? selected
      : layout.items[0]?.id ?? null);
    setUndoStack([]);
    setRedoStack([]);
  }, [layout]);

  const selectedItem = draft.items.find((item) => item.id === selectedItemId) ?? null;
  const selectedGarmentIds = useMemo(() => new Set(draft.items.map((item) => item.garmentId)), [draft.items]);

  const commit = (next: OutfitCanvasLayout, before = draft) => {
    setUndoStack((history) => [...history.slice(-29), before]);
    setRedoStack([]);
    setDraft(next);
    emittedLayout.current = next;
    onLayoutChange(next);
  };

  const transformSelected = (operation: (itemId: string) => OutfitCanvasLayout) => {
    if (!selectedItemId) return;
    commit(operation(selectedItemId));
  };

  const undo = () => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setUndoStack((history) => history.slice(0, -1));
    setRedoStack((history) => [...history, draft]);
    setDraft(previous);
    emittedLayout.current = previous;
    onLayoutChange(previous);
  };

  const redo = () => {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setRedoStack((history) => history.slice(0, -1));
    setUndoStack((history) => [...history, draft]);
    setDraft(next);
    emittedLayout.current = next;
    onLayoutChange(next);
  };

  return <section className="outfit-studio" aria-label="Probador de conjuntos 2D">
    <header className="outfit-studio-heading">
      <div>
        <span className="outfit-studio-eyebrow">ESTUDIO DE ESTILO</span>
        <h2>Arma tu conjunto</h2>
        <p>Combina tus prendas reales, muévelas y guarda la idea para después.</p>
      </div>
      <OutfitNavigator activeOutfitId={activeOutfitId} outfits={outfits} onSelect={onSelectOutfit} />
    </header>

    <div className="outfit-studio-workspace">
      <main className="outfit-studio-stage">
        <OutfitCanvas
          garments={garments}
          layout={draft}
          selectedItemId={selectedItemId}
          resolvePhoto={resolvePhoto}
          onSelect={setSelectedItemId}
          onDragPreview={setDraft}
          onDragCommit={(before, after) => commit(after, before)}
        />
        <OutfitToolbar
          disabled={!selectedItem}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={undo}
          onRedo={redo}
          onScaleDown={() => selectedItem && transformSelected((id) => scaleCanvasItem(draft, id, selectedItem.scale - 0.1, timestamp()))}
          onScaleUp={() => selectedItem && transformSelected((id) => scaleCanvasItem(draft, id, selectedItem.scale + 0.1, timestamp()))}
          onRotateRight={() => selectedItem && transformSelected((id) => rotateCanvasItem(draft, id, selectedItem.rotation + 15, timestamp()))}
          onFlip={() => transformSelected((id) => flipCanvasItem(draft, id, timestamp()))}
          onFront={() => transformSelected((id) => reorderCanvasItem(draft, id, 'front', timestamp()))}
          onBack={() => transformSelected((id) => reorderCanvasItem(draft, id, 'back', timestamp()))}
          onRemove={() => {
            if (!selectedItemId) return;
            const next = removeCanvasItem(draft, selectedItemId, timestamp());
            commit(next);
            setSelectedItemId(next.items[next.items.length - 1]?.id ?? null);
          }}
        />
        <form className="outfit-save" onSubmit={(event) => {
          event.preventDefault();
          const finalName = name.trim() || outfits.find((outfit) => outfit.id === activeOutfitId)?.name || 'Mi nuevo conjunto';
          onSave(finalName, draft.items.map((item) => item.garmentId), draft);
          setName('');
        }}>
          <label htmlFor="outfit-name">Nombre del conjunto</label>
          <div>
            <input id="outfit-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej: Salida del sábado" />
            <button type="submit" disabled={!draft.items.length}>Guardar conjunto</button>
          </div>
        </form>
      </main>
      <GarmentTray garments={garments} selectedGarmentIds={selectedGarmentIds} onAdd={(garment) => {
        const next = addCanvasGarment(draft, garment, timestamp());
        if (next === draft) return;
        commit(next);
        setSelectedItemId(next.items.find((item) => item.garmentId === garment.id)?.id ?? null);
      }} resolvePhoto={resolvePhoto} />
    </div>
  </section>;
}
