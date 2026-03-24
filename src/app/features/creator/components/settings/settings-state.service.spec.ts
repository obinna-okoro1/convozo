/**
 * Unit tests for SettingsStateService — Paystack computed signals and async methods.
 *
 * What these tests cover:
 *   1. isPaystackCreator computed signal
 *      — true when creator.payment_provider === 'paystack'
 *      — false when creator.payment_provider === 'stripe'
 *      — false when creator signal is null
 *   2. isPaystackConnected computed signal
 *      — true when paystackSubaccount.is_active === true
 *      — false when paystackSubaccount is null (not yet set up)
 *      — false when paystackSubaccount.is_active === false
 *   3. loadPaystackBanks()
 *      — sets paystackBanks signal from the edge function response
 *      — sets/clears paystackBanksLoading around the async call
 *      — handles error response from the edge function
 *      — returns early when creator has no country
 *      — handles both { banks: [...] } and flat array response shapes
 *   4. connectPaystack()
 *      — sets/clears paystackConnecting around the async call
 *      — sets paystackSubaccount on success
 *      — sets error message on failure
 *      — returns early when creator has no country
 *   5. resolvePaystackAccount()
 *      — returns accountName on success
 *      — returns error message on failure
 *      — handles thrown exceptions
 *   6. loadCreatorData() — payment routing
 *      — loads Paystack subaccount for paystack creators
 *      — loads Stripe payment account for stripe creators
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/unbound-method */

import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SettingsStateService } from './settings-state.service';
import { Creator, PaystackSubaccount, PaystackBank } from '../../../../core/models';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { CreatorService } from '../../services/creator.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

