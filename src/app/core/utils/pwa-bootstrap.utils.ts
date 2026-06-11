import { isIosStandalonePwa } from './platform.utils';

const RECAPTCHA_READY_MS = 6000;

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
    };
  }
}

/** iOS home-screen PWAs share storage with Safari but run in a stricter WebKit context. */
export async function prepareIosStandalonePwa(): Promise<void> {
  if (!isIosStandalonePwa()) {
    return;
  }

  await unregisterServiceWorkers();
}

export function preloadRecaptcha(siteKey: string): Promise<void> {
  if (!siteKey || typeof document === 'undefined') {
    return Promise.resolve();
  }

  if (window.grecaptcha) {
    return new Promise((resolve) => {
      window.grecaptcha!.ready(() => resolve());
      window.setTimeout(resolve, RECAPTCHA_READY_MS);
    });
  }

  return new Promise((resolve) => {
    const existing = document.querySelector('script[data-rentbook-recaptcha]');
    if (existing) {
      window.setTimeout(resolve, 500);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset['rentbookRecaptcha'] = 'true';
    script.onload = () => {
      if (window.grecaptcha) {
        window.grecaptcha.ready(() => resolve());
      } else {
        resolve();
      }
    };
    script.onerror = () => resolve();
    document.head.appendChild(script);
    window.setTimeout(resolve, RECAPTCHA_READY_MS);
  });
}

async function unregisterServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // Best-effort; continue boot even if unregister fails.
  }
}
