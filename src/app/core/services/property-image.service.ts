import { Injectable, inject } from '@angular/core';
import { AppCheck } from '@angular/fire/app-check';
import { Storage, getDownloadURL, ref, uploadBytes } from '@angular/fire/storage';
import { ensureAppCheckToken } from '../utils/app-check.utils';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
    const storageRef = ref(this.storage, `properties/${ownerId}/${propertyId}/reference.${extension}`);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return getDownloadURL(storageRef);
  }
}
