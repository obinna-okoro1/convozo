import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService, Creator, CreatorSettings, Message } from '../../shared/supabase.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  creator = signal<Creator | null>(null);
  settings = signal<CreatorSettings | null>(null);
  messages = signal<Message[]>([]);
  selectedMessage = signal<Message | null>(null);
  
  loading = signal(true);
  error = signal<string | null>(null);
  
  // Reply modal
  showReplyModal = signal(false);
  replyContent = signal('');
  sendingReply = signal(false);
  
  // Filter
  filterStatus = signal<'all' | 'unhandled' | 'handled'>('all');

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    const user = this.supabaseService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/auth/login']);
      return;
    }

    await this.loadDashboardData(user.id);
  }

  async loadDashboardData(userId: string) {
    try {
      // Get creator profile
      const { data: creatorData, error: creatorError } = await this.supabaseService.getCreatorByUserId(userId);
      
      if (creatorError || !creatorData) {
        this.router.navigate(['/creator/onboarding']);
        return;
      }

      this.creator.set(creatorData);

      // Get settings
      const { data: settingsData } = await this.supabaseService.getCreatorSettings(creatorData.id);
      if (settingsData) {
        this.settings.set(settingsData);
      }

      // Get messages
      await this.loadMessages(creatorData.id);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      this.loading.set(false);
    }
  }

  async loadMessages(creatorId: string) {
    const { data: messagesData } = await this.supabaseService.getMessages(creatorId);
    if (messagesData) {
      this.messages.set(messagesData);
    }
  }

  filteredMessages() {
    const msgs = this.messages();
    if (this.filterStatus() === 'unhandled') {
      return msgs.filter(m => !m.is_handled);
    } else if (this.filterStatus() === 'handled') {
      return msgs.filter(m => m.is_handled);
    }
    return msgs;
  }

  get stats() {
    const msgs = this.messages();
    return {
      total: msgs.length,
      unhandled: msgs.filter(m => !m.is_handled).length,
      handled: msgs.filter(m => m.is_handled).length,
      totalRevenue: msgs.reduce((sum, m) => sum + m.amount_paid, 0) / 100,
    };
  }

  selectMessage(message: Message) {
    this.selectedMessage.set(message);
  }

  openReplyModal(message: Message) {
    this.selectedMessage.set(message);
    this.replyContent.set(message.reply_content || '');
    this.showReplyModal.set(true);
  }

  closeReplyModal() {
    this.showReplyModal.set(false);
    this.replyContent.set('');
    this.sendingReply.set(false);
  }

  async sendReply() {
    const message = this.selectedMessage();
    if (!message || !this.replyContent().trim()) {
      return;
    }

    this.sendingReply.set(true);

    try {
      // Send reply via Edge Function
      const { error: emailError } = await this.supabaseService.sendReplyEmail(
        message.id,
        this.replyContent()
      );

      if (emailError) {
        throw emailError;
      }

      // Reload messages
      if (this.creator()) {
        await this.loadMessages(this.creator()!.id);
      }

      this.closeReplyModal();
    } catch (err) {
      alert('Failed to send reply: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      this.sendingReply.set(false);
    }
  }

  async markAsHandled(message: Message) {
    try {
      await this.supabaseService.updateMessage(message.id, { is_handled: true });
      
      // Reload messages
      if (this.creator()) {
        await this.loadMessages(this.creator()!.id);
      }
    } catch (err) {
      alert('Failed to mark as handled');
    }
  }

  async signOut() {
    await this.supabaseService.signOut();
    this.router.navigate(['/home']);
  }

  copyPublicUrl() {
    const url = `${window.location.origin}/${this.creator()?.slug}`;
    navigator.clipboard.writeText(url);
    alert('URL copied to clipboard!');
  }

  get publicUrl() {
    return `${window.location.origin}/${this.creator()?.slug}`;
  }
}
