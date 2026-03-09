/**
 * Trust Indicators Component
 * Displays encryption, Flutterwave, and privacy indicators at the bottom of forms.
 * Reused across message and call booking forms.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-trust-indicators',
  standalone: true,
  templateUrl: './trust-indicators.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrustIndicatorsComponent {}
