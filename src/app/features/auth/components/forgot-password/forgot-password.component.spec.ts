/**
 * Unit tests for ForgotPasswordComponent
 *
 * What is covered:
 *   Rendering
 *     1. Email input and submit button are present on initial render
 *     2. Success state hides the form and shows the check-email message
 *     3. Error message is visible when the error signal is set
 *
 *   handleSubmit() — empty email guard
 *     4. Submitting an empty email shows an inline error, does NOT call authService
 *
 *   handleSubmit() — success path
 *     5. Submitting a valid email calls authService.sendPasswordResetEmail
 *     6. On success, loading becomes false and success signal becomes true
 *     7. Error signal is cleared before the async call begins
 *
 *   handleSubmit() — error path
 *     8. On failure, error is set to the message returned by the service
 *     9. Loading is always reset to false after the call (success or failure)
 *
 *   updateEmail() helper
 *    10. Calling updateEmail() clears any existing error signal
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/unbound-method */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../services/auth.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

describe('ForgotPasswordComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let component: ForgotPasswordComponent;
  let authSpy: jasmine.SpyObj<AuthService>;

  function configureWith(result: { success: boolean; error?: string }): void {
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['sendPasswordResetEmail']);
    authSpy.sendPasswordResetEmail.and.returnValue(Promise.resolve(result));

    TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authSpy }],
    });
    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    configureWith({ success: true });
  });

  // ── Rendering ───────────────────────────────────────────────────────────────

  it('renders the email input on initial load', () => {
    const input = fixture.nativeElement.querySelector(
      'input[type="email"]',
    ) as HTMLInputElement | null;
    expect(input).toBeTruthy();
  });

  it('renders the submit button on initial load', () => {
    const btn = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
  });

  it('hides the form and shows the success message after a successful submission', async () => {
    // Drive the private signal via the public method
    (component as any).email.set('user@example.com');
    await (component as any).handleSubmit();
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLElement | null;
    expect(form).toBeNull(); // @if success hides the form

    const heading = fixture.nativeElement.querySelector('h2') as HTMLElement;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    expect((heading.textContent ?? '').toLowerCase()).toContain('email');
  });

  it('shows an error message when the error signal is truthy', async () => {
    TestBed.resetTestingModule();
    configureWith({ success: false, error: 'User not found' });

    (component as any).email.set('nobody@example.com');
    await (component as any).handleSubmit();
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    expect(nativeEl.textContent).toContain('User not found');
  });

  // ── handleSubmit() — empty email ──────────────────────────────────────────

  it('does not call authService when email is empty', async () => {
    (component as any).email.set('');
    await (component as any).handleSubmit();

    expect(authSpy.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('sets an error signal when email is empty', async () => {
    (component as any).email.set('');
    await (component as any).handleSubmit();

    expect((component as any).error()).toBeTruthy();
  });

  it('does not call authService when email is only whitespace', async () => {
    (component as any).email.set('   ');
    await (component as any).handleSubmit();

    expect(authSpy.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  // ── handleSubmit() — success path ─────────────────────────────────────────

  it('calls sendPasswordResetEmail with the trimmed email', async () => {
    (component as any).email.set('  user@example.com  ');
    await (component as any).handleSubmit();

    expect(authSpy.sendPasswordResetEmail).toHaveBeenCalledOnceWith('user@example.com');
  });

  it('sets success to true after a successful call', async () => {
    (component as any).email.set('user@example.com');
    await (component as any).handleSubmit();

    expect((component as any).success()).toBeTrue();
  });

  it('resets loading to false after a successful call', async () => {
    (component as any).email.set('user@example.com');
    await (component as any).handleSubmit();

    expect((component as any).loading()).toBeFalse();
  });

  it('clears the error signal before calling the service', async () => {
    // Pre-set an error to simulate a prior failed attempt
    (component as any).error.set('Previous error');
    (component as any).email.set('user@example.com');

    const promise = (component as any).handleSubmit() as Promise<void>;
    // Error is cleared synchronously before the async Supabase call resolves
    expect((component as any).error()).toBeNull();
    await promise;
  });

  // ── handleSubmit() — error path ───────────────────────────────────────────

  it('sets error to the service error message on failure', async () => {
    TestBed.resetTestingModule();
    configureWith({ success: false, error: 'Too many requests' });

    (component as any).email.set('user@example.com');
    await (component as any).handleSubmit();

    expect((component as any).error()).toBe('Too many requests');
  });

  it('falls back to a default error string when service returns no message', async () => {
    TestBed.resetTestingModule();
    // Return success:false with no error string
    configureWith({ success: false });

    (component as any).email.set('user@example.com');
    await (component as any).handleSubmit();

    expect((component as any).error()).toBeTruthy();
  });

  it('keeps success as false on a failed call', async () => {
    TestBed.resetTestingModule();
    configureWith({ success: false, error: 'Network error' });

    (component as any).email.set('user@example.com');
    await (component as any).handleSubmit();

    expect((component as any).success()).toBeFalse();
  });

  it('resets loading to false after a failed call', async () => {
    TestBed.resetTestingModule();
    configureWith({ success: false, error: 'Network error' });

    (component as any).email.set('user@example.com');
    await (component as any).handleSubmit();

    expect((component as any).loading()).toBeFalse();
  });

  // ── updateEmail() ─────────────────────────────────────────────────────────

  it('clears the error signal when updateEmail is called', () => {
    (component as any).error.set('Some previous error');
    (component as any).updateEmail('user@example.com');

    expect((component as any).error()).toBeNull();
  });

  it('updates the email signal with the provided value', () => {
    (component as any).updateEmail('new@email.com');
    expect((component as any).email()).toBe('new@email.com');
  });
});
