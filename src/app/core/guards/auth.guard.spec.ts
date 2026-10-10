/**
 * Unit tests for authGuard
 * Covers: authenticated pass-through, unauthenticated redirect, and
 * the async session-wait behaviour.
 */

import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import type { User } from '@supabase/supabase-js';

import { type SpyObj, createSpyObj } from '@testing/test-utils';

import { authGuard } from './auth.guard';
import { SupabaseService } from '../services/supabase.service';

/** Helper to invoke the functional guard in the TestBed context. */
async function runGuard(): Promise<unknown> {
  return TestBed.runInInjectionContext(async () =>
    authGuard(
      {} as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
    ),
  );
}

describe('authGuard', () => {
  let supabaseSpy: SpyObj<SupabaseService>;
  let router: Router;

  beforeEach(() => {
    supabaseSpy = createSpyObj<SupabaseService>(['waitForSession']);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'auth/login', children: [] }]),
        { provide: SupabaseService, useValue: supabaseSpy },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('returns true when a session exists', async () => {
    // Simulate an authenticated user object
    supabaseSpy.waitForSession.mockResolvedValue({ id: 'user-1' } as User);

    const result = await runGuard();

    expect(result)
      .toBe(true);
  });

  it('returns false when there is no session', async () => {
    supabaseSpy.waitForSession.mockResolvedValue(null);

    const result = await runGuard();

    expect(result)
      .toBe(false);
  });

  it('navigates to /auth/login when there is no session', async () => {
    supabaseSpy.waitForSession.mockResolvedValue(null);
    const navigateSpy = vi.spyOn(router, 'navigate');

    await runGuard();

    expect(navigateSpy)
      .toHaveBeenCalledWith(['/auth/login']);
  });

  it('does NOT navigate when a session exists', async () => {
    supabaseSpy.waitForSession.mockResolvedValue({ id: 'user-2' } as User);
    const navigateSpy = vi.spyOn(router, 'navigate');

    await runGuard();

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('calls waitForSession exactly once per guard invocation', async () => {
    supabaseSpy.waitForSession.mockResolvedValue(null);

    await runGuard();

    expect(supabaseSpy.waitForSession)
      .toHaveBeenCalledTimes(1);
  });
});
