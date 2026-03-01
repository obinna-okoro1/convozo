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
  senderInstagram: string;
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
  protected senderInstagram = '';
  protected messageContent = '';

  protected readonly priceInDollars = computed(
    () => (this.priceCents() ?? 0) / APP_CONSTANTS.PRICE_MULTIPLIER,
  );

  protected readonly charCount = computed(() => this.messageContent.length);

  protected readonly isFollowBack = computed(() => this.productType() === 'follow_back');

  protected readonly productLabel = computed(() =>
    this.isFollowBack() ? 'Follow-Back Request' : 'Priority Message',
  );

  protected readonly priceUnit = computed(() =>
    this.isFollowBack() ? 'per request' : 'per message',
  );

  protected readonly messageLabel = computed(() =>
    this.isFollowBack() ? 'Your Note' : 'Your Message',
  );

  protected readonly messagePlaceholder = computed(() =>
    this.isFollowBack()
      ? 'Tell them why you\'d love a follow-back...'
      : 'Share your thoughts, questions, or feedback...',
  );

  protected readonly inboxNote = computed(() =>
    this.isFollowBack()
      ? `Sent directly to ${this.creatorName()}`
      : `Sent directly to ${this.creatorName()}'s inbox`,
  );

  protected readonly submitLabel = computed(() =>
    this.isFollowBack()
      ? `Pay $${this.priceInDollars()} & Request Follow-Back`
      : `Pay $${this.priceInDollars()} & Send Message`,
  );

  protected onSubmit(): void {
    this.formSubmit.emit({
      senderName: this.senderName,
      senderEmail: this.senderEmail,
      senderInstagram: this.senderInstagram.replace(/^@/, ''),
      messageContent: this.messageContent,
    });
  }
}
