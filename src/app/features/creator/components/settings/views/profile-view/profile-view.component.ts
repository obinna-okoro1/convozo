import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ImageUploadComponent,
  ImageChangeEvent,
} from '../../../../../../shared/components/ui/image-upload/image-upload.component';
import { SettingsStateService } from '../../settings-state.service';

@Component({
  selector: 'app-profile-view',
  imports: [CommonModule, ImageUploadComponent],
  templateUrl: './profile-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileViewComponent {
  constructor(protected readonly state: SettingsStateService) {}

  protected onImageChanged(event: ImageChangeEvent): void {
    this.state.profileImageUrl.set(event.url);
  }

  protected onImageUploadError(message: string): void {
    this.state.error.set(message);
  }
}
