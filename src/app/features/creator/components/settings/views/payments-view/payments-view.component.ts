import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SettingsStateService } from '../../settings-state.service';

@Component({
  selector: 'app-payments-view',
  templateUrl: './payments-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly refreshing = signal(false);

  constructor(protected readonly state: SettingsStateService) {}

  ngOnInit(): void {
    // Always refresh when there's an account but it isn't fully onboarded yet,
    // or when returning from Stripe onboarding via query params.
    const params = this.route.snapshot.queryParamMap;
    const returningFromStripe =
      params.get('connected') === 'true' || params.get('refresh') === 'true';
    const account = this.state.paymentAccount();
    const needsRefresh = returningFromStripe || (account != null && !account.onboarding_completed);
    if (needsRefresh) {
      void this.state.refreshStripeStatus();
    }
  }

  protected async connectStripe(): Promise<void> {
    await this.state.connectPayment();
  }

  protected async refreshStatus(): Promise<void> {
    this.refreshing.set(true);
    await this.state.refreshStripeStatus();
    this.refreshing.set(false);
  }
}
