import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SettingsStateService } from '../../settings-state.service';

@Component({
  selector: 'app-payments-view',
  templateUrl: './payments-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  constructor(protected readonly state: SettingsStateService) {}

  ngOnInit(): void {
    // Check if returning from Stripe onboarding
    const params = this.route.snapshot.queryParamMap;
    if (params.get('connected') === 'true' || params.get('refresh') === 'true') {
      void this.state.refreshStripeStatus();
    }
  }

  protected async connectStripe(): Promise<void> {
    await this.state.connectPayment();
  }
}
