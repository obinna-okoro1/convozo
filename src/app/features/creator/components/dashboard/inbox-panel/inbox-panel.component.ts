import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Message, MessageStats, FilterStatus } from '../../../../../core/models';
import { CreatorService } from '../../../services/creator.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { ReplyModalComponent } from '../reply-modal/reply-modal.component';
import {
  SearchableSelectComponent,
  SelectOption,
} from '../../../../../shared/components/ui/searchable-select/searchable-select.component';

@Component({
  selector: 'app-inbox-panel',
  imports: [CommonModule, ReplyModalComponent, SearchableSelectComponent],
  templateUrl: './inbox-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxPanelComponent {
  public readonly messages = input.required<Message[]>();

  public readonly markHandled = output<Message>();
  public readonly confirmDelete = output<Message>();

  protected readonly sendingReply = signal<boolean>(false);
  protected readonly selectedMessage = signal<Message | null>(null);
  protected readonly showMessageModal = signal<boolean>(false);
  protected readonly showReplyModal = signal<boolean>(false);
  protected readonly filterStatus = signal<FilterStatus>('all');

  protected readonly stats = computed<MessageStats>(() =>
    this.creatorService.calculateStats(this.messages()),
  );

  constructor(
    private readonly creatorService: CreatorService,
    private readonly toast: ToastService,
  ) {}

  protected readonly filteredMessages = computed<Message[]>(() => {
    const msgs = this.messages();
    const status = this.filterStatus();
    if (status === 'unhandled') {
      return msgs.filter((m) => !m.is_handled);
    }
    if (status === 'handled') {
      return msgs.filter((m) => m.is_handled);
    }
    return msgs;
  });

  protected readonly filterOptions = computed<SelectOption[]>(() => {
    const s = this.stats();
    return [
      { value: 'all', label: `All (${s.total})` },
      { value: 'unhandled', label: `Unhandled (${s.unhandled})` },
      { value: 'handled', label: `Handled (${s.handled})` },
    ];
  });

  protected onFilterChange(value: string): void {
    this.filterStatus.set(value as FilterStatus);
  }

  protected handleMessageClick(message: Message): void {
    this.selectedMessage.set(message);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      this.showMessageModal.set(true);
    }
    if (!message.is_handled) {
      this.markHandled.emit(message);
    }
  }

  protected closeMessageModal(): void {
    this.showMessageModal.set(false);
  }

  protected openReplyModal(message: Message): void {
    this.selectedMessage.set(message);
    this.showReplyModal.set(true);
  }

  protected closeReplyModal(): void {
    this.showReplyModal.set(false);
  }

  protected async onReplySent(content: string): Promise<void> {
    const message = this.selectedMessage();
    if (!message) {
      return;
    }

    this.sendingReply.set(true);

    const result = await this.creatorService.replyToMessage(
      message.id,
      content,
      message.sender_email,
    );

    if (result.success) {
      this.toast.success('Reply sent!');
      this.closeReplyModal();
    } else {
      this.toast.error(result.error ?? 'Failed to send reply');
    }

    this.sendingReply.set(false);
  }

  protected markAsHandled(message: Message): void {
    this.markHandled.emit(message);
  }

  protected onConfirmDelete(message: Message): void {
    this.confirmDelete.emit(message);
  }

  protected openReplyModalFromMobile(message: Message): void {
    this.closeMessageModal();
    this.openReplyModal(message);
  }

  protected markAsHandledFromMobile(message: Message): void {
    this.closeMessageModal();
    this.markHandled.emit(message);
  }

  protected confirmDeleteFromMobile(message: Message): void {
    this.closeMessageModal();
    this.confirmDelete.emit(message);
  }
}
