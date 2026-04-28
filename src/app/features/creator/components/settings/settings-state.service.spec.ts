/**
 * Unit tests for SettingsStateService — Flutterwave computed signals and async methods.
 *
 * What these tests cover:
 *   1. isFlutterwaveCreator computed signal
 *      — true when creator.payment_provider === 'flutterwave'
 *      — false when creator.payment_provider === 'stripe'
 *      — false when creator signal is null
 *   2. isFlutterwaveConnected computed signal
 *      — true when flutterwaveSubaccount.is_active === true
 *      — false when flutterwaveSubaccount is null (not yet set up)
 *      — false when flutterwaveSubaccount.is_active === false
 *   3. loadFlutterwaveBanks()
 *      — sets flutterwaveBanks signal from the edge function response
 *      — sets/clears flutterwaveBanksLoading around the async call
 *      — handles error response from the edge function
 *      — returns early when creator has no country
 *      — handles both { banks: [...] } and flat array response shapes
 *   4. connectFlutterwave()
 *      — sets/clears flutterwaveConnecting around the async call
 *      — sets flutterwaveSubaccount on success
 *      — sets error message on failure
 *      — returns early when creator has no country
 *   5. resolveFlutterwaveAccount()
 *      — returns accountName on success
 *      — returns error message on failure
 *      — handles thrown exceptions
 *   6. loadCreatorData() — payment routing
 *      — loads Flutterwave subaccount for flutterwave creators
 *      — loads Stripe payment account for stripe creators
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/unbound-method */

