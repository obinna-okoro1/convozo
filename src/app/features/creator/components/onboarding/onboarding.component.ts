/**
 * Onboarding Component
 * Thin shell — all state and business logic lives in OnboardingStateService.
 */

import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import {
  ImageUploadComponent,
  ImageChangeEvent,
} from '../../../../shared/components/ui/image-upload/image-upload.component';
import { SearchableSelectComponent } from '../../../../shared/components/ui/searchable-select/searchable-select.component';
import { OnboardingStateService } from './onboarding-state.service';

@Component({
  selector: 'app-onboarding',
  imports: [NgClass, ImageUploadComponent, SearchableSelectComponent],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [OnboardingStateService],
})
export class OnboardingComponent implements OnInit {
  protected readonly state = inject(OnboardingStateService);

  public ngOnInit(): void {
    void this.state.initialize();
  }

  /** Extract string value from an input/textarea/select event */
  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** Extract numeric value from an input event */
  protected inputNumber(event: Event): number {
    return +(event.target as HTMLInputElement).value;
  }

  /** Extract checked state from a checkbox event */
  protected inputChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  /** Forwarded to the state service which handles upload URL directly */
  protected onImageChanged(event: ImageChangeEvent): void {
    this.state.profileImageUrl.set(event.url);
  }

  protected onImageUploadError(message: string): void {
    this.state.error.set(message);
  }
}
