import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models/user.model';
import { formatInviteCodeInput } from '../../../core/models/invite-code.model';
import { RecaptchaNoticeComponent } from '../../../shared/components/recaptcha-notice/recaptcha-notice.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RecaptchaNoticeComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  error = signal('');
  showPassword = signal(false);

  roles: { value: UserRole; label: string }[] = [
    { value: 'owner', label: 'Property Owner' },
    { value: 'property_manager', label: 'Property Manager' },
    { value: 'caretaker', label: 'Caretaker' },
    { value: 'tenant', label: 'Tenant' },
  ];

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['owner' as UserRole, Validators.required],
    inviteCode: [''],
  });

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (code) {
      this.form.patchValue({
        role: 'tenant',
        inviteCode: formatInviteCodeInput(code),
      });
    }
  }

  togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  isTenantRole(): boolean {
    return this.form.controls.role.value === 'tenant';
  }

  onInviteCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatInviteCodeInput(input.value);
    this.form.patchValue({ inviteCode: formatted }, { emitEvent: false });
    input.value = formatted;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');

    try {
      const { name, phone, email, password, role, inviteCode } = this.form.getRawValue();
      await this.auth.register(email, password, name, phone, role);

      const queryParams: Record<string, string> = { verify: '1', email };
      if (role === 'tenant' && inviteCode.trim()) {
        queryParams['code'] = inviteCode;
      }

      this.router.navigate(['/login'], { queryParams });
    } catch {
      this.error.set('Could not create account. Email may already be in use.');
    } finally {
      this.loading.set(false);
    }
  }
}