function makeCreator(overrides: Partial<Creator> = {}): Creator {
  return {
    id: 'creator-1',
    user_id: 'user-1',
    email: 'creator@example.com',
    display_name: 'Test Creator',
    slug: 'test-creator',
    bio: null,
    profile_image_url: null,
    banner_image_url: null,
    phone_number: '+2348012345678',
    country: 'NG',
    payment_provider: 'paystack',
    is_active: true,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makePaystackSubaccount(overrides: Partial<PaystackSubaccount> = {}): PaystackSubaccount {
  return {
    id: 'sub-1',
    creator_id: 'creator-1',
    subaccount_code: 'ACCT_abc123',
    business_name: 'Test Creator',
    bank_name: 'Access Bank',
    bank_code: '044',
    account_number: '1234567890',
    account_name: 'TEST CREATOR',
    country: 'NG',
    is_verified: true,
    is_active: true,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makePaystackBank(overrides: Partial<PaystackBank> = {}): PaystackBank {
  return {
    name: 'Access Bank',
    code: '044',
    country: 'Nigeria',
    currency: 'NGN',
    ...overrides,
  };
}

// ── Spec ─────────────────────────────────────────────────────────────────────

describe('SettingsStateService', () => {
  let service: SettingsStateService;
  let creatorServiceSpy: jasmine.SpyObj<CreatorService>;
  let mockClient: any;

  beforeEach(() => {
    creatorServiceSpy = jasmine.createSpyObj<CreatorService>('CreatorService', [
      'getCurrentCreator',
      'getCreatorSettings',
      'getPaystackSubaccount',
      'getPaystackBanks',
      'resolvePaystackAccount',
      'createPaystackSubaccount',
      'getStripeAccount',
      'createStripeConnectAccount',
      'verifyStripeAccount',
      'checkSlugAvailability',
      'updateCreatorProfile',
      'updateCreatorSettings',
    ]);

    mockClient = {
      from: jasmine.createSpy('from'),
      auth: {
        getUser: jasmine
          .createSpy('getUser')
          .and.returnValue(Promise.resolve({ data: { user: { email: 'creator@example.com' } } })),
      },
      functions: { invoke: jasmine.createSpy('invoke') },
    };

    const supabaseSpy = jasmine.createSpyObj<SupabaseService>(
      'SupabaseService',
      ['getStripeAccount'],
      { client: mockClient },
    );

    const routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        SettingsStateService,
        { provide: CreatorService, useValue: creatorServiceSpy },
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(SettingsStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── isPaystackCreator ─────────────────────────────────────────────────────

  describe('isPaystackCreator computed', () => {
    it('returns true when payment_provider is "paystack"', () => {
      service.creator.set(makeCreator({ payment_provider: 'paystack' }));
      expect(service.isPaystackCreator()).toBe(true);
    });

    it('returns false when payment_provider is "stripe"', () => {
      service.creator.set(makeCreator({ payment_provider: 'stripe' }));
      expect(service.isPaystackCreator()).toBe(false);
    });

    it('returns false when creator signal is null (not yet loaded)', () => {
      service.creator.set(null);
      expect(service.isPaystackCreator()).toBe(false);
    });

    it('updates reactively when creator signal changes', () => {
      service.creator.set(makeCreator({ payment_provider: 'stripe' }));
      expect(service.isPaystackCreator()).toBe(false);

      service.creator.set(makeCreator({ payment_provider: 'paystack' }));
      expect(service.isPaystackCreator()).toBe(true);
    });
  });

  // ── isPaystackConnected ───────────────────────────────────────────────────

  describe('isPaystackConnected computed', () => {
    it('returns true when paystackSubaccount.is_active is true', () => {
      service.paystackSubaccount.set(makePaystackSubaccount({ is_active: true }));
      expect(service.isPaystackConnected()).toBe(true);
    });

    it('returns false when paystackSubaccount is null (not yet set up)', () => {
      service.paystackSubaccount.set(null);
      expect(service.isPaystackConnected()).toBe(false);
    });

    it('returns false when paystackSubaccount.is_active is false', () => {
      service.paystackSubaccount.set(makePaystackSubaccount({ is_active: false }));
      expect(service.isPaystackConnected()).toBe(false);
    });

    it('updates reactively when paystackSubaccount signal changes', () => {
      service.paystackSubaccount.set(null);
      expect(service.isPaystackConnected()).toBe(false);

      service.paystackSubaccount.set(makePaystackSubaccount({ is_active: true }));
      expect(service.isPaystackConnected()).toBe(true);
    });
  });

  // ── loadPaystackBanks ─────────────────────────────────────────────────────

  describe('loadPaystackBanks()', () => {
    beforeEach(() => {
      service.creator.set(makeCreator({ country: 'NG' }));
    });

    it('sets paystackBanks from the { banks: [...] } edge function response', async () => {
      const banks = [makePaystackBank(), makePaystackBank({ name: 'GTBank', code: '058' })];
      creatorServiceSpy.getPaystackBanks.and.returnValue(
        Promise.resolve({ data: { banks } as any, error: undefined }),
      );
      await service.loadPaystackBanks();
      expect(service.paystackBanks()).toEqual(banks);
    });

    it('sets paystackBanks from a flat array response', async () => {
      const banks = [makePaystackBank()];
      creatorServiceSpy.getPaystackBanks.and.returnValue(
        Promise.resolve({ data: banks as any, error: undefined }),
      );
      await service.loadPaystackBanks();
      expect(service.paystackBanks()).toEqual(banks);
    });

    it('sets paystackBanksLoading to true while loading and false after', async () => {
      const loadingStates: boolean[] = [];
      let resolvePromise!: (value: any) => void;
      (creatorServiceSpy.getPaystackBanks as unknown as jasmine.Spy).and.returnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const loadPromise = service.loadPaystackBanks();
      loadingStates.push(service.paystackBanksLoading());
      resolvePromise({ data: { banks: [] }, error: null });
      await loadPromise;
      loadingStates.push(service.paystackBanksLoading());

      expect(loadingStates[0]).toBe(true);
      expect(loadingStates[1]).toBe(false);
    });

    it('returns early without calling the edge function when creator has no country', async () => {
      service.creator.set(makeCreator({ country: '' }) as any);
      await service.loadPaystackBanks();
      expect(creatorServiceSpy.getPaystackBanks).not.toHaveBeenCalled();
    });

    it('returns early when creator is null', async () => {
      service.creator.set(null);
      await service.loadPaystackBanks();
      expect(creatorServiceSpy.getPaystackBanks).not.toHaveBeenCalled();
    });

    it('sets error message when the edge function returns an error', async () => {
      creatorServiceSpy.getPaystackBanks.and.returnValue(
        Promise.resolve({ data: undefined, error: { message: 'Service unavailable' } }),
      );
      await service.loadPaystackBanks();
      expect(service.error()).toBe('Failed to load bank list. Please try again.');
    });

    it('always clears paystackBanksLoading even when an error occurs', async () => {
      creatorServiceSpy.getPaystackBanks.and.returnValue(
        Promise.resolve({ data: undefined, error: { message: 'error' } }),
      );
      await service.loadPaystackBanks();
      expect(service.paystackBanksLoading()).toBe(false);
    });

    it('calls the edge function with the creator country', async () => {
      creatorServiceSpy.getPaystackBanks.and.returnValue(
        Promise.resolve({ data: { banks: [] } as any, error: undefined }),
      );
      await service.loadPaystackBanks();
      expect(creatorServiceSpy.getPaystackBanks).toHaveBeenCalledWith('NG');
    });

    it('uses ZA country when creator is in South Africa', async () => {
      service.creator.set(makeCreator({ country: 'ZA' }) as any);
      creatorServiceSpy.getPaystackBanks.and.returnValue(
        Promise.resolve({ data: { banks: [] } as any, error: undefined }),
      );
      await service.loadPaystackBanks();
      expect(creatorServiceSpy.getPaystackBanks).toHaveBeenCalledWith('ZA');
    });
  });

  // ── connectPaystack ───────────────────────────────────────────────────────

  describe('connectPaystack()', () => {
    const params = { bankCode: '044', accountNumber: '1234567890', businessName: 'Test' };

    beforeEach(() => {
      service.creator.set(makeCreator({ country: 'NG' }) as any);
    });

    it('sets paystackSubaccount signal on success', async () => {
      const subaccount = makePaystackSubaccount();
      creatorServiceSpy.createPaystackSubaccount.and.returnValue(
        Promise.resolve({ data: subaccount as any, error: undefined }),
      );
      await service.connectPaystack(params);
      expect(service.paystackSubaccount()).toEqual(subaccount as any);
    });

    it('sets success signal to true after connecting', async () => {
      const subaccount = makePaystackSubaccount();
      creatorServiceSpy.createPaystackSubaccount.and.returnValue(
        Promise.resolve({ data: subaccount as any, error: undefined }),
      );
      await service.connectPaystack(params);
      expect(service.success()).toBe(true);
    });

    it('clears paystackConnecting after a successful connection', async () => {
      creatorServiceSpy.createPaystackSubaccount.and.returnValue(
        Promise.resolve({ data: makePaystackSubaccount() as any, error: undefined }),
      );
      await service.connectPaystack(params);
      expect(service.paystackConnecting()).toBe(false);
    });

    it('sets error message when the edge function returns an error', async () => {
      creatorServiceSpy.createPaystackSubaccount.and.returnValue(
        Promise.resolve({ data: undefined, error: { message: 'Invalid bank account' } }),
      );
      await service.connectPaystack(params);
      expect(service.error()).toBe('Invalid bank account');
    });

    it('clears paystackConnecting after a failed connection', async () => {
      creatorServiceSpy.createPaystackSubaccount.and.returnValue(
        Promise.resolve({ data: undefined, error: { message: 'Failed' } }),
      );
      await service.connectPaystack(params);
      expect(service.paystackConnecting()).toBe(false);
    });

    it('sets generic error message when error has no message', async () => {
      creatorServiceSpy.createPaystackSubaccount.and.returnValue(
        Promise.resolve({ data: undefined, error: {} as any }),
      );
      await service.connectPaystack(params);
      expect(service.error()).toBe('Failed to set up bank account');
    });

    it('sets generic error message when an exception is thrown', async () => {
      creatorServiceSpy.createPaystackSubaccount.and.returnValue(
        Promise.reject(new Error('Network error')),
      );
      await service.connectPaystack(params);
      expect(service.error()).toBe('An unexpected error occurred. Please try again.');
      expect(service.paystackConnecting()).toBe(false);
    });

    it('returns early without calling edge function when creator is null', async () => {
      service.creator.set(null);
      await service.connectPaystack(params);
      expect(creatorServiceSpy.createPaystackSubaccount).not.toHaveBeenCalled();
    });

    it('passes all bank params and country to the edge function', async () => {
      creatorServiceSpy.createPaystackSubaccount.and.returnValue(
        Promise.resolve({ data: makePaystackSubaccount() as any, error: undefined }),
      );
      await service.connectPaystack(params);
      expect(creatorServiceSpy.createPaystackSubaccount).toHaveBeenCalledWith({
        bankCode: '044',
        accountNumber: '1234567890',
        businessName: 'Test',
        country: 'NG',
      });
    });
  });

  // ── resolvePaystackAccount ────────────────────────────────────────────────

  describe('resolvePaystackAccount()', () => {
    it('returns accountName when resolution succeeds', async () => {
      creatorServiceSpy.resolvePaystackAccount.and.returnValue(
        Promise.resolve({ data: { account_name: 'ADEWALE OSEI' } as any, error: undefined }),
      );
      const result = await service.resolvePaystackAccount('1234567890', '044');
      expect(result.accountName).toBe('ADEWALE OSEI');
      expect(result.error).toBeNull();
    });

    it('returns error message when the edge function returns an error', async () => {
      creatorServiceSpy.resolvePaystackAccount.and.returnValue(
        Promise.resolve({ data: undefined, error: { message: 'Not found' } }),
      );
      const result = await service.resolvePaystackAccount('0000000000', '044');
      expect(result.accountName).toBeNull();
      expect(result.error).toBe('Could not verify account. Please check the details.');
    });

    it('returns generic error message when an exception is thrown', async () => {
      creatorServiceSpy.resolvePaystackAccount.and.returnValue(
        Promise.reject(new Error('Network error')),
      );
      const result = await service.resolvePaystackAccount('1234567890', '044');
      expect(result.accountName).toBeNull();
      expect(result.error).toBe('Account verification failed. Please try again.');
    });

    it('returns null accountName when data has no account_name field', async () => {
      creatorServiceSpy.resolvePaystackAccount.and.returnValue(
        Promise.resolve({ data: {} as any, error: undefined }),
      );
      const result = await service.resolvePaystackAccount('1234567890', '044');
      expect(result.accountName).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  // ── loadCreatorData — payment provider routing ────────────────────────────

  describe('loadCreatorData() - routes to correct payment loader by provider', () => {
    const mockSettings = {
      id: 'settings-1',
      creator_id: 'creator-1',
      message_price: 1000,
      messages_enabled: true,
      call_price: 2000,
      call_duration: 10,
      calls_enabled: false,
      tips_enabled: false,
      shop_enabled: false,
      response_expectation: '',
      created_at: NOW,
      updated_at: NOW,
    };

    it('loads Paystack subaccount for a paystack creator', async () => {
      const creator = makeCreator({ payment_provider: 'paystack' });
      const subaccount = makePaystackSubaccount();

      creatorServiceSpy.getCurrentCreator.and.returnValue(Promise.resolve(creator) as any);
      creatorServiceSpy.getCreatorSettings.and.returnValue(
        Promise.resolve({ data: mockSettings as any, error: null }),
      );
      creatorServiceSpy.getPaystackSubaccount.and.returnValue(
        Promise.resolve({ data: subaccount, error: null }),
      );

      await service.loadCreatorData();

      expect(creatorServiceSpy.getPaystackSubaccount).toHaveBeenCalledWith(creator.id);
      // Stripe account should NOT be loaded for Paystack creators
      expect(creatorServiceSpy.getStripeAccount).not.toHaveBeenCalled();
    });

    it('sets paystackSubaccount signal when Paystack subaccount is found', async () => {
      const creator = makeCreator({ payment_provider: 'paystack' });
      const subaccount = makePaystackSubaccount();

      creatorServiceSpy.getCurrentCreator.and.returnValue(Promise.resolve(creator) as any);
      creatorServiceSpy.getCreatorSettings.and.returnValue(
        Promise.resolve({ data: mockSettings as any, error: null }),
      );
      creatorServiceSpy.getPaystackSubaccount.and.returnValue(
        Promise.resolve({ data: subaccount, error: null }),
      );

      await service.loadCreatorData();

      expect(service.paystackSubaccount()).toEqual(subaccount);
    });

    it('does not call getPaystackSubaccount for a stripe creator', async () => {
      const creator = makeCreator({ payment_provider: 'stripe', country: 'US' });

      creatorServiceSpy.getCurrentCreator.and.returnValue(Promise.resolve(creator) as any);
      creatorServiceSpy.getCreatorSettings.and.returnValue(
        Promise.resolve({ data: mockSettings as any, error: null }),
      );
      // Supabase getStripeAccount used by the private loadPaymentAccount path
      (TestBed.inject(SupabaseService) as any).getStripeAccount = jasmine
        .createSpy('getStripeAccount')
        .and.returnValue(Promise.resolve({ data: null, error: null }) as any);

      await service.loadCreatorData();

      expect(creatorServiceSpy.getPaystackSubaccount).not.toHaveBeenCalled();
    });

    it('clears loading after loadCreatorData completes', async () => {
      creatorServiceSpy.getCurrentCreator.and.returnValue(Promise.resolve(null) as any);
      await service.loadCreatorData();
      expect(service.loading()).toBe(false);
    });

    it('sets loading to true during loadCreatorData', async () => {
      let wasLoading = false;
      creatorServiceSpy.getCurrentCreator.and.callFake(() => {
        wasLoading = service.loading();
        return Promise.resolve(null);
      });
      await service.loadCreatorData();
      expect(wasLoading).toBe(true);
    });
  });
});
