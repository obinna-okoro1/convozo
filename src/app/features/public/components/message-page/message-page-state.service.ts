import { Injectable, signal, computed } from '@angular/core';
import { ERROR_MESSAGES } from '../../../../core/constants';
import {
  CreatorProfile,
  CreatorLink,
  AvailabilitySlot,
  MessageType,
  CheckoutSessionPayload,
  ShopCheckoutPayload,
} from '../../../../core/models';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { FormValidators } from '../../../../core/validators/form-validators';
import { ToastService } from '../../../../shared/services/toast.service';
import { errorMessage } from '../../../../shared/utils/error.utils';
import { LinkService } from '../../../link-in-bio/services/link.service';
import { MessageFormData } from '../message-form/message-form.component';
import { CallBookingFormData } from '../call-booking-form/call-booking-form.component';
import { SupportFormData } from './views/support-view/support-view.component';

@Injectable()
export class MessagePageStateService {
  // ── Core data ──
  readonly creator = signal<CreatorProfile | null>(null);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  // ── Availability data ──
  readonly availabilitySlots = signal<AvailabilitySlot[]>([]);

  // ── Links data ──
  readonly creatorLinks = signal<CreatorLink[]>([]);

  // ── UI state ──
  readonly submitting = signal<boolean>(false);

