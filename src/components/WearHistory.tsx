import { useState } from 'react';
import type { Outfit, WearEntry } from '../core/entities';
import { localDate } from '../core/wardrobe-history';

export function WearHistory({ entries, outfits, onRecord }: {
  entries: WearEntry[]; outfits: Outfit[]; onRecord: (outfitId: string, date: string) => void;
}) {
  const [date, setDate] = useState(localDate);
  const [outfitId, setOutfitId] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const visible = entries.filter((entry) => !filterDate || entry.date === filterDate).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  return <section className="wear-history" aria-label="Historial de uso y lavado">
    <h2>Mi calendario</h2>
    <p>Guarda lo que vestiste cada día. Cada prenda cuenta como un uso por fecha.</p>
    <form onSubmit={(event) => {
      event.preventDefault();
      setMessage(''); setError('');
      try { onRecord(outfitId, date); setMessage('Uso registrado.'); }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo registrar el uso.'); }
    }}>
      <label>Fecha de uso<input type="date" required max={localDate()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label>Conjunto usado<select required value={outfitId} onChange={(event) => setOutfitId(event.target.value)}>
        <option value="">Elige un conjunto</option>
        {outfits.map((outfit) => <option key={outfit.id} value={outfit.id}>{outfit.name}</option>)}
      </select></label>
      <button className="primary-button" disabled={!outfitId || !date}>Registrar uso</button>
    </form>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    <div className="history-filter">
      <label>Buscar por fecha<input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} /></label>
      {filterDate && <button type="button" onClick={() => setFilterDate('')}>Ver todas las fechas</button>}
    </div>
    {!visible.length && <p>No hay registros para mostrar. También puedes registrar prendas desde Lavandería.</p>}
    <ol className="history-list">{visible.map((entry) => <li key={entry.id}>
      <time dateTime={entry.date}>{new Date(`${entry.date}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</time>
      <strong>{entry.kind === 'washed' ? 'Lavado' : entry.outfitName || 'Prenda usada'}</strong>
      <p>{entry.garments.map((item) => item.name).join(', ')}</p>
    </li>)}</ol>
  </section>;
}
