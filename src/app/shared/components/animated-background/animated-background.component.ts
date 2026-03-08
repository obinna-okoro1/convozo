/**
 * Animated Background Component
 * Shared glassmorphism background with floating gradient blobs.
 * Drop-in replacement for the duplicated background pattern across pages.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-animated-background',
  standalone: true,
  templateUrl: './animated-background.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnimatedBackgroundComponent {}
