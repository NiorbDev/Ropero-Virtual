import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blankState } from './data/app-state-store';
import type { AppStorage } from './data/create-app-storage';
import { createWebPhotoStore } from './data/photo-store';

const backgroundRemoval = vi.hoisted(() => ({
  remove: vi.fn(async () => new Blob(['cutout'], { type: 'image/png' })),
  dispose: vi.fn(),
}));

const nativeStorage = vi.hoisted(() => ({
  enabled: false,
  createStorage: null as null | (() => Promise<AppStorage>),
}));

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => nativeStorage.enabled,
}));

vi.mock('./data/create-app-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./data/create-app-storage')>();

  return {
    ...actual,
    createAppStorage: (...args: Parameters<typeof actual.createAppStorage>) => {
      const createStorage = nativeStorage.createStorage;
      return createStorage ? createStorage() : actual.createAppStorage(...args);
    },
  };
});

vi.mock('./services/background-removal', () => ({
  BackgroundRemovalService: class {
    remove = backgroundRemoval.remove;
    dispose = backgroundRemoval.dispose;
  },
}));

import App from './App';

function readStoredState() {
  const saved = JSON.parse(localStorage.getItem('ropero-virtual-foundation') ?? '{}');
  return saved.state ?? saved;
}

async function dismissFirstUseTutorial(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole('dialog', { name: 'Bienvenida a tu ropero' });
  await user.click(within(dialog).getByRole('button', { name: 'Omitir' }));
}

async function advanceTutorialToFinal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
}

