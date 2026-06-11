import { AppCheck, getToken } from 'firebase/app-check';

const TOKEN_RETRY_MS = 500;
const TOKEN_TIMEOUT_MS = 10000;

/** Wait until App Check can mint a token (needed before Auth/Firestore on enforced projects). */
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
}
