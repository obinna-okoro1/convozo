/**
 * Creator Header Component
 * Displays avatar, display name, bio, and Instagram handle on the public link-in-bio page.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-creator-header',
  standalone: true,
  templateUrl: './creator-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatorHeaderComponent {
  public readonly displayName = input.required<string>();
  public readonly bio = input<string | null>(null);
  public readonly imageUrl = input<string | null>(null);
  public readonly instagramUsername = input<string | null>(null);
  public readonly themeColor = input<string>('#7c3aed');
}
