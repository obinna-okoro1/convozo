import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-success',
  imports: [CommonModule],
  templateUrl: './success.component.html',
  styleUrls: ['./success.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuccessComponent implements OnInit {
  protected readonly isCallBooking = signal(false);
  protected readonly creatorSlug = signal<string | null>(null);

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
