/**
 * Unit tests for authGuard
 * Covers: authenticated pass-through, unauthenticated redirect, and
 * the async session-wait behaviour.
 */

import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { SupabaseService } from '../services/supabase.service';

/** Helper to invoke the functional guard in the TestBed context. */
async function runGuard(): Promise<boolean | unknown> {
  return TestBed.runInInjectionContext(async () =>
    authGuard(
      {} as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
    ),
  );
}

describe('authGuard', () => {
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let router: Router;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['waitForSession']);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: supabaseSpy },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('returns true when a session exists', async () => {
    // Simulate an authenticated user object
    supabaseSpy.waitForSession.and.resolveTo({ id: 'user-1' } as never);

    const result = await runGuard();

    expect(result).toBeTrue();
  });

  it('returns false when there is no session', async () => {
    supabaseSpy.waitForSession.and.resolveTo(null);

    const result = await runGuard();

    expect(result).toBeFalse();
  });

  it('navigates to /auth/login when there is no session', async () => {
    supabaseSpy.waitForSession.and.resolveTo(null);
    const navigateSpy = spyOn(router, 'navigate');

    await runGuard();

    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });

  it('does NOT navigate when a session exists', async () => {
    supabaseSpy.waitForSession.and.resolveTo({ id: 'user-2' } as never);
    const navigateSpy = spyOn(router, 'navigate');

    await runGuard();

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('calls waitForSession exactly once per guard invocation', async () => {
    supabaseSpy.waitForSession.and.resolveTo(null);

    await runGuard();

    expect(supabaseSpy.waitForSession).toHaveBeenCalledTimes(1);
  });
});
