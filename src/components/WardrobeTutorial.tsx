import { useUiText } from "../ui-language";
import { BrandIcon } from "./BrandIcon";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './wardrobe-tutorial.css';

export interface WardrobeTutorialProps {
  preferenceKey: string;
  canAutoOpen: boolean;
  onAddGarment: () => void;
  onOpenStudio: () => void;
  onTourSection?: (section: "studio" | "wardrobe" | "outfits") => void;
}

const steps = [
  { section: 'studio', title: 'Bienvenida a tu ropero', body: 'En Probador 2D puedes combinar prendas con las flechas de cada fila.' },
  { section: 'wardrobe', title: 'Mi ropero', body: 'Aquí agregas prendas y las buscas por nombre, color o descripción. Puedes tomar una foto desde la app o elegir una de tu galería.' },
  { section: 'studio', title: 'Arma tu conjunto', body: 'Cada corazón cambia la prenda de su fila. Dale un nombre a tu combinación y pulsa Guardar conjunto.' },
  { section: 'outfits', title: 'Tus conjuntos', body: 'Aquí están tus combinaciones guardadas. Usa Probar conjunto para llevar una al probador.' },
] as const;

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function readSeen(preferenceKey: string) {
  try {
    return window.localStorage.getItem(preferenceKey) === 'seen';
  } catch {
    return false;
  }
}

function writeSeen(preferenceKey: string) {
  try {
    window.localStorage.setItem(preferenceKey, 'seen');
  } catch {
    // The in-memory dismissal still prevents another automatic opening this mount.
  }
}

export function WardrobeTutorial({
  preferenceKey,
  canAutoOpen,
  onAddGarment,
  onOpenStudio,
  onTourSection,
}: WardrobeTutorialProps): React.JSX.Element {
  const ui = useUiText();
  const titleId = useId();
  const [dismissed, setDismissed] = useState(() => readSeen(preferenceKey));
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const autoOpenAttempted = useRef(false);
  const shouldRestoreHelpFocus = useRef(true);
  const helpButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const stepTitle = useRef<HTMLHeadingElement>(null);
  const overlay = useRef<HTMLDivElement>(null);

  const markSeen = useCallback(() => {
    setDismissed(true);
    writeSeen(preferenceKey);
  }, [preferenceKey]);

  const closeTutorial = useCallback(() => {
    shouldRestoreHelpFocus.current = true;
    markSeen();
    setOpen(false);
  }, [markSeen]);

  const finishAt = useCallback((navigate: () => void) => {
    shouldRestoreHelpFocus.current = true;
    markSeen();
    setOpen(false);
    navigate();
  }, [markSeen]);

  useEffect(() => {
    if (!canAutoOpen || dismissed || autoOpenAttempted.current) return;
    autoOpenAttempted.current = true;
    shouldRestoreHelpFocus.current = true;
    setStepIndex(0);
    setOpen(true);
  }, [canAutoOpen, dismissed]);

  useLayoutEffect(() => {
    if (!open || !overlay.current) return;

    const background = Array.from(document.body.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement && element !== overlay.current,
    );
    const previous = background.map((element) => ({
      element,
      inert: element.inert,
      hadAttribute: element.hasAttribute('inert'),
    }));
    const previousOverflow = document.body.style.overflow;

    for (const element of background) {
      element.inert = true;
      element.setAttribute('inert', '');
    }
    document.body.style.overflow = 'hidden';

    return () => {
      for (const state of previous) {
        state.element.inert = state.inert;
        if (state.hadAttribute) state.element.setAttribute('inert', '');
        else state.element.removeAttribute('inert');
      }
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeTutorial();
        return;
      }
      if (event.key !== 'Tab' || !overlay.current) return;

      const controls = Array.from(
        overlay.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => !element.hasAttribute('disabled'));
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];

      if (event.shiftKey && (document.activeElement === first || !overlay.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (shouldRestoreHelpFocus.current) helpButton.current?.focus();
    };
  }, [closeTutorial, open]);

  useEffect(() => {
    if (open && stepIndex > 0) stepTitle.current?.focus();
  }, [open, stepIndex]);

  const openFromHelp = () => {
    shouldRestoreHelpFocus.current = true;
    setStepIndex(0);
    setOpen(true);
  };
  const step = steps[stepIndex];
  const finalStep = stepIndex === steps.length - 1;
  const [highlight, setHighlight] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    onTourSection?.(step.section);
    const measure = () => {
      const target = document.querySelector(`[data-tour="${step.section}"]`);
      setHighlight(target?.getBoundingClientRect() ?? null);
    };
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [open, step.section, onTourSection]);


  return (
    <>
      <button
        ref={helpButton}
        className="wardrobe-tutorial-help"
        type="button"
        onClick={openFromHelp}
      >{ui("Ayuda")}</button>
      {open && createPortal(
        <div ref={overlay} className="wardrobe-tutorial-overlay">
          {highlight && <span aria-hidden="true" className="wardrobe-tour-highlight" style={{
            left: highlight.left, top: highlight.top, width: highlight.width, height: highlight.height,
          }} />}
          <section
            className="wardrobe-tutorial-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <button
              ref={closeButton}
              className="wardrobe-tutorial-close"
              type="button"
              aria-label={ui("Cerrar tutorial")}
              onClick={closeTutorial}
            >
              ×
            </button>
            {stepIndex === 0 && <span className="wardrobe-tour-intro"><BrandIcon name="studio" /></span>}
            <p className="wardrobe-tutorial-progress" role="status">{ui("Paso")}{stepIndex + 1}{ui("de")}{steps.length}</p>
            <h2 ref={stepTitle} id={titleId} tabIndex={-1}>{ui(step.title)}</h2>
            <p className="wardrobe-tutorial-copy">{ui(step.body)}</p>
            <div className="wardrobe-tutorial-actions">
              <button className="wardrobe-tutorial-skip" type="button" onClick={closeTutorial}>{ui("Omitir")}</button>
              {stepIndex > 0 && (
                <button type="button" onClick={() => setStepIndex((current) => current - 1)}>{ui("Anterior")}</button>
              )}
              {!finalStep && (
                <button
                  className="wardrobe-tutorial-primary"
                  type="button"
                  onClick={() => setStepIndex((current) => current + 1)}
                >{ui("Siguiente")}</button>
              )}
            </div>
            {finalStep && (
              <div className="wardrobe-tutorial-destinations">
                <button
                  className="wardrobe-tutorial-primary"
                  type="button"
                  onClick={() => finishAt(onAddGarment)}
                >{ui("Añadir mi primera prenda")}</button>
                <button type="button" onClick={() => finishAt(onOpenStudio)}>{ui("Ir al probador")}</button>
              </div>
            )}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
