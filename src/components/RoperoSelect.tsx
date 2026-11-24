import { useUiText } from "../ui-language";
import { useId, useRef, useState } from "react";
import "./ropero-select.css";

type Option<T> = { value: T; label: string; group?: string };

export function RoperoSelect<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly Option<T>[]; onChange: (value: T) => void;
}) {
  const ui = useUiText();
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const selected = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const visible = options.filter((option) => normalize(ui(option.label) + " " + (option.group ?? "")).includes(normalize(query.trim())));

  return <>
    <button type="button" className="ropero-select-trigger" aria-label={label} aria-haspopup="dialog"
      onClick={() => {
        setQuery("");
        dialog.current?.showModal();
        requestAnimationFrame(() => selected.current?.scrollIntoView({ block: "nearest" }));
      }}>
      <span>{ui(options.find((option) => option.value === value)?.label ?? "Elegir")}</span>
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>
    </button>
    <dialog ref={dialog} className="ropero-select-sheet" aria-labelledby={title} onClick={(event) => {
      if (event.target === event.currentTarget) dialog.current?.close();
    }}>
      <div className="ropero-select-panel">
        <header><h2 id={title}>{label}</h2><button autoFocus type="button" aria-label={ui("Cerrar selector")} onClick={() => dialog.current?.close()}>×</button></header>
        {options.length > 12 && <input type="search" aria-label={ui("Buscar opciones")} placeholder={ui("Buscar opciones")} value={query} onChange={(event) => setQuery(event.target.value)} />}
        <div className="ropero-select-options">
          {!visible.length && <p>{ui("No encontramos opciones.")}</p>}
          {visible.map((option, index) => <div key={option.value}>
            {option.group && option.group !== visible[index - 1]?.group && <h3>{ui(option.group)}</h3>}
            <button type="button" ref={option.value === value ? selected : undefined} aria-pressed={option.value === value}
              onClick={() => { onChange(option.value); dialog.current?.close(); }}>
              {ui(option.label)}<span aria-hidden="true" />
            </button>
          </div>)}
        </div>
      </div>
    </dialog>
  </>;
}
