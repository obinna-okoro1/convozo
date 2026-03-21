/**
 * Creator Header Component
 * Displays avatar, display name, bio on the public link-in-bio page.
 */

import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

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
  public readonly themeColor = input<string>('#7c3aed');

  public readonly imageLoadError = signal(false);
}
