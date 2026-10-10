/**
 * Unit tests for AvailabilityService
 * Covers: getAvailabilitySlots, saveAvailabilitySlots (full replace),
 *         addAvailabilitySlot, deleteAvailabilitySlot, toggleAvailabilitySlot.
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */


import { TestBed } from '@angular/core/testing';

import { type SpyObj, createSpyObj } from '@testing/test-utils';

import { AvailabilityService } from './availability.service';
import { AvailabilitySlot } from '../../../core/models';
import { SupabaseService } from '../../../core/services/supabase.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSlot(overrides: Partial<AvailabilitySlot> = {}): AvailabilitySlot {
  return {
    id: 'slot-1',
    creator_id: 'creator-1',
    day_of_week: 1, // Monday
    start_time: '09:00',
    end_time: '17:00',
    is_active: true,
    created_at: new Date()
      .toISOString(),
    updated_at: new Date()
      .toISOString(),
    ...overrides,
  };
}

function makeSlotPayload(
  overrides: Partial<Omit<AvailabilitySlot, 'id' | 'created_at' | 'updated_at'>> = {},
): Omit<AvailabilitySlot, 'id' | 'created_at' | 'updated_at'> {
  return {
    creator_id: 'creator-1',
    day_of_week: 1,
    start_time: '09:00',
    end_time: '17:00',
    is_active: true,
    ...overrides,
  };
}

