import { useEffect, useMemo, useRef } from 'react';
import type { Garment, OutfitCanvasItem, OutfitCanvasLayout } from '../../core/entities';
import { moveCanvasItem, type CanvasPoint } from '../../core/outfit-canvas';
import { PhotoPreview } from './PhotoPreview';

interface OutfitCanvasProps {
  garments: Garment[];
  layout: OutfitCanvasLayout;
  selectedItemId: string | null;
  resolvePhoto: (reference: string) => Promise<string>;
  onDragPreview: (layout: OutfitCanvasLayout) => void;
  onDragCommit: (before: OutfitCanvasLayout, after: OutfitCanvasLayout) => void;
  onSelect: (itemId: string) => void;
}

interface DragState {
  itemId: string;
  pointerId: number;
  before: OutfitCanvasLayout;
  point: CanvasPoint;
}

function referenceFor(item: OutfitCanvasItem, garment: Garment): string | null {
  const selected = garment.photoAssets.find((photo) => photo.id === item.photoAssetId)
    ?? garment.photoAssets[0];
  return selected ? selected.cutoutRef ?? selected.originalRef : garment.imageUrls[0] ?? null;
}

function normalizedPoint(event: React.PointerEvent<HTMLElement>): CanvasPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 0.5, y: 0.5 };
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  };
}

export function OutfitCanvas({
  garments,
  layout,
  selectedItemId,
  resolvePhoto,
  onDragPreview,
  onDragCommit,
  onSelect,
}: OutfitCanvasProps) {
  const drag = useRef<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // A profile/outfit switch must not complete a drag from the previous canvas.
    if (drag.current && !layout.items.some((item) => item.id === drag.current?.itemId)) drag.current = null;
  }, [layout]);
  const garmentById = useMemo(() => new Map(garments.map((garment) => [garment.id, garment])), [garments]);
  const sortedItems = [...layout.items].sort((left, right) => left.zIndex - right.zIndex);

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const point = normalizedPoint(event);
    const after = moveCanvasItem(current.before, current.itemId, point, new Date().toISOString());
    drag.current = null;
    onDragCommit(current.before, after);
  };

  return <div
    ref={canvasRef}
    className="outfit-canvas"
    data-testid="outfit-canvas"
    onPointerMove={(event) => {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId) return;
      current.point = normalizedPoint(event);
      onDragPreview(moveCanvasItem(current.before, current.itemId, current.point, new Date().toISOString()));
    }}
    onPointerUp={finishDrag}
    onPointerCancel={() => {
      const current = drag.current;
      drag.current = null;
      if (current) onDragPreview(current.before);
    }}
  >
    <div className="outfit-canvas-grid" aria-hidden="true" />
    {sortedItems.length === 0 && <div className="outfit-canvas-empty">
      <span>✦</span>
      <strong>Tu outfit empieza aquí</strong>
      <p>Agrega prendas desde tu ropero y ordénalas como quieras.</p>
    </div>}
    {sortedItems.map((item) => {
      const garment = garmentById.get(item.garmentId);
      if (!garment) return null;
      const reference = referenceFor(item, garment);
      const selected = item.id === selectedItemId;
      return <button
        className={`outfit-canvas-item${selected ? ' selected' : ''}`}
        key={item.id}
        type="button"
        aria-label={`Seleccionar ${garment.name}`}
        aria-pressed={selected}
        style={{
          left: `${item.x * 100}%`,
          top: `${item.y * 100}%`,
          zIndex: item.zIndex + 1,
          transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale}) scaleX(${item.flipX ? -1 : 1})`,
        }}
        onClick={() => onSelect(item.id)}
        onPointerDown={(event) => {
          event.preventDefault();
          canvasRef.current?.setPointerCapture?.(event.pointerId);
          onSelect(item.id);
          drag.current = {
            itemId: item.id,
            pointerId: event.pointerId,
            before: layout,
            point: { x: item.x, y: item.y },
          };
        }}
      >
        {reference
          ? <PhotoPreview className="outfit-canvas-photo" alt={garment.name} reference={reference} resolvePhoto={resolvePhoto} />
          : <span className="outfit-canvas-placeholder"><span>♡</span><strong>{garment.name}</strong><small>Sin foto</small></span>}
      </button>;
    })}
  </div>;
}
