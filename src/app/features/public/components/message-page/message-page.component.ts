/**
 * Message page component — public-facing shell that hosts child route views.
 */

import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { MessagePageStateService } from './message-page-state.service';
import { CreatorProfileHeaderComponent } from '../creator-profile-header/creator-profile-header.component';
import { OwnerToolbarComponent } from './owner-toolbar/owner-toolbar.component';
import { ProfileOwnerService } from './services/profile-owner.service';
import { CallViewComponent } from './views/call-view/call-view.component';
import { MessageViewComponent } from './views/message-view/message-view.component';
import { PostsViewComponent } from './views/posts-view/posts-view.component';
import { ShopViewComponent } from './views/shop-view/shop-view.component';
import { SupportViewComponent } from './views/support-view/support-view.component';

/** Public panel routes that open as a bottom-sheet drawer. */
const PUBLIC_PANELS = ['message', 'call', 'shop', 'support', 'posts'] as const;
type PublicPanel = (typeof PUBLIC_PANELS)[number];

@Component({
  selector: 'app-message-page',
  imports: [
    RouterLink,
    RouterOutlet,
    CreatorProfileHeaderComponent,
    OwnerToolbarComponent,
    CallViewComponent,
    MessageViewComponent,
    PostsViewComponent,
    ShopViewComponent,
    SupportViewComponent,
  ],
  templateUrl: './message-page.component.html',
  styleUrls: ['./message-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessagePageComponent implements OnInit {
  protected readonly state = inject(MessagePageStateService);
  protected readonly ownerState = inject(ProfileOwnerService);

  // ── Public panel drawer ────────────────────────────────────────────────────

  /** The active public panel slug ('message', 'call', etc.) or null when on the home tab. */
  protected readonly activePanelRoute = computed((): PublicPanel | null => {
    const url = this.currentUrl();
    const segments = url.split('?')[0].split('#')[0].split('/').filter(Boolean);
    const seg = segments[segments.length - 1] ?? '';
    // Don't treat a /settings/<tab> sub-route as a public panel — those are
    // owner settings tabs handled by OwnerToolbarComponent, not public drawers.
    const parent = segments[segments.length - 2] ?? '';
    if (parent === 'settings') {
      return null;
    }
    return PUBLIC_PANELS.includes(seg as PublicPanel) ? (seg as PublicPanel) : null;
  });

  /** Human-readable title for the active panel drawer header. */
  protected readonly panelTitle = computed((): string => {
    const titles: Record<PublicPanel, string> = {
      message: 'Send a Consultation',
      call: 'Book a Session',
      shop: 'Products',
      support: 'Support',
      posts: 'All Posts',
    };
    const panel = this.activePanelRoute();
    return panel ? titles[panel] : '';
  });

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  public ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.state.error.set('Invalid URL');
      this.state.loading.set(false);
      return;
    }

    // Handle legacy ?tab= query parameter by redirecting to child route
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab) {
      const routeMap: Record<string, string> = {
        message: 'message',
        call: 'call',
      };
      const childRoute = routeMap[tab];
      if (childRoute) {
        void this.router.navigate([childRoute], {
          relativeTo: this.route,
          replaceUrl: true,
          queryParams: {},
        });
      }
    }

    void this.state.initialize(slug).then(() => {
      const creator = this.state.creator();
      if (creator) {
        void this.ownerState.initialize(creator);
      }
    });
  }

  /** Close the panel drawer by navigating back to the profile home tab. */
  protected closePanelRoute(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    void this.router.navigate(['/', slug]);
  }
}
