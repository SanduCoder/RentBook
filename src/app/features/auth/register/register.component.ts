import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DEFAULT_COUNTRY_CODE } from '../../../core/config/country-profiles.config';
import { AuthService } from '../../../core/services/auth.service';
import { CountryProfileService } from '../../../core/services/country-profile.service';
import { UserRole } from '../../../core/models/user.model';
import { formatInviteCodeInput } from '../../../core/models/invite-code.model';
import { phonePlaceholder } from '../../../core/utils/country-detect.utils';
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
  private countryProfiles = inject(CountryProfileService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  error = signal('');
  showPassword = signal(false);
  detectingCountry = signal(true);
  countryDetected = signal(false);
  countries = this.countryProfiles.countries;

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
    countryCode: [DEFAULT_COUNTRY_CODE, Validators.required],
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

    void this.detectCountry();
  }

  phonePlaceholder(): string {
    return phonePlaceholder(this.form.controls.countryCode.value);
  }

  selectedCountryName(): string {
    return this.countryProfiles.getProfile(this.form.controls.countryCode.value).name;
  }

  private async detectCountry(): Promise<void> {
    this.detectingCountry.set(true);
    try {
      const detected = await this.countryProfiles.detectCountryCode();
      if (detected) {
        this.form.patchValue({ countryCode: detected });
        this.countryDetected.set(true);
      }
    } finally {
      this.detectingCountry.set(false);
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
      const { name, phone, email, password, role, inviteCode, countryCode } = this.form.getRawValue();
      await this.auth.register(email, password, name, phone, role, { countryCode });

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
