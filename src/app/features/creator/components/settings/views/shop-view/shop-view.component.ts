/**
 * Shop View Component (Creator-side)
 *
 * Allows creators to:
 *  - Toggle their shop on / off
 *  - Add, edit, activate/deactivate, and delete digital shop items
 *
 * Item types: video | audio | pdf | image | shoutout_request
 *
 * Files are uploaded directly to Supabase Storage:
 *  - Digital files → private 'shop-files' bucket (fans get signed URLs via edge function)
 *  - Thumbnails    → public 'shop-thumbnails' bucket (direct public URL)
 *
 * All prices stored/sent as integer cents. Never use floats for money.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ShopItem, ShopItemType } from '../../../../../../core/models';
import { ShopService } from '../../../../services/shop.service';
import { SettingsStateService } from '../../settings-state.service';

interface ItemFormState {
  title: string;
  description: string;
  priceDollars: number;
  itemType: ShopItemType;
  /** Path in private shop-files bucket — set after upload */
  fileStoragePath: string | null;
  /** Friendly display name shown in the UI after upload */
  fileDisplayName: string | null;
  /** Path in public shop-thumbnails bucket — set after thumbnail upload */
  thumbnailStoragePath: string | null;
  /** Public URL for the thumbnail preview */
  thumbnailPublicUrl: string | null;
  previewText: string;
  deliveryNote: string;
  isRequestBased: boolean;
}

const EMPTY_FORM: ItemFormState = {
  title: '',
  description: '',
  priceDollars: 10,
  itemType: 'pdf',
  fileStoragePath: null,
  fileDisplayName: null,
  thumbnailStoragePath: null,
  thumbnailPublicUrl: null,
  previewText: '',
  deliveryNote: '',
  isRequestBased: false,
};

const TYPE_META: Record<ShopItemType, { emoji: string; label: string; hint: string; accept: string }> = {
  video: {
    emoji: '🎬',
    label: 'Video',
    hint: 'Tutorial, clip, exclusive footage, etc.',
    accept: 'video/mp4,video/quicktime,video/webm,video/x-msvideo',
  },
  audio: {
    emoji: '🎵',
    label: 'Audio',
    hint: 'Music, podcast, voice memo, soundpack, etc.',
    accept: 'audio/mpeg,audio/wav,audio/ogg,audio/flac,audio/x-m4a',
  },
  pdf: {
    emoji: '📄',
    label: 'PDF / E-book',
    hint: 'Guide, template, preset, LUTs, etc.',
    accept: 'application/pdf',
  },
  image: {
    emoji: '🖼️',
    label: 'Image / Photo',
    hint: 'Presets, wallpapers, artwork, prints, etc.',
    accept: 'image/jpeg,image/png,image/webp,application/zip',
  },
  shoutout_request: {
    emoji: '🎥',
    label: 'Shoutout / Video Request',
    hint: 'Fan requests a custom video you record and deliver.',
    accept: '',
  },
};

/** Maximum file sizes in bytes */
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_THUMBNAIL_SIZE = 10 * 1024 * 1024; // 10 MB

