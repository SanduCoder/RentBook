import { Location } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { roleLabel } from '../../core/utils/role.utils';
import { navigateBack } from '../../core/utils/navigate-back.util';
import { phonePlaceholder as formatPhonePlaceholder } from '../../core/utils/country-detect.utils';
import { Icon3dComponent } from '../../shared/components/icon-3d/icon-3d.component';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [ReactiveFormsModule, Icon3dComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent {
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private location = inject(Location);
  private router = inject(Router);

  user = this.auth.currentUser;
  roleLabel = roleLabel;

  phonePlaceholderText(): string {
    return formatPhonePlaceholder(this.user()?.countryCode);
  }

  saving = signal(false);
  saved = signal(false);
  error = signal('');
  resettingPassword = signal(false);
  passwordResetSent = signal(false);

  form = this.fb.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    email: [{ value: '', disabled: true }],
  });

  constructor() {
    effect(() => {
      const user = this.user();
      if (!user) return;

      this.form.patchValue({
        name: user.name,
        phone: user.phone,
        email: user.email,
      });
    });
  }

  goBack(event: Event): void {
    event.preventDefault();
    navigateBack(this.location, this.router, ['/more']);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.saved.set(false);
    this.error.set('');

    try {
      const { name, phone } = this.form.getRawValue();
      await this.auth.updateProfile({ name: name ?? '', phone: phone ?? '' });
      this.saved.set(true);
    } catch (err) {
      console.error('Failed to update profile', err);
      this.error.set('Could not save your changes. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  async sendPasswordReset(): Promise<void> {
    const email = this.user()?.email;
    if (!email) return;

    this.resettingPassword.set(true);
    this.passwordResetSent.set(false);
    this.error.set('');

    try {
      await this.auth.sendPasswordReset(email);
      this.passwordResetSent.set(true);
    } catch (err) {
      console.error('Failed to send password reset', err);
      this.error.set('Could not send reset email. Please try again.');
    } finally {
      this.resettingPassword.set(false);
    }
  }
}
