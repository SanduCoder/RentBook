import { Location } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { navigateBack } from '../../../core/utils/navigate-back.util';
import { AuthService } from '../../../core/services/auth.service';
import { PropertyImageService } from '../../../core/services/property-image.service';
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
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  loading = signal(false);
  propertyId = this.route.snapshot.paramMap.get('id');
  isEdit = !!this.propertyId;

  selectedFile = signal<File | null>(null);
  imagePreview = signal<string | null>(null);
  existingImageUrl = signal<string | null>(null);
  removeImage = signal(false);

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
    country: ['Gambia', Validators.required],
    currency: ['GMD', Validators.required],
  });

  ngOnInit(): void {
    if (!this.propertyId) return;

    this.propertyService.getById(this.propertyId).subscribe((property) => {
      if (!property) return;
      this.form.patchValue({
        name: property.name,
        type: property.type,
        address: property.address,
        country: property.country,
        currency: property.currency,
      });
      if (property.imageUrl) {
        this.existingImageUrl.set(property.imageUrl);
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const error = this.propertyImageService.validateImage(file);
    if (error) {
      window.alert(error);
      input.value = '';
      return;
    }

    this.selectedFile.set(file);
    this.removeImage.set(false);
    this.imagePreview.set(URL.createObjectURL(file));
  }

  clearImage(): void {
    this.selectedFile.set(null);
    this.imagePreview.set(null);
    if (this.existingImageUrl()) {
      this.removeImage.set(true);
      this.existingImageUrl.set(null);
    }
  }

  hasImage(): boolean {
    return !!(this.imagePreview() || this.existingImageUrl());
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
      const file = this.selectedFile();

      if (this.isEdit && this.propertyId) {
        let imageUrl: string | undefined;
        if (file) {
          imageUrl = await this.propertyImageService.upload(user.id, this.propertyId, file);
        }

        await this.propertyService.update(
          this.propertyId,
          imageUrl ? { ...data, imageUrl } : data,
          { removeImage: this.removeImage() && !file }
        );
        this.router.navigate(['/properties', this.propertyId]);
      } else {
        const id = await this.propertyService.create(user.id, data);
        if (file) {
          const imageUrl = await this.propertyImageService.upload(user.id, id, file);
          await this.propertyService.update(id, { imageUrl });
        }
        await this.inviteCodeService.ensurePropertyCode(user.id, user.name, id, data.name);
        this.router.navigate(['/properties', id]);
      }
    } finally {
      this.loading.set(false);
    }
  }
}
