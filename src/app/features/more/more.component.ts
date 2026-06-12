import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DEFAULT_COUNTRY_CODE } from '../../core/config/country-profiles.config';
import { AuthService } from '../../core/services/auth.service';
import { CountryProfileService } from '../../core/services/country-profile.service';
import { InviteCodeService } from '../../core/services/invite-code.service';
import { PropertyService } from '../../core/services/property.service';
import { canManageTenants, roleLabel } from '../../core/utils/role.utils';
import { Icon3dComponent } from '../../shared/components/icon-3d/icon-3d.component';
import { InviteCodeDisplayComponent } from '../../shared/components/invite-code-display/invite-code-display.component';
import { RecaptchaNoticeComponent } from '../../shared/components/recaptcha-notice/recaptcha-notice.component';

@Component({
  selector: 'app-more',
  standalone: true,
  imports: [FormsModule, RouterLink, InviteCodeDisplayComponent, Icon3dComponent, RecaptchaNoticeComponent],
  templateUrl: './more.component.html',
  styleUrl: './more.component.scss',
})
export class MoreComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private inviteCodeService = inject(InviteCodeService);
  private countryProfiles = inject(CountryProfileService);
  private propertyService = inject(PropertyService);

  user = this.auth.currentUser;
  authLoading = this.auth.loading;
  canManageTenants = canManageTenants;
  roleLabel = roleLabel;
  countries = this.countryProfiles.countries;

  countryModalOpen = signal(false);
  draftCountryCode = signal(DEFAULT_COUNTRY_CODE);
  savingCountry = signal(false);
  countryError = signal('');

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

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.countryModalOpen()) {
      this.cancelCountryModal();
    }
  }

  savedCountryCode(): string {
    return this.user()?.countryCode ?? DEFAULT_COUNTRY_CODE;
  }

  savedCountryProfile() {
    return this.countryProfiles.getProfile(this.savedCountryCode());
  }

  draftCountryProfile() {
    return this.countryProfiles.getProfile(this.draftCountryCode());
  }

  draftPaymentMethodsLabel(): string {
    return this.countryProfiles.paymentMethodsLabel(this.draftCountryCode());
  }

  openCountryModal(): void {
    this.draftCountryCode.set(this.savedCountryCode());
    this.countryError.set('');
    this.countryModalOpen.set(true);
  }

  cancelCountryModal(): void {
    this.countryModalOpen.set(false);
    this.countryError.set('');
  }

  async saveCountry(): Promise<void> {
    this.savingCountry.set(true);
    this.countryError.set('');

    try {
      const previousCountryCode = this.savedCountryCode();
      const countryCode = this.draftCountryCode();
      await this.auth.updateCountry(countryCode);
      const user = this.user();
      if (user && canManageTenants(user.role)) {
        await this.propertyService.syncOwnerCountryProfile(user.id, countryCode, previousCountryCode);
      }
      this.countryModalOpen.set(false);
    } catch (err) {
      this.countryError.set(this.countrySaveErrorMessage(err));
    } finally {
      this.savingCountry.set(false);
    }
  }

  private countrySaveErrorMessage(err: unknown): string {
    const code = (err as { code?: string })?.code;
    const message = err instanceof Error ? err.message : String(err);

    if (code === 'permission-denied') {
      return 'Save not allowed. Sign out and back in, or ask support to update Firestore rules.';
    }
    if (
      code === 'unavailable' ||
      /blocked|BLOCKED_BY_CLIENT|network-request-failed|Failed to fetch/i.test(message)
    ) {
      return 'Connection blocked. Disable ad blockers or privacy extensions for this site, then try again.';
    }
    return 'Could not update country. Try again.';
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
