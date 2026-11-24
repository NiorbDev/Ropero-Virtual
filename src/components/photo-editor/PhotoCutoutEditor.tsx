import { useUiText } from "../../ui-language";
import { useEffect, useRef, useState } from 'react';
import {
  applyMaskStroke,
  cloneImageData,
  composeCutout,
  composeMaskedImageData,
  createOpaqueMask,
  createPreviewImageData,
  loadBlobImageData,
  hasMaskSelection,
  intersectGuidedCutout,
  maskFromCutout,
  resizeMask,
  type MaskStrokeMode,
} from '../../services/cutout-editor';
import { attachPhotoEdit, defaultPhotoFrame, framePhoto, readPhotoEdit } from '../../services/photo-frame';
import './photo-cutout-editor.css';

export interface PhotoCutoutEditorProps {
  original: Blob;
  initialCutout?: Blob | null;
  removeBackground: (photo: Blob) => Promise<Blob>;
  onAccept: (cutout: Blob) => void | Promise<void>;
  onCancel: () => void;
}

const previewPadding = 1.35;

type PhotoPoint = { x: number; y: number };

function pinchGeometry(points: PhotoPoint[]) {
  const [first, second] = points;
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
    distance: Math.hypot(first.x - second.x, first.y - second.y),
  };
}

function clampOffset(value: number) {
  return Math.max(-.9, Math.min(.9, value));
}

