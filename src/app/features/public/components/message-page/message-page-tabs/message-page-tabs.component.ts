/**
 * Message Page Tabs Component
 * Renders the tab navigation bar for the public message page.
 * Conditionally shows call and support tabs based on creator settings.
 */

import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MessagePageStateService } from '../message-page-state.service';

interface Tab {
  readonly path: string;
  readonly label: string;
  readonly iconPath: string;
  /** When true, the tab is only active on an exact route match (used for the root links tab). */
  readonly exact?: boolean;
}

@Component({
  selector: 'app-message-page-tabs',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './message-page-tabs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessagePageTabsComponent {
  private readonly state = inject(MessagePageStateService);

  readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');
  readonly canScrollLeft = signal(false);
  readonly canScrollRight = signal(false);

  constructor() {
    afterNextRender(() => this.updateScrollIndicators());
  }

  onScroll(): void {
    this.updateScrollIndicators();
  }

  private updateScrollIndicators(): void {
    const el = this.scrollContainer()?.nativeElement;
    if (!el) return;
    this.canScrollLeft.set(el.scrollLeft > 0);
    this.canScrollRight.set(
      el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    );
  }

  readonly visibleTabs = computed<Tab[]>(() => {
    const tabs: Tab[] = [];

    if (this.state.messagesEnabled()) {
      tabs.push({
        path: 'message',
        label: 'Consult',
        iconPath:
          'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      });
    }

    if (this.state.callsEnabled()) {
      tabs.push({
        path: 'call',
        label: 'Session',
        iconPath:
          'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
      });
    }

    if (this.state.tipsEnabled()) {
      tabs.push({
        path: 'support',
        label: 'Support',
        iconPath:
          'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      });
    }

    if (this.state.shopEnabled()) {
      tabs.push({
        path: 'shop',
        label: 'Products',
        iconPath: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
      });
    }

    // Links is the root profile page — always visible, exact match only
    tabs.push({
      path: '.',
      label: 'Links',
      exact: true,
      iconPath:
        'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
    });

    return tabs;
  });
}
