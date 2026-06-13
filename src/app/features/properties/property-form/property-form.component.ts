import { Location } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DEFAULT_COUNTRY_CODE, CurrencyOption, getCountryProfile, resolveCountryCode } from '../../../core/config/country-profiles.config';
import { navigateBack } from '../../../core/utils/navigate-back.util';
import { AuthService } from '../../../core/services/auth.service';
import { CountryProfileService } from '../../../core/services/country-profile.service';
import { MAX_PROPERTY_IMAGES, PropertyImageService } from '../../../core/services/property-image.service';
import { PropertyService } from '../../../core/services/property.service';
import { InviteCodeService } from '../../../core/services/invite-code.service';
import { PropertyType } from '../../../core/models/property.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-property-form',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent],
  templateUrl: './property-form.component.html',
  styleUrl: './property-form.component.scss',
})
export class PropertyFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private propertyService = inject(PropertyService);
  private propertyImageService = inject(PropertyImageService);
  private inviteCodeService = inject(InviteCodeService);
  private countryProfiles = inject(CountryProfileService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  loading = signal(false);
  propertyId = this.route.snapshot.paramMap.get('id');
  isEdit = !!this.propertyId;
  currencies = signal<CurrencyOption[]>(getCountryProfile(DEFAULT_COUNTRY_CODE).currencies);
  countries = this.countryProfiles.countries;

  existingImageUrls = signal<string[]>([]);
  newFiles = signal<File[]>([]);
  newPreviews = signal<string[]>([]);
  readonly maxImages = MAX_PROPERTY_IMAGES;

  propertyTypes: { value: PropertyType; label: string }[] = [
    { value: 'compound', label: 'Compound' },
    { value: 'apartment', label: 'Apartment' },
    { value: 'room', label: 'Room' },
    { value: 'shop', label: 'Shop' },
    { value: 'office', label: 'Office' },
  ];

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    type: ['compound' as PropertyType, Validators.required],
    address: ['', Validators.required],
    countryCode: [DEFAULT_COUNTRY_CODE, Validators.required],
    country: ['Gambia', Validators.required],
    currency: [getCountryProfile(DEFAULT_COUNTRY_CODE).defaultCurrency, Validators.required],
  });

  ngOnInit(): void {
    this.form.controls.countryCode.valueChanges.subscribe((countryCode) => {
      this.applyCountryProfile(countryCode);
    });

    if (this.propertyId) {
      this.propertyService.getById(this.propertyId).subscribe((property) => {
        if (!property) return;
        const countryCode = property.countryCode
          ? resolveCountryCode(property.countryCode)
          : resolveCountryCode(property.country);
        this.form.patchValue({
          name: property.name,
          type: property.type,
          address: property.address,
          countryCode,
          country: property.country,
          currency: property.currency,
        });
        this.applyCountryProfile(countryCode, false);
        const urls = property.imageUrls?.length
          ? property.imageUrls
          : property.imageUrl
            ? [property.imageUrl]
            : [];
        this.existingImageUrls.set(urls);
      });
      return;
    }

    const userCountry = this.auth.currentUser()?.countryCode ?? DEFAULT_COUNTRY_CODE;
    this.form.patchValue({ countryCode: userCountry });
    this.applyCountryProfile(userCountry, false);
  }

  imageCount(): number {
    return this.existingImageUrls().length + this.newFiles().length;
  }

  canAddMore(): boolean {
    return this.imageCount() < this.maxImages;
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;

    let remaining = this.maxImages - this.imageCount();
    if (remaining <= 0) {
      window.alert(`You can add up to ${this.maxImages} photos.`);
      return;
    }

    const accepted: File[] = [];
    let skippedForLimit = false;
    for (const file of files) {
      if (remaining <= 0) {
        skippedForLimit = true;
        break;
      }
      const error = this.propertyImageService.validateImage(file);
      if (error) {
        window.alert(error);
        continue;
      }
      accepted.push(file);
      remaining--;
    }

    if (skippedForLimit) {
      window.alert(`You can add up to ${this.maxImages} photos. Some were not added.`);
    }
    if (!accepted.length) return;

    this.newFiles.update((current) => [...current, ...accepted]);
    this.newPreviews.update((current) => [
      ...current,
      ...accepted.map((file) => URL.createObjectURL(file)),
    ]);
  }

  removeExistingImage(index: number): void {
    this.existingImageUrls.update((urls) => urls.filter((_, i) => i !== index));
  }

  removeNewImage(index: number): void {
    const preview = this.newPreviews()[index];
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    this.newFiles.update((files) => files.filter((_, i) => i !== index));
    this.newPreviews.update((previews) => previews.filter((_, i) => i !== index));
  }

  cancel(event?: Event): void {
    event?.preventDefault();
    const fallback = this.isEdit && this.propertyId
      ? ['/properties', this.propertyId]
      : ['/properties'];
    navigateBack(this.location, this.router, fallback);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    const user = this.auth.currentUser();
    if (!user) return;

    this.loading.set(true);
    try {
      const data = this.form.getRawValue();
      const newFiles = this.newFiles();

      if (this.isEdit && this.propertyId) {
        const uploaded = newFiles.length
          ? await this.propertyImageService.uploadMany(user.id, this.propertyId, newFiles)
          : [];
        const finalUrls = [...this.existingImageUrls(), ...uploaded];

        if (finalUrls.length) {
          await this.propertyService.update(this.propertyId, {
            ...data,
            imageUrl: finalUrls[0],
            imageUrls: finalUrls,
          });
        } else {
          await this.propertyService.update(this.propertyId, data, { removeImage: true });
        }
        this.router.navigate(['/properties', this.propertyId]);
      } else {
        const id = await this.propertyService.create(user.id, data);
        if (newFiles.length) {
          const finalUrls = await this.propertyImageService.uploadMany(user.id, id, newFiles);
          await this.propertyService.update(id, { imageUrl: finalUrls[0], imageUrls: finalUrls });
        }
        await this.inviteCodeService.ensurePropertyCode(user.id, user.name, id, data.name);
        this.router.navigate(['/properties', id]);
      }
    } finally {
      this.loading.set(false);
    }
  }

  private applyCountryProfile(countryCode: string, resetCurrency = true): void {
    const profile = getCountryProfile(countryCode);
    this.currencies.set(profile.currencies);
    this.form.patchValue(
      {
        country: profile.name,
        ...(resetCurrency ? { currency: profile.defaultCurrency } : {}),
      },
      { emitEvent: false }
    );
  }
}