  // ── Creator settings ──
  private readonly creatorSettings = signal<CreatorProfile['creator_settings'] | null>(null);
  readonly settings = computed(() => this.creatorSettings());
  readonly messagePriceCents = computed(() => this.settings()?.message_price ?? 0);
  readonly messagesEnabled = computed(() => this.settings()?.messages_enabled ?? false);
  readonly followBackPriceCents = computed(() => this.settings()?.follow_back_price ?? 0);
  readonly followBackEnabled = computed(() => this.settings()?.follow_back_enabled ?? false);
  readonly callPriceCents = computed(() => this.settings()?.call_price ?? 0);
  readonly callDuration = computed(() => this.settings()?.call_duration ?? 10);
  readonly callsEnabled = computed(() => this.settings()?.calls_enabled ?? false);
  readonly tipsEnabled = computed(() => this.settings()?.tips_enabled ?? false);
  readonly shopEnabled = computed(() => this.settings()?.shop_enabled ?? false);
  readonly responseExpectation = computed(
    () => this.settings()?.response_expectation ?? '24-48 hours',
  );

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly toast: ToastService,
    private readonly linkService: LinkService,
  ) {}

  // ── Initialization ──

  async initialize(slug: string): Promise<void> {
    await this.loadCreator(slug);
  }

  // ── Public actions ──

  async onMessageSubmit(formData: MessageFormData): Promise<void> {
    if (!this.validateMessageForm(formData)) {
      return;
    }
    await this.processCheckout(
      formData.senderName,
      formData.senderEmail,
      formData.messageContent,
      'message',
    );
  }

  async onFollowBackSubmit(formData: MessageFormData): Promise<void> {
    if (!this.validateMessageForm(formData)) {
      return;
    }
    await this.processCheckout(
      formData.senderName,
      formData.senderEmail,
      formData.messageContent,
      'follow_back',
    );
  }

  async onCallBookingSubmit(formData: CallBookingFormData): Promise<void> {
    if (!this.validateCallForm(formData)) {
      return;
    }
    await this.processCallCheckout(formData);
  }

  async onSupportSubmit(formData: SupportFormData): Promise<void> {
    if (!FormValidators.isNotEmpty(formData.senderName)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.NAME_REQUIRED);
      return;
    }
    if (!FormValidators.isValidEmail(formData.senderEmail)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.EMAIL_REQUIRED);
      return;
    }
    if (formData.amountCents < 100) {
      this.toast.error('Minimum support amount is $1.00');
      return;
    }
    await this.processSupportCheckout(formData);
  }

  async onShopCheckout(
    itemId: string,
    buyerName: string,
    buyerEmail: string,
    requestDetails?: string,
  ): Promise<void> {
    const creatorData = this.creator();
    if (!creatorData) return;

    if (!FormValidators.isNotEmpty(buyerName)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.NAME_REQUIRED);
      return;
    }
    if (!FormValidators.isValidEmail(buyerEmail)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.EMAIL_REQUIRED);
      return;
    }

    this.submitting.set(true);
    try {
      const payload: ShopCheckoutPayload = {
        creator_slug: creatorData.slug,
        item_id: itemId,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
      };
      if (requestDetails?.trim()) {
        payload.request_details = requestDetails.trim();
      }

      const { data, error } = await this.supabaseService.createShopCheckout(payload);

      if (error || !data?.url) {
        throw new Error(error?.message ?? 'Failed to create checkout session');
      }
      window.location.href = data.url;
    } catch (err) {
      this.handleError(err, ERROR_MESSAGES.PAYMENT.FAILED_TO_PROCESS);
    } finally {
      this.submitting.set(false);
    }
  }

  onLinkClicked(link: CreatorLink): void {
    const creatorData = this.creator();
    if (creatorData) {
      void this.linkService.trackClick(link.id, creatorData.id, document.referrer || null);
    }
    window.open(link.url, '_blank', 'noopener,noreferrer');
  }

  // ── Private helpers ──

  private async loadCreator(slug: string): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.getCreatorBySlug(slug);

      if (error || !data) {
        this.error.set('Creator not found');
        return;
      }

      this.creator.set(data as CreatorProfile);

      const settings = (data as CreatorProfile).creator_settings;
      if (settings != null) {
        this.creatorSettings.set(settings);
      }

      await this.loadAvailabilitySlots((data as CreatorProfile).id);
      await this.loadCreatorLinks((data as CreatorProfile).id);
    } catch {
      this.error.set('Failed to load creator');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadAvailabilitySlots(creatorId: string): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('availability_slots')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('is_active', true)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error == null && data != null) {
        this.availabilitySlots.set(data as AvailabilitySlot[]);
      }
    } catch (err) {
      console.error('Failed to load availability slots:', err);
    }
  }

  private async loadCreatorLinks(creatorId: string): Promise<void> {
    try {
      const { data } = await this.linkService.getActiveLinks(creatorId);
      if (data) {
        this.creatorLinks.set(data);
      }
    } catch (err) {
      console.error('Failed to load creator links:', err);
    }
  }

  private validateMessageForm(data: MessageFormData): boolean {
    if (!FormValidators.isNotEmpty(data.senderName)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.NAME_REQUIRED);
      return false;
    }
    if (!FormValidators.isValidEmail(data.senderEmail)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.EMAIL_REQUIRED);
      return false;
    }
    if (!FormValidators.isNotEmpty(data.messageContent)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.CONTENT_REQUIRED);
      return false;
    }
    if (!FormValidators.isValidMessageLength(data.messageContent)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.CONTENT_TOO_LONG);
      return false;
    }
    return true;
  }

  private validateCallForm(data: CallBookingFormData): boolean {
    if (!FormValidators.isNotEmpty(data.senderName)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.NAME_REQUIRED);
      return false;
    }
    if (!FormValidators.isValidEmail(data.senderEmail)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.EMAIL_REQUIRED);
      return false;
    }
    if (!data.scheduledAt) {
      this.toast.error('Please select a time slot for your call');
      return false;
    }
    return true;
  }

  private async processCheckout(
    senderName: string,
    senderEmail: string,
    messageContent: string,
    messageType: MessageType,
  ): Promise<void> {
    const creatorData = this.creator();
    if (!creatorData) {
      return;
    }

    this.submitting.set(true);
    try {
      const priceCents =
        messageType === 'follow_back' ? this.followBackPriceCents() : this.messagePriceCents();

      const payload: CheckoutSessionPayload = {
        creator_slug: creatorData.slug,
        message_content: messageContent,
        sender_name: senderName,
        sender_email: senderEmail,
        message_type: messageType,
        price: priceCents,
      };

      const { data, error } = await this.supabaseService.createCheckoutSession(payload);

      if (error || !data?.url) {
        throw new Error(error?.message || 'Failed to create checkout session');
      }
      window.location.href = data.url;
    } catch (err) {
      this.handleError(err, ERROR_MESSAGES.PAYMENT.FAILED_TO_PROCESS);
    } finally {
      this.submitting.set(false);
    }
  }

  private async processCallCheckout(formData: CallBookingFormData): Promise<void> {
    const creatorData = this.creator();
    if (!creatorData) {
      return;
    }

    this.submitting.set(true);
    try {
      const { data, error } = await this.supabaseService.createCallBookingSession({
        creator_slug: creatorData.slug,
        booker_name: formData.senderName,
        booker_email: formData.senderEmail,
        message_content: formData.messageContent || '',
        price: this.callPriceCents(),
        scheduled_at: formData.scheduledAt,
        fan_timezone: formData.timezone,
      });

      if (error || !data?.url) {
        throw new Error(error?.message || 'Failed to create call booking session');
      }
      window.location.href = data.url;
    } catch (err) {
      this.handleError(err, ERROR_MESSAGES.PAYMENT.FAILED_TO_PROCESS);
    } finally {
      this.submitting.set(false);
    }
  }

  private async processSupportCheckout(formData: SupportFormData): Promise<void> {
    const creatorData = this.creator();
    if (!creatorData) {
      return;
    }

    this.submitting.set(true);
    try {
      const payload: CheckoutSessionPayload = {
        creator_slug: creatorData.slug,
        message_content: formData.messageContent || 'Fan support ❤️',
        sender_name: formData.senderName,
        sender_email: formData.senderEmail,
        message_type: 'support',
        price: formData.amountCents,
      };

      const { data, error } = await this.supabaseService.createCheckoutSession(payload);

      if (error || !data?.url) {
        throw new Error(error?.message || 'Failed to create checkout session');
      }
      window.location.href = data.url;
    } catch (err) {
      this.handleError(err, ERROR_MESSAGES.PAYMENT.FAILED_TO_PROCESS);
    } finally {
      this.submitting.set(false);
    }
  }

  private handleError(err: unknown, defaultMessage: string): void {
    this.toast.error(`${defaultMessage}: ${errorMessage(err, defaultMessage)}`);
  }
}
