import { Component, computed, input, signal } from '@angular/core';

@Component({
  selector: 'app-invite-code-display',
  standalone: true,
  template: `
    <div class="invite-code-display">
      <div class="code-row">
        <span class="code">{{ displayCode() }}</span>
      </div>

      <div class="share-row">
        <button type="button" class="share-btn share-copy" (click)="copy()" [disabled]="!code()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          {{ copied() ? 'Copied' : 'Copy' }}
        </button>
        <button type="button" class="share-btn share-whatsapp" (click)="shareWhatsApp()" [disabled]="!code()">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          WhatsApp
        </button>
        <button type="button" class="share-btn share-sms" (click)="shareSms()" [disabled]="!code()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          SMS
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

    .share-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
    }

    .share-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      border: 1px solid #e2e8f0;
      background: white;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 700;
      border-radius: 0.75rem;
      padding: 0.625rem 0.5rem;
      cursor: pointer;
      white-space: nowrap;
    }

    .share-btn svg {
      width: 1rem;
      height: 1rem;
      flex-shrink: 0;
    }

    .share-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .share-copy {
      color: #15803d;
      border-color: #bbf7d0;
      background: #f0fdf4;
    }

    .share-whatsapp {
      color: #128c7e;
      border-color: #a7f3d0;
      background: #ecfdf5;
    }

    .share-sms {
      color: #2563eb;
      border-color: #bfdbfe;
      background: #eff6ff;
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
  shareContext = input<string>('');

  copied = signal(false);

  displayCode = computed(() => formatCodeForDisplay(this.code()));

  private shareMessage = computed(() => {
    const value = this.code();
    if (!value) return '';

    const joinUrl = `${window.location.origin}/join?code=${encodeURIComponent(value)}`;
    const context = this.shareContext().trim();

    if (context) {
      return `Hi! Join ${context} on RentBook.\n\nCode: ${value}\nOr open: ${joinUrl}`;
    }

    return `Join RentBook with code ${value}:\n${joinUrl}`;
  });

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

  shareWhatsApp(): void {
    const message = this.shareMessage();
    if (!message) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  }

  shareSms(): void {
    const message = this.shareMessage();
    if (!message) return;
    window.location.href = `sms:?body=${encodeURIComponent(message)}`;
  }
}

function formatCodeForDisplay(code: string): string {
  if (!code) return '';
  return code
    .split('-')
    .map((part) => part.split('').join(' '))
    .join(' - ');
}
