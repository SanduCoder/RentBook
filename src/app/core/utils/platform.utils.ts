/** True when the app runs as an installed home-screen PWA (iOS or Android). */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

/** Legacy iOS Safari flag for Add to Home Screen apps. */
export function isIosStandalonePwa(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  return isStandaloneDisplayMode() || nav.standalone === true;
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
