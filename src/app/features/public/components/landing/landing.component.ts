import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface HowItWorksStep {
  num: string;
  title: string;
  body: string;
  icon: string;
  grad: string;
}

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {
  protected readonly currentYear = new Date().getFullYear();

  protected readonly howItWorksSteps: HowItWorksStep[] = [
    {
      num: '01',
      title: 'Create your profile',
      body: 'Sign up, set your price, and get your personal link — convozo.com/yourname. Takes 60 seconds.',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      grad: 'from-purple-500 to-violet-600',
    },
    {
      num: '02',
      title: 'Share your link',
      body: 'Post it everywhere — LinkedIn, Instagram, Twitter, your website. One link, multiple revenue streams.',
      icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
      grad: 'from-pink-500 to-rose-600',
    },
    {
      num: '03',
      title: 'Get paid instantly',
      body: 'Clients pay, Stripe processes, you earn. 78% goes directly to your bank. Payouts every 24 hours.',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      grad: 'from-emerald-500 to-teal-600',
    },
  ];

  protected readonly statsItems = [
    { value: '500+', label: 'Active Experts' },
    { value: '78%', label: 'Expert Payout' },
    { value: '24h', label: 'Avg. Response' },
    { value: '$0', label: 'To Get Started' },
  ];

  protected readonly trustSignals = [
    'Free to join',
    'You keep 78% always',
    'Paid in 24 hours',
    'Stripe-secured',
  ];

  protected readonly chartBars = [40, 55, 35, 70, 50, 85, 65, 90, 75, 100];

  protected readonly tickerItems = [
    { dot: '#a855f7', name: 'expert earned', amt: '$250 · ' },
    { dot: '#ec4899', name: 'client tip', amt: '$75 · ' },
    { dot: '#22c55e', name: 'call booked', amt: '$300 · ' },
    { dot: '#3b82f6', name: 'message replied', amt: '$50 · ' },
    { dot: '#f59e0b', name: 'digital product sale', amt: '$35 · ' },
    { dot: '#f59e0b', name: 'consultation booked', amt: '$100 · ' },
    { dot: '#a855f7', name: 'payout delivered', amt: '$1,240 · ' },
    { dot: '#ec4899', name: 'new message', amt: '$30 · ' },
    { dot: '#22c55e', name: 'video call done', amt: '$200 · ' },
    { dot: '#3b82f6', name: 'product download', amt: '$49 · ' },
  ];
}
