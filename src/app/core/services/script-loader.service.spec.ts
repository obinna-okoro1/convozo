import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';

import { ScriptLoaderService } from './script-loader.service';

describe('ScriptLoaderService', () => {
  let service: ScriptLoaderService;
  let fakeDocument: {
    createElement: Mock;
    head: { appendChild: Mock };
  };
  let fakeScript: {
    src: string;
    async: boolean;
    onload: (() => void) | null;
    onerror: (() => void) | null;
  };

  beforeEach(() => {
    fakeScript = { src: '', async: false, onload: null, onerror: null };
    fakeDocument = {
      createElement: vi.fn()
        .mockReturnValue(fakeScript),
      head: { appendChild: vi.fn() },
    };

    TestBed.configureTestingModule({
      providers: [ScriptLoaderService, { provide: DOCUMENT, useValue: fakeDocument }],
    });

    service = TestBed.inject(ScriptLoaderService);
  });

  // ── load() ──────────────────────────────────────────────────────────────────

  describe('load()', () => {
    it('injects a <script> element into <head>', async () => {
      const promise = service.load('https://js.stripe.com/v3/');
      fakeScript.onload?.();
      await promise;

      expect(fakeDocument.createElement)
        .toHaveBeenCalledWith('script');
      expect(fakeDocument.head.appendChild)
        .toHaveBeenCalledWith(fakeScript);
      expect(fakeScript.src)
        .toBe('https://js.stripe.com/v3/');
      expect(fakeScript.async)
        .toBe(true);
    });

    it('resolves when the script fires its onload callback', async () => {
      const promise = service.load('https://js.stripe.com/v3/');
      fakeScript.onload?.();
      await expect(promise).resolves.toBeUndefined();
    });

    it('rejects with a descriptive error when onerror fires', async () => {
      const promise = service.load('https://js.stripe.com/v3/');
      fakeScript.onerror?.();
      await expect(promise).rejects.toThrow(
        '[ScriptLoader] Failed to load script: https://js.stripe.com/v3/',
      );
    });

    it('deduplicates — same URL returns the cached Promise without re-injecting', async () => {
      const p1 = service.load('https://js.stripe.com/v3/');
      const p2 = service.load('https://js.stripe.com/v3/');

      expect(p1)
        .toBe(p2); // same reference
      expect(fakeDocument.createElement)
        .toHaveBeenCalledTimes(1);
      expect(fakeDocument.head.appendChild)
        .toHaveBeenCalledTimes(1);

      fakeScript.onload?.();
      await p1;
    });

    it('loads two different URLs independently', async () => {
      const secondScript = {
        src: '',
        async: false,
        onload: null as (() => void) | null,
        onerror: null,
      };
      fakeDocument.createElement.mockReturnValueOnce(fakeScript)
        .mockReturnValueOnce(secondScript);

      const p1 = service.load('https://js.stripe.com/v3/');
      const p2 = service.load('https://example.com/lib.js');

      expect(p1).not.toBe(p2);
      expect(fakeDocument.createElement)
        .toHaveBeenCalledTimes(2);

      fakeScript.onload?.();
      secondScript.onload?.();
      await Promise.all([p1, p2]);
    });
  });

  // ── isRequested() ────────────────────────────────────────────────────────────

  describe('isRequested()', () => {
    it('returns false before load() is called', () => {
      expect(service.isRequested('https://js.stripe.com/v3/'))
        .toBe(false);
    });

    it('returns true immediately after load() is called (even before onload)', () => {
      void service.load('https://js.stripe.com/v3/');
      expect(service.isRequested('https://js.stripe.com/v3/'))
        .toBe(true);
    });

    it('returns false for a different URL that has not been requested', () => {
      void service.load('https://js.stripe.com/v3/');
      expect(service.isRequested('https://example.com/other.js'))
        .toBe(false);
    });
  });
});
