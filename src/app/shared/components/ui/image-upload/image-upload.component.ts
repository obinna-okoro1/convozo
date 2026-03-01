/**
 * Image Upload Component
 *
 * Reusable profile-image uploader with built-in compression,
 * preview, Supabase Storage integration and remove support.
 *
 * Usage:
 *   <app-image-upload
 *     [imageUrl]="profileImageUrl()"
 *     [variant]="'compact'"
 *     (imageChanged)="onImageChanged($event)"
 *     (uploadError)="onError($event)"
 *   />
 */

import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { compressImage } from '../../../utils/image.utils';

/** Emitted when the image URL changes (new upload or removal). */
export interface ImageChangeEvent {
  /** The new public URL, or empty string if removed. */
  url: string;
}

@Component({
  selector: 'app-image-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-upload.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageUploadComponent {
  /**
   * Current image URL – drives the preview.
   * Pass the parent's stored URL so the preview shows on load.
   */
  readonly imageUrl = input<string>('');

  /**
   * Visual variant.
   *   - `compact`  → small 5rem thumbnail (onboarding style)
   *   - `large`    → large 10rem thumbnail (settings style)
   */
  readonly variant = input<'compact' | 'large'>('compact');

  /** Label shown above the upload area. */
  readonly label = input<string>('Profile Photo');

  /** Emits whenever the stored URL changes (upload or remove). */
  readonly imageChanged = output<ImageChangeEvent>();

  /** Emits user-facing error strings. */
  readonly uploadError = output<string>();

  /* internal state */
  protected readonly uploading = signal(false);
  protected readonly preview = signal<string | null>(null);

  private static idCounter = 0;
  protected readonly inputId = `img-upload-${++ImageUploadComponent.idCounter}`;

  constructor(private readonly supabaseService: SupabaseService) {}

  /* ------------------------------------------------------------------ */
  /*  Public helpers used in the template                                */
  /* ------------------------------------------------------------------ */

  /** The source for the preview – either a local data-URL or the persisted URL. */
  protected currentPreview(): string | null {
    return this.preview() || this.imageUrl() || null;
  }

  /* ------------------------------------------------------------------ */
  /*  Event handlers                                                     */
  /* ------------------------------------------------------------------ */

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.uploadError.emit('Please upload an image file');
      return;
    }

    this.uploading.set(true);

    try {
      const compressed = await compressImage(file);

      // Show local preview immediately
      const reader = new FileReader();
      reader.onload = (e) => this.preview.set(e.target?.result as string);
      reader.readAsDataURL(compressed);

      const userId = this.supabaseService.getCurrentUser()?.id;
      if (!userId) throw new Error('User not authenticated');

      const fileName = `${userId}-${String(Date.now())}.jpg`;
      const filePath = `avatars/${fileName}`;

      const { data, error } = await this.supabaseService.uploadFile('public', filePath, compressed);
      if (error) throw error;

      if (data?.publicUrl) {
        this.imageChanged.emit({ url: data.publicUrl });
      }
    } catch (err) {
      this.preview.set(null);
      this.uploadError.emit(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      this.uploading.set(false);
      // Reset the input so re-selecting the same file triggers change
      (event.target as HTMLInputElement).value = '';
    }
  }

  protected remove(): void {
    this.preview.set(null);
    this.imageChanged.emit({ url: '' });
  }
}
