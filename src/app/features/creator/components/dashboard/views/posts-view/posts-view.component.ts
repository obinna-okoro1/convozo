/**
 * Posts View — Dashboard
 * Compose and manage short posts (≤ 100 words) published to the expert's public profile.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DashboardStateService } from '../../dashboard-state.service';
import { SupabaseService } from '../../../../../../core/services/supabase.service';
import { ToastService } from '../../../../../../shared/services/toast.service';
import { CreatorPost } from '../../../../../../core/models';

/** Hard word cap matching the public-facing limit */
const MAX_WORDS = 500;

@Component({
  selector: 'app-posts-view',
  templateUrl: './posts-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostsViewComponent {
  protected readonly state = inject(DashboardStateService);
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);

  protected readonly posts = signal<CreatorPost[]>([]);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  /** ID of the post currently being deleted, null when idle */
  protected readonly deletingId = signal<string | null>(null);
  /** Tracks which post is expanded — only one can be open at a time (accordion). */
  protected readonly expandedPostId = signal<string | null>(null);
  protected readonly draftTitle = signal('');
  protected readonly draft = signal('');

  protected readonly wordCount = computed<number>(() => {
    const text = this.draft().trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
  });

  protected readonly wordsRemaining = computed(() => MAX_WORDS - this.wordCount());

  protected readonly canPost = computed(
    () =>
      this.draftTitle().trim().length > 0 &&
      this.wordCount() > 0 &&
      this.wordCount() <= MAX_WORDS &&
      !this.submitting(),
  );

  /** CSS class for the word counter — turns red when over limit */
  protected readonly wordCountClass = computed(() => {
    const rem = this.wordsRemaining();
    if (rem < 0) return 'text-red-400 font-semibold';
    if (rem <= 10) return 'text-yellow-400';
    return 'text-content-tertiary';
  });

  constructor() {
    // Re-load whenever creator data becomes available (handles async dashboard load)
    effect(() => {
      const creatorId = this.state.creator()?.id;
      if (creatorId) {
        void this.loadPosts(creatorId);
      }
    });
  }

  protected onTitleInput(event: Event): void {
    this.draftTitle.set((event.target as HTMLInputElement).value);
  }

  protected onDraftInput(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  /** Toggle a post open/closed. Opening one post closes any previously open post. */
  protected togglePost(id: string): void {
    this.expandedPostId.set(this.expandedPostId() === id ? null : id);
  }

  protected async onPublish(): Promise<void> {
    const creatorId = this.state.creator()?.id;
    if (!creatorId || !this.canPost()) return;

    this.submitting.set(true);
    try {
      const { error } = await this.supabase.client
        .from('creator_posts')
        .insert({ creator_id: creatorId, title: this.draftTitle().trim(), content: this.draft().trim() });

      if (error != null) throw error;

      this.draftTitle.set('');
      this.draft.set('');
      this.toast.success('Post published!');
      await this.loadPosts(creatorId);
    } catch {
      this.toast.error('Failed to publish. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected async onDelete(postId: string): Promise<void> {
    const creatorId = this.state.creator()?.id;
    if (!creatorId) return;

    this.deletingId.set(postId);
    try {
      const { error } = await this.supabase.client
        .from('creator_posts')
        .delete()
        .eq('id', postId)
        .eq('creator_id', creatorId);

      if (error != null) throw error;

      this.posts.update((list) => list.filter((p) => p.id !== postId));
    } catch {
      this.toast.error('Failed to delete post.');
    } finally {
      this.deletingId.set(null);
    }
  }

  private async loadPosts(creatorId: string): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('creator_posts')
        .select('*')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false });

      if (error != null) throw error;
      this.posts.set((data ?? []) as CreatorPost[]);
    } catch {
      this.toast.error('Failed to load posts.');
    } finally {
      this.loading.set(false);
    }
  }

  protected relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
