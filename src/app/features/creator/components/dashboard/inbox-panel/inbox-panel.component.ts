import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Message, MessageReply, MessageStats, FilterStatus } from '@core/models';
import { MessageService } from '@features/creator/services/message.service';
import { ToastService } from '@shared/services/toast.service';
import {
  SearchableSelectComponent,
  SelectOption,
} from '@shared/components/ui/searchable-select/searchable-select.component';

@Component({
  selector: 'app-inbox-panel',
  imports: [CommonModule, FormsModule, DatePipe, SearchableSelectComponent],
  templateUrl: './inbox-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxPanelComponent implements OnDestroy {
  public readonly messages = input.required<Message[]>();

  public readonly markHandled = output<Message>();
  public readonly confirmDelete = output<Message>();

  protected readonly sendingReply = signal<boolean>(false);
  protected readonly selectedMessage = signal<Message | null>(null);
  protected readonly showMessageModal = signal<boolean>(false);
  protected readonly filterStatus = signal<FilterStatus>('all');

  // ── Thread state ───────────────────────────────────────────────────────────
  /** Replies for the currently selected message. */
  protected readonly replies = signal<MessageReply[]>([]);
  protected readonly loadingReplies = signal<boolean>(false);
  /** Inline reply textarea bound value. */
  protected readonly replyText = signal<string>('');

  private repliesChannel: RealtimeChannel | null = null;

  protected readonly stats = computed<MessageStats>(() =>
    this.messageService.calculateStats(this.messages()),
  );

  constructor(
    private readonly messageService: MessageService,
    private readonly toast: ToastService,
  ) {
    // Reload replies whenever the selected message changes.
    effect(() => {
      const msg = this.selectedMessage();
      void this.loadReplies(msg?.id ?? null);
    });
  }

  public ngOnDestroy(): void {
    this.teardownRepliesSubscription();
  }

  protected readonly filteredMessages = computed<Message[]>(() => {
    const msgs = this.messages();
    const status = this.filterStatus();
    if (status === 'unhandled') return msgs.filter((m) => !m.is_handled);
    if (status === 'handled') return msgs.filter((m) => m.is_handled);
    return msgs;
  });

  protected readonly filterOptions = computed<SelectOption[]>(() => {
    const s = this.stats();
    return [
      { value: 'all', label: `All (${s.total})` },
      { value: 'unhandled', label: `Pending (${s.unhandled})` },
      { value: 'handled', label: `Replied (${s.handled})` },
    ];
  });

  protected onFilterChange(value: string): void {
    this.filterStatus.set(value as FilterStatus);
  }

  protected handleMessageClick(message: Message): void {
    this.selectedMessage.set(message);
    this.replyText.set('');
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

  // ── Inline reply (threaded) ────────────────────────────────────────────────

  protected async sendInlineReply(): Promise<void> {
    const message = this.selectedMessage();
    const content = this.replyText().trim();
    if (!message || !content || this.sendingReply()) return;

    this.sendingReply.set(true);

    const result = await this.messageService.replyToMessage(message.id, content, message.sender_email);

    if (result.success) {
      this.replyText.set('');
      this.toast.success('Reply sent!');
      // Optimistically append the expert reply to the local thread
      const optimistic: MessageReply = {
        id: crypto.randomUUID(),
        message_id: message.id,
        sender_type: 'expert',
        content,
        created_at: new Date().toISOString(),
      };
      this.replies.update((prev) => [...prev, optimistic]);
    } else {
      this.toast.error(result.error ?? 'Failed to send reply');
    }

    this.sendingReply.set(false);
  }

  protected onReplyInput(event: Event): void {
    this.replyText.set((event.target as HTMLTextAreaElement).value);
  }

  protected markAsHandled(message: Message): void {
    this.markHandled.emit(message);
  }

  protected onConfirmDelete(message: Message): void {
    this.confirmDelete.emit(message);
  }

  protected markAsHandledFromMobile(message: Message): void {
    this.closeMessageModal();
    this.markHandled.emit(message);
  }

  protected confirmDeleteFromMobile(message: Message): void {
    this.closeMessageModal();
    this.confirmDelete.emit(message);
  }

  protected sendInlineReplyFromMobile(): void {
    this.closeMessageModal();
    void this.sendInlineReply();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async loadReplies(messageId: string | null): Promise<void> {
    this.teardownRepliesSubscription();
    this.replies.set([]);
    this.replyText.set('');

    if (!messageId) return;

    this.loadingReplies.set(true);
    const { data } = await this.messageService.getReplies(messageId);
    this.loadingReplies.set(false);

    if (data) this.replies.set(data);

    // Subscribe to new replies in real-time
    this.repliesChannel = this.messageService.subscribeToReplies(messageId, (updated) => {
      this.replies.set(updated);
    });
  }

  private teardownRepliesSubscription(): void {
    if (this.repliesChannel) {
      this.messageService.unsubscribeFromReplies(this.repliesChannel);
      this.repliesChannel = null;
    }
  }
}
