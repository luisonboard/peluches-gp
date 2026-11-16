// App instalable: registra el service worker (solo en la versión publicada) y guarda el aviso de instalación
// de Android/Chrome para ofrecerlo desde Ajustes. En el iPhone se instala con Compartir → "Añadir a inicio".

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPrompt | null = null;

export function installPwa(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
  });
  window.addEventListener('appinstalled', () => (deferred = null));
  if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* sin modo sin conexión */
      });
    });
  }
}

export type InstallState = 'instalada' | 'disponible' | 'ios' | 'otro';

export function installState(): InstallState {
  const standalone =
    matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'instalada';
  if (deferred) return 'disponible';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios ? 'ios' : 'otro';
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const p = deferred;
  deferred = null;
  await p.prompt();
  return (await p.userChoice).outcome === 'accepted';
}
