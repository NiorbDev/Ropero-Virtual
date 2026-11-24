import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PwaInstallPrompt } from './PwaInstallPrompt';

type InstallEvent = Event & {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const originalUserAgent = navigator.userAgent;

function dispatchInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted'): InstallEvent {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as InstallEvent;
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(event);
  return event;
}

afterEach(() => {
  Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: originalUserAgent });
});

describe('PwaInstallPrompt', () => {
  it('offers the browser install action only after the device makes it available', async () => {
    const user = userEvent.setup();
    render(<PwaInstallPrompt />);

    expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument();
    const event = dispatchInstallPrompt();

    const install = await screen.findByRole('button', { name: 'Instalar app' });
    expect(event.defaultPrevented).toBe(true);
    await user.click(install);
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument();
  });

  it('shows the Safari home-screen instruction on iPhone', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    });

    render(<PwaInstallPrompt />);

    expect(screen.getByText(/compartir.*añadir a pantalla de inicio/i)).toBeVisible();
  });
});
