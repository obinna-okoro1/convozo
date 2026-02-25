/**
 * Trust Banner Component
 * Displays payment security and delivery trust indicators.
 * Reused across message and call booking forms.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-trust-banner',
  standalone: true,
  templateUrl: './trust-banner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrustBannerComponent {}