// ── Spec ─────────────────────────────────────────────────────────────────────

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let supabaseSpy: SpyObj<SupabaseService>;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      from: vi.fn(),
    };

    supabaseSpy = createSpyObj<SupabaseService>([], {
      client: mockClient,
    });

    TestBed.configureTestingModule({
      providers: [AvailabilityService, { provide: SupabaseService, useValue: supabaseSpy }],
    });

    service = TestBed.inject(AvailabilityService);
  });

  it('should be created', () => {
    expect(service)
      .toBeTruthy();
  });

  // ── getAvailabilitySlots ──────────────────────────────────────────────────

  describe('getAvailabilitySlots()', () => {
    it('returns slots on success', async () => {
      const slots = [makeSlot()];
      const chain: any = {
        select: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(null as any),
        order: vi.fn()
          .mockReturnValue(null as any),
      };
      // First order call returns chain, second returns final promise
      let orderCallCount = 0;
      chain.select.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      chain.order.mockImplementation(() => {
        orderCallCount++;

        if (orderCallCount === 1) {return chain;}

        return Promise.resolve({ data: slots, error: null });
      });
      mockClient.from.mockReturnValue(chain);

      const result = await service.getAvailabilitySlots('creator-1');

      expect(mockClient.from)
        .toHaveBeenCalledWith('availability_slots');
      expect(result.data)
        .toEqual(slots);
      expect(result.error)
        .toBeNull();
    });

    it('returns error when query fails', async () => {
      const dbError = { message: 'DB error', code: '500', details: '', hint: '' };
      const chain: any = {
        select: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(null as any),
        order: vi.fn()
          .mockReturnValue(null as any),
      };
      let orderCallCount = 0;
      chain.select.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      chain.order.mockImplementation(() => {
        orderCallCount++;

        if (orderCallCount === 1) {return chain;}

        return Promise.resolve({ data: null, error: dbError });
      });
      mockClient.from.mockReturnValue(chain);

      const result = await service.getAvailabilitySlots('creator-1');

      expect(result.data)
        .toBeNull();
      expect(result.error).not.toBeNull();
    });

    it('orders by day_of_week ascending, then start_time ascending', async () => {
      const chain: any = {
        select: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(null as any),
        order: vi.fn()
          .mockReturnValue(null as any),
      };
      chain.select.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      let orderCallCount = 0;
      chain.order.mockImplementation((...args: unknown[]) => {
        orderCallCount++;

        if (orderCallCount === 1) {
          expect(args[0])
            .toBe('day_of_week');

          return chain;
        }
        expect(args[0])
          .toBe('start_time');

        return Promise.resolve({ data: [], error: null });
      });
      mockClient.from.mockReturnValue(chain);

      await service.getAvailabilitySlots('creator-1');
      expect(orderCallCount)
        .toBe(2);
    });
  });

  // ── saveAvailabilitySlots ─────────────────────────────────────────────────

  describe('saveAvailabilitySlots()', () => {
    it('returns success when delete and insert both succeed', async () => {
      let callIndex = 0;
      const deleteChain: any = {
        delete: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(Promise.resolve({ error: null })),
      };
      deleteChain.delete.mockReturnValue(deleteChain);

      const insertChain: any = {
        insert: vi.fn()
          .mockReturnValue(Promise.resolve({ error: null })),
      };

      mockClient.from.mockImplementation(() => {
        callIndex++;

        return callIndex === 1 ? deleteChain : insertChain;
      });

      const slots = [makeSlotPayload()];
      const result = await service.saveAvailabilitySlots('creator-1', slots);

      expect(result.success)
        .toBe(true);
      expect(result.error)
        .toBeUndefined();
    });

    it('calls delete before insert (full replace pattern)', async () => {
      const callOrder: string[] = [];
      const deleteChain: any = {
        delete: vi.fn()
          .mockImplementation(() => {
            callOrder.push('delete');

            return deleteChain;
          }),
        eq: vi.fn()
          .mockReturnValue(Promise.resolve({ error: null })),
      };
      const insertChain: any = {
        insert: vi.fn()
          .mockImplementation(() => {
            callOrder.push('insert');

            return Promise.resolve({ error: null });
          }),
      };

      let callIndex = 0;
      mockClient.from.mockImplementation(() => {
        callIndex++;

        return callIndex === 1 ? deleteChain : insertChain;
      });

      await service.saveAvailabilitySlots('creator-1', [makeSlotPayload()]);

      expect(callOrder[0])
        .toBe('delete');
      expect(callOrder[1])
        .toBe('insert');
    });

    it('skips insert when slots array is empty', async () => {
      const deleteChain: any = {
        delete: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(Promise.resolve({ error: null })),
      };
      deleteChain.delete.mockReturnValue(deleteChain);
      mockClient.from.mockReturnValue(deleteChain);

      const result = await service.saveAvailabilitySlots('creator-1', []);

      // from() called only once (for delete), not twice
      expect(mockClient.from)
        .toHaveBeenCalledTimes(1);
      expect(result.success)
        .toBe(true);
    });

    it('returns failure when delete fails', async () => {
      const dbError = new Error('Delete failed');
      const deleteChain: any = {
        delete: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(Promise.resolve({ error: dbError })),
      };
      deleteChain.delete.mockReturnValue(deleteChain);
      mockClient.from.mockReturnValue(deleteChain);

      const result = await service.saveAvailabilitySlots('creator-1', [makeSlotPayload()]);

      expect(result.success)
        .toBe(false);
      expect(result.error)
        .toBeTruthy();
    });

    it('returns failure when insert fails', async () => {
      const insertError = new Error('Insert failed');
      let callIndex = 0;
      const deleteChain: any = {
        delete: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(Promise.resolve({ error: null })),
      };
      deleteChain.delete.mockReturnValue(deleteChain);
      const insertChain: any = {
        insert: vi.fn()
          .mockReturnValue(Promise.resolve({ error: insertError })),
      };

      mockClient.from.mockImplementation(() => {
        callIndex++;

        return callIndex === 1 ? deleteChain : insertChain;
      });

      const result = await service.saveAvailabilitySlots('creator-1', [makeSlotPayload()]);

      expect(result.success)
        .toBe(false);
      expect(result.error)
        .toContain('Insert failed');
    });
  });

  // ── addAvailabilitySlot ───────────────────────────────────────────────────

  describe('addAvailabilitySlot()', () => {
    it('inserts a slot and returns it', async () => {
      const newSlot = makeSlot();
      const chain: any = {
        insert: vi.fn()
          .mockReturnValue(null as any),
        select: vi.fn()
          .mockReturnValue(null as any),
        single: vi.fn()
          .mockReturnValue(Promise.resolve({ data: newSlot, error: null })),
      };
      chain.insert.mockReturnValue(chain);
      chain.select.mockReturnValue(chain);
      mockClient.from.mockReturnValue(chain);

      const payload = makeSlotPayload();
      const result = await service.addAvailabilitySlot(payload);

      expect(mockClient.from)
        .toHaveBeenCalledWith('availability_slots');
      expect(chain.insert)
        .toHaveBeenCalledWith(payload);
      expect(result.data)
        .toEqual(newSlot);
      expect(result.error)
        .toBeNull();
    });
  });

  // ── deleteAvailabilitySlot ────────────────────────────────────────────────

  describe('deleteAvailabilitySlot()', () => {
    it('deletes a slot by id', async () => {
      const chain: any = {
        delete: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(Promise.resolve({ error: null })),
      };
      chain.delete.mockReturnValue(chain);
      mockClient.from.mockReturnValue(chain);

      const result = await service.deleteAvailabilitySlot('slot-1');

      expect(mockClient.from)
        .toHaveBeenCalledWith('availability_slots');
      expect(chain.eq)
        .toHaveBeenCalledWith('id', 'slot-1');
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

      const result = await service.deleteAvailabilitySlot('slot-1');

      expect(result.error).not.toBeNull();
    });
  });

  // ── toggleAvailabilitySlot ────────────────────────────────────────────────

  describe('toggleAvailabilitySlot()', () => {
    it('updates is_active to true', async () => {
      const updatedSlot = makeSlot({ is_active: true });
      const chain: any = {
        update: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(null as any),
        select: vi.fn()
          .mockReturnValue(null as any),
        single: vi.fn()
          .mockReturnValue(Promise.resolve({ data: updatedSlot, error: null })),
      };
      chain.update.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      chain.select.mockReturnValue(chain);
      mockClient.from.mockReturnValue(chain);

      const result = await service.toggleAvailabilitySlot('slot-1', true);

      expect(chain.update)
        .toHaveBeenCalledWith({ is_active: true });
      expect(chain.eq)
        .toHaveBeenCalledWith('id', 'slot-1');
      expect(result.data)
        .toEqual(updatedSlot);
    });

    it('updates is_active to false', async () => {
      const updatedSlot = makeSlot({ is_active: false });
      const chain: any = {
        update: vi.fn()
          .mockReturnValue(null as any),
        eq: vi.fn()
          .mockReturnValue(null as any),
        select: vi.fn()
          .mockReturnValue(null as any),
        single: vi.fn()
          .mockReturnValue(Promise.resolve({ data: updatedSlot, error: null })),
      };
      chain.update.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      chain.select.mockReturnValue(chain);
      mockClient.from.mockReturnValue(chain);

      const result = await service.toggleAvailabilitySlot('slot-1', false);

      expect(chain.update)
        .toHaveBeenCalledWith({ is_active: false });
      expect(result.data)
        .toEqual(updatedSlot);
    });
  });
});
