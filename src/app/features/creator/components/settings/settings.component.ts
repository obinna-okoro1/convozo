/**
 * Settings Component (Shell)
 * Responsible for initialization and the header chrome.
 * Child route components handle individual tab views.
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AnimatedBackgroundComponent } from '../../../../shared/components/animated-background/animated-background.component';
import { SettingsStateService } from './settings-state.service';
import { SettingsTabsComponent } from './settings-tabs/settings-tabs.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterOutlet, AnimatedBackgroundComponent, SettingsTabsComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  protected readonly state = inject(SettingsStateService);

  public ngOnInit(): void {
    void this.state.loadCreatorData();
  }
}