export function PhotoCutoutEditor({ original, initialCutout = null, removeBackground, onAccept, onCancel }: PhotoCutoutEditorProps) {
  const ui = useUiText();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, PhotoPoint>());
  const pinching = useRef(false);
  const strokeStart = useRef<ImageData | null>(null);
  const [fullOriginal, setFullOriginal] = useState<ImageData | null>(null);
  const [preview, setPreview] = useState<ImageData | null>(null);
  const [mask, setMask] = useState<ImageData | null>(null);
  const [initialMask, setInitialMask] = useState<ImageData | null>(null);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);
  const [mode, setMode] = useState<MaskStrokeMode | 'move' | 'keep'>('move');
  const [showGuide, setShowGuide] = useState(!initialCutout);
  const [frame, setFrame] = useState(defaultPhotoFrame);
  const [selection, setSelection] = useState<ImageData | null>(null);
  const [selectionUndo, setSelectionUndo] = useState<ImageData[]>([]);
  const [selectionRedo, setSelectionRedo] = useState<ImageData[]>([]);
  const [refining, setRefining] = useState(false);
  const guided = mode === 'keep';
  const paintMask = guided ? selection : mask;
  const setPaintMask = guided ? setSelection : setMask;
  const paintUndo = guided ? selectionUndo : undoStack;
  const setPaintUndo = guided ? setSelectionUndo : setUndoStack;
  const paintRedo = guided ? selectionRedo : redoStack;
  const setPaintRedo = guided ? setSelectionRedo : setRedoStack;
  const previewLayer = useRef<HTMLCanvasElement | null>(null);
  const [brushSize, setBrushSize] = useState(24);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void Promise.all([
      loadBlobImageData(original),
      initialCutout ? readPhotoEdit(initialCutout) : Promise.resolve(null),
    ]).then(async ([source, edit]) => {
      const cutout = initialCutout && !edit ? await loadBlobImageData(initialCutout) : null;
      if (!active) return;
      const editable = createPreviewImageData(source);
      const nextMask = edit ? resizeMask(edit.mask, editable.width, editable.height) : cutout
        ? resizeMask(maskFromCutout(cutout), editable.width, editable.height)
        : createOpaqueMask(editable.width, editable.height);
      setFrame(edit?.frame ?? defaultPhotoFrame);
      setSelection(null);
      setSelectionUndo([]);
      setSelectionRedo([]);
      setFullOriginal(source);
      setPreview(editable);
      setMask(nextMask);
      setInitialMask(cloneImageData(nextMask));
      setUndoStack([]);
      setRedoStack([]);
      setLoading(false);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : 'No fue posible abrir esta fotografía.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [initialCutout, original]);

  useEffect(() => {
    if (!preview || !mask) return;
    const layer = previewLayer.current ?? document.createElement('canvas');
    previewLayer.current = layer;
    layer.width = preview.width;
    layer.height = preview.height;
    const context = layer.getContext('2d');
    if (!context) return;
    const display = guided ? cloneImageData(preview) : composeMaskedImageData(preview, mask);
    if (guided) {
      for (let i = 0; i < display.data.length; i += 4) {
        if (selection?.data[i + 3]) {
          display.data[i] = Math.round(display.data[i] * .6 + 32);
          display.data[i + 1] = Math.round(display.data[i + 1] * .6 + 96);
          display.data[i + 2] = Math.round(display.data[i + 2] * .6 + 72);
        }
      }
    } else if (showGuide && mode === 'restore') {
      for (let i = 3; i < display.data.length; i += 4) {
        display.data[i] ||= Math.round(preview.data[i] * .22);
      }
    }
    context.putImageData(display, 0, 0);
  }, [guided, mask, mode, preview, selection, showGuide]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = previewLayer.current;
    if (!canvas || !layer || !preview) return;
    canvas.width = Math.ceil(preview.width * previewPadding);
    canvas.height = Math.ceil(preview.height * previewPadding);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.translate((canvas.width - preview.width) / 2, (canvas.height - preview.height) / 2);
    framePhoto(context, layer, preview.width, preview.height, frame);
  }, [frame, guided, mask, mode, preview, selection, showGuide]);

  const paintAt = (event: React.PointerEvent<HTMLCanvasElement>, previous?: PhotoPoint) => {
    if (!preview || mode === 'move') return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const angle = frame.angle * Math.PI / 180;
    const toImagePoint = (clientX: number, clientY: number) => {
      const dx = (((clientX - rect.left) / rect.width - .5) * previewPadding - frame.x) * preview.width;
      const dy = (((clientY - rect.top) / rect.height - .5) * previewPadding - frame.y) * preview.height;
      return {
        x: (dx * Math.cos(angle) + dy * Math.sin(angle)) / frame.zoom + preview.width / 2,
        y: (dy * Math.cos(angle) - dx * Math.sin(angle)) / frame.zoom + preview.height / 2,
      };
    };
    const point = toImagePoint(event.clientX, event.clientY);
    const from = previous ? toImagePoint(previous.x, previous.y) : point;
    const radius = (brushSize / 2) * (preview.width * previewPadding / rect.width) / frame.zoom;
    setPaintMask(current => current ? applyMaskStroke(current, {
      mode: mode === 'keep' ? 'restore' : mode, ...point, from, radius,
    }) : current);
  };

  const finishPointer = (event: React.PointerEvent<HTMLCanvasElement>, cancelled = false) => {
    const positions = pointers.current;
    if (!positions.delete(event.pointerId)) return;
    if (!pinching.current && strokeStart.current) {
      const before = strokeStart.current;
      if (cancelled) {
        setPaintMask(before);
      } else {
        paintAt(event);
        setPaintUndo(history => [...history.slice(-29), before]);
        setPaintRedo([]);
      }
      strokeStart.current = null;
    }
    if (!positions.size) pinching.current = false;
  };

  const undo = () => {
    if (!paintMask || !paintUndo.length) return;
    const previous = paintUndo[paintUndo.length - 1];
    setPaintUndo((history) => history.slice(0, -1));
    setPaintRedo((history) => [...history.slice(-29), paintMask]);
    setPaintMask(cloneImageData(previous));
  };

  const redo = () => {
    if (!paintMask || !paintRedo.length) return;
    const next = paintRedo[paintRedo.length - 1];
    setPaintRedo((history) => history.slice(0, -1));
    setPaintUndo((history) => [...history.slice(-29), paintMask]);
    setPaintMask(cloneImageData(next));
  };

  const applyGuidedCutout = async () => {
    if (!selection || !mask || !hasMaskSelection(selection) || refining || saving) return;
    setRefining(true);
    setError('');
    try {
      const automatic = await loadBlobImageData(await removeBackground(original));
      const margin = Math.max(2, Math.round(Math.max(selection.width, selection.height) * .012));
      const result = intersectGuidedCutout(automatic, selection, margin);
      if (!hasMaskSelection(result)) {
        setError(ui("No se detectó un objeto dentro de tu selección. Amplía la zona y vuelve a intentar."));
        return;
      }
      setUndoStack(history => [...history.slice(-29), mask]);
      setRedoStack([]);
      setMask(result);
      setMode('move');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : ui("No se pudo completar el recorte guiado."));
    } finally {
      setRefining(false);
    }
  };

  const accept = async () => {
    if (!fullOriginal || !mask || saving) return;
    setSaving(true);
    setError('');
    try {
      if (!mask.data.some((value, index) => index % 4 === 3 && value !== 0)) {
        setError(ui("El recorte quedó vacío. Deshaz el último cambio o recupera una zona."));
        return;
      }
      const originalMask = resizeMask(mask, fullOriginal.width, fullOriginal.height);
      await onAccept(attachPhotoEdit(await composeCutout(fullOriginal, originalMask, frame), mask, frame));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible guardar el recorte.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="photo-cutout-backdrop" role="presentation">
    <section className="photo-cutout-editor" role="dialog" aria-modal="true" aria-labelledby="cutout-title">
      <header>
        <div>
          <span>{ui("AJUSTE DE FOTO")}</span>
          <h2 id="cutout-title">{ui("Ajustar recorte")}</h2>
          <p>{ui("Usa un dedo para la herramienta activa y dos para mover o acercar la foto.")}</p>
        </div>
        <button className="photo-cutout-close" type="button" aria-label={ui("Cerrar editor")} onClick={onCancel}>×</button>
      </header>

      <div className="photo-cutout-workspace">
        <div className="photo-cutout-canvas-wrap">
          {loading && <div className="photo-cutout-status" role="status">{ui("Preparando la foto…")}</div>}
          {error && !preview && <div className="photo-cutout-status error" role="alert">{error}</div>}
          {preview && mask && <canvas
            ref={canvasRef}
            className="photo-cutout-canvas"
            style={{ '--photo-ratio': preview.width / preview.height, aspectRatio: preview.width / preview.height, cursor: mode === 'move' ? 'grab' : 'crosshair' } as React.CSSProperties}
            aria-label={ui("Vista previa del recorte")}
            onPointerDown={(event) => {
              if (saving || refining || event.button !== 0 || pointers.current.size >= 2) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture?.(event.pointerId);
              const positions = pointers.current;
              positions.set(event.pointerId, { x: event.clientX, y: event.clientY });
              if (positions.size === 2) {
                pinching.current = true;
                if (strokeStart.current) setPaintMask(strokeStart.current);
                strokeStart.current = null;
              } else if (mode !== 'move') {
                strokeStart.current = paintMask;
              }
            }}
            onPointerMove={(event) => {
              const positions = pointers.current;
              const previous = positions.get(event.pointerId);
              if (!previous) return;
              const rect = event.currentTarget.getBoundingClientRect();
              if (!rect.width || !rect.height) return;
              const before = positions.size === 2 ? pinchGeometry([...positions.values()]) : null;
              const point = { x: event.clientX, y: event.clientY };
              positions.set(event.pointerId, point);
              if (before) {
                const after = pinchGeometry([...positions.values()]);
                setFrame(current => {
                  const zoom = Math.max(.5, Math.min(3, current.zoom * after.distance / Math.max(1, before.distance)));
                  const ratio = zoom / current.zoom;
                  const anchorX = ((before.x - rect.left) / rect.width - .5) * previewPadding;
                  const anchorY = ((before.y - rect.top) / rect.height - .5) * previewPadding;
                  return {
                    ...current,
                    zoom,
                    x: clampOffset(anchorX + (current.x - anchorX) * ratio + (after.x - before.x) * previewPadding / rect.width),
                    y: clampOffset(anchorY + (current.y - anchorY) * ratio + (after.y - before.y) * previewPadding / rect.height),
                  };
                });
              } else if (!pinching.current && mode === 'move') {
                setFrame(current => ({
                  ...current,
                  x: clampOffset(current.x + (point.x - previous.x) * previewPadding / rect.width),
                  y: clampOffset(current.y + (point.y - previous.y) * previewPadding / rect.height),
                }));
              } else if (!pinching.current) {
                paintAt(event, previous);
              }
            }}
            onPointerUp={event => finishPointer(event)}
            onPointerCancel={event => finishPointer(event, true)}
            onLostPointerCapture={event => finishPointer(event, true)}
          />}
        </div>

        <fieldset className="photo-cutout-controls" disabled={saving || refining}>
          <div className="photo-cutout-mode" aria-label={ui("Modo del pincel")}>
            <button className={mode === 'erase' ? 'active' : ''} type="button" aria-pressed={mode === 'erase'} onClick={() => setMode('erase')}><span>⌫</span>{ui("Borrar fondo")}</button>
            <button className={mode === 'restore' ? 'active' : ''} type="button" aria-pressed={mode === 'restore'} onClick={() => setMode('restore')}><span>✎</span>{ui("Recuperar zona")}</button>
          </div>
          <div className="photo-cutout-mode">
            <button type="button" className={mode === 'move' ? 'active' : ''} aria-pressed={mode === 'move'} onClick={() => setMode('move')}>{ui("Mover foto")}</button>
            <button type="button" disabled={!mask} className={guided ? 'active' : ''} aria-pressed={guided} onClick={() => {
              if (!mask) return;
              setSelection(current => current ?? new ImageData(mask.width, mask.height));
              setMode('keep');
            }}>{ui("Recorte guiado")}</button>
          </div>
          {guided && <div className="photo-cutout-framing">
            <p>{ui("Pinta por encima de lo que quieres conservar. No hace falta ser preciso: el recorte automático ajustará los bordes y eliminará el resto.")}</p>
            <button className="photo-cutout-reset" type="button" disabled={!hasMaskSelection(selection)} onClick={() => {
              if (!selection) return;
              setSelectionUndo(history => [...history.slice(-29), selection]);
              setSelectionRedo([]);
              setSelection(new ImageData(selection.width, selection.height));
            }}>{ui("Limpiar selección")}</button>
          </div>}
          {mode === 'restore' && <button className="photo-cutout-reset" type="button" aria-pressed={showGuide} onClick={() => setShowGuide(value => !value)}>
            {showGuide ? ui("Ocultar guía de la foto original") : ui("Mostrar guía de la foto original")}
          </button>}
          {mode === 'move' && <div className="photo-cutout-framing">
            <label className="photo-cutout-size"><span>{ui("Giro")}<strong>{frame.angle}°</strong></span>
              <input type="range" min="-180" max="180" value={frame.angle} onChange={event => setFrame({ ...frame, angle: Number(event.target.value) })} />
            </label>
            <label className="photo-cutout-size"><span>{ui("Zoom")}<strong>{Math.round(frame.zoom * 100)}%</strong></span>
              <input type="range" min=".5" max="3" step=".05" value={frame.zoom} onChange={event => setFrame({ ...frame, zoom: Number(event.target.value) })} />
            </label>
            <button className="photo-cutout-reset" type="button" onClick={() => setFrame(defaultPhotoFrame)}>{ui("Restablecer encuadre")}</button>
          </div>}
          {mode !== 'move' && <label className="photo-cutout-size">
            <span>{ui("Tamaño del pincel")}<strong>{brushSize}px</strong></span>
            <input aria-label={ui("Tamaño del pincel")} type="range" min="6" max="96" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
          </label>}
          <div className="photo-cutout-history">
            <button type="button" aria-label={ui("Deshacer")} disabled={!paintUndo.length} onClick={undo}>↶ <span>{ui("Deshacer")}</span></button>
            <button type="button" aria-label={ui("Rehacer")} disabled={!paintRedo.length} onClick={redo}>↷ <span>{ui("Rehacer")}</span></button>
          </div>
          <button className="photo-cutout-reset" type="button" aria-label={ui("Restablecer recorte")} disabled={!initialMask || !mask} onClick={() => {
            if (!initialMask || !mask) return;
            setUndoStack((history) => [...history.slice(-29), cloneImageData(mask)]);
            setRedoStack([]);
            setMask(cloneImageData(initialMask));

            setMode('move');
          }}>{ui("Restablecer recorte")}</button>
          {!guided && <div className="photo-cutout-tip"><span>♡</span><p>{ui("Acércate a los bordes con un pincel pequeño para conservar todos los detalles de la prenda.")}</p></div>}
        </fieldset>
      </div>

      {error && preview && <p className="photo-cutout-error" role="alert">{error}</p>}
      <footer>
        <button className="photo-cutout-secondary" type="button" onClick={onCancel}>{ui("Cancelar")}</button>
        <button className="photo-cutout-secondary" type="button" disabled={loading || saving || refining} onClick={() => {
          setSaving(true);
          void Promise.resolve().then(() => onAccept(original)).catch((reason: Error) => setError(reason.message)).finally(() => setSaving(false));
        }}>{ui("Usar foto completa")}</button>
        {guided
          ? <button className="photo-cutout-primary" type="button" disabled={!hasMaskSelection(selection) || refining} onClick={() => void applyGuidedCutout()}>{ui(refining ? "Afinando bordes…" : "Aplicar recorte guiado")}</button>
          : <button className="photo-cutout-primary" type="button" disabled={!mask || saving} onClick={() => void accept()}>{ui(saving ? "Guardando…" : "Guardar recorte")}</button>}
      </footer>
    </section>
  </div>;
}
