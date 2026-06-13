import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InviteCode } from '../../../core/models/invite-code.model';
import { formatInviteCodeInput, normalizeInviteCode } from '../../../core/models/invite-code.model';
import { AuthService } from '../../../core/services/auth.service';
import { InviteCodeService } from '../../../core/services/invite-code.service';
import { hasPendingTenancyLink, isTenancyLinked } from '../../../core/utils/role.utils';
import { RecaptchaNoticeComponent } from '../../../shared/components/recaptcha-notice/recaptcha-notice.component';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RecaptchaNoticeComponent],
  templateUrl: './join.component.html',
  styleUrl: './join.component.scss',
})
export class JoinComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private inviteCodeService = inject(InviteCodeService);

  loading = signal(false);
  error = signal('');
  success = signal('');
  invite = signal<InviteCode | undefined>(undefined);
  validating = signal(false);

  user = this.auth.currentUser;
  isFullyLinked = computed(() => isTenancyLinked(this.user()));
  isPendingLink = computed(() => hasPendingTenancyLink(this.user()));

  form = this.fb.nonNullable.group({
    code: ['', Validators.required],
  });

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (code) {
      this.form.patchValue({ code: formatInviteCodeInput(code) });
      void this.validateCode();
    }
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatInviteCodeInput(input.value);
    this.form.patchValue({ code: formatted }, { emitEvent: false });
    input.value = formatted;
  }

  async validateCode(): Promise<void> {
    const code = normalizeInviteCode(this.form.controls.code.value);
    if (code.length < 7) {
      this.invite.set(undefined);
      return;
    }

    this.validating.set(true);
    this.error.set('');

    try {
      const invite = await this.inviteCodeService.getByCode(code);
      this.invite.set(invite);
    } catch {
      this.invite.set(undefined);
      this.error.set('Could not validate invite code.');
    } finally {
      this.validating.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || !this.invite()) return;

    const user = this.user();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    if (user.tenantRecordId) {
      this.error.set('Your account is already linked.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.success.set('');

    try {
      const { code } = this.form.getRawValue();
      await this.auth.linkWithInviteCode(user.id, code);

      this.success.set(
        `You're connected to ${this.invite()?.ownerName}. Your landlord will assign your unit soon.`
      );

      window.setTimeout(() => this.router.navigate(['/dashboard']), 1500);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not link your account.');
    } finally {
      this.loading.set(false);
    }
  }
}
