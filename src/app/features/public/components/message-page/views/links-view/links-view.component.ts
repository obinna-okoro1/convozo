/**
 * Links View Component
 * Displays the expert's posts feed, service cards, and compact link pills
 * on the public message page home tab.
 *
 * Owner extras: "Add new link" pill and "New post" modal — rendered only when
 * the authenticated user is the profile owner (via ProfileOwnerService).
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessagePageStateService } from '../../message-page-state.service';
import { ProfileOwnerService } from '../../services/profile-owner.service';
import { SupabaseService } from '@core/services/supabase.service';
import { ToastService } from '@shared/services/toast.service';
import { CreatorLink, CreatorPost } from '@core/models';
import {
  getBrandByKey,
  BrandInfo,
} from '@features/link-in-bio/utils/brand-detection';
import { LinkFormModalComponent } from '@features/link-in-bio/components/link-form-modal/link-form-modal.component';
import { LinkService } from '@features/link-in-bio/services/link.service';
import {
  CallBookingFormComponent,
  CallBookingFormData,
} from '@features/public/components/call-booking-form/call-booking-form.component';
import {
  MessageFormComponent,
  MessageFormData,
} from '@features/public/components/message-form/message-form.component';

/** Max words per post — must match the dashboard posts view */
const MAX_POST_WORDS = 500;

@Component({
  selector: 'app-links-view',
  imports: [RouterLink, LinkFormModalComponent, CallBookingFormComponent, MessageFormComponent],
  templateUrl: './links-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinksViewComponent {
  protected readonly state = inject(MessagePageStateService);
  protected readonly ownerState = inject(ProfileOwnerService);
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly linkService = inject(LinkService);

  /** Tracks which post is expanded — only one open at a time. */
  protected readonly expandedPostId = signal<string | null>(null);

  // ── Booking form handlers ─────────────────────────────────────────

  protected onCallBookingSubmit(formData: CallBookingFormData): void {
    void this.state.onCallBookingSubmit(formData);
  }

  protected onMessageSubmit(formData: MessageFormData): void {
    void this.state.onMessageSubmit(formData);
  }

  // ── Link modal ────────────────────────────────────────────────────
  protected readonly showLinkModal = signal(false);
  /** The link being edited; null means add mode. */
  protected readonly editingLink = signal<CreatorLink | null>(null);
  /** The link ID awaiting delete confirmation. */
  protected readonly deletePendingId = signal<string | null>(null);
  /** The link ID whose ⋮ context menu is currently open. */
  protected readonly activeLinkMenuId = signal<string | null>(null);

  // ── Post compose modal ────────────────────────────────────────────
  protected readonly showPostModal = signal(false);
  protected readonly draftTitle = signal('');
  protected readonly draft = signal('');
  protected readonly postSubmitting = signal(false);

  protected readonly wordCount = computed<number>(() => {
    const text = this.draft().trim();
    return text ? text.split(/\s+/).length : 0;
  });
  protected readonly wordsRemaining = computed(() => MAX_POST_WORDS - this.wordCount());
  protected readonly canPost = computed(
    () =>
      this.draftTitle().trim().length > 0 &&
      this.wordCount() > 0 &&
      this.wordCount() <= MAX_POST_WORDS &&
      !this.postSubmitting(),
  );
  protected readonly wordCountClass = computed(() => {
    const rem = this.wordsRemaining();
    if (rem < 0) return 'text-system-red font-bold';
    if (rem <= 50) return 'text-yellow-400';
    return 'text-content-tertiary';
  });

  // ── Helpers ───────────────────────────────────────────────────────

  protected togglePost(id: string): void {
    this.expandedPostId.set(this.expandedPostId() === id ? null : id);
  }

  protected onLinkClicked(link: CreatorLink): void {
    this.state.onLinkClicked(link);
  }

  protected getBrand(link: CreatorLink): BrandInfo | null {
    return link.icon ? getBrandByKey(link.icon) : null;
  }

  protected relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ── Link context menu (⋮ button — works on mobile and desktop) ───────

  protected toggleLinkMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.activeLinkMenuId.set(this.activeLinkMenuId() === id ? null : id);
    this.deletePendingId.set(null);
  }

  protected closeLinkMenu(): void {
    this.activeLinkMenuId.set(null);
    this.deletePendingId.set(null);
  }

  // ── Link modal actions ────────────────────────────────────────────

  protected openLinkModal(): void {
    this.editingLink.set(null);
    this.showLinkModal.set(true);
  }

  protected openEditLinkModal(link: CreatorLink): void {
    this.activeLinkMenuId.set(null);
    this.editingLink.set(link);
    this.showLinkModal.set(true);
  }

  protected onLinkSaved(): void {
    this.showLinkModal.set(false);
    this.editingLink.set(null);
    // Reload the public links list so changes appear immediately
    const creatorId = this.ownerState.creatorId();
    if (creatorId) {
      void this.state.reloadLinks(creatorId);
    }
  }

  protected closeLinkModal(): void {
    this.showLinkModal.set(false);
    this.editingLink.set(null);
  }

  // ── Link delete actions ───────────────────────────────────────────

  protected requestDelete(link: CreatorLink): void {
    this.deletePendingId.set(link.id);
  }

  protected cancelDelete(): void {
    this.deletePendingId.set(null);
  }

  protected async executeDelete(link: CreatorLink): Promise<void> {
    this.deletePendingId.set(null);
    const { error } = await this.linkService.deleteLink(link.id);
    if (error) {
      this.toast.error('Failed to delete link');
    } else {
      this.toast.success('Link deleted');
      // Remove from local list immediately, then sync from DB
      this.state.creatorLinks.update((list) => list.filter((l) => l.id !== link.id));
      const creatorId = this.ownerState.creatorId();
      if (creatorId) {
        void this.state.reloadLinks(creatorId);
      }
    }
  }

  // ── Post modal actions ────────────────────────────────────────────

  protected openPostModal(): void {
    this.draftTitle.set('');
    this.draft.set('');
    this.showPostModal.set(false);
    // small tick so the modal animation plays cleanly
    requestAnimationFrame(() => this.showPostModal.set(true));
  }

  protected closePostModal(): void {
    this.showPostModal.set(false);
    this.draftTitle.set('');
    this.draft.set('');
  }

  protected async submitPost(): Promise<void> {
    if (!this.canPost() || this.postSubmitting()) return;
    const creatorId = this.ownerState.creatorId();
    if (!creatorId) return;

    this.postSubmitting.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('creator_posts')
        .insert({
          creator_id: creatorId,
          title: this.draftTitle().trim(),
          content: this.draft().trim(),
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // Prepend to the public feed immediately so the owner sees it
        this.state.creatorPosts.update((posts) => [data as CreatorPost, ...posts]);
      }
      this.toast.success('Post published!');
      this.closePostModal();
    } catch {
      this.toast.error('Failed to publish post');
    } finally {
      this.postSubmitting.set(false);
    }
  }
}

