import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { WardrobeTutorial, type WardrobeTutorialProps } from './WardrobeTutorial';

const baseProps: WardrobeTutorialProps = {
  preferenceKey: 'tutorial:user-a',
  canAutoOpen: false,
  onAddGarment: () => {},
  onOpenStudio: () => {},
};

async function reachFinalStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
}

function NavigationHarness() {
  const [destination, setDestination] = useState('inicio');
  const [garments] = useState<string[]>([]);
  const [outfits] = useState<string[]>([]);

  return (
    <>
      <p>Destino: {destination}</p>
      <p>Prendas: {garments.length}</p>
      <p>Conjuntos: {outfits.length}</p>
      <WardrobeTutorial
        {...baseProps}
        onAddGarment={() => setDestination('formulario de prenda')}
        onOpenStudio={() => setDestination('probador')}
      />
    </>
  );
}

describe('WardrobeTutorial', () => {
  it('waits until ready before opening the first-use guide', () => {
    const view = render(<WardrobeTutorial {...baseProps} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.rerender(<WardrobeTutorial {...baseProps} canAutoOpen />);

    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('does not auto-open again after dismissal and remount', async () => {
    const user = userEvent.setup();
    const view = render(<WardrobeTutorial {...baseProps} canAutoOpen />);

    await user.click(screen.getByRole('button', { name: 'Omitir' }));
    expect(localStorage.getItem(baseProps.preferenceKey)).toBe('seen');

    view.unmount();
    render(<WardrobeTutorial {...baseProps} canAutoOpen />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('welcomes people before the practical steps, supports Back, and restarts from Ayuda', async () => {
    const user = userEvent.setup();
    render(<WardrobeTutorial {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Ayuda' }));
    expect(screen.getByText('Paso 1 de 5')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Bienvenida a tu ropero' })).toBeVisible();
    expect(screen.getByText(/se guarda en este dispositivo/i)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Paso 2 de 5')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Guarda tu primera prenda' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(screen.getByText('Paso 1 de 5')).toBeVisible();
    await reachFinalStep(user);
    expect(screen.getByText('Paso 5 de 5')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Guarda lo que te guste' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cerrar tutorial' }));

    await user.click(screen.getByRole('button', { name: 'Ayuda' }));
    expect(screen.getByText('Paso 1 de 5')).toBeVisible();
  });

  it('keeps first-use preferences separate by key', async () => {
    const user = userEvent.setup();
    const first = render(
      <WardrobeTutorial {...baseProps} preferenceKey="tutorial:first" canAutoOpen />,
    );
    await user.click(screen.getByRole('button', { name: 'Omitir' }));
    first.unmount();

    render(<WardrobeTutorial {...baseProps} preferenceKey="tutorial:second" canAutoOpen />);
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('continues in memory when preference storage cannot be read or written', async () => {
    const user = userEvent.setup();
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied');
    });

    try {
      render(<WardrobeTutorial {...baseProps} canAutoOpen />);
      expect(screen.getByRole('dialog')).toBeVisible();
      await user.click(screen.getByRole('button', { name: 'Omitir' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Ayuda' }));
      expect(screen.getByRole('dialog')).toBeVisible();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  it('closes with Escape and restores focus to Ayuda', async () => {
    const user = userEvent.setup();
    render(<WardrobeTutorial {...baseProps} />);
    const help = screen.getByRole('button', { name: 'Ayuda' });

    help.focus();
    await user.click(help);
    expect(screen.getByRole('button', { name: 'Cerrar tutorial' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(baseProps.preferenceKey)).toBe('seen');
    expect(help).toHaveFocus();
  });

  it('wraps Tab and Shift-Tab across every enabled dialog control', async () => {
    const user = userEvent.setup();
    render(<WardrobeTutorial {...baseProps} />);
    await user.click(screen.getByRole('button', { name: 'Ayuda' }));

    const close = screen.getByRole('button', { name: 'Cerrar tutorial' });
    const next = screen.getByRole('button', { name: 'Siguiente' });
    expect(close).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(next).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(close).toHaveFocus();
  });

  it('makes the background inert and restores it with body scrolling on close and unmount', async () => {
    const user = userEvent.setup();
    document.body.style.overflow = 'scroll';
    const view = render(<WardrobeTutorial {...baseProps} />);
    await user.click(screen.getByRole('button', { name: 'Ayuda' }));

    expect(view.container).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(screen.getByRole('button', { name: 'Omitir' }));
    expect(view.container).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('scroll');

    await user.click(screen.getByRole('button', { name: 'Ayuda' }));
    view.unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('routes from final actions without mutating garments or outfits', async () => {
    const user = userEvent.setup();
    render(<NavigationHarness />);
    await user.click(screen.getByRole('button', { name: 'Ayuda' }));
    await reachFinalStep(user);
    const dialog = screen.getByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Añadir mi primera prenda' }));
    expect(screen.getByText('Destino: formulario de prenda')).toBeVisible();
    expect(localStorage.getItem(baseProps.preferenceKey)).toBe('seen');
    expect(screen.getByText('Prendas: 0')).toBeVisible();
    expect(screen.getByText('Conjuntos: 0')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Ayuda' }));
    await reachFinalStep(user);
    await user.click(screen.getByRole('button', { name: 'Ir al probador' }));
    expect(screen.getByText('Destino: probador')).toBeVisible();
    expect(screen.getByText('Prendas: 0')).toBeVisible();
    expect(screen.getByText('Conjuntos: 0')).toBeVisible();
  });
});
