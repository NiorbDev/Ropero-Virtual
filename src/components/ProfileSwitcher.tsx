import { BrandIcon } from "./BrandIcon";
import { useEffect, useId, useRef, useState } from 'react';
import type { Profile } from '../core/entities';
import './profile-switcher.css';

export function ProfileSwitcher({ profiles, activeProfile, onChoose, onCreate }: {
  profiles: Profile[]; activeProfile: Profile;
  onChoose: (profile: Profile) => void; onCreate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = () => { setOpen(false); trigger.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  return <div className="wardrobe-picker">
    <span>Ropero activo</span>
    <button ref={trigger} type="button" className="wardrobe-picker-trigger"
      aria-label={`Cambiar ropero: ${activeProfile.name}`} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(true)}>
      <span aria-hidden="true"><BrandIcon name="wardrobe" /></span><strong>{activeProfile.name}</strong><span aria-hidden="true">⌄</span>
    </button>
    {open && <div className="wardrobe-picker-backdrop" onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={panel} className="wardrobe-picker-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.stopPropagation(); close(); }
          if (event.key !== 'Tab') return;
          const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('button');
          if (!buttons?.length) return;
          const first = buttons[0]; const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
        <header><h2 id={titleId}>Elige tu ropero</h2><button type="button" aria-label="Cerrar selector" onClick={close}>×</button></header>
        <div className="wardrobe-picker-options">{profiles.map((profile) => <button key={profile.id} type="button"
          aria-label={profile.name} aria-current={profile.id === activeProfile.id ? 'true' : undefined}
          onClick={() => { close(); onChoose(profile); }}>
          <span className="wardrobe-picker-avatar" aria-hidden="true">{profile.name.slice(0, 1).toUpperCase()}</span>
          <strong>{profile.name}</strong>{profile.id === activeProfile.id && <span aria-hidden="true">✓</span>}
        </button>)}</div>
        <button className="wardrobe-picker-create" type="button" onClick={() => { close(); onCreate(); }}>＋ Crear otro ropero</button>
      </div>
    </div>}
  </div>;
}
