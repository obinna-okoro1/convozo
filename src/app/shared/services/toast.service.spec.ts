/**
 * Unit tests for ToastService
 * Covers: add, dismiss, auto-dismiss, and all toast type helpers.
 */

import { TestBed } from '@angular/core/testing';
import { ToastService, Toast, ToastType } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
    // Use Jasmine's built-in clock mock — no zone.js/fakeAsync needed
    jasmine.clock().install();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with an empty toast list', () => {
    expect(service.toasts()).toEqual([]);
  });

  // ── success() ─────────────────────────────────────────────────────────────

  it('success() adds a toast with type "success"', () => {
    service.success('Saved successfully');
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].type).toBe('success');
    expect(service.toasts()[0].message).toBe('Saved successfully');
  });

  it('success() uses the default 4000 ms duration when none supplied', () => {
    service.success('Done');
    expect(service.toasts()[0].duration).toBe(4000);
  });

  it('success() respects a custom duration', () => {
    service.success('Done', 2000);
    expect(service.toasts()[0].duration).toBe(2000);
  });

  // ── error() ───────────────────────────────────────────────────────────────

  it('error() adds a toast with type "error" and 5000 ms default duration', () => {
    service.error('Something went wrong');
    const toast = service.toasts()[0];
    expect(toast.type).toBe('error');
    expect(toast.duration).toBe(5000);
  });

  // ── info() ────────────────────────────────────────────────────────────────

  it('info() adds a toast with type "info"', () => {
    service.info('FYI');
    expect(service.toasts()[0].type).toBe('info');
  });

  // ── warning() ─────────────────────────────────────────────────────────────

  it('warning() adds a toast with type "warning"', () => {
    service.warning('Watch out');
    expect(service.toasts()[0].type).toBe('warning');
  });

  // ── Multiple toasts ───────────────────────────────────────────────────────

  it('accumulates multiple toasts with unique ids', () => {
    service.success('First');
    service.error('Second');
    service.info('Third');

    const toasts = service.toasts();
    expect(toasts.length).toBe(3);

    const ids = toasts.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });

  // ── dismiss() ─────────────────────────────────────────────────────────────

  it('dismiss() removes the correct toast by id', () => {
    service.success('First');
    service.error('Second');
    const idToRemove = service.toasts()[0].id;

    service.dismiss(idToRemove);

    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('Second');
  });

  it('dismiss() is a no-op for an unknown id', () => {
    service.success('Stays');
    service.dismiss(999);
    expect(service.toasts().length).toBe(1);
  });

  // ── Auto-dismiss (jasmine.clock) ──────────────────────────────────────────

  it('auto-dismisses toast after its duration elapses', () => {
    service.success('Temporary', 1000);
    expect(service.toasts().length).toBe(1);

    jasmine.clock().tick(1000);

    expect(service.toasts().length).toBe(0);
  });

  it('does NOT auto-dismiss when duration is 0', () => {
    service.success('Permanent', 0);
    jasmine.clock().tick(60_000); // advance far into the future
    expect(service.toasts().length).toBe(1);
  });

  it('auto-dismisses each toast independently', () => {
    service.success('Short', 500);
    service.info('Long', 2000);

    jasmine.clock().tick(500);
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('Long');

    jasmine.clock().tick(1500);
    expect(service.toasts().length).toBe(0);
  });

  // ── Toast shape ───────────────────────────────────────────────────────────

  it('each toast has id, message, type, and duration fields', () => {
    service.warning('Check this', 3000);
    const toast: Toast = service.toasts()[0];

    expect(typeof toast.id).toBe('number');
    expect(toast.message).toBe('Check this');
    expect(toast.type).toBe('warning' as ToastType);
    expect(toast.duration).toBe(3000);
  });
});

