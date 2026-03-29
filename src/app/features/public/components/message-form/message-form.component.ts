/**
 * Message Form Component
 * Handles the paid message submission form on the public message page.
 * Contains pricing card, sender fields, message textarea, and submit button.
 */

import { ChangeDetectionStrategy, Component, input, output, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { APP_CONSTANTS } from '@core/constants';

export interface MessageFormData {
  senderName: string;
  senderEmail: string;
  messageContent: string;
}

@Component({
  selector: 'app-message-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './message-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageFormComponent {
  public readonly priceCents = input.required<number>();
  public readonly creatorName = input.required<string>();
  public readonly responseExpectation = input<string>('24-48 hours');
  public readonly submitting = input<boolean>(false);

  public readonly formSubmit = output<MessageFormData>();

  protected senderName = '';
  protected senderEmail = '';
  protected messageContent = '';

  protected readonly priceInDollars = computed(
    () => (this.priceCents() ?? 0) / APP_CONSTANTS.PRICE_MULTIPLIER,
  );

  protected readonly charCount = computed(() => this.messageContent.length);

  protected readonly serviceDescription = computed(
    () => `Get personalized advice delivered privately to you`,
  );

  protected readonly submitLabel = computed(
    () => `Send Inquiry — $${String(this.priceInDollars())}`,
  );

  protected onSubmit(): void {
    this.formSubmit.emit({
      senderName: this.senderName,
      senderEmail: this.senderEmail,
      messageContent: this.messageContent,
    });
  }
}
