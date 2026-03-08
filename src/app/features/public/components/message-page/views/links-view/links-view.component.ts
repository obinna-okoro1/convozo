/**
 * Links View Component
 * Displays the creator's link-in-bio list on the public message page.
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MessagePageStateService } from '../../message-page-state.service';
import { LinkListComponent } from '../../../../../link-in-bio/components/link-list/link-list.component';
import { CreatorLink } from '../../../../../../core/models';

@Component({
  selector: 'app-links-view',
  imports: [LinkListComponent],
  templateUrl: './links-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinksViewComponent {
  protected readonly state = inject(MessagePageStateService);

  protected onLinkClicked(link: CreatorLink): void {
    this.state.onLinkClicked(link);
  }
}
