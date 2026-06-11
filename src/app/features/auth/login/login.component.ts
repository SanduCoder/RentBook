import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { RecaptchaNoticeComponent } from '../../../shared/components/recaptcha-notice/recaptcha-notice.component';

const REMEMBER_EMAIL_KEY = 'rentbook_remember_email';

function getAuthErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (
      err.message.includes('verify your email') ||
      err.message.includes('could not load your profile') ||
      err.message.includes('home-screen') ||
      err.message.includes('timed out')
    ) {
      return err.message;
    }
  }

  const code = (err as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Invalid email or password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return err instanceof Error && err.message.includes('home-screen')
        ? err.message
        : 'Network error. Check your connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    default:
      return err instanceof Error ? err.message : 'Invalid email or password. Please try again.';
  }
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RecaptchaNoticeComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  error = signal('');
  info = signal('');
  showPassword = signal(false);
  rememberMe = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit(): void {
    const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
    const emailParam = this.route.snapshot.queryParamMap.get('email');
    if (emailParam) {
      this.form.patchValue({ email: emailParam });
    } else if (savedEmail) {
      this.form.patchValue({ email: savedEmail });
      this.rememberMe.set(true);
    }

    if (this.route.snapshot.queryParamMap.get('verify') === '1') {
      this.info.set('Account created. Verify your email, then sign in to continue.');
    }
  }

  togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  async onResendVerification(): Promise<void> {
    this.error.set('');
    this.info.set('');
    const { email, password } = this.form.getRawValue();
    if (!email || !password) {
      this.error.set('Enter your email and password, then tap Resend verification email.');
      return;
    }
    try {
      await this.auth.resendVerificationEmail(email, password);
      this.info.set('Verification email sent. Check your inbox.');
    } catch {
      this.error.set('Could not resend verification email. Check your details and try again.');
    }
  }

  async onForgotPassword(): Promise<void> {
    this.error.set('');
    this.info.set('');

    const email = this.form.controls.email.value.trim();
    if (!email) {
      this.error.set('Enter your email address first, then tap Forgot password.');
      return;
    }

    try {
      await this.auth.sendPasswordReset(email);
      this.info.set('Password reset email sent. Check your inbox.');
    } catch {
      this.error.set('Could not send reset email. Check the address and try again.');
    }
  }

  onSocialLogin(provider: 'google' | 'apple'): void {
    this.error.set('');
    this.info.set('');
    const label = provider === 'google' ? 'Google' : 'Apple';
    this.info.set(`${label} sign-in is coming soon. Use email and password for now.`);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');
    this.info.set('');

    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);

      if (this.rememberMe()) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }

      const code = this.route.snapshot.queryParamMap.get('code');
      this.router.navigate(code ? ['/join'] : ['/dashboard'], code ? { queryParams: { code } } : undefined);
    } catch (err) {
      this.error.set(getAuthErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }
}
