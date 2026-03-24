/**
 * Creator Profile Header Component
 * Displays the creator's avatar, name, bio, and status.
 * Used on the public message page.
 */

import { ChangeDetectionStrategy, Component, input, computed, signal } from '@angular/core';
import { CreatorProfile } from '../../../../core/models';

@Component({
  selector: 'app-creator-profile-header',
  standalone: true,
  templateUrl: './creator-profile-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatorProfileHeaderComponent {
  public readonly creator = input.required<CreatorProfile>();
  public readonly responseExpectation = input<string>('24-48 hours');
  /** Whether this expert has completed identity verification. Defaults to false. */
  public readonly verified = input<boolean>(false);

  protected readonly imageLoadError = signal(false);
  protected readonly bannerLoadError = signal(false);

  protected readonly initial = computed(() => {
    const name = this.creator()?.display_name;
    return name ? name.charAt(0) : 'C';
  });
}
