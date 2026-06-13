import { Injectable, inject } from '@angular/core';
import { AppCheck } from '@angular/fire/app-check';
import { Storage, getDownloadURL, ref, uploadBytes } from '@angular/fire/storage';
import { ensureAppCheckToken } from '../utils/app-check.utils';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Maximum number of reference photos allowed per property. */
export const MAX_PROPERTY_IMAGES = 6;

@Injectable({ providedIn: 'root' })
export class PropertyImageService {
  private storage = inject(Storage);
  private appCheck = inject(AppCheck, { optional: true });

  validateImage(file: File): string | null {
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file (JPG, PNG, etc.).';
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return 'Image must be 5 MB or smaller.';
    }
    return null;
  }

  async upload(ownerId: string, propertyId: string, file: File): Promise<string> {
    await ensureAppCheckToken(this.appCheck ?? null);
    const error = this.validateImage(file);
    if (error) throw new Error(error);

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storageRef = ref(this.storage, `properties/${ownerId}/${propertyId}/${unique}.${extension}`);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return getDownloadURL(storageRef);
  }

  /** Upload several photos sequentially; returns their download URLs in order. */
  async uploadMany(ownerId: string, propertyId: string, files: File[]): Promise<string[]> {
    const urls: string[] = [];
    for (const file of files) {
      urls.push(await this.upload(ownerId, propertyId, file));
    }
    return urls;
  }
}
