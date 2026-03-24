/**
 * Message Form Component
 * Handles the paid message submission form on the public message page.
 * Contains pricing card, sender fields, message textarea, and submit button.
 */

import { ChangeDetectionStrategy, Component, input, output, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { APP_CONSTANTS } from '../../../../core/constants';
import { TrustIndicatorsComponent } from '../../../../shared/components/trust-indicators/trust-indicators.component';

export interface MessageFormData {
  senderName: string;
  senderEmail: string;
  messageContent: string;
}

@Component({
  selector: 'app-message-form',
  standalone: true,
  imports: [FormsModule, TrustIndicatorsComponent],
  templateUrl: './message-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageFormComponent {
  public readonly priceCents = input.required<number>();
  public readonly creatorName = input.required<string>();
  public readonly responseExpectation = input<string>('24-48 hours');
  public readonly submitting = input<boolean>(false);
  public readonly productType = input<'message' | 'follow_back'>('message');

  public readonly formSubmit = output<MessageFormData>();

  protected senderName = '';
  protected senderEmail = '';
  protected messageContent = '';

  protected readonly priceInDollars = computed(
    () => (this.priceCents() ?? 0) / APP_CONSTANTS.PRICE_MULTIPLIER,
  );

  protected readonly charCount = computed(() => this.messageContent.length);

  protected readonly isFollowBack = computed(() => this.productType() === 'follow_back');

  protected readonly productLabel = computed(() =>
    this.isFollowBack() ? 'Connection Request' : 'Private Consultation',
  );

  protected readonly serviceDescription = computed(() =>
    this.isFollowBack()
      ? `Request a direct connection with ${this.creatorName()}`
      : 'Get personalized advice delivered privately to you',
  );

  protected readonly priceUnit = computed(() =>
    this.isFollowBack() ? '' : 'per consultation',
  );

  protected readonly messageLabel = computed(() =>
    this.isFollowBack() ? 'Your Note' : 'Your Inquiry',
  );

  protected readonly messagePlaceholder = computed(() =>
    this.isFollowBack()
      ? "Tell them why you'd like to connect..."
      : 'Describe what you need help with or would like to discuss...',
  );

  protected readonly inboxNote = computed(() =>
    this.isFollowBack()
      ? `Delivered privately to ${this.creatorName()}`
      : `Delivered privately to ${this.creatorName()}`,
  );

  protected readonly submitLabel = computed(() =>
    this.isFollowBack()
      ? `Request Connection — $${String(this.priceInDollars())}`
      : `Send Inquiry — $${String(this.priceInDollars())}`,
  );

  protected onSubmit(): void {
    this.formSubmit.emit({
      senderName: this.senderName,
      senderEmail: this.senderEmail,
      messageContent: this.messageContent,
    });
  }
}
