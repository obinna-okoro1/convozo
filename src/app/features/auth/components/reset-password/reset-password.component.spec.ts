/**
 * Unit tests for ResetPasswordComponent
 *
 * What is covered:
 *   ngOnInit — PKCE code exchange
 *     1. Missing ?code= param sets sessionError, clears sessionLoading
 *     2. Valid code calls supabase.auth.exchangeCodeForSession
 *     3. Supabase exchange error sets sessionError, clears sessionLoading
 *     4. Successful exchange clears sessionLoading with no sessionError
 *
 *   handleResetPassword() — validation
 *     5. Password shorter than 8 chars sets error, does NOT call authService
 *     6. Exactly 7 chars is rejected
 *     7. Exactly 8 chars is accepted
 *     8. Passwords that don't match set a mismatch error
 *     9. Matching, valid passwords proceed to authService
 *
 *   handleResetPassword() — success path
 *    10. Calls authService.updatePassword with the new password
 *    11. Sets success to true
 *    12. Calls supabase.auth.signOut to clear the recovery session
 *    13. Resets loading to false
 *
 *   handleResetPassword() — failure path
 *    14. Sets error to the message returned by authService
 *    15. Falls back to a generic error string when authService returns no message
 *    16. Keeps success as false
 *    17. Resets loading to false and does NOT call signOut
 *
 *   Signal helpers
 *    18. updateNewPassword clears the error signal
 *    19. updateConfirmPassword clears the error signal
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/unbound-method */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ResetPasswordComponent } from './reset-password.component';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { AuthService } from '../../services/auth.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal ActivatedRoute stub with an optional ?code= param. */
function makeRoute(code: string | null): Partial<ActivatedRoute> {
  return {
    snapshot: {
      queryParamMap: {
        get: (key: string) => (key === 'code' ? code : null),
        has: (key: string) => key === 'code' && code !== null,
        getAll: () => [],
        keys: [],
      },
    } as unknown as ActivatedRoute['snapshot'],
  };
}

/** Build a SupabaseService stub with configurable exchangeCodeForSession / signOut. */
function makeSupabaseSpy(opts: { exchangeError?: Error | null } = {}) {
  const exchangeResult = opts.exchangeError ? { error: opts.exchangeError } : { error: null };

  const mockClient = {
    auth: {
      exchangeCodeForSession: jasmine
        .createSpy('exchangeCodeForSession')
        .and.resolveTo(exchangeResult),
      signOut: jasmine.createSpy('signOut').and.resolveTo(undefined),
    },
  };

  return jasmine.createSpyObj<SupabaseService>(
    'SupabaseService',
    ['waitForSession', 'getCurrentUser'],
    { client: mockClient as any },
  );
}

// ── Spec ─────────────────────────────────────────────────────────────────────

