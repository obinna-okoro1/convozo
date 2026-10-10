/**
 * Unit tests for LinkService
 * Covers: getActiveLinks, getCreatorLinks, createLink, updateLink,
 *         deleteLink, reorderLinks, getClickStats.
 * Note: trackClick is fire-and-forget, so we only verify it doesn't throw.
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */


import { TestBed } from '@angular/core/testing';

import { type SpyObj, createSpyObj } from '@testing/test-utils';

import { LinkService } from './link.service';
import { CreatorLink } from '../../../core/models';
import { SupabaseService } from '../../../core/services/supabase.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLink(overrides: Partial<CreatorLink> = {}): CreatorLink {
  return {
    id: 'link-1',
    creator_id: 'creator-1',
    title: 'My YouTube',
    url: 'https://youtube.com/channel/test',
    icon: 'youtube',
    position: 0,
    is_active: true,
    click_count: 0,
    created_at: new Date()
      .toISOString(),
    updated_at: new Date()
      .toISOString(),
    ...overrides,
  };
}

/** Build a standard fluent chain with all common methods. */
function makeChain(finalResult: { data: unknown; error: unknown }): any {
  const chain: any = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn()
      .mockReturnValue(Promise.resolve(finalResult)),
    gte: vi.fn()
      .mockReturnValue(Promise.resolve(finalResult)),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(Promise.resolve(finalResult));
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);

  return chain;
}

// ── Spec ─────────────────────────────────────────────────────────────────────

