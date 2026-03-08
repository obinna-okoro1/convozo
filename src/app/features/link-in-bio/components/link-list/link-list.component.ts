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
  template: `
    <div class="flex flex-col gap-3 w-full">
      @for (link of links(); track link.id) {
        <app-link-button
          [link]="link"
          [themeColor]="themeColor()"
          (clicked)="linkClicked.emit($event)"
        />
      } @empty {
        <div class="text-center py-8">
          <p class="text-slate-500 text-sm">No links yet</p>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkListComponent {
  readonly links = input.required<CreatorLink[]>();
  readonly themeColor = input<string | null>(null);

  readonly linkClicked = output<CreatorLink>();
}
