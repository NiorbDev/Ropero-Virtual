import { useEffect, useState } from "react";
import type { UpdateServiceWorker } from "../pwa";
import "./PwaUpdateNotice.css";

const updateReadyEvent = "ropero:update-ready";

export function PwaUpdateNotice() {
  const [updateServiceWorker, setUpdateServiceWorker] = useState<UpdateServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const showUpdate = (event: Event) => {
      const update = (event as CustomEvent<UpdateServiceWorker>).detail;
      if (typeof update !== "function") return;

      setUpdateServiceWorker(() => update);
      setError("");
    };

    window.addEventListener(updateReadyEvent, showUpdate);
    window.dispatchEvent(new Event("ropero:update-ready-request"));
    return () => window.removeEventListener(updateReadyEvent, showUpdate);
  }, []);

  if (!updateServiceWorker) return null;
  const update = updateServiceWorker;

  async function applyUpdate() {
    setError("");
    setIsUpdating(true);

    try {
      await update(true);
    } catch {
      setIsUpdating(false);
      setError("No se pudo actualizar todavía. Puedes intentarlo de nuevo cuando quieras.");
    }
  }

  return (
    <aside className="pwa-update-notice" aria-live="polite">
      <p>Hay una nueva versión lista. Guarda cualquier cambio que estés editando y actualiza cuando quieras.</p>
      {error && <p className="pwa-update-error" role="alert">{error}</p>}
      <button type="button" onClick={applyUpdate} disabled={isUpdating}>
        {isUpdating ? "Actualizando…" : error ? "Reintentar actualización" : "Actualizar ahora"}
      </button>
    </aside>
  );
}
