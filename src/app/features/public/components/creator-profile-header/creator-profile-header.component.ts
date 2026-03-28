/**
 * Creator Profile Header Component
 * Displays the creator's avatar, name, bio, and status.
 * Used on the public message page.
 */

import { ChangeDetectionStrategy, Component, input, computed, signal, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CreatorProfile } from '../../../../core/models';
import {
  getCategoryById,
  getSubcategoryLabel,
  type ExpertCategory,
} from '../../../../core/models/expert-categories.data';

@Component({
  selector: 'app-creator-profile-header',
  standalone: true,
  templateUrl: './creator-profile-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatorProfileHeaderComponent {
  private readonly document = inject(DOCUMENT);

  public readonly creator = input.required<CreatorProfile>();
  public readonly responseExpectation = input<string>('24-48 hours');
  /** Whether this expert has completed identity verification. Defaults to false. */
  public readonly verified = input<boolean>(false);

  protected readonly imageLoadError = signal(false);
  protected readonly bannerLoadError = signal(false);
  protected readonly shareMenuOpen = signal(false);
  protected readonly copied = signal(false);

  protected readonly initial = computed(() => {
    const name = this.creator()?.display_name;
    return name ? name.charAt(0) : 'C';
  });

  /** Full public profile URL for sharing. */
  protected readonly profileUrl = computed(() => {
    const { origin } = this.document.location;
    return `${origin}/${this.creator().slug}`;
  });

  /** Pre-built WhatsApp share link. */
  protected readonly whatsappUrl = computed(() => {
    const url = this.profileUrl();
    const name = this.creator().display_name;
    return `https://wa.me/?text=${encodeURIComponent(`Check out ${name} on Convozo: ${url}`)}`;
  });

  /** Pre-built X / Twitter share link. */
  protected readonly xUrl = computed(() => {
    const url = this.profileUrl();
    const name = this.creator().display_name;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${name} on Convozo`)}&url=${encodeURIComponent(url)}`;
  });

  /** Resolved top-level category (emoji + label), or null. */
  protected readonly categoryInfo = computed((): ExpertCategory | null => {
    const id = this.creator()?.category;
    return id ? (getCategoryById(id) ?? null) : null;
  });

  /** Resolved subcategory label, or null. */
  protected readonly subcategoryLabel = computed((): string | null => {
    const catId = this.creator()?.category;
    const subId = this.creator()?.subcategory;
    if (!catId || !subId) return null;
    return getSubcategoryLabel(catId, subId);
  });

  /** True when the expert has at least one credential worth surfacing. */
  protected readonly hasCredentials = computed(() => {
    const c = this.creator();
    return !!(c?.profession_title ?? c?.category);
  });

  /**
   * Attempts the native Web Share API first (gives a full share sheet on mobile
   * including WhatsApp, Messages, etc.).  Falls back to the custom dropdown on
   * browsers / desktop environments that don't support it.
   */
  protected async shareProfile(): Promise<void> {
    const url = this.profileUrl();
    const name = this.creator().display_name;

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: name, text: `Check out ${name} on Convozo`, url });
        return;
      } catch {
        // User cancelled native share – fall through to custom menu.
      }
    }

    this.shareMenuOpen.update(v => !v);
  }

  /** Writes the profile URL to the clipboard and shows brief "Copied!" feedback. */
  protected async copyLink(): Promise<void> {
    this.shareMenuOpen.set(false);
    try {
      await navigator.clipboard.writeText(this.profileUrl());
    } catch {
      // Clipboard API unavailable – silently ignore.
    }
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  protected closeShareMenu(): void {
    this.shareMenuOpen.set(false);
  }
}
