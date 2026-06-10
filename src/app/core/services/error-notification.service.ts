import { ErrorHandler, Injectable, inject, signal } from '@angular/core';

export interface AppToast {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ErrorNotificationService {
  private nextId = 1;
  readonly toasts = signal<AppToast[]>([]);

  show(message: string, type: AppToast['type'] = 'error'): void {
    const id = this.nextId++;
    this.toasts.update((items) => [...items, { id, message, type }]);
    setTimeout(() => this.dismiss(id), 5000);
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  dismiss(id: number): void {
    this.toasts.update((items) => items.filter((item) => item.id !== id));
  }

  handleError(error: unknown, fallback = 'Something went wrong. Please try again.'): void {
    const message = error instanceof Error ? error.message : fallback;
    this.show(message);
  }
}

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private notifications = inject(ErrorNotificationService);

  handleError(error: unknown): void {
    console.error(error);
    this.notifications.handleError(error);
  }
}