describe('App', () => {
  beforeEach(() => {
    backgroundRemoval.remove.mockReset();
    backgroundRemoval.remove.mockResolvedValue(new Blob(['cutout'], { type: 'image/png' }));
    backgroundRemoval.dispose.mockClear();
    nativeStorage.enabled = false;
    nativeStorage.createStorage = null;
  });

  it('creates and combines accessories from an empty fitting room', async () => {
    const dialogPrototype = HTMLDialogElement.prototype;
    const showModal = Object.getOwnPropertyDescriptor(dialogPrototype, 'showModal');
    const close = Object.getOwnPropertyDescriptor(dialogPrototype, 'close');
    if (!showModal) Object.defineProperty(dialogPrototype, 'showModal', {
      configurable: true, value(this: HTMLDialogElement) { this.open = true; },
    });
    if (!close) Object.defineProperty(dialogPrototype, 'close', {
      configurable: true, value(this: HTMLDialogElement) { this.open = false; },
    });
    try {
      const user = userEvent.setup();
      render(<App />);
      await user.type(screen.getByLabelText(/tu nombre/i), 'Accesorios');
      await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
      await dismissFirstUseTutorial(user);

      await user.click(screen.getByRole('button', { name: 'Agregar accesorio' }));
      await user.click(screen.getByRole('button', { name: 'Aros' }));
      await user.click(screen.getByRole('button', { name: 'Crear accesorio' }));
      await user.type(screen.getByLabelText(/nombre de la prenda/i), 'Aros de plata');
      await user.click(screen.getByRole('button', { name: /guardar prenda/i }));

      await user.click(screen.getByRole('button', { name: 'Agregar accesorio' }));
      await user.click(screen.getByRole('button', { name: 'Cartera' }));
      await user.click(screen.getByRole('button', { name: 'Crear accesorio' }));
      await user.type(screen.getByLabelText(/nombre de la prenda/i), 'Cartera rosa');
      await user.click(screen.getByRole('button', { name: /guardar prenda/i }));

      expect(screen.getByRole('button', { name: 'Aros de plata' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Cartera rosa' })).toHaveAttribute('aria-pressed', 'true');
      await user.click(screen.getByRole('button', { name: 'Guardar conjunto' }));
      await waitFor(() => expect(readStoredState().outfits).toHaveLength(1));
    } finally {
      if (!showModal) Reflect.deleteProperty(dialogPrototype, 'showModal');
      if (!close) Reflect.deleteProperty(dialogPrototype, 'close');
    }
  });

  it('shows the Ropero Virtual title', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /ropero virtual/i })).toBeVisible();
  });

  it('lets a person create their private wardrobe profile', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);

    expect(screen.getByText(/hola, norel/i)).toBeVisible();
  });

  it('persists a versioned wardrobe and reports local save status', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText(/guardado local listo/i)).toBeVisible();
    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('ropero-virtual-foundation') ?? '{}');
      expect(saved.schemaVersion).toBe(2);
      expect(saved.state.profiles[0].name).toBe('Norel');
      expect(saved.state.profiles[0]).not.toHaveProperty('avatar');
    });
    expect(screen.getByText(/guardado en este equipo/i)).toBeVisible();
  });

  it('switches profiles from the header without leaking the previous garment draft', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.type(screen.getByLabelText(/tu nombre/i), 'Nico');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /agregar prenda/i }));
    await user.type(screen.getByLabelText(/nombre de la prenda/i), 'Solo de Nico');
    await user.click(screen.getByRole('button', { name: /Cambiar ropero/ }));
    await user.click(screen.getByRole('button', { name: /Crear otro ropero/ }));
    await user.type(screen.getByLabelText(/tu nombre/i), 'Pareja');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /agregar prenda/i }));
    expect(screen.getByLabelText(/nombre de la prenda/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: /Cambiar ropero/ })).toHaveTextContent('Pareja');
  });

  it('archives, restores, and deletes a garment only after confirmation', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.type(screen.getByLabelText(/tu nombre/i), 'Nico');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /agregar prenda/i }));
    await user.type(screen.getByLabelText(/nombre de la prenda/i), 'Chaqueta especial');
    await user.click(screen.getByRole('button', { name: 'Guardar prenda' }));
    await user.click(screen.getByRole('button', { name: 'Archivar Chaqueta especial' }));
    expect(screen.queryByRole('heading', { name: 'Chaqueta especial' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Ver prendas archivadas' }));
    await user.click(screen.getByRole('button', { name: 'Restaurar Chaqueta especial' }));
    await user.click(screen.getByRole('checkbox', { name: 'Ver prendas archivadas' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar Chaqueta especial' }));
    expect(screen.getByRole('heading', { name: 'Chaqueta especial' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('heading', { name: 'Chaqueta especial' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Eliminar Chaqueta especial' }));
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => expect(readStoredState().garments).toHaveLength(0));
  });

  it('previews carousel changes without overwriting the saved outfit until Save', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.type(screen.getByLabelText(/tu nombre/i), 'Nico');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    for (const name of ['Polera rosa', 'Polera negra']) {
      await user.click(screen.getByRole('button', { name: /agregar prenda/i }));
      await user.type(screen.getByLabelText(/nombre de la prenda/i), name);
      await user.click(screen.getByRole('button', { name: 'Guardar prenda' }));
    }
    await user.click(screen.getByRole('button', { name: 'Conjuntos' }));
    await user.type(screen.getByLabelText('Nombre del conjunto'), 'Paseo');
    await user.click(screen.getByRole('checkbox', { name: 'Polera rosa' }));
    await user.click(screen.getByRole('button', { name: 'Guardar conjunto' }));
    const originalIds = [...readStoredState().outfits[0].garmentIds];
    await user.click(screen.getByRole('button', { name: 'Probador 2D' }));
    await user.click(screen.getByRole('button', { name: 'Conjunto siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Anterior Partes de arriba' }));
    expect(readStoredState().outfits[0].garmentIds).toEqual(originalIds);
    await user.click(screen.getByRole('button', { name: 'Guardar conjunto' }));
    await waitFor(() => expect(readStoredState().outfits[0].garmentIds).not.toEqual(originalIds));
  });

  it('records outfit dates, restores archived outfits and retains history after deletion and reload', async () => {
    const user = userEvent.setup(); const view = render(<App />);
    await user.type(screen.getByLabelText(/tu nombre/i), 'Nico');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /agregar prenda/i }));
    await user.type(screen.getByLabelText(/nombre de la prenda/i), 'Chaqueta especial');
    await user.click(screen.getByRole('button', { name: 'Guardar prenda' }));
    await user.click(screen.getByRole('button', { name: 'Conjuntos' }));
    await user.type(screen.getByLabelText('Nombre del conjunto'), 'Salida');
    await user.click(screen.getByRole('checkbox', { name: 'Chaqueta especial' }));
    await user.click(screen.getByRole('button', { name: 'Guardar conjunto' }));
    await user.click(screen.getByRole('button', { name: 'Archivar Salida' }));
    await user.click(screen.getByRole('checkbox', { name: 'Ver conjuntos archivados' }));
    await user.click(screen.getByRole('button', { name: 'Restaurar Salida' }));
    await user.click(screen.getByRole('checkbox', { name: 'Ver conjuntos archivados' }));
    await user.click(screen.getByRole('button', { name: 'Historial por fecha' }));
    await user.selectOptions(screen.getByLabelText('Conjunto usado'), readStoredState().outfits[0].id);
    fireEvent.change(screen.getByLabelText('Fecha de uso'), { target: { value: '2026-08-20' } });
    await user.click(screen.getByRole('button', { name: 'Registrar uso' }));
    expect(await screen.findByText('Uso registrado.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Mis conjuntos' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar Salida' }));
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => expect(readStoredState().outfits).toHaveLength(0));
    expect(readStoredState().wearHistory[0].outfitName).toBe('Salida');
    view.unmount(); render(<App />);
    await user.click(screen.getByRole('button', { name: /Nico/ }));
    await user.click(screen.getByRole('button', { name: 'Conjuntos' }));
    await user.click(screen.getByRole('button', { name: 'Historial por fecha' }));
    const history = screen.getByRole('region', { name: 'Historial de uso y lavado' });
    expect(within(history).getByText('Salida')).toBeVisible();
    expect(within(history).getByText('Chaqueta especial')).toBeVisible();
  });

  it('clears a failed native save warning only after a successful retry and keeps the initialization warning', async () => {
    const user = userEvent.setup();
    const initializationWarning = 'SQLite se restauró desde el respaldo local.';
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('sql execute denied'))
      .mockResolvedValue(undefined);
    nativeStorage.enabled = true;
    nativeStorage.createStorage = async () => ({
      stateStore: {
        load: async () => ({ state: blankState, source: 'primary', warning: null }),
        save,
      },
      photoStore: createWebPhotoStore(),
      initializationWarning,
    });

    render(<App />);

    expect(await screen.findByText(/no se pudo guardar el último cambio/i)).toBeVisible();

    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);

    await waitFor(() => {
      expect(screen.getByText(/guardado en este equipo/i)).toBeVisible();
    });
    expect(screen.queryByText(/no se pudo guardar el último cambio/i)).not.toBeInTheDocument();
    expect(screen.getByText(initializationWarning)).toBeVisible();
  });

  it('does not overwrite protected native SQLite state after a legacy fallback load', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    nativeStorage.enabled = true;
    nativeStorage.createStorage = async () => ({
      stateStore: {
        load: async () => ({
          state: blankState,
          source: 'legacy',
          warning: 'SQLite usa una versión de datos no compatible; se mantuvo el respaldo local sin sobrescribirlo.',
        }),
        save,
      },
      photoStore: createWebPhotoStore(),
      initializationWarning: null,
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText(/guardado local listo/i)).toBeVisible());
    expect(save).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);

    await waitFor(() => expect(save).toHaveBeenCalled());
  });

  it('opens on the 2D studio and keeps the 3D room out of primary navigation', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);

    expect(screen.getByRole('heading', { name: /arma tu conjunto/i })).toBeVisible();
    expect(screen.queryByText(/probador 3d/i)).not.toBeInTheDocument();
  });

  it('shows a short garment form and hides optional details until requested', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /agregar prenda/i }));

    const photoInput = screen.getByLabelText(/fotos? de la prenda/i);
    expect(photoInput).toBeVisible();
    expect(photoInput).toHaveAttribute('accept', 'image/*');
    expect(photoInput).toHaveAttribute('capture', 'environment');
    expect(screen.getByLabelText(/nombre de la prenda/i)).toBeVisible();
    expect(screen.getByLabelText('Tipo de prenda')).toBeVisible();
    expect(screen.getByLabelText('Color')).toBeVisible();
    expect(screen.getByLabelText(/cómo te queda/i)).toBeVisible();
    expect(screen.getByLabelText('Estado')).toBeVisible();
    expect(screen.getByLabelText('Descripción')).toBeVisible();
    expect(screen.getByLabelText(/talla/i)).not.toBeVisible();
    expect(screen.queryByLabelText(/3d/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/patrón/i)).not.toBeInTheDocument();

    await user.click(screen.getByText('Más detalles'));

    expect(screen.getByLabelText(/talla/i)).toBeVisible();
    expect(screen.getByLabelText('Largo aproximado')).toBeVisible();
    expect(screen.getByLabelText('Disponibilidad')).toBeVisible();
  });

  it('derives category and laundry state from the quick form', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /agregar prenda/i }));
    await user.type(screen.getByLabelText(/nombre de la prenda/i), 'Chaqueta beige');
    await user.selectOptions(screen.getByLabelText('Tipo de prenda'), 'chaqueta');
    await user.type(screen.getByLabelText('Color'), 'beige');
    await user.selectOptions(screen.getByLabelText('Estado'), 'dirty');
    await user.click(screen.getByRole('button', { name: /guardar prenda/i }));

    await waitFor(() => {
      const savedGarment = readStoredState().garments[0];
      expect(savedGarment.category).toBe('outerwear');
      expect(savedGarment.subtype).toBe('chaqueta');
      expect(savedGarment.laundryState).toBe('dirty');
      expect(savedGarment).not.toHaveProperty('threeD');
      expect(savedGarment).not.toHaveProperty('visualStyle');
    });
  });

  it('imports Norel inventory once with its laundry states', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /importar inventario.*61/i }));

    expect(screen.getByText('61 prendas guardadas')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Chaqueta beige con detalles celestes' })).toBeVisible();
    expect(screen.getByRole('button', { name: /inventario importado.*61\/61/i })).toBeDisabled();

    await waitFor(() => expect(readStoredState().garments).toHaveLength(61));
    const saved = readStoredState();
    expect(saved.garments.filter((garment: { laundryState: string }) => garment.laundryState === 'dirty')).toHaveLength(6);
  });

  it('edits an imported garment and adds more than one photo', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /importar inventario/i }));
    await user.click(screen.getByRole('button', { name: /editar chaqueta beige con detalles celestes/i }));

    expect(screen.getByLabelText(/nombre de la prenda/i)).toHaveValue('Chaqueta beige con detalles celestes');
    await user.upload(screen.getByLabelText(/fotos de la prenda/i), [
      new File(['front'], 'front.png', { type: 'image/png' }),
      new File(['back'], 'back.png', { type: 'image/png' }),
    ]);
    await user.clear(screen.getByLabelText('Descripción'));
    await user.type(screen.getByLabelText('Descripción'), 'Franjas celestes por ambas mangas');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      const updated = readStoredState().garments.find(
        (item: { importKey?: string }) => item.importKey === 'norel-056',
      );
      expect(updated?.imageUrls).toHaveLength(2);
    });
    const jacket = readStoredState().garments.find(
      (item: { importKey?: string }) => item.importKey === 'norel-056',
    );
    expect(jacket.imageUrls).toHaveLength(2);
    expect(jacket.description).toBe('Franjas celestes por ambas mangas');
  });

  it('saves an uncut photo by default without invoking background removal', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.type(screen.getByLabelText(/tu nombre/i), 'Foto con fondo');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /agregar prenda/i }));
    await user.upload(screen.getByLabelText(/fotos de la prenda/i), new File(['original'], 'original.png', { type: 'image/png' }));
    await screen.findByRole('button', { name: /quitar fondo automáticamente/i });
    await user.type(screen.getByLabelText(/nombre de la prenda/i), 'Polera con fondo');
    await user.click(screen.getByRole('button', { name: /guardar prenda/i }));
    await waitFor(() => expect(readStoredState().garments[0].photoAssets[0].cutoutRef).toBeNull());
    expect(backgroundRemoval.remove).not.toHaveBeenCalled();
    expect(readStoredState().garments[0].photoAssets[0].originalRef).toBeTruthy();
  });

  it('can return to the photo with its background after an automatic cutout', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.type(screen.getByLabelText(/tu nombre/i), 'Foto con fondo');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /agregar prenda/i }));
    await user.upload(screen.getByLabelText(/fotos de la prenda/i), new File(['original'], 'original.png', { type: 'image/png' }));
    await user.click(await screen.findByRole('button', { name: /quitar fondo automáticamente/i }));
    await screen.findByRole('button', { name: 'Usar foto con fondo' });
    let finishRecut!: (blob: Blob) => void;
    backgroundRemoval.remove.mockImplementationOnce(() => new Promise<Blob>(resolve => { finishRecut = resolve; }));
    await user.type(screen.getByLabelText(/nombre de la prenda/i), 'Polera');
    await user.click(screen.getByRole('button', { name: 'Rehacer recorte automático' }));
    expect(screen.getByRole('button', { name: /guardar prenda/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Usar foto con fondo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ajustar recorte' })).toBeDisabled();
    finishRecut(new Blob(['new-cutout'], { type: 'image/png' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Usar foto con fondo' })).toBeEnabled());
    await user.click(await screen.findByRole('button', { name: 'Usar foto con fondo' }));
    await user.type(screen.getByLabelText(/nombre de la prenda/i), 'Polera con fondo');
    await user.click(screen.getByRole('button', { name: /guardar prenda/i }));
    await waitFor(() => expect(readStoredState().garments[0].photoAssets[0].cutoutRef).toBeNull());
    expect(readStoredState().garments[0].photoAssets[0].originalRef).toBeTruthy();
  });

  it('keeps the original photo when automatic background removal fails', async () => {
    const user = userEvent.setup();
    backgroundRemoval.remove.mockRejectedValueOnce(new Error('offline'));
    render(<App />);

    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /mi ropero/i }));
    await user.click(screen.getByRole('button', { name: /agregar prenda/i }));
    await user.upload(screen.getByLabelText(/fotos de la prenda/i), new File(['front'], 'front.png', { type: 'image/png' }));
    await user.click(await screen.findByRole('button', { name: /quitar fondo automáticamente/i }));

    expect(await screen.findByText(/tu foto original está a salvo/i)).toBeVisible();
    await user.type(screen.getByLabelText(/nombre de la prenda/i), 'Polera de prueba');
    await user.click(screen.getByRole('button', { name: /guardar prenda/i }));
    await waitFor(() => {
      const savedGarment = readStoredState().garments[0];
      expect(savedGarment.photoAssets[0].originalRef).toBeTruthy();
      expect(savedGarment.photoAssets[0].cutoutRef).toBeNull();
    });
  });

  it('shows complete wardrobe transfer controls for the active profile', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /transferir/i }));

    expect(screen.getByRole('button', { name: /exportar ropero/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /importar ropero/i })).toBeVisible();
  });

  it('searches and combines category and laundry filters', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /importar inventario/i }));
    await user.type(screen.getByLabelText(/buscar prendas/i), 'crema');
    await user.selectOptions(screen.getByLabelText(/filtrar categoría/i), 'top');
    await user.selectOptions(screen.getByLabelText(/filtrar lavado/i), 'dirty');

    expect(screen.getByText('1 de 61 prendas')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Polera crema' })).toBeVisible();
  });

  it('loads a saved outfit into the main 2D studio', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /agregar prenda/i }));
    await user.type(screen.getByLabelText(/nombre de la prenda/i), 'Polera lila');
    await user.click(screen.getByRole('button', { name: /guardar prenda/i }));
    await user.click(screen.getByRole('button', { name: /conjuntos/i }));
    await user.type(screen.getByLabelText(/nombre del conjunto/i), 'Salida');
    await user.click(screen.getByRole('checkbox', { name: /polera lila/i }));
    await user.click(screen.getByRole('button', { name: /guardar conjunto/i }));
    await user.click(screen.getByRole('button', { name: /probar conjunto salida/i }));

    expect(screen.getByRole('heading', { name: /arma tu conjunto/i })).toBeVisible();
    expect(screen.queryByText(/probador 3d/i)).not.toBeInTheDocument();
  });

  it('opens the simple garment form from the tutorial final action', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));

    await advanceTutorialToFinal(user);
    await user.click(screen.getByRole('button', { name: 'Añadir mi primera prenda' }));

    expect(screen.getByLabelText(/nombre de la prenda/i)).toBeVisible();
    expect(screen.getByText(/con el nombre basta para guardarla/i)).toBeVisible();
    expect(readStoredState().garments).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Ayuda' })).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  it('keeps Ayuda reachable from laundry and outfits', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);

    await user.click(screen.getByRole('button', { name: 'Lavandería' }));
    await user.click(screen.getByRole('button', { name: 'Ayuda' }));
    expect(screen.getByRole('dialog', { name: 'Bienvenida a tu ropero' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cerrar tutorial' }));
    await user.click(screen.getByRole('button', { name: 'Conjuntos' }));

    expect(screen.getByRole('button', { name: 'Ayuda' })).toBeVisible();
  });

  it('preserves a garment draft while Help is opened and closed', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /agregar prenda/i }));
    await user.type(screen.getByLabelText(/nombre de la prenda/i), 'Abrigo en progreso');

    await user.click(screen.getByRole('button', { name: 'Ayuda' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar tutorial' }));

    expect(screen.getByLabelText(/nombre de la prenda/i)).toHaveValue('Abrigo en progreso');
  });

  it('preserves a garment draft when Help ends at Añadir mi primera prenda', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    await user.click(screen.getByRole('button', { name: /agregar prenda/i }));
    await user.type(screen.getByLabelText(/nombre de la prenda/i), 'Chaqueta en progreso');

    await user.click(screen.getByRole('button', { name: 'Ayuda' }));
    await advanceTutorialToFinal(user);
    await user.click(screen.getByRole('button', { name: 'Añadir mi primera prenda' }));

    expect(screen.getByLabelText(/nombre de la prenda/i)).toHaveValue('Chaqueta en progreso');
  });

  it('does not save garments or outfits when using Help navigation', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText(/tu nombre/i), 'Norel');
    await user.click(screen.getByRole('button', { name: /crear mi ropero/i }));
    await dismissFirstUseTutorial(user);
    const before = readStoredState();

    await user.click(screen.getByRole('button', { name: 'Ayuda' }));
    await advanceTutorialToFinal(user);
    await user.click(screen.getByRole('button', { name: 'Ir al probador' }));

    expect(readStoredState().garments).toHaveLength(before.garments.length);
    expect(readStoredState().outfits).toHaveLength(before.outfits.length);
    expect(screen.getByRole('heading', { name: /arma tu conjunto/i })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ayuda' })).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });
});
