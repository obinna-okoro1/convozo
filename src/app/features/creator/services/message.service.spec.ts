/**
 * Unit tests for MessageService
 * Covers: getMessages, calculateStats, replyToMessage, markAsHandled,
 *         deleteMessage, subscribeToMessages, unsubscribeFromMessages.
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { TestBed } from '@angular/core/testing';
import { MessageService } from './message.service';
import { Message } from '../../../core/models';
import { SupabaseService } from '../../../core/services/supabase.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<Message> = {}): Message {
  const now = new Date().toISOString();
  return {
    id: 'msg-1',
    creator_id: 'creator-1',
    sender_name: 'Alice',
    sender_email: 'alice@example.com',
    message_content: 'Hello',
    amount_paid: 1000,
    message_type: 'message',
    is_handled: false,
    reply_content: null,
    replied_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/** Build a fluent Supabase query chain spy returning the given final result. */
function makeQueryChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: jasmine.createSpy('select').and.returnValue(null as any),
    eq: jasmine.createSpy('eq').and.returnValue(null as any),
    neq: jasmine.createSpy('neq').and.returnValue(null as any),
    order: jasmine.createSpy('order').and.returnValue(Promise.resolve(result)),
    update: jasmine.createSpy('update').and.returnValue(null as any),
    delete: jasmine.createSpy('delete').and.returnValue(null as any),
    single: jasmine.createSpy('single').and.returnValue(Promise.resolve(result)),
  };

  // Make each method return the chain itself so calls can be chained.
  chain.select.and.returnValue(chain);
  chain.eq.and.returnValue(chain);
  chain.neq.and.returnValue(chain);
  chain.order.and.returnValue(Promise.resolve(result));
  chain.update.and.returnValue(chain);
  chain.delete.and.returnValue(chain);

  return chain;
}

// ── Spec ─────────────────────────────────────────────────────────────────────

