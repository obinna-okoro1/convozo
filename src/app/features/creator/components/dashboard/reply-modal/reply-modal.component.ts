import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { Message } from '../../../../../core/models';
import { TemplatePickerComponent } from '../../template-picker/template-picker.component';

@Component({
  selector: 'app-reply-modal',
  imports: [TemplatePickerComponent],
  templateUrl: './reply-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplyModalComponent {
  public readonly message = input.required<Message | null>();
  public readonly sendingReply = input.required<boolean>();

  public readonly replySent = output<string>();
  public readonly closed = output();

  protected readonly replyContent = signal<string>('');
  protected readonly showTemplatePicker = signal<boolean>(false);

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected openTemplatePicker(): void {
    this.showTemplatePicker.set(true);
  }

  protected onTemplateSelected(content: string): void {
    const message = this.message();
    if (message) {
      content = content.replace(/\{sender_name\}/g, message.sender_name);
    }
    this.replyContent.set(content);
    this.showTemplatePicker.set(false);
  }

  protected sendReply(): void {
    const content = this.replyContent().trim();
    if (!content) {
      return;
    }
    this.replySent.emit(content);
  }

  protected close(): void {
    this.replyContent.set('');
    this.showTemplatePicker.set(false);
    this.closed.emit();
  }
}
