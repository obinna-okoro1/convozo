/**
 * Posts View — Public library of all posts from a creator.
 * Accessed via /:slug/posts. Shows full chronological feed.
 */

import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CreatorPost } from '../../../../../../core/models';
import { SupabaseService } from '../../../../../../core/services/supabase.service';
import { MessagePageStateService } from '../../message-page-state.service';

@Component({
  selector: 'app-posts-view',
  imports: [RouterLink],
  templateUrl: './posts-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostsViewComponent implements OnInit {
  protected readonly state = inject(MessagePageStateService);
  private readonly supabase = inject(SupabaseService);

  protected readonly posts = signal<CreatorPost[]>([]);
  protected readonly loading = signal(true);
  /** Tracks which post is expanded — only one can be open at a time (accordion). */
  protected readonly expandedPostId = signal<string | null>(null);

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