describe('LinkService', () => {
  let service: LinkService;
  let supabaseSpy: SpyObj<SupabaseService>;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      from: vi.fn(),
      rpc: vi.fn()
        .mockReturnValue(Promise.resolve({ error: null })),
    };

    supabaseSpy = createSpyObj<SupabaseService>([], {
      client: mockClient,
    });

    TestBed.configureTestingModule({
      providers: [LinkService, { provide: SupabaseService, useValue: supabaseSpy }],
    });

    service = TestBed.inject(LinkService);
  });

  it('should be created', () => {
    expect(service)
      .toBeTruthy();
  });

  // ── getActiveLinks ────────────────────────────────────────────────────────

  describe('getActiveLinks()', () => {
    it('returns active links on success', async () => {
      const links = [makeLink()];
      const chain = makeChain({ data: links, error: null });
      mockClient.from.mockReturnValue(chain);

      const result = await service.getActiveLinks('creator-1');

      expect(mockClient.from)
        .toHaveBeenCalledWith('creator_links');
      expect(chain.eq)
        .toHaveBeenCalledWith('creator_id', 'creator-1');
      expect(chain.eq)
        .toHaveBeenCalledWith('is_active', true);
      expect(result.data)
        .toEqual(links);
      expect(result.error)
        .toBeNull();
    });

    it('orders by position ascending', async () => {
      const chain = makeChain({ data: [], error: null });
      mockClient.from.mockReturnValue(chain);

      await service.getActiveLinks('creator-1');

      expect(chain.order)
        .toHaveBeenCalledWith('position', { ascending: true });
    });

    it('returns null data on error', async () => {
      const dbError = { message: 'Not found', code: '404', details: '', hint: '' };
      const chain = makeChain({ data: null, error: dbError });
      mockClient.from.mockReturnValue(chain);

      const result = await service.getActiveLinks('creator-1');

      expect(result.data)
        .toBeNull();
      expect(result.error).not.toBeNull();
    });
  });

  // ── getCreatorLinks ───────────────────────────────────────────────────────

  describe('getCreatorLinks()', () => {
    it('fetches all links including inactive', async () => {
      const links = [makeLink(), makeLink({ id: 'link-2', is_active: false })];
      const chain = makeChain({ data: links, error: null });
      mockClient.from.mockReturnValue(chain);

      const result = await service.getCreatorLinks('creator-1');

      // Should NOT filter by is_active
      expect(chain.eq).not.toHaveBeenCalledWith('is_active', expect.anything());
      expect(result.data)
        .toEqual(links);
    });
  });

  // ── createLink ────────────────────────────────────────────────────────────

  describe('createLink()', () => {
    it('inserts a link and returns it', async () => {
      const newLink = makeLink();
      const chain = makeChain({ data: newLink, error: null });
      mockClient.from.mockReturnValue(chain);

      const payload = {
        title: 'My YouTube',
        url: 'https://youtube.com',
        icon: 'youtube',
        position: 0,
      };
      const result = await service.createLink('creator-1', payload);

      expect(mockClient.from)
        .toHaveBeenCalledWith('creator_links');
      expect(chain.insert)
        .toHaveBeenCalled();
      expect(result.data)
        .toEqual(newLink);
      expect(result.error)
        .toBeNull();
    });
  });

  // ── updateLink ────────────────────────────────────────────────────────────

  describe('updateLink()', () => {
    it('updates a link by id', async () => {
      const updated = makeLink({ title: 'New Title' });
      const chain = makeChain({ data: updated, error: null });
      mockClient.from.mockReturnValue(chain);

      const result = await service.updateLink('link-1', { title: 'New Title' });

      expect(chain.update)
        .toHaveBeenCalledWith({ title: 'New Title' });
      expect(chain.eq)
        .toHaveBeenCalledWith('id', 'link-1');
      expect(result.data)
        .toEqual(updated);
    });

    it('can update is_active to deactivate a link', async () => {
      const updated = makeLink({ is_active: false });
      const chain = makeChain({ data: updated, error: null });
      mockClient.from.mockReturnValue(chain);

      await service.updateLink('link-1', { is_active: false });

      expect(chain.update)
        .toHaveBeenCalledWith({ is_active: false });
    });
  });

  // ── deleteLink ────────────────────────────────────────────────────────────

  describe('deleteLink()', () => {
    it('deletes a link by id', async () => {
      const chain: any = {
        delete: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(Promise.resolve({ error: null })),
      };
      chain.delete.mockReturnValue(chain);
      mockClient.from.mockReturnValue(chain);

      const result = await service.deleteLink('link-1');

      expect(chain.delete)
        .toHaveBeenCalled();
      expect(chain.eq)
        .toHaveBeenCalledWith('id', 'link-1');
      expect(result.error)
        .toBeNull();
    });

    it('returns error on failure', async () => {
      const dbError = { message: 'Delete failed', code: '500', details: '', hint: '' };
      const chain: any = {
        delete: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(Promise.resolve({ error: dbError })),
      };
      chain.delete.mockReturnValue(chain);
      mockClient.from.mockReturnValue(chain);

      const result = await service.deleteLink('link-1');

      expect(result.error).not.toBeNull();
    });
  });

  // ── reorderLinks ──────────────────────────────────────────────────────────

  describe('reorderLinks()', () => {
    it('returns success when all updates succeed', async () => {
      const chain: any = {
        update: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(Promise.resolve({ error: null })),
      };
      chain.update.mockReturnValue(chain);
      mockClient.from.mockReturnValue(chain);

      const result = await service.reorderLinks([
        { id: 'link-1', position: 0 },
        { id: 'link-2', position: 1 },
      ]);

      expect(result.error)
        .toBeNull();
      expect(mockClient.from)
        .toHaveBeenCalledTimes(2);
    });

    it('returns error immediately when an update fails', async () => {
      const dbError = { message: 'Update failed', code: '500', details: '', hint: '' };
      const chain: any = {
        update: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(Promise.resolve({ error: dbError })),
      };
      chain.update.mockReturnValue(chain);
      mockClient.from.mockReturnValue(chain);

      const result = await service.reorderLinks([
        { id: 'link-1', position: 0 },
        { id: 'link-2', position: 1 },
      ]);

      expect(result.error).not.toBeNull();
      // Should stop after first failure
      expect(mockClient.from)
        .toHaveBeenCalledTimes(1);
    });

    it('returns success for empty links array', async () => {
      const result = await service.reorderLinks([]);
      expect(result.error)
        .toBeNull();
      expect(mockClient.from).not.toHaveBeenCalled();
    });
  });

  // ── getClickStats ─────────────────────────────────────────────────────────

  describe('getClickStats()', () => {
    function makeGteChain(rows: unknown[], error: unknown = null): any {
      const ch: any = {
        select: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(null as any),
        gte: vi.fn()
          .mockReturnValue(Promise.resolve({ data: rows, error })),
      };
      ch.select.mockReturnValue(ch);
      ch.eq.mockReturnValue(ch);

      return ch;
    }

    it('aggregates click counts by link_id', async () => {
      const rows = [{ link_id: 'link-1' }, { link_id: 'link-1' }, { link_id: 'link-2' }];
      mockClient.from.mockReturnValue(makeGteChain(rows));

      const result = await service.getClickStats('creator-1');

      expect(result.data)
        .toBeTruthy();
      const data = result.data ?? [];
      const link1 = data.find((r) => r.link_id === 'link-1');
      const link2 = data.find((r) => r.link_id === 'link-2');
      expect(link1?.count)
        .toBe(2);
      expect(link2?.count)
        .toBe(1);
    });

    it('returns empty array when no clicks exist', async () => {
      mockClient.from.mockReturnValue(makeGteChain([]));

      const result = await service.getClickStats('creator-1');

      expect(result.data)
        .toEqual([]);
    });

    it('returns error when query fails', async () => {
      const dbError = { message: 'Query failed', code: '500', details: '', hint: '' };
      const ch: any = {
        select: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(null as any),
        gte: vi.fn()
          .mockReturnValue(Promise.resolve({ data: null, error: dbError })),
      };
      ch.select.mockReturnValue(ch);
      ch.eq.mockReturnValue(ch);
      mockClient.from.mockReturnValue(ch);

      const result = await service.getClickStats('creator-1');

      expect(result.data)
        .toBeNull();
      expect(result.error).not.toBeNull();
    });
  });
});
