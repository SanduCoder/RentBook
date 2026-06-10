import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

const AUTH_LOAD_TIMEOUT_MS = 8000;

function waitForAuth(auth: AuthService): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const started = Date.now();
    const check = setInterval(() => {
      if (!auth.loading()) {
        clearInterval(check);
        resolve(!!auth.currentUser() && auth.emailVerified());
        return;
      }
      if (Date.now() - started > AUTH_LOAD_TIMEOUT_MS) {
        clearInterval(check);
        resolve(false);
      }
    }, 100);
  });
}

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const ready = auth.loading() ? await waitForAuth(auth) : !!auth.currentUser() && auth.emailVerified();

  if (ready) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.currentUser() && auth.emailVerified()) {
    router.navigate(['/dashboard']);
    return false;
  }
  return true;
};
