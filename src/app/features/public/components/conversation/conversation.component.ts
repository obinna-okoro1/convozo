/**
 * ConversationComponent
 *
 * Public page — no auth required.
 * Renders the full threaded conversation between a client and an expert,
 * identified by `conversation_token` in the URL.
 *
 * Route: /conversation/:token
 *
 * The client can read all replies and post follow-up messages once the
 * expert has replied at least once.
 */

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import {
  EdgeFunctionService,
  ConversationData,
} from '../../../../core/services/edge-function.service';
import { MessageReply } from '../../../../core/models';

type LoadState = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-conversation',
  imports: [FormsModule, DatePipe],
  templateUrl: './conversation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationComponent implements OnInit {
  protected readonly loadState = signal<LoadState>('loading');
  protected readonly loadError = signal<string | null>(null);
  protected readonly conversation = signal<ConversationData | null>(null);

  protected readonly replyText = signal('');
  protected readonly sending = signal(false);
  protected readonly sendError = signal<string | null>(null);
  protected readonly sendSuccess = signal(false);

  /** True once the expert has replied at least once — enables client reply box. */
  protected readonly canReply = computed(() => {
    const conv = this.conversation();
    if (!conv) return false;
    return conv.replies.some((r) => r.sender_type === 'expert');
  });

  /** Live reply list — updated optimistically after a successful send. */
  protected readonly replies = computed<MessageReply[]>(() => {
    return this.conversation()?.replies ?? [];
  });

  private readonly token = signal<string>('');

  constructor(
    private readonly route: ActivatedRoute,
    private readonly edgeFn: EdgeFunctionService,
  ) {}

  public ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    this.token.set(token);
    void this.loadConversation(token);
  }

  private async loadConversation(token: string): Promise<void> {
    this.loadState.set('loading');
    this.loadError.set(null);

    const { data, error } = await this.edgeFn.getConversation(token);

    if (error || !data) {
      this.loadError.set(error?.message ?? 'Conversation not found.');
      this.loadState.set('error');
      return;
    }

    this.conversation.set(data);
    this.loadState.set('loaded');
  }

  protected async sendReply(): Promise<void> {
    const content = this.replyText().trim();
    if (!content || this.sending()) return;

    this.sending.set(true);
    this.sendError.set(null);

    const { data, error } = await this.edgeFn.postClientReply(this.token(), content);

    if (error || !data) {
      this.sendError.set(error?.message ?? 'Failed to send reply. Please try again.');
      this.sending.set(false);
      return;
    }

    // Optimistic append — add client reply to the local list immediately
    const newReply: MessageReply = {
      id: data.reply.id,
      message_id: this.conversation()!.message.id,
      sender_type: 'client',
      content,
      created_at: data.reply.created_at,
    };

    const current = this.conversation();
    if (current) {
      this.conversation.set({ ...current, replies: [...current.replies, newReply] });
    }

    this.replyText.set('');
    this.sending.set(false);
    this.sendSuccess.set(true);
  }

  protected onReplyInput(event: Event): void {
    this.replyText.set((event.target as HTMLTextAreaElement).value);
    this.sendSuccess.set(false);
  }

  protected formatAmount(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }
}
