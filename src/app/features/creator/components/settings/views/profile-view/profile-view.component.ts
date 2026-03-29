import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ImageUploadComponent,
  ImageChangeEvent,
} from '@shared/components/ui/image-upload/image-upload.component';
import { SearchableSelectComponent } from '@shared/components/ui/searchable-select/searchable-select.component';
import { SettingsStateService } from '../../settings-state.service';

/** Preset banner images bundled with the app (served from /assets/banners/). */
interface BannerPreset { label: string; value: string; }

@Component({
  selector: 'app-profile-view',
  imports: [CommonModule, ImageUploadComponent, SearchableSelectComponent],
  templateUrl: './profile-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileViewComponent {
  protected readonly bannerPresets: BannerPreset[] = [
    { label: 'Mountains', value: '/assets/banners/banner-1.jpg' },
    { label: 'City Lights', value: '/assets/banners/banner-2.jpg' },
    { label: 'Galaxy', value: '/assets/banners/banner-3.jpg' },
    { label: 'Ocean', value: '/assets/banners/banner-4.jpg' },
    { label: 'Forest', value: '/assets/banners/banner-5.jpg' },
  ];

  /** Only used to drive the upload component preview when a custom banner is active. */
  protected readonly customBannerUrl = computed(() => {
    const url = this.state.bannerImageUrl();
    // Return empty string for preset banners — the upload component should show blank
    return url && !url.startsWith('/assets/banners/') ? url : '';
  });

  protected readonly isPresetBanner = computed(() =>
    this.state.bannerImageUrl().startsWith('/assets/banners/'),
  );

  constructor(protected readonly state: SettingsStateService) {}

  protected selectBannerPreset(value: string): void {
    // Toggle: clicking the same preset deselects it
    if (this.state.bannerImageUrl() === value) {
      this.state.bannerImageUrl.set('');
    } else {
      this.state.bannerImageUrl.set(value);
    }
  }

  protected removeBanner(): void {
    this.state.bannerImageUrl.set('');
  }

  protected onBannerChanged(event: ImageChangeEvent): void {
    this.state.bannerImageUrl.set(event.url);
  }

  protected onImageChanged(event: ImageChangeEvent): void {
    this.state.profileImageUrl.set(event.url);
  }

  protected onImageUploadError(message: string): void {
    this.state.error.set(message);
  }
}
