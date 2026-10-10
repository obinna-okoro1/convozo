/**
 * Unit tests for ShopService
 * Covers: getShopItems, getActiveShopItems, createShopItem, updateShopItem,
 *         deleteShopItem, getShopOrders, createShopCheckout,
 *         uploadShopFile, uploadShopThumbnail, getShopDownloadUrl.
 *
 * ShopService is a pure delegation layer — every method forwards its arguments
 * directly to SupabaseService and returns the result unchanged.
 * Tests verify: correct method delegation, argument forwarding, and result pass-through.
 */





import { TestBed } from '@angular/core/testing';

import { type SpyObj, createSpyObj } from '@testing/test-utils';
import { EdgeFunctionService } from 'app/core/services/edge-function.service';
import { StorageService } from 'app/core/services/storage.service';

import { ShopService } from './shop.service';
import {
  EdgeFunctionResponse,
  ShopCheckoutPayload,
  ShopItem,
  ShopOrder,
} from '../../../core/models';
import { SupabaseService } from '../../../core/services/supabase.service';

// ── Fixture factories ─────────────────────────────────────────────────────────

function makeShopItem(overrides: Partial<ShopItem> = {}): ShopItem {
  const now = new Date()
    .toISOString();

  return {
    id: 'item-1',
    creator_id: 'creator-1',
    title: 'My eBook',
    description: 'A great read',
    price: 999,
    item_type: 'pdf',
    file_storage_path: 'creator-1/123_ebook.pdf',
    thumbnail_storage_path: null,
    file_url: null,
    thumbnail_url: null,
    preview_text: null,
    delivery_note: null,
    is_active: true,
    is_request_based: false,
    sort_order: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeShopOrder(overrides: Partial<ShopOrder> = {}): ShopOrder {
  const now = new Date()
    .toISOString();

  return {
    id: 'order-1',
    item_id: 'item-1',
    creator_id: 'creator-1',
    buyer_name: 'Fan One',
    buyer_email: 'fan@example.com',
    amount_paid: 999,
    stripe_session_id: 'cs_test_abc',
    idempotency_key: 'idem-1',
    status: 'completed',
    request_details: null,
    fulfillment_url: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

type ShopItemPayload = Omit<ShopItem, 'id' | 'created_at' | 'updated_at'>;

function makeShopItemPayload(overrides: Partial<ShopItemPayload> = {}): ShopItemPayload {
  return {
    creator_id: 'creator-1',
    title: 'My eBook',
    description: 'A great read',
    price: 999,
    item_type: 'pdf',
    file_storage_path: 'creator-1/123_ebook.pdf',
    thumbnail_storage_path: null,
    file_url: null,
    thumbnail_url: null,
    preview_text: null,
    delivery_note: null,
    is_active: true,
    is_request_based: false,
    sort_order: 0,
    ...overrides,
  };
}

// ── Spec ─────────────────────────────────────────────────────────────────────

describe('ShopService', () => {
  let service: ShopService;
  let supabaseSpy: SpyObj<SupabaseService>;
  let edgeFunctionsSpy: SpyObj<EdgeFunctionService>;
  let storageSpy: SpyObj<StorageService>;

  beforeEach(() => {
    supabaseSpy = createSpyObj<SupabaseService>([
      'getShopItems',
      'createShopItem',
      'updateShopItem',
      'deleteShopItem',
      'getShopOrders',
      'getActiveShopItems',
    ]);
    edgeFunctionsSpy = createSpyObj<EdgeFunctionService>(['createShopCheckout', 'getShopDownloadUrl']);
    storageSpy = createSpyObj<StorageService>(['uploadShopFile', 'uploadShopThumbnail']);

    TestBed.configureTestingModule({
      providers: [
        ShopService,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: EdgeFunctionService, useValue: edgeFunctionsSpy },
        { provide: StorageService, useValue: storageSpy },
      ],
    });

    service = TestBed.inject(ShopService);
  });

  it('should be created', () => {
    expect(service)
      .toBeTruthy();
  });

  // ── getShopItems ──────────────────────────────────────────────────────────

  describe('getShopItems()', () => {
    it('delegates to supabaseService.getShopItems with the creatorId', async () => {
      const items = [makeShopItem(), makeShopItem({ id: 'item-2', is_active: false })];
      supabaseSpy.getShopItems.mockReturnValue(Promise.resolve({ data: items, error: null }));

      const result = await service.getShopItems('creator-1');


      expect(supabaseSpy.getShopItems)
        .toHaveBeenCalledWith('creator-1');
      expect(result.data)
        .toEqual(items);
      expect(result.error)
        .toBeNull();
    });

    it('includes inactive items (creator-side view returns all)', async () => {
      const items = [makeShopItem({ is_active: false })];
      supabaseSpy.getShopItems.mockReturnValue(Promise.resolve({ data: items, error: null }));

      const result = await service.getShopItems('creator-1');

      const data = result.data ?? [];
      expect(data.some((i) => !i.is_active))
        .toBe(true);
    });

    it('propagates error from supabaseService', async () => {
      const err = new Error('DB error');
      supabaseSpy.getShopItems.mockReturnValue(Promise.resolve({ data: null, error: err }));

      const result = await service.getShopItems('creator-1');

      expect(result.data)
        .toBeNull();
      expect(result.error)
        .toBe(err);
    });
  });

  // ── getActiveShopItems ────────────────────────────────────────────────────

  describe('getActiveShopItems()', () => {
    it('delegates to supabaseService.getActiveShopItems with the creatorId', async () => {
      const items = [makeShopItem({ is_active: true })];
      supabaseSpy.getActiveShopItems.mockReturnValue(Promise.resolve({ data: items, error: null }));

      const result = await service.getActiveShopItems('creator-1');


      expect(supabaseSpy.getActiveShopItems)
        .toHaveBeenCalledWith('creator-1');
      expect(result.data)
        .toEqual(items);
      expect(result.error)
        .toBeNull();
    });

    it('returns empty array when no active items exist', async () => {
      supabaseSpy.getActiveShopItems.mockReturnValue(Promise.resolve({ data: [], error: null }));

      const result = await service.getActiveShopItems('creator-1');

      expect(result.data)
        .toEqual([]);
    });

    it('propagates error on RLS or network failure', async () => {
      const err = new Error('RLS denied');
      supabaseSpy.getActiveShopItems.mockReturnValue(Promise.resolve({ data: null, error: err }));

      const result = await service.getActiveShopItems('creator-1');

      expect(result.data)
        .toBeNull();
      expect(result.error)
        .toBe(err);
    });
  });

  // ── createShopItem ────────────────────────────────────────────────────────

  describe('createShopItem()', () => {
    it('delegates to supabaseService.createShopItem with the full item payload', async () => {
      const payload = makeShopItemPayload();
      const created = makeShopItem();
      supabaseSpy.createShopItem.mockReturnValue(Promise.resolve({ data: created, error: null }));

      const result = await service.createShopItem(payload);


      expect(supabaseSpy.createShopItem)
        .toHaveBeenCalledWith(payload);
      expect(result.data)
        .toEqual(created);
      expect(result.error)
        .toBeNull();
    });

    it('creates a request-based shoutout item correctly', async () => {
      const payload = makeShopItemPayload({
        item_type: 'shoutout_request',
        is_request_based: true,
        file_storage_path: null,
      });
      supabaseSpy.createShopItem.mockReturnValue(
        Promise.resolve({
          data: { ...makeShopItem(), ...payload, id: 'item-shoutout' },
          error: null,
        }),
      );

      const result = await service.createShopItem(payload);


      expect(supabaseSpy.createShopItem)
        .toHaveBeenCalledWith(payload);
      expect(result.data?.is_request_based)
        .toBe(true);
    });

    it('propagates error on insert failure', async () => {
      const err = new Error('Insert failed');
      supabaseSpy.createShopItem.mockReturnValue(Promise.resolve({ data: null, error: err }));

      const result = await service.createShopItem(makeShopItemPayload());

      expect(result.data)
        .toBeNull();
      expect(result.error)
        .toBe(err);
    });
  });

  // ── updateShopItem ────────────────────────────────────────────────────────

  describe('updateShopItem()', () => {
    it('delegates to supabaseService.updateShopItem with id and updates object', async () => {
      const updates = { title: 'Updated Title', price: 1499 };
      const updated = makeShopItem({ title: 'Updated Title', price: 1499 });
      supabaseSpy.updateShopItem.mockReturnValue(Promise.resolve({ data: updated, error: null }));

      const result = await service.updateShopItem('item-1', updates);


      expect(supabaseSpy.updateShopItem)
        .toHaveBeenCalledWith('item-1', updates);
      expect(result.data)
        .toEqual(updated);
    });

    it('can deactivate an item via is_active: false', async () => {
      const updated = makeShopItem({ is_active: false });
      supabaseSpy.updateShopItem.mockReturnValue(Promise.resolve({ data: updated, error: null }));

      const result = await service.updateShopItem('item-1', { is_active: false });

      expect(result.data?.is_active)
        .toBe(false);
    });

    it('propagates error on update failure', async () => {
      const err = new Error('Update failed');
      supabaseSpy.updateShopItem.mockReturnValue(Promise.resolve({ data: null, error: err }));

      const result = await service.updateShopItem('item-1', { is_active: false });

      expect(result.data)
        .toBeNull();
      expect(result.error)
        .toBe(err);
    });
  });

  // ── deleteShopItem ────────────────────────────────────────────────────────

  describe('deleteShopItem()', () => {
    it('delegates to supabaseService.deleteShopItem with the item id', async () => {
      supabaseSpy.deleteShopItem.mockReturnValue(Promise.resolve({ error: null }));

      const result = await service.deleteShopItem('item-1');


      expect(supabaseSpy.deleteShopItem)
        .toHaveBeenCalledWith('item-1');
      expect(result.error)
        .toBeNull();
    });

    it('propagates error on delete failure', async () => {
      const err = new Error('Delete failed');
      supabaseSpy.deleteShopItem.mockReturnValue(Promise.resolve({ error: err }));

      const result = await service.deleteShopItem('item-1');

      expect(result.error)
        .toBe(err);
    });
  });

  // ── getShopOrders ─────────────────────────────────────────────────────────

  describe('getShopOrders()', () => {
    it('delegates to supabaseService.getShopOrders with the creatorId', async () => {
      const orders = [makeShopOrder(), makeShopOrder({ id: 'order-2', status: 'pending' })];
      supabaseSpy.getShopOrders.mockReturnValue(Promise.resolve({ data: orders, error: null }));

      const result = await service.getShopOrders('creator-1');


      expect(supabaseSpy.getShopOrders)
        .toHaveBeenCalledWith('creator-1');
      expect(result.data)
        .toEqual(orders);
      expect(result.error)
        .toBeNull();
    });

    it('returns all order statuses (pending, completed, refunded)', async () => {
      const orders = [
        makeShopOrder({ status: 'pending' }),
        makeShopOrder({ id: 'order-2', status: 'completed' }),
        makeShopOrder({ id: 'order-3', status: 'refunded' }),
      ];
      supabaseSpy.getShopOrders.mockReturnValue(Promise.resolve({ data: orders, error: null }));

      const result = await service.getShopOrders('creator-1');

      const data = result.data ?? [];
      expect(data.length)
        .toBe(3);
    });

    it('propagates error on query failure', async () => {
      const err = new Error('Orders query failed');
      supabaseSpy.getShopOrders.mockReturnValue(Promise.resolve({ data: null, error: err }));

      const result = await service.getShopOrders('creator-1');

      expect(result.data)
        .toBeNull();
      expect(result.error)
        .toBe(err);
    });
  });

  // ── createShopCheckout ────────────────────────────────────────────────────

  describe('createShopCheckout()', () => {
    const basePayload: ShopCheckoutPayload = {
      creator_slug: 'creator-slug',
      item_id: 'item-1',
      buyer_name: 'Fan One',
      buyer_email: 'fan@example.com',
    };

    it('delegates to EdgeFunctionService.createShopCheckout with the full payload', async () => {
      const response: EdgeFunctionResponse<{ sessionId: string; url: string }> = {
        data: { sessionId: 'cs_test_xyz', url: 'https://checkout.stripe.com/xyz' },
      };
      edgeFunctionsSpy.createShopCheckout.mockReturnValue(Promise.resolve(response));

      const result = await service.createShopCheckout(basePayload);


      expect(edgeFunctionsSpy.createShopCheckout)
        .toHaveBeenCalledWith(basePayload);
      expect(result.data?.sessionId)
        .toBe('cs_test_xyz');
      expect(result.data?.url)
        .toBe('https://checkout.stripe.com/xyz');
    });

    it('forwards optional request_details for shoutout purchases', async () => {
      const payloadWithDetails: ShopCheckoutPayload = {
        ...basePayload,
        request_details: 'Please say happy birthday to Alex!',
      };
      edgeFunctionsSpy.createShopCheckout.mockReturnValue(
        Promise.resolve({ data: { sessionId: 'cs_2', url: 'https://checkout.stripe.com/2' } }),
      );

      await service.createShopCheckout(payloadWithDetails);


      expect(edgeFunctionsSpy.createShopCheckout)
        .toHaveBeenCalledWith(payloadWithDetails);
    });

    it('propagates edge function error', async () => {
      edgeFunctionsSpy.createShopCheckout.mockReturnValue(
        Promise.resolve({ error: { message: 'Creator not found' } }),
      );

      const result = await service.createShopCheckout(basePayload);

      expect(result.error?.message)
        .toBe('Creator not found');
      expect(result.data)
        .toBeUndefined();
    });
  });

  // ── uploadShopFile ────────────────────────────────────────────────────────

  describe('uploadShopFile()', () => {
    it('delegates to StorageService.uploadShopFile with creatorId and file', async () => {
      const file = new File(['content'], 'ebook.pdf', { type: 'application/pdf' });
      storageSpy.uploadShopFile.mockReturnValue(
        Promise.resolve({ path: 'creator-1/123_ebook.pdf', error: null }),
      );

      const result = await service.uploadShopFile('creator-1', file);


      expect(storageSpy.uploadShopFile)
        .toHaveBeenCalledWith('creator-1', file);
      expect(result.path)
        .toBe('creator-1/123_ebook.pdf');
      expect(result.error)
        .toBeNull();
    });

    it('returns the storage path (never a public URL)', async () => {
      const file = new File(['video content'], 'lesson.mp4', { type: 'video/mp4' });
      storageSpy.uploadShopFile.mockReturnValue(
        Promise.resolve({ path: 'creator-1/456_lesson.mp4', error: null }),
      );

      const result = await service.uploadShopFile('creator-1', file);

      // Path must not be a full URL — it is a private bucket path only
      expect(result.path).not.toContain('http');
    });

    it('propagates upload error with null path', async () => {
      const file = new File([''], 'bad.pdf', { type: 'application/pdf' });
      const err = new Error('Upload failed');
      storageSpy.uploadShopFile.mockReturnValue(Promise.resolve({ path: null, error: err }));

      const result = await service.uploadShopFile('creator-1', file);

      expect(result.path)
        .toBeNull();
      expect(result.error)
        .toBe(err);
    });
  });

  // ── uploadShopThumbnail ───────────────────────────────────────────────────

  describe('uploadShopThumbnail()', () => {
    it('delegates to StorageService.uploadShopThumbnail and returns path + publicUrl', async () => {
      const file = new File(['img'], 'thumb.png', { type: 'image/png' });
      const publicUrl = 'https://cdn.example.com/shop-thumbnails/creator-1/123_thumb.png';
      storageSpy.uploadShopThumbnail.mockReturnValue(
        Promise.resolve({ path: 'creator-1/123_thumb.png', publicUrl, error: null }),
      );

      const result = await service.uploadShopThumbnail('creator-1', file);


      expect(storageSpy.uploadShopThumbnail)
        .toHaveBeenCalledWith('creator-1', file);
      expect(result.path)
        .toBe('creator-1/123_thumb.png');
      expect(result.publicUrl)
        .toBe(publicUrl);
      expect(result.error)
        .toBeNull();
    });

    it('publicUrl is a fully-qualified HTTPS URL for use in <img> tags', async () => {
      const file = new File(['img'], 'cover.jpg', { type: 'image/jpeg' });
      const publicUrl =
        'https://supabase.co/storage/v1/object/public/shop-thumbnails/creator-1/cover.jpg';
      storageSpy.uploadShopThumbnail.mockReturnValue(
        Promise.resolve({ path: 'creator-1/cover.jpg', publicUrl, error: null }),
      );

      const result = await service.uploadShopThumbnail('creator-1', file);

      expect(result.publicUrl)
        .toMatch(/^https:\/\//);
    });

    it('propagates upload error with null path and null publicUrl', async () => {
      const file = new File([''], 'thumb.png', { type: 'image/png' });
      const err = new Error('Storage limit exceeded');
      storageSpy.uploadShopThumbnail.mockReturnValue(
        Promise.resolve({ path: null, publicUrl: null, error: err }),
      );

      const result = await service.uploadShopThumbnail('creator-1', file);

      expect(result.path)
        .toBeNull();
      expect(result.publicUrl)
        .toBeNull();
      expect(result.error)
        .toBe(err);
    });
  });

  // ── getShopDownloadUrl ────────────────────────────────────────────────────

  describe('getShopDownloadUrl()', () => {
    it('delegates to EdgeFunctionService.getShopDownloadUrl with the sessionId', async () => {
      const response: EdgeFunctionResponse<{ url: string; filename: string }> = {
        data: { url: 'https://storage.supabase.co/signed-url', filename: 'ebook.pdf' },
      };
      edgeFunctionsSpy.getShopDownloadUrl.mockReturnValue(Promise.resolve(response));

      const result = await service.getShopDownloadUrl('cs_test_abc');


      expect(edgeFunctionsSpy.getShopDownloadUrl)
        .toHaveBeenCalledWith('cs_test_abc');
      expect(result.data?.url)
        .toBe('https://storage.supabase.co/signed-url');
      expect(result.data?.filename)
        .toBe('ebook.pdf');
    });

    it('returned URL is a signed short-lived URL (contains http)', async () => {
      edgeFunctionsSpy.getShopDownloadUrl.mockReturnValue(
        Promise.resolve({
          data: {
            url: 'https://storage.supabase.co/object/sign/shop-files/creator-1/file.pdf?token=xyz',
            filename: 'file.pdf',
          },
        }),
      );

      const result = await service.getShopDownloadUrl('cs_test_abc');

      expect(result.data?.url)
        .toMatch(/^https:\/\//);
    });

    it('propagates edge function error when session is invalid', async () => {
      edgeFunctionsSpy.getShopDownloadUrl.mockReturnValue(
        Promise.resolve({ error: { message: 'Session not found' } }),
      );

      const result = await service.getShopDownloadUrl('invalid-session');

      expect(result.error?.message)
        .toBe('Session not found');
      expect(result.data)
        .toBeUndefined();
    });
  });
});