describe('MessageService', () => {
  let service: MessageService;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      from: jasmine.createSpy('from'),
      channel: jasmine.createSpy('channel'),
      removeChannel: jasmine.createSpy('removeChannel').and.returnValue(Promise.resolve()),
    };

    supabaseSpy = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['sendReplyEmail'], {
      client: mockClient,
    });

    TestBed.configureTestingModule({
      providers: [MessageService, { provide: SupabaseService, useValue: supabaseSpy }],
    });

    service = TestBed.inject(MessageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── calculateStats ────────────────────────────────────────────────────────

  describe('calculateStats()', () => {
    it('returns zeros for an empty array', () => {
      const stats = service.calculateStats([]);
      expect(stats.total).toBe(0);
      expect(stats.handled).toBe(0);
      expect(stats.unhandled).toBe(0);
      expect(stats.totalRevenue).toBe(0);
    });

    it('counts total messages', () => {
      const messages = [makeMessage(), makeMessage({ id: 'msg-2' })];
      expect(service.calculateStats(messages).total).toBe(2);
    });

    it('correctly splits handled and unhandled counts', () => {
      const messages = [
        makeMessage({ is_handled: true }),
        makeMessage({ id: 'msg-2', is_handled: false }),
        makeMessage({ id: 'msg-3', is_handled: false }),
      ];
      const stats = service.calculateStats(messages);
      expect(stats.handled).toBe(1);
      expect(stats.unhandled).toBe(2);
    });

    it('converts revenue from cents to dollars', () => {
      const messages = [
        makeMessage({ amount_paid: 1000 }), // $10.00
        makeMessage({ id: 'msg-2', amount_paid: 2500 }), // $25.00
      ];
      expect(service.calculateStats(messages).totalRevenue).toBeCloseTo(35.0);
    });

    it('handles null amount_paid as zero', () => {
      const messages = [makeMessage({ amount_paid: null as unknown as number })];
      expect(service.calculateStats(messages).totalRevenue).toBe(0);
    });
  });

  // ── getMessages ───────────────────────────────────────────────────────────

  describe('getMessages()', () => {
    it('returns messages from supabase on success', async () => {
      const messages = [makeMessage()];
      const chain = makeQueryChain({ data: messages, error: null });
      mockClient.from.and.returnValue(chain);

      const result = await service.getMessages('creator-1');

      expect(mockClient.from).toHaveBeenCalledWith('messages');
      expect(result.data).toEqual(messages);
      expect(result.error).toBeNull();
    });

    it('returns error when supabase call fails', async () => {
      const dbError = { message: 'DB error', code: '500', details: '', hint: '' };
      const chain = makeQueryChain({ data: null, error: dbError });
      mockClient.from.and.returnValue(chain);

      const result = await service.getMessages('creator-1');

      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    });

    it('queries with neq filter to exclude call type messages', async () => {
      const chain = makeQueryChain({ data: [], error: null });
      mockClient.from.and.returnValue(chain);

      await service.getMessages('creator-1');

      expect(chain.neq).toHaveBeenCalledWith('message_type', 'call');
    });

    it('orders by created_at descending', async () => {
      const chain = makeQueryChain({ data: [], error: null });
      mockClient.from.and.returnValue(chain);

      await service.getMessages('creator-1');

      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });

  // ── replyToMessage ────────────────────────────────────────────────────────

  describe('replyToMessage()', () => {
    it('returns success when sendReplyEmail resolves without error', async () => {
      supabaseSpy.sendReplyEmail.and.returnValue(
        Promise.resolve({ data: undefined, error: undefined }),
      );

      const result = await service.replyToMessage('msg-1', 'Thanks!', 'user@test.com');

      expect(result.success).toBeTrue();
      expect(result.error).toBeUndefined();
    });

    it('calls sendReplyEmail with messageId and reply content', async () => {
      supabaseSpy.sendReplyEmail.and.returnValue(
        Promise.resolve({ data: undefined, error: undefined }),
      );

      await service.replyToMessage('msg-1', 'Thanks!', 'user@test.com');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(supabaseSpy.sendReplyEmail).toHaveBeenCalledWith('msg-1', 'Thanks!');
    });

    it('returns failure when sendReplyEmail returns an error', async () => {
      const edgeError = { message: 'Edge function failed' };
      supabaseSpy.sendReplyEmail.and.returnValue(
        Promise.resolve({ data: undefined, error: edgeError }),
      );

      const result = await service.replyToMessage('msg-1', 'reply', 'user@test.com');

      expect(result.success).toBeFalse();
      expect(result.error).toBeTruthy();
    });

    it('returns failure when sendReplyEmail throws', async () => {
      supabaseSpy.sendReplyEmail.and.returnValue(Promise.reject(new Error('Network error')));

      const result = await service.replyToMessage('msg-1', 'reply', 'user@test.com');

      expect(result.success).toBeFalse();
      expect(result.error).toContain('Network error');
    });
  });

  // ── markAsHandled ─────────────────────────────────────────────────────────

  describe('markAsHandled()', () => {
    it('calls supabase update with is_handled = true', async () => {
      const chain: any = {
        update: jasmine.createSpy('update').and.returnValue(null as any),
        eq: jasmine.createSpy('eq').and.returnValue(Promise.resolve({ error: null })),
      };
      chain.update.and.returnValue(chain);
      mockClient.from.and.returnValue(chain);

      const result = await service.markAsHandled('msg-1');

      expect(mockClient.from).toHaveBeenCalledWith('messages');
      expect(chain.update).toHaveBeenCalledWith({ is_handled: true });
      expect(chain.eq).toHaveBeenCalledWith('id', 'msg-1');
      expect(result.error).toBeNull();
    });

    it('returns error when update fails', async () => {
      const dbError = { message: 'Update failed', code: '500', details: '', hint: '' };
      const chain: any = {
        update: jasmine.createSpy('update').and.returnValue(null as any),
        eq: jasmine.createSpy('eq').and.returnValue(Promise.resolve({ error: dbError })),
      };
      chain.update.and.returnValue(chain);
      mockClient.from.and.returnValue(chain);

      const result = await service.markAsHandled('msg-1');

      expect(result.error).not.toBeNull();
    });
  });

  // ── deleteMessage ─────────────────────────────────────────────────────────

  describe('deleteMessage()', () => {
    it('calls supabase delete on messages table', async () => {
      const chain: any = {
        delete: jasmine.createSpy('delete').and.returnValue(null as any),
        eq: jasmine.createSpy('eq').and.returnValue(Promise.resolve({ error: null })),
      };
      chain.delete.and.returnValue(chain);
      mockClient.from.and.returnValue(chain);

      const result = await service.deleteMessage('msg-1');

      expect(mockClient.from).toHaveBeenCalledWith('messages');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'msg-1');
      expect(result.error).toBeNull();
    });

    it('returns error when delete fails', async () => {
      const dbError = { message: 'Delete failed', code: '500', details: '', hint: '' };
      const chain: any = {
        delete: jasmine.createSpy('delete').and.returnValue(null as any),
        eq: jasmine.createSpy('eq').and.returnValue(Promise.resolve({ error: dbError })),
      };
      chain.delete.and.returnValue(chain);
      mockClient.from.and.returnValue(chain);

      const result = await service.deleteMessage('msg-1');

      expect(result.error).not.toBeNull();
    });
  });

  // ── subscribeToMessages ───────────────────────────────────────────────────

  describe('subscribeToMessages()', () => {
    it('creates a channel and subscribes', () => {
      const mockChannel = {
        on: jasmine.createSpy('on').and.returnValue(null as any),
        subscribe: jasmine.createSpy('subscribe').and.returnValue({}),
      };
      mockChannel.on.and.returnValue(mockChannel);
      mockClient.channel.and.returnValue(mockChannel);

      service.subscribeToMessages('creator-1', jasmine.createSpy());

      expect(mockClient.channel).toHaveBeenCalledWith('messages:creator-1');
      expect(mockChannel.on).toHaveBeenCalled();
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });
  });

  // ── unsubscribeFromMessages ───────────────────────────────────────────────

  describe('unsubscribeFromMessages()', () => {
    it('calls removeChannel with the provided channel', () => {
      const mockChannel = {} as any;
      service.unsubscribeFromMessages(mockChannel);
      expect(mockClient.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });
});