import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SettingsStateService } from './settings-state.service';
import { Creator, FlutterwaveSubaccount, FlutterwaveBank } from '../../../../core/models';
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
    payment_provider: 'flutterwave',
    is_active: true,
    category: null,
    subcategory: null,
    profession_title: null,
    years_of_experience: null,
    linkedin_url: null,
    profile_type: 'consultant' as 'consultant' | 'practitioner',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeFlutterwaveSubaccount(overrides: Partial<FlutterwaveSubaccount> = {}): FlutterwaveSubaccount {
  return {
    id: 'sub-1',
    creator_id: 'creator-1',
    subaccount_id: 'RS_abc123',
    business_name: 'Test Creator',
    bank_name: 'Access Bank',
    bank_code: '044',
    account_number: '1234567890',
    account_name: 'TEST CREATOR',
    country: 'NG',
    is_active: true,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeFlutterwaveBank(overrides: Partial<FlutterwaveBank> = {}): FlutterwaveBank {
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
      'getFlutterwaveSubaccount',
      'getFlutterwaveBanks',
      'resolveFlutterwaveAccount',
      'createFlutterwaveSubaccount',
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

  // ── isFlutterwaveCreator ──────────────────────────────────────────────────

  describe('isFlutterwaveCreator computed', () => {
    it('returns true when payment_provider is "flutterwave"', () => {
      service.creator.set(makeCreator({ payment_provider: 'flutterwave' }));
      expect(service.isFlutterwaveCreator()).toBe(true);
    });

    it('returns false when payment_provider is "stripe"', () => {
      service.creator.set(makeCreator({ payment_provider: 'stripe' }));
      expect(service.isFlutterwaveCreator()).toBe(false);
    });

    it('returns false when creator signal is null (not yet loaded)', () => {
      service.creator.set(null);
      expect(service.isFlutterwaveCreator()).toBe(false);
    });

    it('updates reactively when creator signal changes', () => {
      service.creator.set(makeCreator({ payment_provider: 'stripe' }));
      expect(service.isFlutterwaveCreator()).toBe(false);

      service.creator.set(makeCreator({ payment_provider: 'flutterwave' }));
      expect(service.isFlutterwaveCreator()).toBe(true);
    });
  });

  // ── isFlutterwaveConnected ─────────────────────────────────────────────────

  describe('isFlutterwaveConnected computed', () => {
    it('returns true when flutterwaveSubaccount.is_active is true', () => {
      service.flutterwaveSubaccount.set(makeFlutterwaveSubaccount({ is_active: true }));
      expect(service.isFlutterwaveConnected()).toBe(true);
    });

    it('returns false when flutterwaveSubaccount is null (not yet set up)', () => {
      service.flutterwaveSubaccount.set(null);
      expect(service.isFlutterwaveConnected()).toBe(false);
    });

    it('returns false when flutterwaveSubaccount.is_active is false', () => {
      service.flutterwaveSubaccount.set(makeFlutterwaveSubaccount({ is_active: false }));
      expect(service.isFlutterwaveConnected()).toBe(false);
    });

    it('updates reactively when flutterwaveSubaccount signal changes', () => {
      service.flutterwaveSubaccount.set(null);
      expect(service.isFlutterwaveConnected()).toBe(false);

      service.flutterwaveSubaccount.set(makeFlutterwaveSubaccount({ is_active: true }));
      expect(service.isFlutterwaveConnected()).toBe(true);
    });
  });

  // ── loadFlutterwaveBanks ───────────────────────────────────────────────────

  describe('loadFlutterwaveBanks()', () => {
    beforeEach(() => {
      service.creator.set(makeCreator({ country: 'NG' }));
    });

    it('sets flutterwaveBanks from the { banks: [...] } edge function response', async () => {
      const banks = [makeFlutterwaveBank(), makeFlutterwaveBank({ name: 'GTBank', code: '058' })];
      creatorServiceSpy.getFlutterwaveBanks.and.returnValue(
        Promise.resolve({ data: { banks } as any, error: undefined }),
      );
      await service.loadFlutterwaveBanks();
      expect(service.flutterwaveBanks()).toEqual(banks);
    });

    it('sets flutterwaveBanks from a flat array response', async () => {
      const banks = [makeFlutterwaveBank()];
      creatorServiceSpy.getFlutterwaveBanks.and.returnValue(
        Promise.resolve({ data: banks as any, error: undefined }),
      );
      await service.loadFlutterwaveBanks();
      expect(service.flutterwaveBanks()).toEqual(banks);
    });

    it('sets flutterwaveBanksLoading to true while loading and false after', async () => {
      const loadingStates: boolean[] = [];
      let resolvePromise!: (value: any) => void;
      (creatorServiceSpy.getFlutterwaveBanks as unknown as jasmine.Spy).and.returnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const loadPromise = service.loadFlutterwaveBanks();
      loadingStates.push(service.flutterwaveBanksLoading());
      resolvePromise({ data: { banks: [] }, error: null });
      await loadPromise;
      loadingStates.push(service.flutterwaveBanksLoading());

      expect(loadingStates[0]).toBe(true);
      expect(loadingStates[1]).toBe(false);
    });

    it('returns early without calling the edge function when creator has no country', async () => {
      service.creator.set(makeCreator({ country: '' }) as any);
      await service.loadFlutterwaveBanks();
      expect(creatorServiceSpy.getFlutterwaveBanks).not.toHaveBeenCalled();
    });

    it('returns early when creator is null', async () => {
      service.creator.set(null);
      await service.loadFlutterwaveBanks();
      expect(creatorServiceSpy.getFlutterwaveBanks).not.toHaveBeenCalled();
    });

    it('sets error message when the edge function returns an error', async () => {
      creatorServiceSpy.getFlutterwaveBanks.and.returnValue(
        Promise.resolve({ data: undefined, error: { message: 'Service unavailable' } }),
      );
      await service.loadFlutterwaveBanks();
      expect(service.error()).toBe('Failed to load bank list. Please try again.');
    });

    it('always clears flutterwaveBanksLoading even when an error occurs', async () => {
      creatorServiceSpy.getFlutterwaveBanks.and.returnValue(
        Promise.resolve({ data: undefined, error: { message: 'error' } }),
      );
      await service.loadFlutterwaveBanks();
      expect(service.flutterwaveBanksLoading()).toBe(false);
    });

    it('calls the edge function with the creator country', async () => {
      creatorServiceSpy.getFlutterwaveBanks.and.returnValue(
        Promise.resolve({ data: { banks: [] } as any, error: undefined }),
      );
      await service.loadFlutterwaveBanks();
      expect(creatorServiceSpy.getFlutterwaveBanks).toHaveBeenCalledWith('NG');
    });

    it('uses ZA country when creator is in South Africa', async () => {
      service.creator.set(makeCreator({ country: 'ZA' }) as any);
      creatorServiceSpy.getFlutterwaveBanks.and.returnValue(
        Promise.resolve({ data: { banks: [] } as any, error: undefined }),
      );
      await service.loadFlutterwaveBanks();
      expect(creatorServiceSpy.getFlutterwaveBanks).toHaveBeenCalledWith('ZA');
    });
  });

  // ── connectFlutterwave ───────────────────────────────────────────────────────

  describe('connectFlutterwave()', () => {
    const params = { bankCode: '044', accountNumber: '1234567890', businessName: 'Test' };

    beforeEach(() => {
      service.creator.set(makeCreator({ country: 'NG' }) as any);
    });

    it('sets flutterwaveSubaccount signal on success', async () => {
      const subaccount = makeFlutterwaveSubaccount();
      creatorServiceSpy.createFlutterwaveSubaccount.and.returnValue(
        Promise.resolve({ data: subaccount as any, error: undefined }),
      );
      await service.connectFlutterwave(params);
      expect(service.flutterwaveSubaccount()).toEqual(subaccount as any);
    });

    it('sets success signal to true after connecting', async () => {
      const subaccount = makeFlutterwaveSubaccount();
      creatorServiceSpy.createFlutterwaveSubaccount.and.returnValue(
        Promise.resolve({ data: subaccount as any, error: undefined }),
      );
      await service.connectFlutterwave(params);
      expect(service.success()).toBe(true);
    });

    it('clears flutterwaveConnecting after a successful connection', async () => {
      creatorServiceSpy.createFlutterwaveSubaccount.and.returnValue(
        Promise.resolve({ data: makeFlutterwaveSubaccount() as any, error: undefined }),
      );
      await service.connectFlutterwave(params);
      expect(service.flutterwaveConnecting()).toBe(false);
    });

    it('sets error message when the edge function returns an error', async () => {
      creatorServiceSpy.createFlutterwaveSubaccount.and.returnValue(
        Promise.resolve({ data: undefined, error: { message: 'Invalid bank account' } }),
      );
      await service.connectFlutterwave(params);
      expect(service.error()).toBe('Invalid bank account');
    });

    it('clears flutterwaveConnecting after a failed connection', async () => {
      creatorServiceSpy.createFlutterwaveSubaccount.and.returnValue(
        Promise.resolve({ data: undefined, error: { message: 'Failed' } }),
      );
      await service.connectFlutterwave(params);
      expect(service.flutterwaveConnecting()).toBe(false);
    });

    it('sets generic error message when error has no message', async () => {
      creatorServiceSpy.createFlutterwaveSubaccount.and.returnValue(
        Promise.resolve({ data: undefined, error: {} as any }),
      );
      await service.connectFlutterwave(params);
      expect(service.error()).toBe('Failed to set up bank account');
    });

    it('sets generic error message when an exception is thrown', async () => {
      creatorServiceSpy.createFlutterwaveSubaccount.and.returnValue(
        Promise.reject(new Error('Network error')),
      );
      await service.connectFlutterwave(params);
      expect(service.error()).toBe('An unexpected error occurred. Please try again.');
      expect(service.flutterwaveConnecting()).toBe(false);
    });

    it('returns early without calling edge function when creator is null', async () => {
      service.creator.set(null);
      await service.connectFlutterwave(params);
      expect(creatorServiceSpy.createFlutterwaveSubaccount).not.toHaveBeenCalled();
    });

    it('passes all bank params and country to the edge function', async () => {
      creatorServiceSpy.createFlutterwaveSubaccount.and.returnValue(
        Promise.resolve({ data: makeFlutterwaveSubaccount() as any, error: undefined }),
      );
      await service.connectFlutterwave(params);
      expect(creatorServiceSpy.createFlutterwaveSubaccount).toHaveBeenCalledWith({
        bankCode: '044',
        accountNumber: '1234567890',
        businessName: 'Test',
        country: 'NG',
      });
    });
  });

  // ── resolveFlutterwaveAccount ────────────────────────────────────────────────

  describe('resolveFlutterwaveAccount()', () => {
    it('returns accountName when resolution succeeds', async () => {
      creatorServiceSpy.resolveFlutterwaveAccount.and.returnValue(
        Promise.resolve({ data: { account_name: 'ADEWALE OSEI' } as any, error: undefined }),
      );
      const result = await service.resolveFlutterwaveAccount('1234567890', '044');
      expect(result.accountName).toBe('ADEWALE OSEI');
      expect(result.error).toBeNull();
    });

    it('returns error message when the edge function returns an error', async () => {
      creatorServiceSpy.resolveFlutterwaveAccount.and.returnValue(
        Promise.resolve({ data: undefined, error: { message: 'Not found' } }),
      );
      const result = await service.resolveFlutterwaveAccount('0000000000', '044');
      expect(result.accountName).toBeNull();
      expect(result.error).toBe('Could not verify account. Please check your account number and bank.');
    });

    it('returns generic error message when an exception is thrown', async () => {
      creatorServiceSpy.resolveFlutterwaveAccount.and.returnValue(
        Promise.reject(new Error('Network error')),
      );
      const result = await service.resolveFlutterwaveAccount('1234567890', '044');
      expect(result.accountName).toBeNull();
      expect(result.error).toBe('Account verification failed. Please try again.');
    });

    it('returns null accountName when data has no account_name field', async () => {
      creatorServiceSpy.resolveFlutterwaveAccount.and.returnValue(
        Promise.resolve({ data: {} as any, error: undefined }),
      );
      const result = await service.resolveFlutterwaveAccount('1234567890', '044');
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
      session_type: 'online' as const,
      physical_address: null,
      tips_enabled: false,
      shop_enabled: false,
      response_expectation: '',
      auto_reply_text: null,
      buffer_minutes: 0,
      created_at: NOW,
      updated_at: NOW,
    };

    it('loads Flutterwave subaccount for a flutterwave creator', async () => {
      const creator = makeCreator({ payment_provider: 'flutterwave' });
      const subaccount = makeFlutterwaveSubaccount();

      creatorServiceSpy.getCurrentCreator.and.returnValue(Promise.resolve(creator) as any);
      creatorServiceSpy.getCreatorSettings.and.returnValue(
        Promise.resolve({ data: mockSettings as any, error: null }),
      );
      creatorServiceSpy.getFlutterwaveSubaccount.and.returnValue(
        Promise.resolve({ data: subaccount, error: null }),
      );

      await service.loadCreatorData();

      expect(creatorServiceSpy.getFlutterwaveSubaccount).toHaveBeenCalledWith(creator.id);
      // Stripe account should NOT be loaded for Flutterwave creators
      expect(creatorServiceSpy.getStripeAccount).not.toHaveBeenCalled();
    });

    it('sets flutterwaveSubaccount signal when Flutterwave subaccount is found', async () => {
      const creator = makeCreator({ payment_provider: 'flutterwave' });
      const subaccount = makeFlutterwaveSubaccount();

      creatorServiceSpy.getCurrentCreator.and.returnValue(Promise.resolve(creator) as any);
      creatorServiceSpy.getCreatorSettings.and.returnValue(
        Promise.resolve({ data: mockSettings as any, error: null }),
      );
      creatorServiceSpy.getFlutterwaveSubaccount.and.returnValue(
        Promise.resolve({ data: subaccount, error: null }),
      );

      await service.loadCreatorData();

      expect(service.flutterwaveSubaccount()).toEqual(subaccount);
    });

    it('does not call getFlutterwaveSubaccount for a stripe creator', async () => {
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

      expect(creatorServiceSpy.getFlutterwaveSubaccount).not.toHaveBeenCalled();
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
