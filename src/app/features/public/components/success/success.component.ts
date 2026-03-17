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
  protected readonly creatorSlug = signal<string | null>(null);

  // ── Shop download state ────────────────────────────────────────────────────
  protected readonly shopItemTitle = signal<string | null>(null);
  protected readonly shopDownloadUrl = signal<string | null>(null);
  protected readonly shopFilename = signal<string | null>(null);
  protected readonly loadingDownload = signal(false);
  protected readonly downloadError = signal<string | null>(null);

  protected readonly confettiItems = Array.from({ length: 12 }, (_, i) => i);
  protected readonly confettiPositions = this.confettiItems.map(() => ({
    left: `${Math.floor(Math.random() * 100)}%`,
    delay: `${(Math.random() * 2).toFixed(1)}s`,
  }));

  protected readonly callSteps = [
    { n: 1, text: "Check your email — a booking confirmation and receipt has been sent to you." },
    { n: 2, text: 'The creator will DM you on Instagram to agree on an exact date and time.' },
    { n: 3, text: "You'll receive a private call link by email. Join at the scheduled time — enjoy!" },
  ];

  protected readonly messageSteps = [
    { n: 1, text: 'The creator receives your message in their priority inbox.' },
    { n: 2, text: "You'll receive a confirmation email with your message details." },
    { n: 3, text: "When the creator replies, you'll get an email with their response." },
  ];

  protected readonly shopSteps = [
    { n: 1, text: "Your payment is confirmed and your file is stored securely on Convozo." },
    { n: 2, text: "Click 'Download Your File' below — a secure link will open immediately." },
    { n: 3, text: "Save your file after downloading — the download link expires in 5 minutes." },
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
    this.creatorSlug.set(creator);

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
}

