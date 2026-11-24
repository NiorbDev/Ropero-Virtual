import { useUiText } from "../ui-language";
import { useState } from 'react';

export function ItemActions({ name, archived, onArchive, onDelete }: {
  name: string; archived: boolean; onArchive: () => void; onDelete: () => void;
}) {
  const ui = useUiText();
  const [confirming, setConfirming] = useState(false);
  return <div className="item-actions">
    <button type="button" onClick={onArchive} aria-label={`${archived ? ui("Restaurar") : ui("Archivar")} ${name}`}>
      {archived ? ui("Restaurar") : ui("Archivar")}
    </button>
    {!confirming ? <button type="button" className="danger" onClick={() => setConfirming(true)} aria-label={`Eliminar ${name}`}>{ui("Eliminar")}</button> :
      <div className="delete-confirmation" role="group" aria-label={`Confirmar eliminación de ${name}`}>
        <p>¿Eliminar «{name}»? Esta acción no se puede deshacer aquí. El historial de uso se conserva.</p>
        <button type="button" className="danger" onClick={onDelete}>{ui("Sí, eliminar")}</button>
        <button type="button" onClick={() => setConfirming(false)}>{ui("Cancelar")}</button>
      </div>}
  </div>;
}
