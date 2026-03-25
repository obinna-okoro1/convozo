/**
 * Links View Component
 * Displays the expert's posts feed, service cards, and compact link pills
 * on the public message page home tab.
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessagePageStateService } from '../../message-page-state.service';
import { CreatorLink } from '../../../../../../core/models';
import {
  getBrandByKey,
  BrandInfo,
} from '../../../../../../features/link-in-bio/utils/brand-detection';

@Component({
  selector: 'app-links-view',
  imports: [RouterLink],
  templateUrl: './links-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinksViewComponent {
  protected readonly state = inject(MessagePageStateService);

  protected onLinkClicked(link: CreatorLink): void {
    this.state.onLinkClicked(link);
  }

  /** Returns brand icon metadata for a link, or null for generic links. */
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
}
