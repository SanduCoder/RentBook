import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="empty-state">
      <div class="icon">{{ icon }}</div>
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      <ng-content />
    </div>
  `,
  styles: `
    .empty-state {
      text-align: center;
      padding: 3rem 1.5rem;
      color: var(--text-secondary);
    }
    .icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    h3 {
      margin: 0 0 0.5rem;
      color: var(--text-primary);
      font-size: 1.125rem;
    }
    p {
      margin: 0 0 1.5rem;
      font-size: 0.9375rem;
      line-height: 1.5;
    }
  `,
})
export class EmptyStateComponent {
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) title!: string;
  @Input({ required: true }) message!: string;
}
