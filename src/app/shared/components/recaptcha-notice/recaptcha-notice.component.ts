import { Component } from '@angular/core';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-recaptcha-notice',
  standalone: true,
  template: `
    @if (enabled) {
      <p class="recaptcha-notice">
        This site is protected by reCAPTCHA and the Google
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        and
        <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
        apply.
      </p>
    }
  `,
  styles: [
    `
      .recaptcha-notice {
        margin: 0;
        text-align: center;
        font-size: 0.6875rem;
        color: var(--text-muted);
        line-height: 1.45;
      }

      .recaptcha-notice a {
        color: var(--text-muted);
        text-decoration: underline;
        text-underline-offset: 2px;
      }
    `,
  ],
})
export class RecaptchaNoticeComponent {
  readonly enabled = environment.production && !!environment.appCheckRecaptchaSiteKey;
}
