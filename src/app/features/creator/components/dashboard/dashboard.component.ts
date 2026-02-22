/**
 * Dashboard Component
 * Lean component that delegates business logic to CreatorService
 * Enhanced with analytics, templates, and push notifications
 */

import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CreatorService } from '../../services/creator.service';
import { AuthService } from '../../../auth/services/auth.service';
import { Creator, CreatorSettings, Message, MessageStats, FilterStatus } from '../../../../core/models';
import { ROUTES } from '../../../../core/constants';
import { PushNotificationService } from '../../../../core/services/push-notification.service';
import { ResponseTemplateService } from '../../../../core/services/response-template.service';
import { AnalyticsDashboardComponent } from '../analytics-dashboard/analytics-dashboard.component';
import { TemplatePickerComponent } from '../template-picker/template-picker.component';
import { AvailabilityManagerComponent } from '../availability-manager/availability-manager.component';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, RouterLink, AnalyticsDashboardComponent, TemplatePickerComponent, AvailabilityManagerComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  // State signals
  protected readonly creator = signal<Creator | null>(null);
  protected readonly settings = signal<CreatorSettings | null>(null);
  protected readonly messages = signal<Message[]>([]);
  protected readonly selectedMessage = signal<Message | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly stripeSetupIncomplete = signal<boolean>(false);
  
  // Reply modal state
  protected readonly showReplyModal = signal<boolean>(false);
  protected readonly replyContent = signal<string>('');
  protected readonly sendingReply = signal<boolean>(false);
  
  // Template picker state
  protected readonly showTemplatePicker = signal<boolean>(false);
  
  // View state (inbox vs analytics)
  protected readonly activeView = signal<'inbox' | 'analytics' | 'availability'>('inbox');
  
  // Push notifications
  protected readonly pushEnabled = signal<boolean>(false);
  protected readonly pushLoading = signal<boolean>(false);
  
  // Filter state
  protected readonly filterStatus = signal<FilterStatus>('all');

  // Computed values
  protected readonly stats = computed<MessageStats>(() => 
    this.creatorService.calculateStats(this.messages())
  );
  protected readonly publicUrl = computed<string>(() => 
    this.creatorService.buildPublicUrl(this.creator()?.slug)
  );
  
  protected readonly isPushSupported = computed(() => this.pushService.isSupported());

  private queryParamsSubscription?: Subscription;

  constructor(
    private readonly creatorService: CreatorService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly pushService: PushNotificationService,
    private readonly templateService: ResponseTemplateService
  ) {}

  public async ngOnInit(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      await this.router.navigate([ROUTES.AUTH.LOGIN]);
      return;
    }

    this.subscribeToQueryParams();
    await this.loadDashboardData(user.id);
    this.checkPushSubscription();
  }

  public ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
  }

  /**
   * Check current push notification subscription status
   */
  private checkPushSubscription(): void {
    this.pushEnabled.set(this.pushService.isSubscribed());
  }

  /**
   * Toggle push notifications
   */
  protected async togglePushNotifications(): Promise<void> {
    this.pushLoading.set(true);
    
    if (this.pushEnabled()) {
      const result = await this.pushService.unsubscribe();
      if (result.success) {
        this.pushEnabled.set(false);
      }
    } else {
      const result = await this.pushService.subscribe();
      if (result.success) {
        this.pushEnabled.set(true);
        // Show a test notification
        await this.pushService.sendLocalNotification(
          'Notifications enabled! 🎉',
          'You\'ll now receive alerts for new messages.'
        );
      } else if (result.error) {
        alert(result.error);
      }
    }
    
    this.pushLoading.set(false);
  }

  /**
   * Subscribe to query parameters
   */
  private subscribeToQueryParams(): void {
    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      if (params['stripe_setup'] === 'incomplete') {
        this.stripeSetupIncomplete.set(true);
      }
      if (params['view'] === 'availability') {
        this.activeView.set('availability');
      }
    });
  }

  /**
   * Load all dashboard data
   */
  private async loadDashboardData(userId: string): Promise<void> {
    try {
      const { data: creatorData, error: creatorError } = await this.creatorService.getCreatorByUserId(userId);
      
      if (creatorError || !creatorData) {
        await this.router.navigate([ROUTES.CREATOR.ONBOARDING]);
        return;
      }

      this.creator.set(creatorData);
      
      // Initialize templates for this creator
      await this.templateService.initializeTemplates(creatorData.id);

      const { data: settingsData } = await this.creatorService.getCreatorSettings(creatorData.id);
      if (settingsData) {
        this.settings.set(settingsData);
      }

      const { data: messagesData } = await this.creatorService.getMessages(creatorData.id);
      if (messagesData) {
        this.messages.set(messagesData);
      }
    } catch (err) {
      this.handleError(err, 'Failed to load dashboard');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Get filtered messages
   */
  protected filteredMessages(): Message[] {
    const msgs = this.messages();
    const status = this.filterStatus();

    if (status === 'unhandled') {
      return msgs.filter(m => !m.is_handled);
    } else if (status === 'handled') {
      return msgs.filter(m => m.is_handled);
    }
    return msgs;
  }

  /**
   * Select a message
   */
  protected selectMessage(message: Message): void {
    this.selectedMessage.set(message);
  }

  /**
   * Open reply modal
   */
  protected openReplyModal(message: Message): void {
    this.selectedMessage.set(message);
    this.replyContent.set(message.reply_content || '');
    this.showReplyModal.set(true);
  }

  /**
   * Close reply modal
   */
  protected closeReplyModal(): void {
    this.showReplyModal.set(false);
    this.replyContent.set('');
    this.sendingReply.set(false);
    this.showTemplatePicker.set(false);
  }

  /**
   * Open template picker
   */
  protected openTemplatePicker(): void {
    this.showTemplatePicker.set(true);
  }

  /**
   * Handle template selection
   */
  protected onTemplateSelected(content: string): void {
    // Replace sender_name placeholder with actual name
    const message = this.selectedMessage();
    if (message) {
      content = content.replace(/\{sender_name\}/g, message.sender_name);
    }
    this.replyContent.set(content);
    this.showTemplatePicker.set(false);
  }

  /**
   * Send reply
   */
  protected async sendReply(): Promise<void> {
    const message = this.selectedMessage();
    const content = this.replyContent().trim();

    if (!message || !content) {
      return;
    }

    this.sendingReply.set(true);

    const result = await this.creatorService.replyToMessage(message.id, content, message.sender_email);

    if (result.success) {
      const currentCreator = this.creator();
      if (currentCreator) {
        const { data } = await this.creatorService.getMessages(currentCreator.id);
        if (data) {
          this.messages.set(data);
        }
      }
      this.closeReplyModal();
    } else {
      this.handleError(result.error, 'Failed to send reply');
    }

    this.sendingReply.set(false);
  }

  /**
   * Mark message as handled
   */
  protected async markAsHandled(message: Message): Promise<void> {
    const { error } = await this.creatorService.markAsHandled(message.id);
    
    if (!error) {
      const currentCreator = this.creator();
      if (currentCreator) {
        const { data } = await this.creatorService.getMessages(currentCreator.id);
        if (data) {
          this.messages.set(data);
        }
      }
    } else {
      this.handleError(error, 'Failed to mark as handled');
    }
  }

  /**
   * Sign out
   */
  protected async signOut(): Promise<void> {
    await this.authService.signOut();
  }

  /**
   * Copy public URL
   */
  protected copyPublicUrl(): void {
    const url = this.publicUrl();
    if (url) {
      navigator.clipboard.writeText(url).then(
        () => alert('URL copied to clipboard!'),
        () => alert('Failed to copy URL')
      );
    }
  }

  /**
   * Handle errors
   */
  private handleError(err: unknown, defaultMessage: string): void {
    const errorMessage = err instanceof Error ? err.message : defaultMessage;
    alert(errorMessage);
  }
}
