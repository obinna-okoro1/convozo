/**
 * Unit tests for AuthService — sendPasswordResetEmail() and updatePassword()
 *
 * What is covered:
 *   sendPasswordResetEmail()
 *     1. Invalid / empty email → returns { success: false, error: ... } without calling Supabase
 *     2. Valid email → calls supabase.auth.resetPasswordForEmail with correct redirectTo
 *     3. Supabase returns an error → surfaces error message
 *     4. Supabase returns ok → returns { success: true }
 *
 *   updatePassword()
 *     1. Password shorter than 8 chars → returns { success: false } without calling Supabase
 *     2. Valid password → calls supabase.auth.updateUser({ password })
 *     3. Supabase returns an error → surfaces error message
 *     4. Supabase returns ok → returns { success: true }
 */





import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Mock } from 'vitest';

import { type SpyObj, createSpyObj } from '@testing/test-utils';

import { AuthService } from './auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock of the SupabaseService client with only the auth methods
 * needed for the password-reset flow.
 */
function makeAuthClient(
  overrides: Partial<{
    resetPasswordForEmail: Mock;
    updateUser: Mock;
  }> = {},
) {
  return {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
      getSession: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail:
        overrides.resetPasswordForEmail ??
        vi.fn()
          .mockResolvedValue({ error: null }),
      updateUser:
        overrides.updateUser ??
        vi.fn()
          .mockResolvedValue({ data: {}, error: null }),
    },
  };
}

// ── Spec ─────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let mockClient: ReturnType<typeof makeAuthClient>;
  let supabaseSpy: SpyObj<SupabaseService>;

  /** Re-configure TestBed with a fresh client. Call inside beforeEach or a test. */
  function configureWith(clientOverrides: Parameters<typeof makeAuthClient>[0] = {}) {
    mockClient = makeAuthClient(clientOverrides);
    supabaseSpy = createSpyObj<SupabaseService>(['getCreatorByUserId', 'waitForSession', 'getCurrentUser'],
      { client: mockClient },
    );
    // Prevent real navigation; router is provided via provideRouter([])
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideRouter([]),
        { provide: SupabaseService, useValue: supabaseSpy },
      ],
    });
    service = TestBed.inject(AuthService);
  }

  beforeEach(() => {
    configureWith();
  });

  // ── sendPasswordResetEmail ─────────────────────────────────────────────────

  describe('sendPasswordResetEmail()', () => {
    it('returns { success: false } for an empty email without calling Supabase', async () => {
      const result = await service.sendPasswordResetEmail('');

      expect(result.success)
        .toBe(false);
      expect(result.error)
        .toBeTruthy();
      expect(mockClient.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    });

    it('returns { success: false } for a plainly invalid email', async () => {
      const result = await service.sendPasswordResetEmail('not-an-email');

      expect(result.success)
        .toBe(false);
      expect(mockClient.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    });

    it('returns { success: false } for an email missing TLD', async () => {
      const result = await service.sendPasswordResetEmail('user@nodomain');

      expect(result.success)
        .toBe(false);
      expect(mockClient.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    });

    it('calls resetPasswordForEmail with the correct email for a valid address', async () => {
      await service.sendPasswordResetEmail('user@example.com');

      expect(mockClient.auth.resetPasswordForEmail)
        .toHaveBeenCalledExactlyOnceWith(
          'user@example.com',
          expect.any(Object),
        );
    });

    it('passes a redirectTo URL ending in /auth/reset-password', async () => {
      await service.sendPasswordResetEmail('user@example.com');

      const args = mockClient.auth.resetPasswordForEmail.mock.calls[0] as [
        string,
        { redirectTo: string },
      ];
      const [, opts] = args;
      expect(opts.redirectTo)
        .toContain('/auth/reset-password');
    });

    it('returns { success: true } when Supabase returns no error', async () => {
      const result = await service.sendPasswordResetEmail('user@example.com');

      expect(result.success)
        .toBe(true);
      expect(result.error)
        .toBeUndefined();
    });

    it('returns { success: false, error } when Supabase returns an error', async () => {
      TestBed.resetTestingModule();
      configureWith({
        resetPasswordForEmail: vi.fn()
          .mockResolvedValue({ error: new Error('Rate limit exceeded') }),
      });

      const result = await service.sendPasswordResetEmail('user@example.com');

      expect(result.success)
        .toBe(false);
      expect(result.error)
        .toBe('Rate limit exceeded');
    });

    it('returns a fallback error string when the thrown value is not an Error instance', async () => {
      TestBed.resetTestingModule();
      configureWith({
        resetPasswordForEmail: vi.fn()
          .mockRejectedValue('string rejection'),
      });

      const result = await service.sendPasswordResetEmail('user@example.com');

      expect(result.success)
        .toBe(false);
      expect(result.error)
        .toBe('Failed to send reset email');
    });
  });

  // ── updatePassword ─────────────────────────────────────────────────────────

  describe('updatePassword()', () => {
    it('returns { success: false } for a password shorter than 8 characters', async () => {
      const result = await service.updatePassword('short');

      expect(result.success)
        .toBe(false);
      expect(result.error)
        .toContain('8 characters');
      expect(mockClient.auth.updateUser).not.toHaveBeenCalled();
    });

    it('returns { success: false } for exactly 7 characters', async () => {
      const result = await service.updatePassword('1234567');

      expect(result.success)
        .toBe(false);
      expect(mockClient.auth.updateUser).not.toHaveBeenCalled();
    });

    it('accepts a password of exactly 8 characters', async () => {
      const result = await service.updatePassword('12345678');

      expect(result.success)
        .toBe(true);
    });

    it('calls supabase.auth.updateUser with the password', async () => {
      await service.updatePassword('securepassword');

      expect(mockClient.auth.updateUser)
        .toHaveBeenCalledExactlyOnceWith({ password: 'securepassword' });
    });

    it('returns { success: true } when Supabase returns no error', async () => {
      const result = await service.updatePassword('securepassword');

      expect(result.success)
        .toBe(true);
      expect(result.error)
        .toBeUndefined();
    });

    it('returns { success: false, error } when Supabase returns an error', async () => {
      TestBed.resetTestingModule();
      configureWith({
        updateUser: vi.fn()
          .mockResolvedValue({ data: null, error: new Error('Expired recovery session') }),
      });

      const result = await service.updatePassword('securepassword');

      expect(result.success)
        .toBe(false);
      expect(result.error)
        .toBe('Expired recovery session');
    });

    it('returns a fallback error string when the thrown value is not an Error instance', async () => {
      TestBed.resetTestingModule();
      configureWith({
        updateUser: vi.fn()
          .mockRejectedValue({ code: 42 }), // non-Error object
      });

      const result = await service.updatePassword('securepassword');

      expect(result.success)
        .toBe(false);
      expect(result.error)
        .toBe('Failed to update password');
    });

    it('does NOT call updateUser for an empty string', async () => {
      await service.updatePassword('');

      expect(mockClient.auth.updateUser).not.toHaveBeenCalled();
    });
  });
});
