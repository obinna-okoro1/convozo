import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-success',
  imports: [CommonModule, RouterLink],
  templateUrl: './success.component.html',
  styleUrls: ['./success.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuccessComponent implements OnInit {
  protected readonly isCallBooking = signal(false);
  protected readonly creatorSlug = signal<string | null>(null);

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

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  public ngOnInit(): void {
    const type = this.route.snapshot.queryParamMap.get('type');
    this.isCallBooking.set(type === 'call');
    const creator = this.route.snapshot.queryParamMap.get('creator');
    this.creatorSlug.set(creator);
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

