/**
 * Creator Page Component
 * Public-facing link-in-bio page for creators at /:slug
 * Shows creator profile header, their links, and CTAs for messaging/booking.
 */

import { ChangeDetectionStrategy, Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CreatorLink } from '../../../../core/models';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { CreatorHeaderComponent } from '../../components/creator-header/creator-header.component';
import { LinkListComponent } from '../../components/link-list/link-list.component';
import { LinkService } from '../../services/link.service';

interface CreatorProfile {
  id: string;
  display_name: string;
  bio: string | null;
  profile_image_url: string | null;
  slug: string;
  instagram_username: string | null;
  theme_color: string | null;
  is_active: boolean;
  creator_settings: {
    message_price: number;
    calls_enabled: boolean;
    call_price: number | null;
    follow_back_enabled: boolean;
    follow_back_price: number | null;
  } | null;
}

@Component({
  selector: 'app-creator-page',
  standalone: true,
  imports: [RouterLink, CreatorHeaderComponent, LinkListComponent],
  templateUrl: './creator-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatorPageComponent implements OnInit {
  protected readonly creator = signal<CreatorProfile | null>(null);
  protected readonly links = signal<CreatorLink[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly themeColor = computed(() => this.creator()?.theme_color || '#7c3aed');
  protected readonly bgGradient = computed(() => {
    const color = this.themeColor();
    return `linear-gradient(to bottom right, #f5f5f7, ${color}08, #f5f5f7)`;
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly supabaseService: SupabaseService,
    private readonly linkService: LinkService,
  ) {}

  public ngOnInit(): void {
    void this.initialize();
  }

  protected onLinkClicked(link: CreatorLink): void {
    // Track the click in the background
    const creator = this.creator();
    if (creator != null) {
      const referrer = document.referrer !== '' ? document.referrer : null;
      void this.linkService.trackClick(link.id, creator.id, referrer);
    }
    // Navigate to the external URL
    window.open(link.url, '_blank', 'noopener,noreferrer');
  }

  private async initialize(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.error.set('Creator not found.');
      this.loading.set(false);
      return;
    }

    try {
      // Fetch creator profile with settings
      const { data: creator, error: creatorErr } = await this.supabaseService.client
        .from('creators')
        .select(
          `
          id, display_name, bio, profile_image_url, slug,
          instagram_username, theme_color, is_active,
          creator_settings (
            message_price, calls_enabled, call_price,
            follow_back_enabled, follow_back_price
          )
        `,
        )
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (creatorErr != null || creator == null) {
        this.error.set('This creator page does not exist.');
        this.loading.set(false);
        return;
      }

      const creatorProfile = creator as unknown as CreatorProfile;
      this.creator.set(creatorProfile);

      // Fetch active links
      const { data: links } = await this.linkService.getActiveLinks(creatorProfile.id);
      this.links.set(links ?? []);
    } catch {
      this.error.set('Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
