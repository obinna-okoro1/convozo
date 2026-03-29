import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessagePageStateService } from '../../message-page-state.service';

export interface SupportFormData {
  senderName: string;
  senderEmail: string;
  messageContent: string;
  amountCents: number;
}

@Component({
  selector: 'app-support-view',
  imports: [FormsModule],
  templateUrl: './support-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportViewComponent {
  protected readonly state = inject(MessagePageStateService);

  protected senderName = '';
  protected senderEmail = '';
  protected messageContent = '';
  protected amountDollars = 5;

  protected readonly presetAmounts = [3, 5, 10, 25, 50];

  protected selectAmount(amount: number): void {
    this.amountDollars = amount;
  }

  protected onSubmit(): void {
    const amountCents = Math.round(this.amountDollars * 100);
    if (amountCents < 100) {
      return;
    }

    void this.state.onSupportSubmit({
      senderName: this.senderName,
      senderEmail: this.senderEmail,
      messageContent: this.messageContent,
      amountCents,
    });
  }
}
