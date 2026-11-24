import { useEffect, useState } from 'react';
import './PwaInstallPrompt.css';

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isInstalled(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIPhoneSafari(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !isInstalled();
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIPhoneGuide, setShowIPhoneGuide] = useState(isIPhoneSafari);
  const [error, setError] = useState('');

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      const installPrompt = event as BeforeInstallPromptEvent;
      event.preventDefault();
      setInstallEvent(installPrompt);
      setError('');
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setShowIPhoneGuide(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    setError('');
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
    } catch {
      setError('No se pudo abrir la instalación. Puedes intentarlo otra vez desde el menú del navegador.');
    }
  }

  if (!installEvent && !showIPhoneGuide) return null;

  return (
    <aside className="pwa-install-prompt" aria-live="polite">
      {installEvent ? (
        <>
          <p>Ten tu ropero como una app en tu inicio.</p>
          <button type="button" onClick={install}>Instalar app</button>
        </>
      ) : (
        <p>Para instalarla: toca Compartir y después “Añadir a pantalla de inicio”.</p>
      )}
      {error && <p className="pwa-install-error" role="alert">{error}</p>}
    </aside>
  );
}
