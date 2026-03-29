/**
 * Link Service
 * Handles CRUD for creator links and click tracking
 */

import { Injectable } from '@angular/core';
import { CreatorLink, SupabaseResponse } from '@core/models';
import { SupabaseService } from '@core/services/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class LinkService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // ── Public reads (no auth needed) ────────────────────────────────

  /**
   * Get active links for a creator (public facing)
   */
  public async getActiveLinks(creatorId: string): Promise<SupabaseResponse<CreatorLink[]>> {
    const { data, error } = await this.supabaseService.client
      .from('creator_links')
      .select('*')
      .eq('creator_id', creatorId)
      .eq('is_active', true)
      .order('position', { ascending: true });

    return { data: data as CreatorLink[] | null, error };
  }

  /**
   * Record a click and return the target URL
   */
  public async trackClick(
    linkId: string,
    creatorId: string,
    referrer: string | null,
  ): Promise<void> {
    // Fire-and-forget insert; we don't block the redirect
    await this.supabaseService.client.from('link_clicks').insert({
      link_id: linkId,
      creator_id: creatorId,
      referrer,
      user_agent: navigator.userAgent,
    });

    // Optimistic bump of the denormalized counter
    try {
      await this.supabaseService.client.rpc('increment_click_count', { row_id: linkId });
    } catch {
      // Non-critical – the counter will be eventually consistent
    }
  }

  // ── Creator-authenticated CRUD ───────────────────────────────────

  /**
   * Get all links for the current creator (including inactive)
   */
  public async getCreatorLinks(creatorId: string): Promise<SupabaseResponse<CreatorLink[]>> {
    const { data, error } = await this.supabaseService.client
      .from('creator_links')
      .select('*')
      .eq('creator_id', creatorId)
      .order('position', { ascending: true });

    return { data: data as CreatorLink[] | null, error };
  }

  /**
   * Create a new link
   */
  public async createLink(
    creatorId: string,
    link: { title: string; url: string; icon: string | null; position: number },
  ): Promise<SupabaseResponse<CreatorLink>> {
    const response = (await this.supabaseService.client
      .from('creator_links')
      .insert({
        creator_id: creatorId,
        title: link.title,
        url: link.url,
        icon: link.icon,
        position: link.position,
      })
      .select()
      .single()) as unknown as SupabaseResponse<CreatorLink>;

    return response;
  }

  /**
   * Update a link
   */
  public async updateLink(
    linkId: string,
    updates: Partial<Pick<CreatorLink, 'title' | 'url' | 'icon' | 'position' | 'is_active'>>,
  ): Promise<SupabaseResponse<CreatorLink>> {
    const response = (await this.supabaseService.client
      .from('creator_links')
      .update(updates)
      .eq('id', linkId)
      .select()
      .single()) as unknown as SupabaseResponse<CreatorLink>;

    return response;
  }

  /**
   * Delete a link
   */
  public async deleteLink(linkId: string): Promise<{ error: Error | null }> {
    const { error } = await this.supabaseService.client
      .from('creator_links')
      .delete()
      .eq('id', linkId);

    return { error };
  }

  /**
   * Batch-update positions (for drag-and-drop reorder)
   */
  public async reorderLinks(
    links: { id: string; position: number }[],
  ): Promise<{ error: Error | null }> {
    // Use a transaction-like approach: update each link's position
    for (const link of links) {
      const { error } = await this.supabaseService.client
        .from('creator_links')
        .update({ position: link.position })
        .eq('id', link.id);

      if (error) {
        return { error };
      }
    }
    return { error: null };
  }

  /**
   * Get click analytics for a creator's links
   */
  public async getClickStats(
    creatorId: string,
    days = 30,
  ): Promise<SupabaseResponse<{ link_id: string; count: number }[]>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await this.supabaseService.client
      .from('link_clicks')
      .select('link_id')
      .eq('creator_id', creatorId)
      .gte('created_at', since.toISOString());

    if (error != null) {
      return { data: null, error };
    }

    // Aggregate counts client-side (avoids needing a custom RPC)
    const counts = new Map<string, number>();
    for (const row of data) {
      const linkId = (row as { link_id: string }).link_id;
      counts.set(linkId, (counts.get(linkId) ?? 0) + 1);
    }

    const result = Array.from(counts.entries()).map(([link_id, count]) => ({ link_id, count }));
    return { data: result, error: null };
  }
}
