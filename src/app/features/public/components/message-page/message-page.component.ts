/**
 * Message page component — public-facing shell that hosts child route views.
 */

import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { MessagePageStateService } from './message-page-state.service';
import { CreatorProfileHeaderComponent } from '../creator-profile-header/creator-profile-header.component';

@Component({
  selector: 'app-message-page',
  imports: [RouterLink, RouterOutlet, CreatorProfileHeaderComponent],
  templateUrl: './message-page.component.html',
  styleUrls: ['./message-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessagePageComponent implements OnInit {
  protected readonly state = inject(MessagePageStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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

    void this.state.initialize(slug);
  }
}
