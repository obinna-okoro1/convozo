/**
 * Unit tests for CreatorService — Flutterwave payment provider routing and methods.
 *
 * What these tests cover:
 *   1. createCreator() payment_provider routing
 *      — NG/ZA (any case) → 'flutterwave'
 *      — All other countries → 'stripe'
 *      — Country code is always uppercased before being stored
 *   2. getFlutterwaveSubaccount() — queries the correct table with creator_id
 *   3. getFlutterwaveBanks() — invokes get-flutterwave-banks edge function with country
 *   4. resolveFlutterwaveAccount() — invokes get-flutterwave-banks with resolve:true params
 *   5. createFlutterwaveSubaccount() — invokes create-flutterwave-recipient with all params
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { TestBed } from '@angular/core/testing';
import { CreatorService } from './creator.service';
import { SupabaseService } from '../../../core/services/supabase.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a fluent Supabase query chain that resolves to `result` at the terminal call. */
function makeQueryChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: jasmine.createSpy('select'),
    insert: jasmine.createSpy('insert'),
    eq: jasmine.createSpy('eq'),
    maybeSingle: jasmine.createSpy('maybeSingle').and.returnValue(Promise.resolve(result)),
    single: jasmine.createSpy('single').and.returnValue(Promise.resolve(result)),
  };
  chain.select.and.returnValue(chain);
  chain.insert.and.returnValue(chain);
  chain.eq.and.returnValue(chain);
  return chain;
}

/** Base creator insert data — override fields under test. */
function makeCreatorInput(country: string) {
  return {
    userId: 'user-1',
    email: 'creator@example.com',
    displayName: 'Test Creator',
    bio: 'Hello',
    slug: 'test-creator',
    phoneNumber: '+2348012345678',
    country,
  };
}

// ── Spec ─────────────────────────────────────────────────────────────────────

