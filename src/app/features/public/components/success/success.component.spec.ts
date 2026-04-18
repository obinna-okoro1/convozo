/**
 * SuccessComponent — unit tests
 *
 * Covers:
 *  - Default message-sent view when no special query params present
 *  - Call booking view (type=call)
 *  - Support tip view (type=support)
 *  - Shop purchase view (shop=1)
 *  - Flutterwave cancelled/failed status → redirect away (never show success)
 *  - Flutterwave successful status → shows success normally
 *  - goBack() navigation with/without creator slug
 *  - Google Calendar URL generation
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { SuccessComponent } from './success.component';
import { ShopService } from '@features/creator/services/shop.service';

function buildRoute(
  params: Record<string, string>,
): { snapshot: { queryParamMap: ReturnType<typeof convertToParamMap> } } {
  return { snapshot: { queryParamMap: convertToParamMap(params) } };
}

describe('SuccessComponent', () => {
  let fixture: ComponentFixture<SuccessComponent>;
  let router: Router;
  let shopService: jasmine.SpyObj<ShopService>;

  function create(queryParams: Record<string, string> = {}): void {
    shopService = jasmine.createSpyObj('ShopService', ['getShopDownloadUrl']);
    shopService.getShopDownloadUrl.and.returnValue(
      Promise.resolve({ data: undefined, error: { message: 'no session' } }),
    );

    TestBed.configureTestingModule({
      imports: [SuccessComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: buildRoute(queryParams) },
        { provide: ShopService, useValue: shopService },
      ],
    });

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

    fixture = TestBed.createComponent(SuccessComponent);
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comp = (): any => fixture.componentInstance;

  // ── Default (message) view ──────────────────────────────────────────────

  it('defaults to message-sent view when no type/shop params', () => {
    create({ creator: 'johndoe' });
    expect(comp().isCallBooking()).toBeFalse();
    expect(comp().isShopPurchase()).toBeFalse();
    expect(comp().isSupportTip()).toBeFalse();
    expect(comp().creatorSlug()).toBe('johndoe');
  });

  // ── Type-specific views ─────────────────────────────────────────────────

  it('sets isCallBooking when type=call', () => {
    create({ type: 'call', creator: 'expert1' });
    expect(comp().isCallBooking()).toBeTrue();
    expect(comp().isShopPurchase()).toBeFalse();
    expect(comp().isSupportTip()).toBeFalse();
  });

  it('sets isSupportTip when type=support', () => {
    create({ type: 'support', creator: 'expert1' });
    expect(comp().isSupportTip()).toBeTrue();
    expect(comp().isCallBooking()).toBeFalse();
  });

  it('sets isShopPurchase when shop=1', () => {
    create({ shop: '1', creator: 'expert1', session_id: 'cs_test_123' });
    expect(comp().isShopPurchase()).toBeTrue();
  });

  // ── Flutterwave status redirect (critical security fix) ─────────────────

  it('redirects away when Flutterwave status=cancelled', () => {
    create({ status: 'cancelled', creator: 'johndoe' });
    expect(router.navigate).toHaveBeenCalledOnceWith(
      ['/', 'johndoe'],
      jasmine.objectContaining({ queryParams: { payment: 'cancelled' } }),
    );
  });

  it('redirects away when Flutterwave status=failed', () => {
    create({ status: 'failed', creator: 'johndoe' });
    expect(router.navigate).toHaveBeenCalledOnceWith(
      ['/', 'johndoe'],
      jasmine.objectContaining({ queryParams: { payment: 'cancelled' } }),
    );
  });

  it('redirects to home when Flutterwave status=cancelled and no creator slug', () => {
    create({ status: 'cancelled' });
    expect(router.navigate).toHaveBeenCalledOnceWith(
      ['/'],
      jasmine.objectContaining({ queryParams: { payment: 'cancelled' } }),
    );
  });

  it('does NOT redirect when Flutterwave status=successful', () => {
    create({ status: 'successful', creator: 'johndoe' });
    expect(router.navigate).not.toHaveBeenCalled();
    expect(comp().creatorSlug()).toBe('johndoe');
  });

  it('does NOT redirect when no status param (Stripe flow)', () => {
    create({ creator: 'johndoe' });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  // ── Signal state not set on cancelled redirect ──────────────────────────

  it('does NOT set isCallBooking when redirecting on cancelled status', () => {
    create({ status: 'cancelled', type: 'call', creator: 'x' });
    expect(comp().isCallBooking()).toBeFalse();
  });

  // ── goBack() navigation ─────────────────────────────────────────────────

  it('navigates to creator profile on goBack() when slug is set', () => {
    create({ creator: 'johndoe' });
    comp().goBack();
    expect(router.navigate).toHaveBeenCalledWith(['/', 'johndoe']);
  });

  it('navigates to home on goBack() when no creator slug', () => {
    create({});
    comp().goBack();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  // ── Google Calendar URL ─────────────────────────────────────────────────

  it('generates a valid Google Calendar URL for call bookings', () => {
    create({
      type: 'call',
      creator: 'expert1',
      name: 'Dr Smith',
      scheduled_at: '2026-05-01T14:00:00Z',
      duration: '60',
    });
    const url: string = comp().getGoogleCalendarUrl();
    expect(url).toContain('calendar.google.com/calendar/render');
    expect(url).toContain('Dr+Smith');
    expect(url).toContain('20260501T140000');
  });

  // ── Shop download fetch ─────────────────────────────────────────────────

  it('calls shopService.getShopDownloadUrl when shop=1 with session_id', () => {
    create({ shop: '1', session_id: 'cs_test_abc', creator: 'x' });
    expect(shopService.getShopDownloadUrl).toHaveBeenCalledOnceWith('cs_test_abc');
  });

  it('does NOT call shopService when shop param is missing', () => {
    create({ creator: 'x' });
    expect(shopService.getShopDownloadUrl).not.toHaveBeenCalled();
  });
});
