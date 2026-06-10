import { Location } from '@angular/common';
import { Router } from '@angular/router';

export function navigateBack(location: Location, router: Router, fallback: string[]): void {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    location.back();
    return;
  }

  router.navigate(fallback);
}
