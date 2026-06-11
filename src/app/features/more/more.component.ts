import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { InviteCodeService } from '../../core/services/invite-code.service';
import { canManageTenants, roleLabel } from '../../core/utils/role.utils';
import { Icon3dComponent } from '../../shared/components/icon-3d/icon-3d.component';
import { InviteCodeDisplayComponent } from '../../shared/components/invite-code-display/invite-code-display.component';
import { RecaptchaNoticeComponent } from '../../shared/components/recaptcha-notice/recaptcha-notice.component';

@Component({
  selector: 'app-more',
  standalone: true,
  imports: [RouterLink, InviteCodeDisplayComponent, Icon3dComponent, RecaptchaNoticeComponent],
  templateUrl: './more.component.html',
  styleUrl: './more.component.scss',
})
export class MoreComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private inviteCodeService = inject(InviteCodeService);

  user = this.auth.currentUser;
  authLoading = this.auth.loading;
  canManageTenants = canManageTenants;
  roleLabel = roleLabel;

  ownerCode = signal('');
  loadingCode = signal(false);
  regenerating = signal(false);
  codeError = signal('');

  private loadedForUserId = '';

  constructor() {
    effect(() => {
      if (this.authLoading()) return;

      const user = this.user();
      if (!user || !canManageTenants(user.role)) return;
      if (this.loadedForUserId === user.id) return;

      void this.loadOwnerCode(user.id, user.name);
    });
  }

  async loadOwnerCode(userId: string, userName: string): Promise<void> {
    this.loadingCode.set(true);
    this.codeError.set('');

    try {
      const code = await this.inviteCodeService.ensureOwnerCode(userId, userName);
      this.ownerCode.set(code);
      this.loadedForUserId = userId;
    } catch (err) {
      console.error('Failed to load owner invite code', err);
      this.codeError.set('Could not load your invite code. Tap New code to try again.');
    } finally {
      this.loadingCode.set(false);
    }
  }

  async regenerateOwnerCode(): Promise<void> {
    const user = this.user();
    if (!user) return;

    this.regenerating.set(true);
    this.codeError.set('');

    try {
      const code = await this.inviteCodeService.regenerateOwnerCode(user.id, user.name);
      this.ownerCode.set(code);
      this.loadedForUserId = user.id;
    } catch (err) {
      console.error('Failed to regenerate owner invite code', err);
      this.codeError.set('Could not create a new code. Please try again.');
    } finally {
      this.regenerating.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}
