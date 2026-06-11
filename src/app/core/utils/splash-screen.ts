const SPLASH_ID = 'app-splash';
const STATUS_ID = 'splash-status';
const DISMISS_MS = 400;
const FORCE_DISMISS_MS = 15000;
const SLOW_MSG_MS = 3500;
const SLOWER_MSG_MS = 7500;

let dismissed = false;
let watchdogStarted = false;

export function setSplashStatus(message: string): void {
  const el = document.getElementById(STATUS_ID);
  if (el) {
    el.textContent = message;
  }
}

export function dismissAppSplash(): void {
  if (dismissed) {
    return;
  }
  dismissed = true;

  const splash = document.getElementById(SPLASH_ID);
  if (!splash) {
    return;
  }

  splash.classList.add('splash-hide');
  document.body.classList.remove('splash-active');
  window.setTimeout(() => splash.remove(), DISMISS_MS);
}

export function showSplashError(message: string): void {
  setSplashStatus(message);
  document.getElementById(SPLASH_ID)?.classList.add('splash-error');
}

export function startSplashWatchdog(): void {
  if (watchdogStarted) {
    return;
  }
  watchdogStarted = true;

  window.setTimeout(() => setSplashStatus('Still connecting…'), SLOW_MSG_MS);
  window.setTimeout(
    () => setSplashStatus('Taking longer than usual — please wait…'),
    SLOWER_MSG_MS
  );
  window.setTimeout(() => dismissAppSplash(), FORCE_DISMISS_MS);
}
