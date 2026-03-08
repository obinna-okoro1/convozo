/**
 * Link List Component
 * Renders a vertical list of link buttons and handles click tracking.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CreatorLink } from '../../../../core/models';
import { LinkButtonComponent } from '../link-button/link-button.component';

@Component({
  selector: 'app-link-list',
  standalone: true,
  imports: [LinkButtonComponent],
  templateUrl: './link-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkListComponent {
  public readonly links = input.required<CreatorLink[]>();
  public readonly themeColor = input<string | null>(null);

  public readonly linkClicked = output<CreatorLink>();
}
