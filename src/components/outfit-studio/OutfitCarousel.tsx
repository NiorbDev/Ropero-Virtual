import { useUiText } from "../../ui-language";
import { BrandIcon } from "../BrandIcon";
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Garment, GarmentCategory, OutfitCanvasLayout } from '../../core/entities';
import { createDefaultLayout } from '../../core/outfit-canvas';
import type { OutfitStudioProps } from './OutfitStudio';
import { OutfitNavigator } from './OutfitNavigator';
import { PhotoPreview } from './PhotoPreview';
import './outfit-studio.css';
import './outfit-carousel.css';

const rows: Array<[GarmentCategory, string]> = [
  ['top', 'Partes de arriba'], ['outerwear', 'Abrigos'], ['dress-skirt', 'Vestidos y faldas'],
  ['bottom', 'Partes de abajo'], ['footwear', 'Calzado'],
];

export function OutfitCarousel({ garments, outfits, activeOutfitId, layout, resolvePhoto,
  onLayoutChange, onSelectOutfit, onSave, onNew, accessoryTypes, onAddAccessory }: OutfitStudioProps & {
    onNew: () => void;
    accessoryTypes: Array<{ value: string; label: string }>;
    onAddAccessory: (type?: string) => void;
  }) {
  const ui = useUiText();
  const [undoStack, setUndoStack] = useState<OutfitCanvasLayout[]>([]);
  const [redoStack, setRedoStack] = useState<OutfitCanvasLayout[]>([]);
  const [name, setName] = useState('');
  const [accessoryType, setAccessoryType] = useState('');
  const accessoryPicker = useRef<HTMLDialogElement>(null);
  const accessoryPickerTitle = useId();
  const [saved, setSaved] = useState(false);
  const emitted = useRef<OutfitCanvasLayout | null>(null);
  const nameId = useId();
  const current = outfits.find(outfit => outfit.id === activeOutfitId);
  const optionsByCategory = useMemo(() => {
    const categories = new Map<GarmentCategory, Garment[]>();
    for (const garment of garments) {
      const options = categories.get(garment.category);
      if (options) options.push(garment);
      else categories.set(garment.category, [garment]);
    }
    return categories;
  }, [garments]);
  const itemByGarmentId = useMemo(() => {
    const items = new Map<string, OutfitCanvasLayout['items'][number]>();
    for (const item of layout.items) {
      if (!items.has(item.garmentId)) items.set(item.garmentId, item);
    }
    return items;
  }, [layout.items]);
  const chosen = useMemo(
    () => garments.filter(garment => itemByGarmentId.has(garment.id)),
    [garments, itemByGarmentId],
  );

  useEffect(() => {
    if (layout === emitted.current) return;
    emitted.current = null;
    setUndoStack([]); setRedoStack([]); setSaved(false); setName('');
  }, [layout, activeOutfitId]);

  const emit = (next: OutfitCanvasLayout) => {
    emitted.current = next;
    setSaved(false);
    onLayoutChange(next);
  };
  const commit = (next: OutfitCanvasLayout) => {
    setUndoStack(history => [...history.slice(-29), layout]);
    setRedoStack([]);
    emit(next);
  };
  const replaceCategory = (category: GarmentCategory, replacement: Garment[]) => {
    // Keep the other rows' saved photo choices and legacy transforms intact.
    const retained = layout.items.filter(item => garments.find(g => g.id === item.garmentId)?.category !== category);
    const next = createDefaultLayout(replacement, new Date().toISOString());
    const replacements = next.items.map(item => layout.items.find(existing => existing.garmentId === item.garmentId) ?? item);
    commit({ ...next, items: [...retained, ...replacements].map((item, zIndex) => ({ ...item, zIndex })) });
  };
  const cycle = (category: GarmentCategory, offset: number) => {
    const options = optionsByCategory.get(category) ?? [];
    const index = options.findIndex(g => chosen.some(selected => selected.id === g.id));
    // The extra stop is an explicit empty row, useful for outfits without a jacket.
    const next = ((index + 1 + offset + options.length + 1) % (options.length + 1)) - 1;
    replaceCategory(category, next < 0 ? [] : [options[next]]);
  };

  const accessories = optionsByCategory.get('accessory') ?? [];
  const selectedAccessories = chosen.filter(garment => garment.category === 'accessory');
  const types = new Map(accessoryTypes.map(type => [type.value, type.label]));
  for (const accessory of accessories) {
    if (accessory.subtype && !types.has(accessory.subtype)) types.set(accessory.subtype, accessory.subtype);
  }
  const visibleAccessories = accessories.filter(garment => !accessoryType || garment.subtype === accessoryType);
  return <section className="outfit-studio outfit-carousel" aria-label="Probador de conjuntos 2D">
    <header className="outfit-studio-heading">
      <div><span className="outfit-studio-eyebrow">{ui("TU MIX DE HOY")}</span><h2>{ui("Arma tu conjunto")}</h2>
        <p>{ui("Una fila por tipo de prenda. Cambia con las flechas, sin arrastrar.")}</p></div>
      <div className="carousel-outfits">
        <OutfitNavigator activeOutfitId={activeOutfitId} outfits={outfits} onSelect={onSelectOutfit}/>
        <button type="button" className="carousel-new" onClick={onNew}>{ui("Nuevo conjunto")}</button>
      </div>
    </header>
    <div className="carousel-rack">
      {rows.filter(([category]) => optionsByCategory.has(category) || ['top', 'bottom', 'footwear'].includes(category)).map(([category, label]) => {
        const options = optionsByCategory.get(category) ?? [];
        const selected = chosen.filter(g => g.category === category);
        return <section className={`carousel-row carousel-row-${category}`} aria-label={ui(label)} key={category}>
          <h3>{ui(label)}</h3>
          <div className="carousel-row-controls">
            <button type="button" className="carousel-arrow" aria-label={`Anterior ${label}`} disabled={!options.length} onClick={() => cycle(category, -1)}>‹</button>
            <div className="carousel-pieces" aria-live="polite" aria-atomic="true">
              {selected.length ? selected.map(garment => {
                const item = itemByGarmentId.get(garment.id);
                const photo = garment.photoAssets.find(photo => photo.id === item?.photoAssetId) ?? garment.photoAssets[0];
                const reference = photo ? photo.cutoutRef ?? photo.originalRef : garment.imageUrls[0];
                return <figure key={garment.id}>
                  {reference ? <PhotoPreview reference={reference} resolvePhoto={resolvePhoto} alt={garment.name}/>
                    : <div className="carousel-no-photo" aria-hidden="true"><BrandIcon name={garment.category} /><small>{ui("Sin foto")}</small></div>}
                  <figcaption>{garment.name}</figcaption>
                </figure>;
              }) : <p className="carousel-empty">{options.length ? ui("Sin prenda · usa las flechas para elegir") : ui("Agrega prendas a tu ropero para verlas aquí")}</p>}
            </div>
            <button type="button" className="carousel-arrow" aria-label={`Siguiente ${label}`} disabled={!options.length} onClick={() => cycle(category, 1)}>›</button>
          </div>

        </section>;
      })}
    </div>
    <section className="carousel-accessory-panel" aria-label={ui("Accesorios")}>
      <div className="carousel-accessory-tiles">
        {selectedAccessories.map(garment => {
          const photo = garment.photoAssets[0];
          const reference = photo?.cutoutRef ?? photo?.originalRef ?? garment.imageUrls[0];
          return <button type="button" key={garment.id} aria-pressed="true" onClick={() => {
            replaceCategory('accessory', selectedAccessories.filter(item => item.id !== garment.id));
          }}>
            {reference ? <PhotoPreview reference={reference} resolvePhoto={resolvePhoto} alt="" /> : <BrandIcon name="accessory" />}
            {garment.name}
          </button>;
        })}
        <button type="button" className="carousel-accessory-add" aria-label={ui("Agregar accesorio")}
          aria-haspopup="dialog" onClick={() => accessoryPicker.current?.showModal()}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <dialog ref={accessoryPicker} className="ropero-select-sheet" aria-labelledby={accessoryPickerTitle}
        onClick={event => { if (event.target === event.currentTarget) accessoryPicker.current?.close(); }}>
        <div className="ropero-select-panel">
          <header>
            <h2 id={accessoryPickerTitle}>{ui("Accesorios")}</h2>
            <button type="button" aria-label={ui("Cerrar selector")} onClick={() => accessoryPicker.current?.close()}>×</button>
          </header>
          <div className="carousel-accessory-types" aria-label={ui("Tipo de accesorio")}>
            <button type="button" aria-pressed={!accessoryType} onClick={() => setAccessoryType('')}>{ui("Todos")}</button>
            {[...types].map(([value, label]) => (
              <button type="button" key={value} aria-pressed={accessoryType === value}
                onClick={() => setAccessoryType(value)}>{ui(label)}</button>
            ))}
          </div>
          {visibleAccessories.length > 0 && <div className="carousel-accessory-tiles">
            {visibleAccessories.map(garment => {
              const active = itemByGarmentId.has(garment.id);
              const photo = garment.photoAssets[0];
              const reference = photo?.cutoutRef ?? photo?.originalRef ?? garment.imageUrls[0];
              return <button type="button" key={garment.id} aria-pressed={active} onClick={() => {
                replaceCategory('accessory', active
                  ? selectedAccessories.filter(item => item.id !== garment.id)
                  : [...selectedAccessories, garment]);
              }}>
                {reference ? <PhotoPreview reference={reference} resolvePhoto={resolvePhoto} alt="" /> : <BrandIcon name="accessory" />}
                {garment.name}
              </button>;
            })}
          </div>}
          <div className="carousel-accessory-actions">
            <button type="button" className="primary-button compact" onClick={() => {
              accessoryPicker.current?.close();
              onAddAccessory(accessoryType || undefined);
            }}>{ui("Crear accesorio")}</button>
            <button type="button" className="carousel-accessory-done" onClick={() => accessoryPicker.current?.close()}><BrandIcon name="check" />{ui("Listo")}</button>
          </div>
        </div>
      </dialog>
    </section>
    <div className="carousel-history">
      <button type="button" disabled={!undoStack.length} onClick={() => {
        const previous = undoStack[undoStack.length - 1]; if (!previous) return;
        setUndoStack(history => history.slice(0, -1)); setRedoStack(history => [...history, layout]); emit(previous);
      }}>{ui("Deshacer")}</button>
      <button type="button" disabled={!redoStack.length} onClick={() => {
        const next = redoStack[redoStack.length - 1]; if (!next) return;
        setRedoStack(history => history.slice(0, -1)); setUndoStack(history => [...history, layout]); emit(next);
      }}>{ui("Rehacer")}</button>
    </div>
    <form className="outfit-save" onSubmit={event => {
      event.preventDefault();
      onSave(name.trim() || current?.name || ui("Mi nuevo conjunto"), layout.items.map(item => item.garmentId), layout);
      setSaved(true);
    }}>
      <label htmlFor={nameId}>{ui("Nombre del conjunto")}</label>
      <div><input id={nameId} value={name} onChange={event => { setName(event.target.value); setSaved(false); }} placeholder={current?.name || 'Ej: Salida del sábado'}/>
        <button type="submit" disabled={!chosen.length}>{ui("Guardar conjunto")}</button></div>
      <p role="status">{saved ? ui("Conjunto guardado.") : ui("Solo se guarda al pulsar Guardar. Cambiar de conjunto descarta esta vista previa.")}</p>
    </form>
  </section>;
}
