import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ShopService } from '../../../creator/services/shop.service';

@Component({
  selector: 'app-success',
  imports: [CommonModule, RouterLink],
  templateUrl: './success.component.html',
  styleUrls: ['./success.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuccessComponent implements OnInit {
  protected readonly isCallBooking = signal(false);
  protected readonly isShopPurchase = signal(false);
  protected readonly isSupportTip = signal(false);
  protected readonly creatorSlug = signal<string | null>(null);
  protected readonly creatorName = signal<string | null>(null);

  // ── Shop download state ────────────────────────────────────────────────────
  protected readonly shopItemTitle = signal<string | null>(null);
  protected readonly shopDownloadUrl = signal<string | null>(null);
  protected readonly shopFilename = signal<string | null>(null);
  protected readonly loadingDownload = signal(false);
  protected readonly downloadError = signal<string | null>(null);

  protected readonly callSteps = [
    { n: 1, text: "Check your email — a booking confirmation with all the details has been sent to you." },
    { n: 2, text: "You'll receive a secure join link by email before your call. No action needed until then." },
    { n: 3, text: "Click the join link at the scheduled time — your call starts automatically. Enjoy!" },
  ];

  protected readonly messageSteps = [
    { n: 1, text: 'Your message has been delivered to their priority inbox.' },
    { n: 2, text: "You'll receive a confirmation email with your message details." },
    { n: 3, text: "When they reply, you'll get an email with their response." },
  ];

  protected readonly shopSteps = [
    { n: 1, text: "Your payment is confirmed and your file is stored securely on Convozo." },
    { n: 2, text: "Click 'Download Your File' below — a secure link will open immediately." },
    { n: 3, text: "Save your file after downloading \u2014 the download link expires in 1 hour." },
  ];

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly shopService: ShopService,
  ) {}

  public ngOnInit(): void {
    const type = this.route.snapshot.queryParamMap.get('type');
    const shop = this.route.snapshot.queryParamMap.get('shop');
    const creator = this.route.snapshot.queryParamMap.get('creator');

    this.isCallBooking.set(type === 'call');
    this.isShopPurchase.set(shop === '1');
    this.isSupportTip.set(type === 'support');
    this.creatorSlug.set(creator);
    this.creatorName.set(this.route.snapshot.queryParamMap.get('name'));

    // Fetch the signed download URL from our edge function
    if (shop === '1') {
      const sessionId = this.route.snapshot.queryParamMap.get('session_id');
      if (sessionId) {
        void this.fetchDownloadUrl(sessionId);
      }
    }
  }

  protected async fetchDownloadUrl(sessionId: string): Promise<void> {
    this.loadingDownload.set(true);
    this.downloadError.set(null);

    const result = await this.shopService.getShopDownloadUrl(sessionId);
    this.loadingDownload.set(false);

    if (result.error || !result.data?.url) {
      this.downloadError.set('Could not load your download link. Please check your email or contact support.');
      return;
    }

    this.shopDownloadUrl.set(result.data.url);
    this.shopFilename.set(result.data.filename ?? null);
  }

  protected goBack(): void {
    const slug = this.creatorSlug();
    if (slug) {
      void this.router.navigate(['/', slug]);
    } else {
      void this.router.navigate(['/']);
    }
  }

  /**
   * Build a Google Calendar "add event" URL for call bookings.
   * Reads scheduled_at from query params.
   */
  protected getGoogleCalendarUrl(): string {
    const scheduledAt = this.route.snapshot.queryParamMap.get('scheduled_at') ?? '';
    const duration = Number(this.route.snapshot.queryParamMap.get('duration') ?? '30');
    const expert = this.creatorName() ?? 'Expert';

    const start = scheduledAt ? new Date(scheduledAt) : new Date();
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const fmt = (d: Date): string => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Convozo Consultation with ${expert}`,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: 'Your video consultation booked via Convozo. Check your email for the join link.',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }
}

