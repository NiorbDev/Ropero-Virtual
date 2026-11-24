import { useUiText } from "../ui-language";
import { useEffect, useRef, useState } from "react";
import { BrandIcon } from "./BrandIcon";

export function GarmentPhotoPicker({ onPhotos }: { onPhotos: (files: File[], openEditor?: boolean) => void }) {
  const ui = useUiText();
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!camera) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((result) => {
        if (cancelled) { result.getTracks().forEach((track) => track.stop()); return; }
        stream = result;
        if (video.current) video.current.srcObject = result;
      })
      .catch(() => {
        if (cancelled) return;
        setError(ui("No pude abrir la cámara. Revisa el permiso o usa una foto de la galería."));
        setCamera(false);
      });
    return () => { cancelled = true; stream?.getTracks().forEach((track) => track.stop()); };
  }, [camera]);

  function capture() {
    const preview = video.current;
    if (!preview?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = preview.videoWidth;
    canvas.height = preview.videoHeight;
    canvas.getContext("2d")?.drawImage(preview, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onPhotos([new File([blob], "prenda.jpg", { type: "image/jpeg" })], true);
    }, "image/jpeg", 0.9);
    setCamera(false);
  }

  return <div className="wide-field photo-upload-field">
    <div className="photo-upload-heading"><BrandIcon name="photo" /><span>{ui("Fotos de la prenda")}<small>{ui("Opcional · puedes agregarlas después")}</small></span></div>
    <div className="photo-picker-actions">
      {navigator.mediaDevices && !camera && <button type="button" onClick={() => { setError(""); setCamera(true); }}>{ui("Usar cámara")}</button>}
      <button type="button" onClick={() => { setCamera(false); input.current?.click(); }}>{ui("Elegir de la galería")}</button>
    </div>
    <input ref={input} hidden type="file" accept="image/*" multiple aria-label={ui("Fotos de la prenda")} onChange={(event) => {
      onPhotos(Array.from(event.currentTarget.files ?? []));
      event.currentTarget.value = "";
    }} />
    {camera && <div className="photo-picker-camera">
      <video ref={video} autoPlay muted playsInline aria-label={ui("Vista previa de la cámara")} />
      <div className="photo-picker-actions"><button type="button" onClick={capture}>{ui("Tomar foto")}</button><button type="button" onClick={() => setCamera(false)}>{ui("Cerrar cámara")}</button></div>
    </div>}
    {error && <p role="status">{error}</p>}
  </div>;
}
