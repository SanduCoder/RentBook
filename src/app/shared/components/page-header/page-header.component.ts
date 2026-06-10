import { Location } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { Router } from '@angular/router';
import { navigateBack } from '../../../core/utils/navigate-back.util';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    @if (showBack) {
      <a href="#" class="back-link" (click)="goBack($event)">← Back</a>
    }

    <header class="page-header">
      <div>
        <h1>{{ title }}</h1>
        @if (subtitle) {
          <p>{{ subtitle }}</p>
        }
      </div>
      <ng-content />
    </header>
  `,
  styles: `
    .back-link {
      display: inline-flex;
      align-items: center;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: #1b8a5a;
      text-decoration: none;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0;
      color: var(--text-primary);
    }

    p {
      margin: 0.25rem 0 0;
      color: var(--text-secondary);
      font-size: 0.9375rem;
    }
  `,
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() showBack = false;
  @Input() backFallback = '/more';

  private location = inject(Location);
  private router = inject(Router);

  goBack(event: Event): void {
    event.preventDefault();
    navigateBack(this.location, this.router, [this.backFallback]);
  }
}
