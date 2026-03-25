/**
 * PortalComponent — /portal
 *
 * Public-facing client dashboard. Authenticated via Supabase magic link.
 * Shows all paid messages and call bookings the client has made across all experts.
 *
 * Auth flow:
 *   1. Client lands here after clicking a magic link from an email.
 *   2. Supabase JS client processes the #access_token hash and fires SIGNED_IN.
 *   3. If no session exists (link expired): client types their email to get a
 *      fresh magic link sent to the same address.
 */

import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { SupabaseService } from '../../../../core/services/supabase.service';
import {
  ClientPortalData,
  EdgeFunctionService,
  PortalBooking,
  PortalMessage,
} from '../../../../core/services/edge-function.service';
import { User } from '@supabase/supabase-js';

type PortalView = 'loading' | 'unauthenticated' | 'link-sent' | 'authenticated';

@Component({
  selector: 'app-portal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  templateUrl: './portal.component.html',
})
export class PortalComponent implements OnInit, OnDestroy {
  protected readonly view = signal<PortalView>('loading');
  protected readonly emailInput = signal<string>('');
  protected readonly emailError = signal<string>('');
  protected readonly sendError = signal<string>('');
  protected readonly isSending = signal<boolean>(false);
  protected readonly loadError = signal<string>('');
  protected readonly messages = signal<PortalMessage[]>([]);
  protected readonly bookings = signal<PortalBooking[]>([]);
  protected readonly user = signal<User | null>(null);
  protected readonly activeTab = signal<'messages' | 'bookings'>('messages');

  private authUnsubscribe: (() => void) | null = null;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly edgeFn: EdgeFunctionService,
  ) {}

  async ngOnInit(): Promise<void> {
    // Subscribe to future auth events (magic-link click fires SIGNED_IN)
    const { data: { subscription } } = this.supabase.client.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          this.user.set(session.user);
          await this.loadPortalData();
        } else if (event === 'SIGNED_OUT') {
          this.user.set(null);
          this.messages.set([]);
          this.bookings.set([]);
          this.view.set('unauthenticated');
        }
      },
    );
    this.authUnsubscribe = subscription.unsubscribe.bind(subscription);

    // Check if a session already exists (client clicked link, JS already processed hash)
    await this.supabase.waitForSession();
    const currentUser = this.supabase.getCurrentUser();
    if (currentUser) {
      this.user.set(currentUser);
      await this.loadPortalData();
    } else {
      this.view.set('unauthenticated');
    }
  }

  ngOnDestroy(): void {
    this.authUnsubscribe?.();
  }

  // ── Unauthenticated form ────────────────────────────────────────────

  protected onEmailInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.emailInput.set(value);
    this.emailError.set('');
  }

  protected async sendMagicLink(): Promise<void> {
    const email = this.emailInput().trim();
    if (!email || !this.isValidEmail(email)) {
      this.emailError.set('Please enter a valid email address.');
      return;
    }

    this.isSending.set(true);
    this.sendError.set('');

    try {
      const { error } = await this.supabase.client.auth.signInWithOtp({
        email,
        options: {
          // Redirect back to this page so the session is set here, not at /auth/callback
          emailRedirectTo: `${window.location.origin}/portal`,
          // Clients may not have Supabase accounts; allow creation
          shouldCreateUser: true,
        },
      });

      if (error) {
        this.sendError.set('Failed to send the link. Please try again in a moment.');
        return;
      }

      this.view.set('link-sent');
    } finally {
      this.isSending.set(false);
    }
  }

  // ── Authenticated actions ───────────────────────────────────────────

  protected setTab(tab: 'messages' | 'bookings'): void {
    this.activeTab.set(tab);
  }

  protected async signOut(): Promise<void> {
    await this.supabase.signOut();
    // onAuthStateChange handles the state transition
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  protected conversationUrl(token: string): string {
    return `/conversation/${token}`;
  }

  protected joinUrl(bookingId: string, fanToken: string): string {
    return `/call/${bookingId}?role=fan&token=${fanToken}`;
  }

  protected formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  protected formatDateTime(iso: string, timezone?: string | null): string {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone ?? 'UTC',
      timeZoneName: 'short',
    });
  }

  protected expertReplyCount(msg: PortalMessage): number {
    return msg.replies.filter((r) => r.sender_type === 'expert').length;
  }

  protected isCallJoinable(booking: PortalBooking): boolean {
    return booking.status === 'confirmed' || booking.status === 'in_progress';
  }

  protected bookingStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      confirmed: 'Confirmed',
      in_progress: 'In Progress',
      completed: 'Completed',
      no_show_creator: 'Refunded',
      cancelled: 'Cancelled',
    };
    return labels[status] ?? status;
  }

  // ── Private ──────────────────────────────────────────────────────────

  private async loadPortalData(): Promise<void> {
    this.view.set('loading');
    this.loadError.set('');

    const { data, error } = await this.edgeFn.getClientPortal();

    if (error || !data) {
      this.loadError.set(error?.message ?? 'Failed to load your data. Please refresh the page.');
      this.view.set('authenticated');
      return;
    }

    this.messages.set(data.messages);
    this.bookings.set(data.bookings);
    this.view.set('authenticated');
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
