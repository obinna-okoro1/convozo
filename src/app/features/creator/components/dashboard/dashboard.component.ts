/**
 * Dashboard Component (Shell)
 * Responsible for initialization, real-time subscriptions,
 * push notifications, and the header chrome.
 * Child route components handle individual views.
 */

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
} from '@angular/core';

import { Router, RouterLink, RouterOutlet, ActivatedRoute } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Subscription } from 'rxjs';
import { ROUTES } from '../../../../core/constants';
import { PushNotificationService } from '../../../../core/services/push-notification.service';
import { ResponseTemplateService } from '../../../../core/services/response-template.service';
import { AnimatedBackgroundComponent } from '../../../../shared/components/animated-background/animated-background.component';
import { ToastService } from '../../../../shared/services/toast.service';
import { AuthService } from '../../../auth/services/auth.service';
import { CreatorService } from '../../services/creator.service';
import { DashboardStateService } from './dashboard-state.service';
import { DashboardTabsComponent } from './dashboard-tabs/dashboard-tabs.component';
import { DeleteConfirmModalComponent } from './delete-confirm-modal/delete-confirm-modal.component';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    RouterLink,
    RouterOutlet,
    AnimatedBackgroundComponent,
    DashboardTabsComponent,
    DeleteConfirmModalComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Shell-only UI state
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly paymentSetupIncomplete = signal<boolean>(false);

  // Push notifications
  protected readonly pushEnabled = signal<boolean>(false);
  protected readonly pushLoading = signal<boolean>(false);
  protected readonly isPushSupported = computed(() => this.pushService.isSupported());

  // Expose shared state for the template (header profile, delete modal)
  protected readonly dashboardState = inject(DashboardStateService);

  private queryParamsSubscription?: Subscription;
  private realtimeChannel?: RealtimeChannel;
  private bookingsRealtimeChannel?: RealtimeChannel;

  constructor(
    private readonly creatorService: CreatorService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly pushService: PushNotificationService,
    private readonly templateService: ResponseTemplateService,
    private readonly toast: ToastService,
  ) {}

  // ── Lifecycle ───────────────────────────────────────────────────────

  public ngOnInit(): void {
    void this.initialize();
  }

  public ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
    if (this.realtimeChannel) {
      this.creatorService.unsubscribeFromMessages(this.realtimeChannel);
    }
    if (this.bookingsRealtimeChannel) {
      this.creatorService.unsubscribeFromCallBookings(this.bookingsRealtimeChannel);
    }
  }

  // ── Protected methods ───────────────────────────────────────────────

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
        await this.pushService.sendLocalNotification(
          'Notifications enabled! 🎉',
          "You'll now receive alerts for new messages.",
        );
      } else if (result.error) {
        this.toast.error(result.error);
      }
    }

    this.pushLoading.set(false);
  }

  /**
   * Sign out
   */
  protected async signOut(): Promise<void> {
    await this.authService.signOut();
  }

  // ── Private methods ─────────────────────────────────────────────────

  private async initialize(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      await this.router.navigate([ROUTES.AUTH.LOGIN]);
      return;
    }

    this.subscribeToQueryParams();
    await this.loadDashboardData(user.id);
    this.checkPushSubscription();
  }

  /**
   * Subscribe to query parameters
   */
  private subscribeToQueryParams(): void {
    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      if (params['payment_setup'] === 'incomplete') {
        this.paymentSetupIncomplete.set(true);
      }
      if (params['view'] === 'availability') {
        void this.router.navigate(['availability'], { relativeTo: this.route });
      }
    });
  }

  /**
   * Check current push notification subscription status
   */
  private checkPushSubscription(): void {
    this.pushEnabled.set(this.pushService.isSubscribed());
  }

  /**
   * Load all dashboard data and populate the shared state service
   */
  private async loadDashboardData(userId: string): Promise<void> {
    try {
      const { data: creatorData, error: creatorError } =
        await this.creatorService.getCreatorByUserId(userId);

      if (creatorError || !creatorData) {
        await this.router.navigate([ROUTES.CREATOR.ONBOARDING]);
        return;
      }

      this.dashboardState.creator.set(creatorData);

      // Initialize templates for this creator
      this.templateService.initializeTemplates(creatorData.id, creatorData.display_name);

      const { data: settingsData } = await this.creatorService.getCreatorSettings(creatorData.id);
      if (settingsData) {
        this.dashboardState.settings.set(settingsData);
      }

      const { data: messagesData } = await this.creatorService.getMessages(creatorData.id);
      if (messagesData) {
        this.dashboardState.messages.set(messagesData);
      }

      const { data: bookingsData } = await this.creatorService.getCallBookings(creatorData.id);
      if (bookingsData) {
        this.dashboardState.callBookings.set(bookingsData);
      }

      // Subscribe to real-time updates so the inbox refreshes instantly
      this.realtimeChannel = this.creatorService.subscribeToMessages(
        creatorData.id,
        (updatedMessages) => {
          this.dashboardState.messages.set(updatedMessages);
        },
      );

      // Subscribe to real-time call booking updates
      this.bookingsRealtimeChannel = this.creatorService.subscribeToCallBookings(
        creatorData.id,
        (updatedBookings) => {
          this.dashboardState.callBookings.set(updatedBookings);
        },
      );
    } catch (err) {
      this.handleError(err, 'Failed to load dashboard');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Handle errors
   */
  private handleError(err: unknown, defaultMessage: string): void {
    const errorMessage = err instanceof Error ? err.message : defaultMessage;
    this.toast.error(errorMessage);
  }
}
