/**
 * Follow-Back View Component
 * Displays the follow-back request form on the public message page.
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessagePageStateService } from '../../message-page-state.service';
import {
  MessageFormComponent,
  MessageFormData,
} from '../../../message-form/message-form.component';

@Component({
  selector: 'app-follow-back-view',
  imports: [RouterLink, MessageFormComponent],
  templateUrl: './follow-back-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FollowBackViewComponent {
  protected readonly state = inject(MessagePageStateService);

  protected onFollowBackSubmit(formData: MessageFormData): void {
    void this.state.onFollowBackSubmit(formData);
  }
}