@Component({
  selector: 'app-shop-view',
  imports: [FormsModule, RouterLink],
  templateUrl: './shop-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopViewComponent implements OnInit {
  protected readonly state = inject(SettingsStateService);
  private readonly shopService = inject(ShopService);

  protected readonly items = signal<ShopItem[]>([]);
  protected readonly loadingItems = signal(true);
  protected readonly savingItem = signal(false);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly shopError = signal<string | null>(null);
  protected readonly shopSuccess = signal<string | null>(null);
  protected readonly showForm = signal(false);
  protected readonly editingId = signal<string | null>(null);

  /** Upload states — kept as separate signals so the UI updates independently */
  protected readonly uploadingFile = signal(false);
  protected readonly uploadingThumbnail = signal(false);
  protected readonly fileUploadError = signal<string | null>(null);
  protected readonly thumbnailUploadError = signal<string | null>(null);

  /** Form state held in a signal so computed properties react to changes */
  protected readonly form = signal<ItemFormState>({ ...EMPTY_FORM });

  protected readonly typeMeta = TYPE_META;
  protected readonly itemTypes = Object.keys(TYPE_META) as ShopItemType[];

  protected readonly activeCount = computed(() => this.items().filter((i) => i.is_active).length);

  protected readonly canSaveItem = computed(() => {
    const f = this.form();
    const hasFile = f.isRequestBased || f.fileStoragePath !== null;
    return (
      f.title.trim().length > 0 &&
      f.title.length <= 100 &&
      f.priceDollars >= 1 &&
      hasFile &&
      !this.uploadingFile() &&
      !this.uploadingThumbnail()
    );
  });

  public ngOnInit(): void {
    void this.loadItems();
  }

  // ── Named form-field setters ───────────────────────────────────────────────

  protected setTitle(value: string): void {
    this.form.update((f) => ({ ...f, title: value }));
  }

  protected setDescription(value: string): void {
    this.form.update((f) => ({ ...f, description: value }));
  }

  protected setPrice(value: string): void {
    this.form.update((f) => ({ ...f, priceDollars: +value }));
  }

  protected setPreviewText(value: string): void {
    this.form.update((f) => ({ ...f, previewText: value }));
  }

  protected setDeliveryNote(value: string): void {
    this.form.update((f) => ({ ...f, deliveryNote: value }));
  }

  // ── File upload handlers ───────────────────────────────────────────────────

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      this.fileUploadError.set('File is too large. Maximum size is 500 MB.');
      input.value = '';
      return;
    }

    const creator = this.state.creator();
    if (!creator) return;

    this.fileUploadError.set(null);
    this.uploadingFile.set(true);

    const result = await this.shopService.uploadShopFile(creator.id, file);
    this.uploadingFile.set(false);

    if (result.error || !result.path) {
      this.fileUploadError.set('Upload failed. Please try again.');
      input.value = '';
      return;
    }

    this.form.update((f) => ({
      ...f,
      fileStoragePath: result.path,
      fileDisplayName: file.name,
    }));
    // Reset input so re-selecting the same file triggers change event
    input.value = '';
  }

  protected async onThumbnailSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > MAX_THUMBNAIL_SIZE) {
      this.thumbnailUploadError.set('Image is too large. Maximum size is 10 MB.');
      input.value = '';
      return;
    }

    const creator = this.state.creator();
    if (!creator) return;

    this.thumbnailUploadError.set(null);
    this.uploadingThumbnail.set(true);

    const result = await this.shopService.uploadShopThumbnail(creator.id, file);
    this.uploadingThumbnail.set(false);

    if (result.error || !result.path) {
      this.thumbnailUploadError.set('Thumbnail upload failed. Please try again.');
      input.value = '';
      return;
    }

    this.form.update((f) => ({
      ...f,
      thumbnailStoragePath: result.path,
      thumbnailPublicUrl: result.publicUrl,
    }));
    input.value = '';
  }

  protected clearFile(): void {
    // Note: we don't delete from storage here — orphan cleanup handled separately
    this.form.update((f) => ({ ...f, fileStoragePath: null, fileDisplayName: null }));
    this.fileUploadError.set(null);
  }

  protected clearThumbnail(): void {
    this.form.update((f) => ({ ...f, thumbnailStoragePath: null, thumbnailPublicUrl: null }));
    this.thumbnailUploadError.set(null);
  }

  // ── Form actions ───────────────────────────────────────────────────────────

  protected openAddForm(): void {
    this.editingId.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.fileUploadError.set(null);
    this.thumbnailUploadError.set(null);
    this.shopError.set(null);
    this.showForm.set(true);
  }

  protected openEditForm(item: ShopItem): void {
    this.editingId.set(item.id);
    this.form.set({
      title: item.title,
      description: item.description ?? '',
      priceDollars: item.price / 100,
      itemType: item.item_type,
      fileStoragePath: item.file_storage_path ?? null,
      fileDisplayName: item.file_storage_path
        ? item.file_storage_path.split('/').pop()?.replace(/^\d+_/, '') ?? 'Uploaded file'
        : null,
      thumbnailStoragePath: item.thumbnail_storage_path ?? null,
      thumbnailPublicUrl: null, // will be loaded lazily
      previewText: item.preview_text ?? '',
      deliveryNote: item.delivery_note ?? '',
      isRequestBased: item.is_request_based,
    });
    this.fileUploadError.set(null);
    this.thumbnailUploadError.set(null);
    this.shopError.set(null);
    this.showForm.set(true);
  }

  protected cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.shopError.set(null);
    this.fileUploadError.set(null);
    this.thumbnailUploadError.set(null);
  }

  protected onTypeChange(type: ShopItemType): void {
    this.form.update((f) => ({
      ...f,
      itemType: type,
      isRequestBased: type === 'shoutout_request',
      // Clear file data when switching type — file may not be compatible
      fileStoragePath: null,
      fileDisplayName: null,
      fileUploadError: null,
    }));
    this.fileUploadError.set(null);
  }

  protected async saveItem(): Promise<void> {
    if (!this.canSaveItem()) return;
    const creator = this.state.creator();
    if (!creator) return;

    const f = this.form();
    // Money is always integer cents — Math.round prevents float drift
    const priceCents = Math.round(f.priceDollars * 100);

    const payload = {
      creator_id: creator.id,
      title: f.title.trim(),
      description: f.description.trim() || null,
      price: priceCents,
      item_type: f.itemType,
      file_storage_path: f.isRequestBased ? null : (f.fileStoragePath ?? null),
      thumbnail_storage_path: f.thumbnailStoragePath ?? null,
      // Keep legacy fields null for new items
      file_url: null,
      thumbnail_url: null,
      preview_text: f.previewText.trim() || null,
      delivery_note: f.deliveryNote.trim() || null,
      is_active: true,
      is_request_based: f.isRequestBased,
      sort_order: 0,
    };

    this.savingItem.set(true);
    this.shopError.set(null);

    const editId = this.editingId();
    if (editId) {
      const result = await this.shopService.updateShopItem(editId, payload);
      this.savingItem.set(false);
      if (result.error || !result.data) {
        this.shopError.set('Failed to update item. Please try again.');
        return;
      }
      this.items.update((list) => list.map((i) => (i.id === editId ? result.data! : i)));
    } else {
      const result = await this.shopService.createShopItem(payload);
      this.savingItem.set(false);
      if (result.error || !result.data) {
        this.shopError.set('Failed to create item. Please try again.');
        return;
      }
      this.items.update((list) => [result.data!, ...list]);
    }

    this.showForm.set(false);
    this.editingId.set(null);
    this.flashSuccess(editId ? 'Item updated!' : 'Item added to your shop!');
  }

  protected async toggleItemActive(item: ShopItem): Promise<void> {
    const result = await this.shopService.updateShopItem(item.id, { is_active: !item.is_active });
    if (result.error || !result.data) return;
    this.items.update((list) => list.map((i) => (i.id === item.id ? result.data! : i)));
  }

  protected async deleteItem(id: string): Promise<void> {
    this.deletingId.set(id);
    const result = await this.shopService.deleteShopItem(id);
    this.deletingId.set(null);
    if (result.error) {
      this.shopError.set('Failed to delete item. Please try again.');
      return;
    }
    this.items.update((list) => list.filter((i) => i.id !== id));
    this.flashSuccess('Item removed from your shop.');
  }

  // ── Shop-level toggle ──────────────────────────────────────────────────────

  protected async toggleShop(): Promise<void> {
    this.state.shopEnabled.update((v) => !v);
    await this.state.saveMonetization();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  protected formatPrice(cents: number): string {
    return '$' + (cents / 100).toFixed(2);
  }

  protected getTypeMeta(type: ShopItemType): { emoji: string; label: string; hint: string; accept: string } {
    return TYPE_META[type];
  }

  private async loadItems(): Promise<void> {
    const creator = this.state.creator();
    if (!creator) return;

    this.loadingItems.set(true);
    const result = await this.shopService.getShopItems(creator.id);
    this.loadingItems.set(false);

    if (result.error) {
      this.shopError.set('Failed to load shop items.');
      return;
    }
    this.items.set(result.data ?? []);
  }

  private flashSuccess(msg: string): void {
    this.shopSuccess.set(msg);
    setTimeout(() => this.shopSuccess.set(null), 3500);
  }
}

