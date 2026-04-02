import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms-of-service',
  imports: [RouterLink],
  templateUrl: './terms-of-service.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsOfServiceComponent {
  protected readonly lastUpdated = 'April 2, 2026';
  protected readonly currentYear = new Date().getFullYear();
}
