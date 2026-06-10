import { Component, inject } from '@angular/core';
import { ErrorNotificationService } from '../../../core/services/error-notification.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    @if (notifications.toasts().length > 0) {
      <div class="toast-stack" aria-live="polite">
        @for (toast of notifications.toasts(); track toast.id) {
          <div class="toast" [class]="toast.type" role="alert">
            <p>{{ toast.message }}</p>
            <button type="button" (click)="notifications.dismiss(toast.id)" aria-label="Dismiss">×</button>
          </div>
        }
      </div>
    }
  `,
  styles: `
    .toast-stack {
      position: fixed;
      left: 1rem;
      right: 1rem;
      bottom: 5.5rem;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border-radius: 0.75rem;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
      pointer-events: auto;
      font-size: 0.875rem;
      line-height: 1.4;
    }

    .toast p {
      margin: 0;
      flex: 1;
    }

    .toast button {
      border: none;
      background: transparent;
      font-size: 1.25rem;
      line-height: 1;
      cursor: pointer;
      color: inherit;
      opacity: 0.7;
      padding: 0;
    }

    .toast.error {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }

    .toast.success {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #bbf7d0;
    }

    .toast.info {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }
  `,
})
export class AppToastComponent {
  notifications = inject(ErrorNotificationService);
}