describe('ResetPasswordComponent', () => {
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let component: ResetPasswordComponent;
  let authSpy: jasmine.SpyObj<AuthService>;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;

  function configureWith(opts: {
    code?: string | null;
    updateResult?: { success: boolean; error?: string };
    exchangeError?: Error | null;
  }): void {
    const code = opts.code !== undefined ? opts.code : 'valid-code-123';
    const updateResult = opts.updateResult ?? { success: true };

    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['updatePassword']);
    authSpy.updatePassword.and.returnValue(Promise.resolve(updateResult));

    supabaseSpy = makeSupabaseSpy({ exchangeError: opts.exchangeError ?? null });

    TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ActivatedRoute, useValue: makeRoute(code) },
      ],
    });

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    configureWith({});
  });

  // ── ngOnInit — PKCE code exchange ─────────────────────────────────────────

  it('sets sessionError when ?code= is missing from the URL', async () => {
    TestBed.resetTestingModule();
    configureWith({ code: null });

    fixture.detectChanges(); // triggers ngOnInit
    // Wait for the async exchangeSession to complete
    await fixture.whenStable();

    expect((component as any).sessionError()).toBeTruthy();
  });

  it('clears sessionLoading when ?code= is missing', async () => {
    TestBed.resetTestingModule();
    configureWith({ code: null });

    fixture.detectChanges();
    await fixture.whenStable();

    expect((component as any).sessionLoading()).toBeFalse();
  });

  it('does NOT call exchangeCodeForSession when code is missing', async () => {
    TestBed.resetTestingModule();
    configureWith({ code: null });

    fixture.detectChanges();
    await fixture.whenStable();

    expect(supabaseSpy.client.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('calls exchangeCodeForSession with the code from the URL', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(supabaseSpy.client.auth.exchangeCodeForSession).toHaveBeenCalledOnceWith(
      'valid-code-123',
    );
  });

  it('sets sessionError when Supabase rejects the code', async () => {
    TestBed.resetTestingModule();
    configureWith({ exchangeError: new Error('JWT expired') });

    fixture.detectChanges();
    await fixture.whenStable();

    expect((component as any).sessionError()).toBeTruthy();
  });

  it('clears sessionLoading after a failed exchange', async () => {
    TestBed.resetTestingModule();
    configureWith({ exchangeError: new Error('JWT expired') });

    fixture.detectChanges();
    await fixture.whenStable();

    expect((component as any).sessionLoading()).toBeFalse();
  });

  it('clears sessionLoading after a successful exchange', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect((component as any).sessionLoading()).toBeFalse();
  });

  it('sets no sessionError after a successful exchange', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect((component as any).sessionError()).toBeNull();
  });

  // ── handleResetPassword() — validation ────────────────────────────────────

  it('returns early with an error for a password shorter than 8 chars', async () => {
    (component as any).newPassword.set('short');
    (component as any).confirmPassword.set('short');
    await (component as any).handleResetPassword();

    expect((component as any).error()).toContain('8 characters');
    expect(authSpy.updatePassword).not.toHaveBeenCalled();
  });

  it('rejects a password of exactly 7 characters', async () => {
    (component as any).newPassword.set('1234567');
    (component as any).confirmPassword.set('1234567');
    await (component as any).handleResetPassword();

    expect(authSpy.updatePassword).not.toHaveBeenCalled();
  });

  it('accepts a password of exactly 8 characters', async () => {
    (component as any).newPassword.set('12345678');
    (component as any).confirmPassword.set('12345678');
    await (component as any).handleResetPassword();

    expect(authSpy.updatePassword).toHaveBeenCalled();
  });

  it('sets a mismatch error when passwords do not match', async () => {
    (component as any).newPassword.set('password123');
    (component as any).confirmPassword.set('different456');
    await (component as any).handleResetPassword();

    expect((component as any).error()).toContain('match');
    expect(authSpy.updatePassword).not.toHaveBeenCalled();
  });

  // ── handleResetPassword() — success path ──────────────────────────────────

  it('calls authService.updatePassword with the new password', async () => {
    (component as any).newPassword.set('securepass99');
    (component as any).confirmPassword.set('securepass99');
    await (component as any).handleResetPassword();

    expect(authSpy.updatePassword).toHaveBeenCalledOnceWith('securepass99');
  });

  it('sets success to true after a successful update', async () => {
    (component as any).newPassword.set('securepass99');
    (component as any).confirmPassword.set('securepass99');
    await (component as any).handleResetPassword();

    expect((component as any).success()).toBeTrue();
  });

  it('calls supabase signOut to clear the recovery session on success', async () => {
    (component as any).newPassword.set('securepass99');
    (component as any).confirmPassword.set('securepass99');
    await (component as any).handleResetPassword();

    expect(supabaseSpy.client.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('resets loading to false after a successful update', async () => {
    (component as any).newPassword.set('securepass99');
    (component as any).confirmPassword.set('securepass99');
    await (component as any).handleResetPassword();

    expect((component as any).loading()).toBeFalse();
  });

  // ── handleResetPassword() — failure path ──────────────────────────────────

  it('sets error to the service message on failure', async () => {
    TestBed.resetTestingModule();
    configureWith({ updateResult: { success: false, error: 'Session expired' } });

    (component as any).newPassword.set('securepass99');
    (component as any).confirmPassword.set('securepass99');
    await (component as any).handleResetPassword();

    expect((component as any).error()).toBe('Session expired');
  });

  it('falls back to a generic error string when service returns no message', async () => {
    TestBed.resetTestingModule();
    configureWith({ updateResult: { success: false } });

    (component as any).newPassword.set('securepass99');
    (component as any).confirmPassword.set('securepass99');
    await (component as any).handleResetPassword();

    expect((component as any).error()).toBeTruthy();
  });

  it('keeps success as false on a failed update', async () => {
    TestBed.resetTestingModule();
    configureWith({ updateResult: { success: false, error: 'Fail' } });

    (component as any).newPassword.set('securepass99');
    (component as any).confirmPassword.set('securepass99');
    await (component as any).handleResetPassword();

    expect((component as any).success()).toBeFalse();
  });

  it('resets loading to false after a failed update', async () => {
    TestBed.resetTestingModule();
    configureWith({ updateResult: { success: false, error: 'Fail' } });

    (component as any).newPassword.set('securepass99');
    (component as any).confirmPassword.set('securepass99');
    await (component as any).handleResetPassword();

    expect((component as any).loading()).toBeFalse();
  });

  it('does NOT call signOut when the update fails', async () => {
    TestBed.resetTestingModule();
    configureWith({ updateResult: { success: false, error: 'Fail' } });

    (component as any).newPassword.set('securepass99');
    (component as any).confirmPassword.set('securepass99');
    await (component as any).handleResetPassword();

    expect(supabaseSpy.client.auth.signOut).not.toHaveBeenCalled();
  });

  // ── Signal helpers ────────────────────────────────────────────────────────

  it('updateNewPassword clears the error signal', () => {
    (component as any).error.set('Some error');
    (component as any).updateNewPassword('newvalue');

    expect((component as any).error()).toBeNull();
  });

  it('updateConfirmPassword clears the error signal', () => {
    (component as any).error.set('Some error');
    (component as any).updateConfirmPassword('newvalue');

    expect((component as any).error()).toBeNull();
  });

  it('updateNewPassword updates the newPassword signal', () => {
    (component as any).updateNewPassword('mypassword');

    expect((component as any).newPassword()).toBe('mypassword');
  });

  it('updateConfirmPassword updates the confirmPassword signal', () => {
    (component as any).updateConfirmPassword('mypassword');

    expect((component as any).confirmPassword()).toBe('mypassword');
  });
});
