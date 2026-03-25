/**
 * Public Shop View Component
 *
 * Client-facing storefront. Displays all active shop items for an expert.
 * Clients can purchase digital downloads or submit a shoutout / video request.
 *
 * Flow:
 *  1. Page loads → fetch active items via ShopService
 *  2. Client clicks an item card → inline form expands
 *  3. Client submits name + email (+ brief for request-based) → Stripe Checkout
 */

import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TrustIndicatorsComponent } from '../../../../../../shared/components/trust-indicators/trust-indicators.component';
import { ShopItem } from '../../../../../../core/models';
import { ShopService } from '../../../../../creator/services/shop.service';
import { MessagePageStateService } from '../../message-page-state.service';

const TYPE_EMOJI: Record<string, string> = {
  video: '🎬',
  audio: '🎵',
  pdf: '📄',
  image: '🖼️',
  shoutout_request: '🎥',
};

const TYPE_LABEL: Record<string, string> = {
  video: 'Video',
  audio: 'Audio',
  pdf: 'PDF / E-book',
  image: 'Image / Photo',
  shoutout_request: 'Video Request',
};

@Component({
  selector: 'app-shop-view',
  imports: [RouterLink, FormsModule, TrustIndicatorsComponent],
  templateUrl: './shop-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopViewComponent implements OnInit {
  protected readonly state = inject(MessagePageStateService);
  protected readonly shopService = inject(ShopService);

  protected readonly items = signal<ShopItem[]>([]);
  protected readonly loadingItems = signal(true);
  protected readonly activeItemId = signal<string | null>(null);

  // Per-item buyer form values
  protected buyerName = '';
  protected buyerEmail = '';
  protected requestDetails = '';

  // Metadata helpers exposed to template
  protected readonly typeEmoji = TYPE_EMOJI;
  protected readonly typeLabel = TYPE_LABEL;

  public ngOnInit(): void {
    void this.loadItems();
  }

  protected toggleItem(itemId: string): void {
    if (this.activeItemId() === itemId) {
      this.activeItemId.set(null);
    } else {
      this.activeItemId.set(itemId);
      this.buyerName = '';
      this.buyerEmail = '';
      this.requestDetails = '';
    }
  }

  protected formatPrice(cents: number): string {
    return '$' + (cents / 100).toFixed(2);
  }

  protected onSubmit(item: ShopItem): void {
    void this.state.onShopCheckout(
      item.id,
      this.buyerName,
      this.buyerEmail,
      item.is_request_based ? this.requestDetails : undefined,
    );
  }

  private async loadItems(): Promise<void> {
    const creator = this.state.creator();
    if (!creator) return;

    this.loadingItems.set(true);
    const result = await this.shopService.getActiveShopItems(creator.id);
    this.loadingItems.set(false);

    this.items.set(result.data ?? []);
  }
}
