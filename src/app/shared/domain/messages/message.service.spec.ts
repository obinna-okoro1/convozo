/**
 * Unit tests for MessageService
 * Covers: getMessages, calculateStats, replyToMessage, markAsHandled,
 *         deleteMessage, subscribeToMessages, unsubscribeFromMessages.
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */


import { TestBed } from '@angular/core/testing';

import { type SpyObj, createSpyObj } from '@testing/test-utils';
import { EdgeFunctionService } from 'app/core/services/edge-function.service';

import { MessageService } from './message.service';
import { Message } from '../../../core/models';
import { SupabaseService } from '../../../core/services/supabase.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<Message> = {}): Message {
  const now = new Date()
    .toISOString();

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
    conversation_token: 'test-token-1',
    created_at: now,
    updated_at: now,
    refunded_at: null,
    ...overrides,
  };
}

/** Build a fluent Supabase query chain spy returning the given final result. */
function makeQueryChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn()
      .mockReturnValue(null as any),
    eq: vi.fn()
      .mockReturnValue(null as any),
    neq: vi.fn()
      .mockReturnValue(null as any),
    order: vi.fn()
      .mockReturnValue(Promise.resolve(result)),
    update: vi.fn()
      .mockReturnValue(null as any),
    delete: vi.fn()
      .mockReturnValue(null as any),
    single: vi.fn()
      .mockReturnValue(Promise.resolve(result)),
  };

  // Make each method return the chain itself so calls can be chained.
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.neq.mockReturnValue(chain);
  chain.order.mockReturnValue(Promise.resolve(result));
  chain.update.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);

  return chain;
}

// ── Spec ─────────────────────────────────────────────────────────────────────

