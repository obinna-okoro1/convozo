/**
 * Creator Page Component
 * Public-facing link-in-bio page for creators at /:slug
 * Shows creator profile header, their links, and CTAs for messaging/booking.
 */

import { ChangeDetectionStrategy, Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CreatorLink } from '../../../../core/models';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { LinkService } from '../../services/link.service';
import { CreatorHeaderComponent } from '../../components/creator-header/creator-header.component';
import { LinkListComponent } from '../../components/link-list/link-list.component';

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
  template: `
    <div class="min-h-screen relative overflow-hidden" [style.background]="bgGradient()">
      <!-- Animated background blobs -->
      <div class="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          class="absolute top-0 left-1/4 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"
          [style.background]="themeColor()"
        ></div>
        <div
          class="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"
          [style.background]="themeColor()"
          style="animation-delay: 2s;"
        ></div>
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center min-h-screen relative z-10">
          <div class="text-center">
            <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl animate-pulse"
              [style.background]="'linear-gradient(135deg, ' + themeColor() + ', ' + themeColor() + 'aa)'"
            >
              <svg class="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p class="text-slate-400 text-sm">Loading...</p>
          </div>
        </div>
      } @else if (error()) {
        <div class="flex items-center justify-center min-h-screen relative z-10 px-4">
          <div class="text-center max-w-md">
            <div class="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 class="text-xl font-bold text-white mb-2">Page Not Found</h2>
            <p class="text-slate-400 text-sm mb-6">{{ error() }}</p>
            <a routerLink="/home" class="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors">
              Go Home
            </a>
          </div>
        </div>
      } @else if (creator()) {
        <div class="relative z-10 max-w-lg mx-auto px-4 py-12 sm:py-16">
          <!-- Creator Header -->
          <app-creator-header
            [displayName]="creator()!.display_name"
            [bio]="creator()!.bio"
            [imageUrl]="creator()!.profile_image_url"
            [instagramUsername]="creator()!.instagram_username"
            [themeColor]="themeColor()"
          />

          <!-- Links -->
          @if (links().length > 0) {
            <app-link-list
              [links]="links()"
              [themeColor]="themeColor()"
              (linkClicked)="onLinkClicked($event)"
            />
          }

          <!-- Service CTAs (message / call / follow-back) -->
          @if (creator()!.creator_settings; as settings) {
            <div class="mt-6 flex flex-col gap-3">
              @if (settings.message_price > 0) {
                <a
                  [routerLink]="['/', creator()!.slug, 'message']"
                  class="group flex items-center gap-3 w-full px-6 py-4 rounded-2xl border backdrop-blur-xl transition-all duration-300 active:scale-[0.98] sm:hover:scale-[1.02]"
                  [style.background]="themeColor() + '15'"
                  [style.border-color]="themeColor() + '40'"
                >
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                    [style.background]="themeColor() + '30'"
                  >
                    <svg class="w-5 h-5" [style.color]="themeColor()" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span class="flex-1 text-white font-semibold text-base">Send a Paid Message</span>
                  <span class="text-xs font-medium px-3 py-1 rounded-full" [style.background]="themeColor() + '20'" [style.color]="themeColor()">
                    {{ '$' + (settings.message_price / 100).toFixed(2) }}
                  </span>
                </a>
              }
              @if (settings.calls_enabled && settings.call_price) {
                <a
                  [routerLink]="['/', creator()!.slug, 'message']"
                  [queryParams]="{tab: 'call'}"
                  class="group flex items-center gap-3 w-full px-6 py-4 rounded-2xl border backdrop-blur-xl transition-all duration-300 active:scale-[0.98] sm:hover:scale-[1.02]"
                  [style.background]="themeColor() + '15'"
                  [style.border-color]="themeColor() + '40'"
                >
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                    [style.background]="themeColor() + '30'"
                  >
                    <svg class="w-5 h-5" [style.color]="themeColor()" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <span class="flex-1 text-white font-semibold text-base">Book a Call</span>
                  <span class="text-xs font-medium px-3 py-1 rounded-full" [style.background]="themeColor() + '20'" [style.color]="themeColor()">
                    {{ '$' + (settings.call_price / 100).toFixed(2) }}
                  </span>
                </a>
              }
              @if (settings.follow_back_enabled && settings.follow_back_price) {
                <a
                  [routerLink]="['/', creator()!.slug, 'message']"
                  [queryParams]="{tab: 'follow_back'}"
                  class="group flex items-center gap-3 w-full px-6 py-4 rounded-2xl border backdrop-blur-xl transition-all duration-300 active:scale-[0.98] sm:hover:scale-[1.02]"
                  [style.background]="themeColor() + '15'"
                  [style.border-color]="themeColor() + '40'"
                >
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                    [style.background]="themeColor() + '30'"
                  >
                    <svg class="w-5 h-5" [style.color]="themeColor()" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <span class="flex-1 text-white font-semibold text-base">Request Follow Back</span>
                  <span class="text-xs font-medium px-3 py-1 rounded-full" [style.background]="themeColor() + '20'" [style.color]="themeColor()">
                    {{ '$' + (settings.follow_back_price / 100).toFixed(2) }}
                  </span>
                </a>
              }
            </div>
          }

          <!-- Powered by footer -->
          <div class="mt-12 text-center">
            <a
              routerLink="/home"
              class="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <span>Powered by</span>
              <span class="font-semibold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Convozo</span>
            </a>
          </div>
        </div>
      }
    </div>
  `,
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
    return `linear-gradient(to bottom right, #0f172a, ${color}15, #0f172a)`;
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly supabaseService: SupabaseService,
    private readonly linkService: LinkService,
  ) {}

  ngOnInit(): void {
    void this.initialize();
  }

  protected async onLinkClicked(link: CreatorLink): Promise<void> {
    // Track the click in the background
    const creator = this.creator();
    if (creator) {
      void this.linkService.trackClick(link.id, creator.id, document.referrer || null);
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
        .select(`
          id, display_name, bio, profile_image_url, slug,
          instagram_username, theme_color, is_active,
          creator_settings (
            message_price, calls_enabled, call_price,
            follow_back_enabled, follow_back_price
          )
        `)
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (creatorErr || !creator) {
        this.error.set('This creator page does not exist.');
        this.loading.set(false);
        return;
      }

      this.creator.set(creator as unknown as CreatorProfile);

      // Fetch active links
      const { data: links } = await this.linkService.getActiveLinks(creator.id);
      this.links.set(links ?? []);
    } catch {
      this.error.set('Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
