import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../../../../core/services/supabase.service';
import { SettingsStateService } from '../../settings-state.service';
import {
  SearchableSelectComponent,
  SelectOption,
} from '../../../../../../shared/components/ui/searchable-select/searchable-select.component';

interface FlutterwaveBank {
  id: string;
  code: string;
  name: string;
}

@Component({
  selector: 'app-payments-view',
  imports: [FormsModule, SearchableSelectComponent],
  templateUrl: './payments-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsViewComponent {
  private readonly supabase = inject(SupabaseService);

  protected readonly showUpdateForm = signal(false);
  protected readonly bankCode = signal('');
  protected readonly accountNumber = signal('');
  protected readonly country = signal('NG');

  protected readonly banks = signal<FlutterwaveBank[]>([]);
  protected readonly banksLoading = signal(false);
  protected readonly banksError = signal<string | null>(null);

  protected readonly countryOptions: SelectOption[] = [
    { value: 'NG', label: '🇳🇬 Nigeria' },
    { value: 'GH', label: '🇬🇭 Ghana' },
    { value: 'KE', label: '🇰🇪 Kenya' },
    { value: 'ZA', label: '🇿🇦 South Africa' },
    { value: 'TZ', label: '🇹🇿 Tanzania' },
    { value: 'UG', label: '🇺🇬 Uganda' },
  ];

  protected readonly bankSelectOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Select your bank' },
    ...this.banks().map((b) => ({ value: b.code, label: b.name })),
  ]);

  // Account verification state
  protected readonly verifying = signal(false);
  protected readonly verifiedName = signal<string | null>(null);
  protected readonly verifyError = signal<string | null>(null);

  // Auto-clear verification when bank or account changes
  protected readonly canVerify = computed(() =>
    this.bankCode().length > 0 && this.accountNumber().length >= 10 && !this.banksLoading(),
  );
  protected readonly isVerified = computed(() => this.verifiedName() !== null);

  constructor(protected readonly state: SettingsStateService) {
    // Load banks when country changes
    effect(() => {
      void this.loadBanks(this.country());
    });

    // Clear verification when bank or account number changes
    effect(() => {
      // Read both signals to track them
      this.bankCode();
      this.accountNumber();
      this.verifiedName.set(null);
      this.verifyError.set(null);
    });
  }

  protected async loadBanks(country: string): Promise<void> {
    this.banksLoading.set(true);
    this.banksError.set(null);
    this.bankCode.set('');
    try {
      const { data, error } = await this.supabase.getBanks(country);
      if (error) throw error;
      const response = data as unknown as { status: string; data: FlutterwaveBank[] } | null;
      this.banks.set(response?.data ?? []);
    } catch {
      this.banksError.set('Could not load bank list. Please try again.');
      this.banks.set([]);
    } finally {
      this.banksLoading.set(false);
    }
  }

  protected async verifyAccount(): Promise<void> {
    if (!this.canVerify()) return;
    this.verifying.set(true);
    this.verifyError.set(null);
    this.verifiedName.set(null);

    try {
      const { data, error } = await this.supabase.resolveAccount(
        this.accountNumber(),
        this.bankCode(),
      );
      if (error) throw error;
      const response = data as unknown as { account_name?: string; error?: string } | null;
      if (response?.account_name) {
        this.verifiedName.set(response.account_name);
      } else {
        this.verifyError.set(response?.error || 'Could not verify this account. Please check your details.');
      }
    } catch {
      this.verifyError.set('Verification failed. Please check your bank and account number.');
    } finally {
      this.verifying.set(false);
    }
  }

  protected toggleUpdateForm(): void {
    this.showUpdateForm.update(v => !v);
    if (!this.showUpdateForm()) {
      this.bankCode.set('');
      this.accountNumber.set('');
      this.country.set('NG');
      this.verifiedName.set(null);
      this.verifyError.set(null);
    }
  }

  protected async submitUpdate(): Promise<void> {
    if (!this.isVerified()) return;
    await this.state.connectPayment(this.bankCode(), this.accountNumber(), this.country());
    if (!this.state.error()) {
      this.showUpdateForm.set(false);
      this.bankCode.set('');
      this.accountNumber.set('');
      this.country.set('NG');
      this.verifiedName.set(null);
      this.verifyError.set(null);
    }
  }
}
