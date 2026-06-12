import { AppCheck, getToken } from 'firebase/app-check';

const TOKEN_RETRY_MS = 500;
const TOKEN_TIMEOUT_MS = 10000;

export const APP_CHECK_FAILED_MESSAGE =
  'Security check failed. Refresh the page, wait a few seconds, then try again.';

/** Wait until App Check can mint a token (auth and sensitive writes). */
export async function ensureAppCheckReady(appCheck: AppCheck | null): Promise<void> {
  if (!appCheck) {
    return;
  }

  const started = Date.now();
  while (Date.now() - started < TOKEN_TIMEOUT_MS) {
    try {
      await getToken(appCheck, false);
      return;
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, TOKEN_RETRY_MS));
    }
  }

  throw new Error(APP_CHECK_FAILED_MESSAGE);
}

/** Storage uploads and other sensitive writes — force-refresh token (Safari). */
export async function ensureAppCheckToken(appCheck: AppCheck | null): Promise<void> {
  if (!appCheck) {
    return;
  }

  try {
    await getToken(appCheck, true);
  } catch {
    throw new Error(APP_CHECK_FAILED_MESSAGE);
  }
}
