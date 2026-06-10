import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { canManageTenants } from '../utils/role.utils';

export const tenantManagerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (canManageTenants(auth.currentUser()?.role)) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
