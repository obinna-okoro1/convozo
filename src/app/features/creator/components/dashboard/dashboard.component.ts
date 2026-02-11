/**
 * Dashboard component with proper access modifiers and clean architecture
 */

import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { Creator, CreatorSettings, Message, MessageStats, FilterStatus } from '../../../../core/models';
import { ROUTES } from '../../../../core/constants';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
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
  
  // Filter state
  protected readonly filterStatus = signal<FilterStatus>('all');

  // Computed values
  protected readonly stats = computed<MessageStats>(() => this.calculateStats());
  protected readonly publicUrl = computed<string>(() => this.buildPublicUrl());

  private queryParamsSubscription?: Subscription;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  public async ngOnInit(): Promise<void> {
    const user = this.supabaseService.getCurrentUser();
    if (!user) {
      await this.router.navigate([ROUTES.AUTH.LOGIN]);
      return;
    }

    this.subscribeToQueryParams();
    await this.loadDashboardData(user.id);
  }

  public ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
  }

  /**
   * Subscribe to query parameters to check for Stripe setup status
   */
  private subscribeToQueryParams(): void {
    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      if (params['stripe_setup'] === 'incomplete') {
        this.stripeSetupIncomplete.set(true);
      }
    });
  }

  /**
   * Load all dashboard data
   */
  private async loadDashboardData(userId: string): Promise<void> {
    try {
      const { data: creatorData, error: creatorError } = await this.supabaseService.getCreatorByUserId(userId);
      
      if (creatorError || !creatorData) {
        await this.router.navigate([ROUTES.CREATOR.ONBOARDING]);
        return;
      }

      this.creator.set(creatorData);
      await this.loadCreatorSettings(creatorData.id);
      await this.loadMessages(creatorData.id);
    } catch (err) {
      this.handleError(err, 'Failed to load dashboard');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Load creator settings
   */
  private async loadCreatorSettings(creatorId: string): Promise<void> {
    const { data: settingsData } = await this.supabaseService.getCreatorSettings(creatorId);
    if (settingsData) {
      this.settings.set(settingsData);
    }
  }

  /**
   * Load messages for the creator
   */
  private async loadMessages(creatorId: string): Promise<void> {
    const { data: messagesData } = await this.supabaseService.getMessages(creatorId);
    if (messagesData) {
      this.messages.set(messagesData);
    }
  }

  /**
   * Get filtered messages based on current filter status
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
   * Calculate message statistics
   */
  private calculateStats(): MessageStats {
    const msgs = this.messages();
    return {
      total: msgs.length,
      unhandled: msgs.filter(m => !m.is_handled).length,
      handled: msgs.filter(m => m.is_handled).length,
      totalRevenue: msgs.reduce((sum, m) => sum + m.amount_paid, 0) / 100,
    };
  }

  /**
   * Build public URL for the creator
   */
  private buildPublicUrl(): string {
    const creatorSlug = this.creator()?.slug;
    return creatorSlug ? `${window.location.origin}/${creatorSlug}` : '';
  }

  /**
   * Select a message to view details
   */
  protected selectMessage(message: Message): void {
    this.selectedMessage.set(message);
  }

  /**
   * Open reply modal for a message
   */
  protected openReplyModal(message: Message): void {
    this.selectedMessage.set(message);
    this.replyContent.set(message.reply_content || '');
    this.showReplyModal.set(true);
  }

  /**
   * Close reply modal and reset state
   */
  protected closeReplyModal(): void {
    this.showReplyModal.set(false);
    this.replyContent.set('');
    this.sendingReply.set(false);
  }

  /**
   * Send reply to a message
   */
  protected async sendReply(): Promise<void> {
    const message = this.selectedMessage();
    const content = this.replyContent().trim();

    if (!message || !content) {
      return;
    }

    this.sendingReply.set(true);

    try {
      const { error: emailError } = await this.supabaseService.sendReplyEmail(message.id, content);

      if (emailError) {
        throw emailError;
      }

      const currentCreator = this.creator();
      if (currentCreator) {
        await this.loadMessages(currentCreator.id);
      }

      this.closeReplyModal();
    } catch (err) {
      this.handleError(err, 'Failed to send reply');
    } finally {
      this.sendingReply.set(false);
    }
  }

  /**
   * Mark a message as handled
   */
  protected async markAsHandled(message: Message): Promise<void> {
    try {
      await this.supabaseService.updateMessage(message.id, { is_handled: true });
      
      const currentCreator = this.creator();
      if (currentCreator) {
        await this.loadMessages(currentCreator.id);
      }
    } catch (err) {
      this.handleError(err, 'Failed to mark as handled');
    }
  }

  /**
   * Sign out the current user
   */
  protected async signOut(): Promise<void> {
    await this.supabaseService.signOut();
    await this.router.navigate([ROUTES.HOME]);
  }

  /**
   * Copy public URL to clipboard
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
   * Handle errors consistently
   */
  private handleError(err: unknown, defaultMessage: string): void {
    const errorMessage = err instanceof Error ? err.message : defaultMessage;
    alert(errorMessage);
  }
}