describe('MessageService', () => {
  let service: MessageService;
  let supabaseSpy: SpyObj<SupabaseService>;
  let edgeFunctionsSpy: SpyObj<EdgeFunctionService>;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      from: vi.fn(),
      channel: vi.fn(),
      removeChannel: vi.fn()
        .mockReturnValue(Promise.resolve()),
    };

    supabaseSpy = createSpyObj<SupabaseService>([], {
      client: mockClient,
    });
    edgeFunctionsSpy = createSpyObj<EdgeFunctionService>(['sendReplyEmail']);

    TestBed.configureTestingModule({
      providers: [
        MessageService,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: EdgeFunctionService, useValue: edgeFunctionsSpy },
      ],
    });

    service = TestBed.inject(MessageService);
  });

  it('should be created', () => {
    expect(service)
      .toBeTruthy();
  });

  // ── calculateStats ────────────────────────────────────────────────────────

  describe('calculateStats()', () => {
    it('returns zeros for an empty array', () => {
      const stats = service.calculateStats([]);
      expect(stats.total)
        .toBe(0);
      expect(stats.handled)
        .toBe(0);
      expect(stats.unhandled)
        .toBe(0);
      expect(stats.totalRevenue)
        .toBe(0);
    });

    it('counts total messages', () => {
      const messages = [makeMessage(), makeMessage({ id: 'msg-2' })];
      expect(service.calculateStats(messages).total)
        .toBe(2);
    });

    it('correctly splits handled and unhandled counts', () => {
      const messages = [
        makeMessage({ is_handled: true }),
        makeMessage({ id: 'msg-2', is_handled: false }),
        makeMessage({ id: 'msg-3', is_handled: false }),
      ];
      const stats = service.calculateStats(messages);
      expect(stats.handled)
        .toBe(1);
      expect(stats.unhandled)
        .toBe(2);
    });

    it('converts revenue from cents to dollars', () => {
      const messages = [
        makeMessage({ amount_paid: 1000 }), // $10.00
        makeMessage({ id: 'msg-2', amount_paid: 2500 }), // $25.00
      ];
      expect(service.calculateStats(messages).totalRevenue)
        .toBeCloseTo(35.0);
    });

    it('handles null amount_paid as zero', () => {
      const messages = [makeMessage({ amount_paid: null as unknown as number })];
      expect(service.calculateStats(messages).totalRevenue)
        .toBe(0);
    });
  });

  // ── getMessages ───────────────────────────────────────────────────────────

  describe('getMessages()', () => {
    it('returns messages from supabase on success', async () => {
      const messages = [makeMessage()];
      const chain = makeQueryChain({ data: messages, error: null });
      mockClient.from.mockReturnValue(chain);

      const result = await service.getMessages('creator-1');

      expect(mockClient.from)
        .toHaveBeenCalledWith('messages');
      expect(result.data)
        .toEqual(messages);
      expect(result.error)
        .toBeNull();
    });

    it('returns error when supabase call fails', async () => {
      const dbError = { message: 'DB error', code: '500', details: '', hint: '' };
      const chain = makeQueryChain({ data: null, error: dbError });
      mockClient.from.mockReturnValue(chain);

      const result = await service.getMessages('creator-1');

      expect(result.data)
        .toBeNull();
      expect(result.error).not.toBeNull();
    });

    it('queries with neq filter to exclude call type messages', async () => {
      const chain = makeQueryChain({ data: [], error: null });
      mockClient.from.mockReturnValue(chain);

      await service.getMessages('creator-1');

      expect(chain.neq)
        .toHaveBeenCalledWith('message_type', 'call');
    });

    it('orders by created_at descending', async () => {
      const chain = makeQueryChain({ data: [], error: null });
      mockClient.from.mockReturnValue(chain);

      await service.getMessages('creator-1');

      expect(chain.order)
        .toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });

  // ── replyToMessage ────────────────────────────────────────────────────────

  describe('replyToMessage()', () => {
    it('returns success when sendReplyEmail resolves without error', async () => {
      edgeFunctionsSpy.sendReplyEmail.mockReturnValue(
        Promise.resolve({ data: undefined, error: undefined }),
      );

      const result = await service.replyToMessage('msg-1', 'Thanks!', 'user@test.com');

      expect(result.success)
        .toBe(true);
      expect(result.error)
        .toBeUndefined();
    });

    it('calls sendReplyEmail with messageId and reply content', async () => {
      edgeFunctionsSpy.sendReplyEmail.mockReturnValue(
        Promise.resolve({ data: undefined, error: undefined }),
      );

      await service.replyToMessage('msg-1', 'Thanks!', 'user@test.com');


      expect(edgeFunctionsSpy.sendReplyEmail)
        .toHaveBeenCalledWith('msg-1', 'Thanks!');
    });

    it('returns failure when sendReplyEmail returns an error', async () => {
      const edgeError = { message: 'Edge function failed' };
      edgeFunctionsSpy.sendReplyEmail.mockReturnValue(
        Promise.resolve({ data: undefined, error: edgeError }),
      );

      const result = await service.replyToMessage('msg-1', 'reply', 'user@test.com');

      expect(result.success)
        .toBe(false);
      expect(result.error)
        .toBeTruthy();
    });

    it('returns failure when sendReplyEmail throws', async () => {
      edgeFunctionsSpy.sendReplyEmail.mockReturnValue(Promise.reject(new Error('Network error')));

      const result = await service.replyToMessage('msg-1', 'reply', 'user@test.com');

      expect(result.success)
        .toBe(false);
      expect(result.error)
        .toContain('Network error');
    });
  });

  // ── markAsHandled ─────────────────────────────────────────────────────────

  describe('markAsHandled()', () => {
    it('calls supabase update with is_handled = true', async () => {
      const chain: any = {
        update: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(Promise.resolve({ error: null })),
      };
      chain.update.mockReturnValue(chain);
      mockClient.from.mockReturnValue(chain);

      const result = await service.markAsHandled('msg-1');

      expect(mockClient.from)
        .toHaveBeenCalledWith('messages');
      expect(chain.update)
        .toHaveBeenCalledWith({ is_handled: true });
      expect(chain.eq)
        .toHaveBeenCalledWith('id', 'msg-1');
      expect(result.error)
        .toBeNull();
    });

    it('returns error when update fails', async () => {
      const dbError = { message: 'Update failed', code: '500', details: '', hint: '' };
      const chain: any = {
        update: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(Promise.resolve({ error: dbError })),
      };
      chain.update.mockReturnValue(chain);
      mockClient.from.mockReturnValue(chain);

      const result = await service.markAsHandled('msg-1');

      expect(result.error).not.toBeNull();
    });
  });

  // ── deleteMessage ─────────────────────────────────────────────────────────

  describe('deleteMessage()', () => {
    it('calls supabase delete on messages table', async () => {
      const chain: any = {
        delete: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(Promise.resolve({ error: null })),
      };
      chain.delete.mockReturnValue(chain);
      mockClient.from.mockReturnValue(chain);

      const result = await service.deleteMessage('msg-1');

      expect(mockClient.from)
        .toHaveBeenCalledWith('messages');
      expect(chain.delete)
        .toHaveBeenCalled();
      expect(chain.eq)
        .toHaveBeenCalledWith('id', 'msg-1');
      expect(result.error)
        .toBeNull();
    });

    it('returns error when delete fails', async () => {
      const dbError = { message: 'Delete failed', code: '500', details: '', hint: '' };
      const chain: any = {
        delete: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(Promise.resolve({ error: dbError })),
      };
      chain.delete.mockReturnValue(chain);
      mockClient.from.mockReturnValue(chain);

      const result = await service.deleteMessage('msg-1');

      expect(result.error).not.toBeNull();
    });
  });

  // ── getReplies ────────────────────────────────────────────────────────────

  describe('getReplies()', () => {
    it('fetches replies for a message from supabase on success', async () => {
      const replies = [
        { id: 'r-1', message_id: 'msg-1', sender_type: 'expert' as const, content: 'Hi back', created_at: new Date()
          .toISOString() },
      ];
      const chain = makeQueryChain({ data: replies, error: null });
      mockClient.from.mockReturnValue(chain);

      const result = await service.getReplies('msg-1');

      expect(mockClient.from)
        .toHaveBeenCalledWith('message_replies');
      expect(result.data)
        .toEqual(replies);
      expect(result.error)
        .toBeNull();
    });

    it('returns error when supabase call fails', async () => {
      const dbError = { message: 'DB error', code: '500', details: '', hint: '' };
      const chain = makeQueryChain({ data: null, error: dbError });
      mockClient.from.mockReturnValue(chain);

      const result = await service.getReplies('msg-1');

      expect(result.data)
        .toBeNull();
      expect(result.error).not.toBeNull();
    });

    it('filters by message_id', async () => {
      const chain = makeQueryChain({ data: [], error: null });
      mockClient.from.mockReturnValue(chain);

      await service.getReplies('msg-abc');

      expect(chain.eq)
        .toHaveBeenCalledWith('message_id', 'msg-abc');
    });

    it('orders replies ascending (chronological)', async () => {
      const chain = makeQueryChain({ data: [], error: null });
      mockClient.from.mockReturnValue(chain);

      await service.getReplies('msg-1');

      expect(chain.order)
        .toHaveBeenCalledWith('created_at', { ascending: true });
    });
  });

  // ── subscribeToReplies ────────────────────────────────────────────────────

  describe('subscribeToReplies()', () => {
    it('creates a channel named replies:<messageId>', () => {
      const mockChannel = {
        on: vi.fn()
          .mockReturnValue(null as any),
        subscribe: vi.fn()
          .mockReturnValue({}),
      };
      mockChannel.on.mockReturnValue(mockChannel);
      mockClient.channel.mockReturnValue(mockChannel);

      service.subscribeToReplies('msg-1', vi.fn());

      expect(mockClient.channel)
        .toHaveBeenCalledWith('replies:msg-1');
    });

    it('subscribes to INSERT events on message_replies', () => {
      const mockChannel = {
        on: vi.fn()
          .mockReturnValue(null as any),
        subscribe: vi.fn()
          .mockReturnValue({}),
      };
      mockChannel.on.mockReturnValue(mockChannel);
      mockClient.channel.mockReturnValue(mockChannel);

      service.subscribeToReplies('msg-1', vi.fn());

      const callArgs = mockChannel.on.mock.calls[0] as [string, object, ...unknown[]];
      const filterArg = callArgs[1] as { event: string; table: string; filter: string };
      expect(callArgs[0])
        .toBe('postgres_changes');
      expect(filterArg.event)
        .toBe('INSERT');
      expect(filterArg.table)
        .toBe('message_replies');
      expect(filterArg.filter)
        .toBe('message_id=eq.msg-1');
    });

    it('calls subscribe() on the channel', () => {
      const mockChannel = {
        on: vi.fn()
          .mockReturnValue(null as any),
        subscribe: vi.fn()
          .mockReturnValue({}),
      };
      mockChannel.on.mockReturnValue(mockChannel);
      mockClient.channel.mockReturnValue(mockChannel);

      service.subscribeToReplies('msg-1', vi.fn());

      expect(mockChannel.subscribe)
        .toHaveBeenCalled();
    });
  });

  // ── unsubscribeFromReplies ────────────────────────────────────────────────

  describe('unsubscribeFromReplies()', () => {
    it('calls removeChannel with the provided channel', () => {
      const mockChannel = {} as any;
      service.unsubscribeFromReplies(mockChannel);
      expect(mockClient.removeChannel)
        .toHaveBeenCalledWith(mockChannel);
    });
  });

  // ── subscribeToMessages ───────────────────────────────────────────────────

  describe('subscribeToMessages()', () => {
    it('creates a channel and subscribes', () => {
      const mockChannel = {
        on: vi.fn()
          .mockReturnValue(null as any),
        subscribe: vi.fn()
          .mockReturnValue({}),
      };
      mockChannel.on.mockReturnValue(mockChannel);
      mockClient.channel.mockReturnValue(mockChannel);

      service.subscribeToMessages('creator-1', vi.fn());

      expect(mockClient.channel)
        .toHaveBeenCalledWith('messages:creator-1');
      expect(mockChannel.on)
        .toHaveBeenCalled();
      expect(mockChannel.subscribe)
        .toHaveBeenCalled();
    });
  });

  // ── unsubscribeFromMessages ───────────────────────────────────────────────

  describe('unsubscribeFromMessages()', () => {
    it('calls removeChannel with the provided channel', () => {
      const mockChannel = {} as any;
      service.unsubscribeFromMessages(mockChannel);
      expect(mockClient.removeChannel)
        .toHaveBeenCalledWith(mockChannel);
    });
  });
});
