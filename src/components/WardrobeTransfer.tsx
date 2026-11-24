import { useUiText } from "../ui-language";
import { Capacitor } from "@capacitor/core";
import { BrandIcon } from "./BrandIcon";
import { useRef, useState } from 'react';
import type { SavedState } from '../data/app-state-store';
import type { AppStorage } from '../data/create-app-storage';
import {
  exportWardrobePackage,
  importWardrobePackage,
  inspectWardrobePackage,
  type WardrobeImportMode,
  type WardrobeImportPreview,
} from '../data/wardrobe-package';
import './wardrobe-transfer.css';

export interface WardrobeTransferProps {
  state: SavedState;
  storage: AppStorage;
  onImported: (state: SavedState) => void;
}

function plural(count: number, singular: string, pluralWord: string): string {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

export function WardrobeTransfer({ state, storage, onImported }: WardrobeTransferProps) {
  const ui = useUiText();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<WardrobeImportPreview | null>(null);
  const mode: WardrobeImportMode = 'new-profiles';
  const [busy, setBusy] = useState<'export' | 'inspect' | 'import' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const exportArchive = async () => {
    setBusy('export');
    setError('');
    setMessage('');
    try {
      const archive = await exportWardrobePackage(state, storage.photoStore);
      const url = URL.createObjectURL(archive);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ropero-${new Date().toISOString().slice(0, 10)}.ropero`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(ui("Ropero exportado con sus fotos y conjuntos."));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible exportar el ropero.');
    } finally {
      setBusy(null);
    }
  };

  const inspect = async (file: File) => {
    setBusy('inspect');
    setError('');
    setMessage('');
    setPreview(null);
    try {
      setPreview(await inspectWardrobePackage(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible revisar el archivo.');
    } finally {
      setBusy(null);
    }
  };

  const importArchive = async () => {
    if (!preview) return;
    setBusy('import');
    setError('');
    try {
      const imported = await importWardrobePackage(preview, mode, storage);
      onImported(imported);
      setPreview(null);
      setMessage(ui("Ropero importado correctamente."));
      if (inputRef.current) inputRef.current.value = '';
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible importar el ropero.');
    } finally {
      setBusy(null);
    }
  };

  return <section className="wardrobe-transfer" aria-label={ui("Transferir ropero")}>
    <div className="wardrobe-transfer-heading">
      <div><span>{ui("RESPALDO Y TRASPASO")}</span><strong>{ui("Lleva tu ropero contigo")}</strong></div>
      <span aria-hidden="true"><BrandIcon name="transfer" /></span>
    </div>
    {Capacitor.getPlatform() === 'android' && <div className="wardrobe-transfer-preview">
      <strong>{ui("Copia automática de Android")}</strong>
      <p>{ui("Activa la copia de seguridad en los ajustes de Android. El sistema decide cuándo copiar los datos y si puede restaurarlos. Si tu ropero tiene muchas fotos, guarda también un archivo .ropero: la copia en la nube de Android tiene un límite de 25 MB por app.")}</p>
    </div>}
    <p>{ui("Exporta tus prendas, conjuntos y fotos en un archivo .ropero. Puedes guardarlo en Google Drive y volver a importarlo desde otro equipo.")}</p>
    <div className="wardrobe-transfer-actions">
      <button type="button" disabled={busy !== null} onClick={() => void exportArchive()}>{busy === 'export' ? ui("Exportando…") : ui("Exportar ropero")}</button>
      <button type="button" disabled={busy !== null} onClick={() => inputRef.current?.click()}>{busy === 'inspect' ? ui("Revisando…") : ui("Importar ropero")}</button>
      <label className="wardrobe-transfer-file-label" htmlFor="wardrobe-transfer-file">{ui("Archivo .ropero")}</label>
      <input
        ref={inputRef}
        id="wardrobe-transfer-file"
        className="wardrobe-transfer-file"
        type="file"
        accept=".ropero,application/x-ropero"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void inspect(file);
        }}
      />
    </div>

    {preview && <div className="wardrobe-transfer-preview" role="status">
      <div><span>{ui("ARCHIVO REVISADO")}</span><strong>{preview.fileName}</strong></div>
      <ul>
        <li>{plural(preview.profileCount, 'perfil', 'perfiles')}</li>
        <li>{plural(preview.garmentCount, 'prenda', 'prendas')}</li>
        <li>{plural(preview.outfitCount, 'conjunto', 'conjuntos')}</li>
        <li>{plural(preview.photoCount, 'foto', 'fotos')}</li>
      </ul>
      <p>{ui("Las prendas y conjuntos del archivo se añadirán a tu ropero.")}</p>
      <div className="wardrobe-transfer-preview-actions">
        <button type="button" onClick={() => setPreview(null)}>{ui("Cancelar")}</button>
        <button className="primary" type="button" disabled={busy === 'import'} onClick={() => void importArchive()}>{busy === 'import' ? ui("Importando…") : ui("Confirmar importación")}</button>
      </div>
    </div>}
    {message && <p className="wardrobe-transfer-message" role="status">{message}</p>}
    {error && <p className="wardrobe-transfer-error" role="alert">{error}</p>}
  </section>;
}
