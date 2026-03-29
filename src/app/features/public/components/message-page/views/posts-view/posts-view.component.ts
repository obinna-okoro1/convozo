/**
 * Posts View — Public library of all posts from a creator.
 * Accessed via /:slug/posts. Shows full chronological feed.
 */

import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CreatorPost } from '@core/models';
import { SupabaseService } from '@core/services/supabase.service';
import { ToastService } from '@shared/services/toast.service';
import { MessagePageStateService } from '../../message-page-state.service';
import { ProfileOwnerService } from '../../services/profile-owner.service';

@Component({
  selector: 'app-posts-view',
  imports: [],
  templateUrl: './posts-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostsViewComponent implements OnInit {
  protected readonly state = inject(MessagePageStateService);
  protected readonly ownerState = inject(ProfileOwnerService);
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);

  protected readonly posts = signal<CreatorPost[]>([]);
  protected readonly loading = signal(true);
  /** Tracks which post is expanded — only one can be open at a time (accordion). */
  protected readonly expandedPostId = signal<string | null>(null);

  // ── Owner edit/delete state ─────────────────────────────────────────────────
  /** ID of post whose ⋮ menu is currently open */
  protected readonly activePostMenuId = signal<string | null>(null);
  /** ID of the post being edited inline */
  protected readonly editingPostId = signal<string | null>(null);
  /** Inline editor fields */
  protected readonly editTitle = signal('');
  protected readonly editContent = signal('');
  /** ID of post currently being saved */
  protected readonly savingPostId = signal<string | null>(null);
  /** ID of post waiting for delete confirmation in the dropdown */
  protected readonly deletePendingPostId = signal<string | null>(null);
  /** ID of post currently being deleted */
  protected readonly deletingPostId = signal<string | null>(null);

  public ngOnInit(): void {
    const creatorId = this.state.creator()?.id;
    if (creatorId) {
      void this.loadAllPosts(creatorId);
    } else {
      this.loading.set(false);
    }
  }

  private async loadAllPosts(creatorId: string): Promise<void> {
    try {
      const { data, error } = await this.supabase.client
        .from('creator_posts')
        .select('id, title, content, created_at, updated_at')
        .eq('creator_id', creatorId)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error == null && data != null) {
        this.posts.set(data as CreatorPost[]);
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      this.loading.set(false);
    }
  }

  /** Toggle a post open/closed. Opening one post closes any previously open post. */
  protected togglePost(id: string): void {
    this.expandedPostId.set(this.expandedPostId() === id ? null : id);
  }

  // ── Owner: ⋮ menu ────────────────────────────────────────────────────────────

  protected togglePostMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.activePostMenuId.set(this.activePostMenuId() === id ? null : id);
    if (this.deletePendingPostId() !== id) {
      this.deletePendingPostId.set(null);
    }
  }

  protected closePostMenu(): void {
    this.activePostMenuId.set(null);
    this.deletePendingPostId.set(null);
  }

  // ── Owner: edit ─────────────────────────────────────────────────────────────

  protected startEditPost(post: CreatorPost): void {
    this.activePostMenuId.set(null);
    this.deletePendingPostId.set(null);
    this.editTitle.set(post.title ?? '');
    this.editContent.set(post.content);
    this.editingPostId.set(post.id);
  }

  protected cancelEditPost(): void {
    this.editingPostId.set(null);
    this.editTitle.set('');
    this.editContent.set('');
  }

  protected async saveEditPost(post: CreatorPost): Promise<void> {
    if (this.savingPostId()) return;

    const content = this.editContent().trim();
    if (!content) {
      this.toast.error('Post content cannot be empty');
      return;
    }

    const title = this.editTitle().trim() || null;
    this.savingPostId.set(post.id);
    try {
      const { error } = await this.supabase.client
        .from('creator_posts')
        .update({ title, content })
        .eq('id', post.id)
        .eq('creator_id', this.ownerState.creatorId()!);

      if (error != null) throw error;

      // Update local list
      this.posts.update((list) =>
        list.map((p) => (p.id === post.id ? { ...p, title, content } : p)),
      );
      this.toast.success('Post updated');
      this.editingPostId.set(null);
    } catch {
      this.toast.error('Failed to update post');
    } finally {
      this.savingPostId.set(null);
    }
  }

  // ── Owner: delete ───────────────────────────────────────────────────────────

  protected requestDeletePost(postId: string): void {
    this.deletePendingPostId.set(postId);
  }

  protected cancelDeletePost(): void {
    this.deletePendingPostId.set(null);
  }

  protected async executeDeletePost(postId: string): Promise<void> {
    if (this.deletingPostId()) return;

    this.deletePendingPostId.set(null);
    this.activePostMenuId.set(null);
    this.deletingPostId.set(postId);
    try {
      const { error } = await this.supabase.client
        .from('creator_posts')
        .delete()
        .eq('id', postId)
        .eq('creator_id', this.ownerState.creatorId()!);

      if (error != null) throw error;

      this.posts.update((list) => list.filter((p) => p.id !== postId));
      this.toast.success('Post deleted');
    } catch {
      this.toast.error('Failed to delete post');
    } finally {
      this.deletingPostId.set(null);
    }
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
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
