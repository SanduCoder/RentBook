import { Component, Input } from '@angular/core';
import { CurrencyFormatPipe } from '../../pipes/currency-format.pipe';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CurrencyFormatPipe],
  template: `
    <div class="stat-card">
      <span class="stat-label">{{ label }}</span>
      @if (isCurrency) {
        <span class="stat-value">{{ currencyValue | currencyFormat: currency }}</span>
      } @else {
        <span class="stat-value">{{ value }}</span>
      }
      @if (subtitle) {
        <span class="stat-subtitle">{{ subtitle }}</span>
      }
    </div>
  `,
  styles: `
    .stat-card {
      background: var(--surface);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .stat-label {
      font-size: 0.875rem;
      color: var(--text-secondary);
      font-weight: 500;
    }
    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.2;
    }
    .stat-subtitle {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }
  `,
})
export class StatCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: number | string;
  @Input() currencyValue = 0;
  @Input() subtitle?: string;
  @Input() currency = 'GMD';
  @Input() isCurrency = false;
}
