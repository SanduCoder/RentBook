import { Component, computed, input, signal } from '@angular/core';

@Component({
  selector: 'app-invite-code-display',
  standalone: true,
  template: `
    <div class="invite-code-display">
      <div class="code-row">
        <span class="code">{{ displayCode() }}</span>
        <button type="button" class="copy-btn" (click)="copy()" [disabled]="!code()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          {{ copied() ? 'Copied' : 'Copy' }}
        </button>
      </div>
      @if (hint()) {
        <p class="hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
          </svg>
          <span>{{ hint() }}</span>
        </p>
      }
    </div>
  `,
  styles: `
    .invite-code-display {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }

    .code-row {
      display: flex;
      align-items: stretch;
      gap: 0.625rem;
    }

    .code {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 3rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 1rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      color: #15803d;
      background: #f0fdf4;
      border: 1.5px dashed #86efac;
      border-radius: 0.75rem;
      padding: 0.625rem 0.75rem;
      text-align: center;
    }

    .copy-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      border: none;
      background: linear-gradient(165deg, #1a7f52 0%, #146843 100%);
      color: white;
      font-size: 0.8125rem;
      font-weight: 700;
      border-radius: 0.75rem;
      padding: 0 1rem;
      min-width: 5.5rem;
      cursor: pointer;
      white-space: nowrap;
      box-shadow: 0 4px 14px rgba(27, 138, 90, 0.25);
    }

    .copy-btn svg {
      width: 1rem;
      height: 1rem;
    }

    .copy-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .hint {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      margin: 0;
      font-size: 0.75rem;
      color: #64748b;
      line-height: 1.45;
    }

    .hint svg {
      width: 1rem;
      height: 1rem;
      color: #16a34a;
      flex-shrink: 0;
      margin-top: 0.0625rem;
    }
  `,
})
export class InviteCodeDisplayComponent {
  code = input.required<string>();
  hint = input<string>('');

  copied = signal(false);

  displayCode = computed(() => formatCodeForDisplay(this.code()));

  async copy(): Promise<void> {
    const value = this.code();
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      this.copied.set(true);
      window.setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // ignore clipboard failures
    }
  }
}

function formatCodeForDisplay(code: string): string {
  if (!code) return '';
  return code
    .split('-')
    .map((part) => part.split('').join(' '))
    .join(' - ');
}
