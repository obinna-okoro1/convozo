/**
 * Message View Component
 * Displays the paid message form on the public message page.
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import {
  MessageFormComponent,
  MessageFormData,
} from '../../../message-form/message-form.component';
import { MessagePageStateService } from '../../message-page-state.service';

@Component({
  selector: 'app-message-view',
  imports: [MessageFormComponent],
  templateUrl: './message-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageViewComponent {
  protected readonly state = inject(MessagePageStateService);

  protected onMessageSubmit(formData: MessageFormData): void {
    void this.state.onMessageSubmit(formData);
  }
}
