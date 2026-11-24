import { useState } from 'react';

interface OutfitToolbarProps {
  disabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onScaleDown: () => void;
  onScaleUp: () => void;
  onRotateRight: () => void;
  onFlip: () => void;
  onFront: () => void;
  onBack: () => void;
  onRemove: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function OutfitToolbar(props: OutfitToolbarProps) {
  const [showLayerActions, setShowLayerActions] = useState(false);
  const action = (label: string, icon: string, onClick: () => void, danger = false) => <button
    className={danger ? 'danger' : ''}
    type="button"
    aria-label={label}
    title={label}
    disabled={props.disabled}
    onClick={onClick}
  ><span aria-hidden="true">{icon}</span><small>{label}</small></button>;

  return <div className="outfit-toolbar" aria-label="Herramientas de la prenda">
    <div className="outfit-toolbar-history">
      <button type="button" aria-label="Deshacer" title="Deshacer" disabled={!props.canUndo} onClick={props.onUndo}>↶</button>
      <button type="button" aria-label="Rehacer" title="Rehacer" disabled={!props.canRedo} onClick={props.onRedo}>↷</button>
    </div>
    <div className="outfit-toolbar-actions">
      {action('Hacer más pequeña', '−', props.onScaleDown)}
      {action('Hacer más grande', '+', props.onScaleUp)}
      {action('Girar a la derecha', '↷', props.onRotateRight)}
      {action('Voltear horizontalmente', '⇆', props.onFlip)}
      <button
        type="button"
        aria-label="Orden de capas"
        aria-expanded={showLayerActions}
        disabled={props.disabled}
        onClick={() => setShowLayerActions((visible) => !visible)}
      ><span aria-hidden="true">☷</span><small>Orden</small></button>
      {showLayerActions && action('Traer al frente', '⇧', props.onFront)}
      {showLayerActions && action('Enviar al fondo', '⇩', props.onBack)}
      {action('Quitar del conjunto', '×', props.onRemove, true)}
    </div>
  </div>;
}
