import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SettingsStateService } from '../../settings-state.service';
import { FEATURE_FLAGS } from '../../../../../../core/constants';

@Component({
  selector: 'app-payments-view',
  templateUrl: './payments-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly refreshing = signal(false);
  protected readonly stripeConnectEnabled = FEATURE_FLAGS.STRIPE_CONNECT_ENABLED;

  // ── Paystack bank setup form ──────────────────────────────────────
  protected readonly bankCode = signal('');
  protected readonly accountNumber = signal('');
  protected readonly businessName = signal('');
  protected readonly resolvedAccountName = signal<string | null>(null);
  protected readonly resolving = signal(false);
  protected readonly resolveError = signal<string | null>(null);
  protected readonly showBankForm = signal(false);

  constructor(protected readonly state: SettingsStateService) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const returningFromStripe =
      params.get('connected') === 'true' || params.get('refresh') === 'true';
    const account = this.state.paymentAccount();
    const needsStripeRefresh = returningFromStripe || (account != null && !account.onboarding_completed);
    if (needsStripeRefresh) {
      void this.state.refreshStripeStatus();
    }

    // For Paystack creators: auto-refresh live status from Paystack on every page
    // load so the UI always reflects current verification state without requiring
    // the creator to manually click "Refresh Status".
    if (this.state.isPaystackCreator() && this.state.paystackSubaccount()) {
      void this.state.refreshPaystackStatus();
    }

    // Pre-fill the business name with the creator's display name
    const creator = this.state.creator();
    if (creator) {
      this.businessName.set(creator.display_name);
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

  /** Re-fetch is_verified / is_active from Paystack and update the UI badge. */
  protected async refreshPaystackStatus(): Promise<void> {
    this.refreshing.set(true);
    await this.state.refreshPaystackStatus();
    this.refreshing.set(false);
  }

  // ── Paystack methods ──────────────────────────────────────────────

  protected openBankForm(): void {
    this.showBankForm.set(true);
    this.resolvedAccountName.set(null);
    this.resolveError.set(null);
    void this.state.loadPaystackBanks();
  }

  protected onBankCodeChange(code: string): void {
    this.bankCode.set(code);
    this.resolvedAccountName.set(null);
    this.resolveError.set(null);
  }

  protected onAccountNumberChange(num: string): void {
    this.accountNumber.set(num.replace(/\D/g, ''));
    this.resolvedAccountName.set(null);
    this.resolveError.set(null);
  }

  /** Resolve the account name so the creator can confirm before submitting. */
  protected async resolveAccount(): Promise<void> {
    const num = this.accountNumber();
    const code = this.bankCode();
    if (!num || !code) return;

    this.resolving.set(true);
    this.resolveError.set(null);
    this.resolvedAccountName.set(null);

    const { accountName, error } = await this.state.resolvePaystackAccount(num, code);
    this.resolvedAccountName.set(accountName);
    this.resolveError.set(error);
    this.resolving.set(false);
  }

  protected get canSubmitBank(): boolean {
    return !!(
      this.bankCode() &&
      this.accountNumber().length >= 6 &&
      this.businessName() &&
      this.resolvedAccountName()
    );
  }

  protected async submitBankAccount(): Promise<void> {
    if (!this.canSubmitBank) return;

    await this.state.connectPaystack({
      bankCode: this.bankCode(),
      accountNumber: this.accountNumber(),
      businessName: this.businessName(),
    });

    if (!this.state.error()) {
      this.showBankForm.set(false);
    }
  }
}

