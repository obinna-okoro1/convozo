/**
 * Shop View Component (Creator-side)
 *
 * Allows creators to:
 *  - Toggle their shop on / off
 *  - Add, edit, activate/deactivate, and delete digital shop items
 *
 * Item types: video | audio | pdf | image | shoutout_request
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
  fileUrl: string;
  thumbnailUrl: string;
  previewText: string;
  deliveryNote: string;
  isRequestBased: boolean;
}

const EMPTY_FORM: ItemFormState = {
  title: '',
  description: '',
  priceDollars: 10,
  itemType: 'pdf',
  fileUrl: '',
  thumbnailUrl: '',
  previewText: '',
  deliveryNote: '',
  isRequestBased: false,
};

const TYPE_META: Record<ShopItemType, { emoji: string; label: string; hint: string }> = {
  video: { emoji: '🎬', label: 'Video', hint: 'Tutorial, clip, exclusive footage, etc.' },
  audio: { emoji: '🎵', label: 'Audio', hint: 'Music, podcast, voice memo, soundpack, etc.' },
  pdf: { emoji: '📄', label: 'PDF / E-book', hint: 'Guide, template, preset, LUTs, etc.' },
  image: { emoji: '🖼️', label: 'Image / Photo', hint: 'Presets, wallpapers, artwork, prints, etc.' },
  shoutout_request: {
    emoji: '🎥',
    label: 'Shoutout / Video Request',
    hint: 'Fan requests a custom video you record and deliver.',
  },
};

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

  /** Form state held in a signal so canSaveItem() computed tracks it reactively */
  protected readonly form = signal<ItemFormState>({ ...EMPTY_FORM });

  protected readonly typeMeta = TYPE_META;
  protected readonly itemTypes = Object.keys(TYPE_META) as ShopItemType[];

  protected readonly activeCount = computed(() => this.items().filter((i) => i.is_active).length);

  protected readonly canSaveItem = computed(() => {
    const f = this.form();
    return (
      f.title.trim().length > 0 &&
      f.title.length <= 100 &&
      f.priceDollars >= 1 &&
      (f.isRequestBased || f.fileUrl.trim().length > 0)
    );
  });

  public ngOnInit(): void {
    void this.loadItems();
  }

  // ── Named form-field setters (arrow functions forbidden in Angular templates) ──

  protected setTitle(value: string): void {
    this.form.update((f) => ({ ...f, title: value }));
  }

  protected setDescription(value: string): void {
    this.form.update((f) => ({ ...f, description: value }));
  }

  protected setPrice(value: string): void {
    this.form.update((f) => ({ ...f, priceDollars: +value }));
  }

  protected setFileUrl(value: string): void {
    this.form.update((f) => ({ ...f, fileUrl: value }));
  }

  protected setThumbnailUrl(value: string): void {
    this.form.update((f) => ({ ...f, thumbnailUrl: value }));
  }

  protected setPreviewText(value: string): void {
    this.form.update((f) => ({ ...f, previewText: value }));
  }

  protected setDeliveryNote(value: string): void {
    this.form.update((f) => ({ ...f, deliveryNote: value }));
  }

  // ── Form actions ───────────────────────────────────────────────────────────

  protected openAddForm(): void {
    this.editingId.set(null);
    this.form.set({ ...EMPTY_FORM });
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
      fileUrl: item.file_url ?? '',
      thumbnailUrl: item.thumbnail_url ?? '',
      previewText: item.preview_text ?? '',
      deliveryNote: item.delivery_note ?? '',
      isRequestBased: item.is_request_based,
    });
    this.shopError.set(null);
    this.showForm.set(true);
  }

  protected cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.shopError.set(null);
  }

  protected onTypeChange(type: ShopItemType): void {
    this.form.update((f) => ({
      ...f,
      itemType: type,
      isRequestBased: type === 'shoutout_request',
    }));
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
      file_url: f.isRequestBased ? null : (f.fileUrl.trim() || null),
      thumbnail_url: f.thumbnailUrl.trim() || null,
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

  protected getTypeMeta(type: ShopItemType): { emoji: string; label: string; hint: string } {
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
