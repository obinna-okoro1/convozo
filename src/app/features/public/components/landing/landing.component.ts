import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnimatedBackgroundComponent } from '../../../../shared/components/animated-background/animated-background.component';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, AnimatedBackgroundComponent],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {
  protected readonly currentYear = new Date().getFullYear();
}