describe('CreatorService', () => {
  let service: CreatorService;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      from: jasmine.createSpy('from'),
      functions: {
        invoke: jasmine.createSpy('invoke'),
      },
    };

    const supabaseSpy = jasmine.createSpyObj<SupabaseService>(
      'SupabaseService',
      ['getCreatorByUserId', 'getCurrentUser'],
      { client: mockClient },
    );

    TestBed.configureTestingModule({
      providers: [CreatorService, { provide: SupabaseService, useValue: supabaseSpy }],
    });

    service = TestBed.inject(CreatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── createCreator — payment_provider routing ───────────────────────────────

  describe('createCreator() - payment_provider routing by country', () => {
    /**
     * Captures the object passed to .insert() and returns the mock creator.
     * Lets us assert what payment_provider and country values were sent to Supabase.
     */
    function setupInsertCapture(): { insertArgs: any[] } {
      const insertArgs: any[] = [];
      const chain: any = {
        select: () => chain,
        single: () => Promise.resolve({ data: { id: 'creator-1' }, error: null }),
      };
      mockClient.from.and.returnValue({
        insert: (data: unknown) => {
          insertArgs.push(data);
          return chain;
        },
      });
      return { insertArgs };
    }

    it('sets payment_provider to "flutterwave" for NG creators', async () => {
      const { insertArgs } = setupInsertCapture();
      await service.createCreator(makeCreatorInput('NG'));
      expect(insertArgs[0].payment_provider).toBe('flutterwave');
    });

    it('sets payment_provider to "flutterwave" for ZA creators', async () => {
      const { insertArgs } = setupInsertCapture();
      await service.createCreator(makeCreatorInput('ZA'));
      expect(insertArgs[0].payment_provider).toBe('flutterwave');
    });

    it('sets payment_provider to "flutterwave" for lowercase "ng" (case-insensitive)', async () => {
      const { insertArgs } = setupInsertCapture();
      await service.createCreator(makeCreatorInput('ng'));
      expect(insertArgs[0].payment_provider).toBe('flutterwave');
    });

    it('sets payment_provider to "flutterwave" for lowercase "za" (case-insensitive)', async () => {
      const { insertArgs } = setupInsertCapture();
      await service.createCreator(makeCreatorInput('za'));
      expect(insertArgs[0].payment_provider).toBe('flutterwave');
    });

    it('sets payment_provider to "stripe" for US creators', async () => {
      const { insertArgs } = setupInsertCapture();
      await service.createCreator(makeCreatorInput('US'));
      expect(insertArgs[0].payment_provider).toBe('stripe');
    });

    it('sets payment_provider to "stripe" for GB creators', async () => {
      const { insertArgs } = setupInsertCapture();
      await service.createCreator(makeCreatorInput('GB'));
      expect(insertArgs[0].payment_provider).toBe('stripe');
    });

    it('sets payment_provider to "stripe" for CA creators', async () => {
      const { insertArgs } = setupInsertCapture();
      await service.createCreator(makeCreatorInput('CA'));
      expect(insertArgs[0].payment_provider).toBe('stripe');
    });

    it('sets payment_provider to "stripe" for AU creators', async () => {
      const { insertArgs } = setupInsertCapture();
      await service.createCreator(makeCreatorInput('AU'));
      expect(insertArgs[0].payment_provider).toBe('stripe');
    });

    it('sets payment_provider to "stripe" for DE creators', async () => {
      const { insertArgs } = setupInsertCapture();
      await service.createCreator(makeCreatorInput('DE'));
      expect(insertArgs[0].payment_provider).toBe('stripe');
    });

    it('always stores country in uppercase regardless of input case', async () => {
      const { insertArgs } = setupInsertCapture();
      await service.createCreator(makeCreatorInput('ng'));
      // Stored as 'NG', not 'ng'
      expect(insertArgs[0].country).toBe('NG');
    });

    it('stores country in uppercase for Stripe countries too', async () => {
      const { insertArgs } = setupInsertCapture();
      await service.createCreator(makeCreatorInput('us'));
      expect(insertArgs[0].country).toBe('US');
      expect(insertArgs[0].payment_provider).toBe('stripe');
    });

    it('returns data and error from Supabase insert', async () => {
      const chain: any = {
        select: () => chain,
        single: () => Promise.resolve({ data: { id: 'creator-99' }, error: null }),
      };
      mockClient.from.and.returnValue({ insert: () => chain });
      const result = await service.createCreator(makeCreatorInput('NG'));
      expect(result.data).toEqual(jasmine.objectContaining({ id: 'creator-99' }));
      expect(result.error).toBeNull();
    });

    it('propagates Supabase error on insert failure', async () => {
      const supabaseError = { message: 'unique constraint violation' };
      const chain: any = {
        select: () => chain,
        single: () => Promise.resolve({ data: null, error: supabaseError }),
      };
      mockClient.from.and.returnValue({ insert: () => chain });
      const result = await service.createCreator(makeCreatorInput('NG'));
      expect(result.error).toEqual(
        jasmine.objectContaining({ message: 'unique constraint violation' }),
      );
    });
  });

  // ── getFlutterwaveSubaccount ───────────────────────────────────────────────

  describe('getFlutterwaveSubaccount()', () => {
    it('queries the flutterwave_subaccounts table', async () => {
      const chain = makeQueryChain({ data: null, error: null });
      mockClient.from.and.returnValue(chain);
      await service.getFlutterwaveSubaccount('creator-1');
      expect(mockClient.from).toHaveBeenCalledWith('flutterwave_subaccounts');
    });

    it('filters by creator_id', async () => {
      const chain = makeQueryChain({ data: null, error: null });
      mockClient.from.and.returnValue(chain);
      await service.getFlutterwaveSubaccount('creator-42');
      expect(chain.eq).toHaveBeenCalledWith('creator_id', 'creator-42');
    });

    it('returns the subaccount data when found', async () => {
      const mockSubaccount = {
        id: 'sub-1',
        creator_id: 'creator-1',
        subaccount_id: 'RS_abc123',
        is_active: true,
      };
      const chain = makeQueryChain({ data: mockSubaccount, error: null });
      mockClient.from.and.returnValue(chain);
      const result = await service.getFlutterwaveSubaccount('creator-1');
      expect(result.data).toEqual(
        jasmine.objectContaining({ id: 'sub-1', subaccount_id: 'RS_abc123' }),
      );
      expect(result.error).toBeNull();
    });

    it('returns null data when no subaccount exists', async () => {
      const chain = makeQueryChain({ data: null, error: null });
      mockClient.from.and.returnValue(chain);
      const result = await service.getFlutterwaveSubaccount('creator-new');
      expect(result.data).toBeNull();
    });
  });

  // ── getFlutterwaveBanks ───────────────────────────────────────────────────

  describe('getFlutterwaveBanks()', () => {
    it('invokes the get-flutterwave-banks edge function', async () => {
      mockClient.functions.invoke.and.returnValue(
        Promise.resolve({ data: { banks: [] }, error: null }),
      );
      await service.getFlutterwaveBanks('NG');
      expect(mockClient.functions.invoke).toHaveBeenCalledWith(
        'get-flutterwave-banks',
        jasmine.objectContaining({ body: { country: 'NG' } }),
      );
    });

    it('passes the correct country code to the edge function', async () => {
      mockClient.functions.invoke.and.returnValue(
        Promise.resolve({ data: { banks: [] }, error: null }),
      );
      await service.getFlutterwaveBanks('ZA');
      const [, options] = mockClient.functions.invoke.calls.mostRecent().args as [
        string,
        { body: { country: string } },
      ];
      expect(options.body.country).toBe('ZA');
    });

    it('returns data and error from the edge function', async () => {
      const mockBanks = [{ name: 'GTBank', code: '058', country: 'Nigeria', currency: 'NGN' }];
      mockClient.functions.invoke.and.returnValue(
        Promise.resolve({ data: { banks: mockBanks }, error: null }),
      );
      const result = await service.getFlutterwaveBanks('NG');
      expect((result.data as any).banks).toEqual(mockBanks);
    });

    it('propagates edge function errors', async () => {
      const fnError = { message: 'Edge function unavailable' };
      mockClient.functions.invoke.and.returnValue(Promise.resolve({ data: null, error: fnError }));
      const result = await service.getFlutterwaveBanks('NG');
      expect(result.error).toEqual(
        jasmine.objectContaining({ message: 'Edge function unavailable' }),
      );
    });
  });

  // ── resolveFlutterwaveAccount ─────────────────────────────────────────────

  describe('resolveFlutterwaveAccount()', () => {
    it('invokes the get-flutterwave-banks edge function with resolve:true', async () => {
      mockClient.functions.invoke.and.returnValue(
        Promise.resolve({ data: { account_name: 'JOHN DOE' }, error: null }),
      );
      await service.resolveFlutterwaveAccount('1234567890', '044');
      expect(mockClient.functions.invoke).toHaveBeenCalledWith(
        'get-flutterwave-banks',
        jasmine.objectContaining({
          body: { resolve: true, account_number: '1234567890', bank_code: '044' },
        }),
      );
    });

    it('passes the account number and bank code correctly', async () => {
      mockClient.functions.invoke.and.returnValue(
        Promise.resolve({ data: { account_name: 'ADEWALE' }, error: null }),
      );
      await service.resolveFlutterwaveAccount('9999999999', '033');
      const [, options] = mockClient.functions.invoke.calls.mostRecent().args as [
        string,
        { body: { account_number: string; bank_code: string } },
      ];
      expect(options.body.account_number).toBe('9999999999');
      expect(options.body.bank_code).toBe('033');
    });

    it('returns the account name on success', async () => {
      mockClient.functions.invoke.and.returnValue(
        Promise.resolve({ data: { account_name: 'NOMSA DLAMINI' }, error: null }),
      );
      const result = await service.resolveFlutterwaveAccount('6200123456', 'FNB');
      expect((result.data as any).account_name).toBe('NOMSA DLAMINI');
    });

    it('propagates edge function errors on failure', async () => {
      const fnError = { message: 'Could not resolve account' };
      mockClient.functions.invoke.and.returnValue(Promise.resolve({ data: null, error: fnError }));
      const result = await service.resolveFlutterwaveAccount('0000000000', '044');
      expect(result.error).toEqual(
        jasmine.objectContaining({ message: 'Could not resolve account' }),
      );
    });
  });

  // ── createFlutterwaveSubaccount ───────────────────────────────────────────

  describe('createFlutterwaveSubaccount()', () => {
    it('invokes the create-flutterwave-recipient edge function', async () => {
      mockClient.functions.invoke.and.returnValue(
        Promise.resolve({ data: { subaccount_id: 'RS_new' }, error: null }),
      );
      await service.createFlutterwaveSubaccount({
        bankCode: '044',
        accountNumber: '1234567890',
        businessName: 'Test Creator',
        country: 'NG',
      });
      expect(mockClient.functions.invoke).toHaveBeenCalledWith(
        'create-flutterwave-recipient',
        jasmine.objectContaining({
          body: {
            bank_code: '044',
            account_number: '1234567890',
            business_name: 'Test Creator',
            country: 'NG',
          },
        }),
      );
    });

    it('passes all four required params to the edge function', async () => {
      mockClient.functions.invoke.and.returnValue(Promise.resolve({ data: null, error: null }));
      await service.createFlutterwaveSubaccount({
        bankCode: 'FNB',
        accountNumber: '6200123456',
        businessName: 'Nomsa Dlamini',
        country: 'ZA',
      });
      const [, options] = mockClient.functions.invoke.calls.mostRecent().args as [
        string,
        {
          body: { bank_code: string; account_number: string; business_name: string; country: string };
        },
      ];
      expect(options.body.bank_code).toBe('FNB');
      expect(options.body.account_number).toBe('6200123456');
      expect(options.body.business_name).toBe('Nomsa Dlamini');
      expect(options.body.country).toBe('ZA');
    });

    it('returns the subaccount data on success', async () => {
      const mockData = { subaccount_id: 'RS_xyz', is_active: true };
      mockClient.functions.invoke.and.returnValue(Promise.resolve({ data: mockData, error: null }));
      const result = await service.createFlutterwaveSubaccount({
        bankCode: '044',
        accountNumber: '1234567890',
        businessName: 'Test',
        country: 'NG',
      });
      expect(result.data).toEqual(jasmine.objectContaining({ subaccount_id: 'RS_xyz' }));
      expect(result.error).toBeNull();
    });

    it('propagates edge function errors', async () => {
      const fnError = { message: 'Bank code invalid' };
      mockClient.functions.invoke.and.returnValue(Promise.resolve({ data: null, error: fnError }));
      const result = await service.createFlutterwaveSubaccount({
        bankCode: '000',
        accountNumber: '0000000000',
        businessName: 'Test',
        country: 'NG',
      });
      expect(result.error).toEqual(fnError);
    });
  });
});
