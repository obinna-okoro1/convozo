/**
 * Unit tests for SocialProofComponent
 * Covers: default input values, all responseRating tiers, CSS class
 * computed signals, and every public formatting helper.
 */

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { SocialProofComponent, SocialProofData } from './social-proof.component';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeData(overrides: Partial<SocialProofData> = {}): SocialProofData {
  return {
    totalMessages: 0,
    responseRate: 0,
    avgResponseTime: 24,
    ...overrides,
  };
}

function createFixture(data: SocialProofData): ComponentFixture<SocialProofComponent> {
  const fixture = TestBed.createComponent(SocialProofComponent);
  fixture.componentRef.setInput('data', data);
  fixture.detectChanges();
  return fixture;
}

// ── Spec ─────────────────────────────────────────────────────────────────────

describe('SocialProofComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SocialProofComponent],
    }).compileComponents();
  });

  it('should create with default data', () => {
    const fixture = createFixture(makeData());
    expect(fixture.componentInstance).toBeTruthy();
  });

  // ── responseRating tiers ─────────────────────────────────────────────────

  describe('responseRating computed signal', () => {
    const cases: [number, string][] = [
      [1, 'excellent'], // ≤ 2 h
      [2, 'excellent'],
      [4, 'fast'], // ≤ 8 h
      [8, 'fast'],
      [12, 'good'], // ≤ 24 h
      [24, 'good'],
      [36, 'average'], // ≤ 48 h
      [48, 'average'],
      [72, 'slow'], // > 48 h
    ];

    cases.forEach(([hours, expected]) => {
      it(`rates ${String(hours)} h as "${expected}"`, () => {
        const fixture = createFixture(makeData({ avgResponseTime: hours }));
        const comp = fixture.componentInstance;
        // Access protected signal through cast — white-box test
        const rating = (comp as unknown as { responseRating: () => string }).responseRating();
        expect(rating).toBe(expected);
      });
    });
  });

  // ── responseRateColor ────────────────────────────────────────────────────

  describe('responseRateColor computed signal', () => {
    it('returns success color for ≥ 90% rate', () => {
      const fixture = createFixture(makeData({ responseRate: 95 }));
      const comp = fixture.componentInstance as unknown as { responseRateColor: () => string };
      expect(comp.responseRateColor()).toContain('success');
    });

    it('returns warning color for 70–89% rate', () => {
      const fixture = createFixture(makeData({ responseRate: 75 }));
      const comp = fixture.componentInstance as unknown as { responseRateColor: () => string };
      expect(comp.responseRateColor()).toContain('warning');
    });

    it('returns neutral color for < 70% rate', () => {
      const fixture = createFixture(makeData({ responseRate: 50 }));
      const comp = fixture.componentInstance as unknown as { responseRateColor: () => string };
      expect(comp.responseRateColor()).toContain('neutral');
    });
  });

  // ── formatNumber() ───────────────────────────────────────────────────────

  describe('formatNumber()', () => {
    let comp: SocialProofComponent;

    beforeEach(() => {
      comp = TestBed.createComponent(SocialProofComponent).componentInstance;
    });

    it('returns the number as a string when < 1000', () => {
      expect(comp.formatNumber(999)).toBe('999');
    });

    it('converts 1000 to "1k"', () => {
      expect(comp.formatNumber(1000)).toBe('1k');
    });

    it('converts 1500 to "1.5k"', () => {
      expect(comp.formatNumber(1500)).toBe('1.5k');
    });

    it('converts 2000 to "2k" (no trailing .0)', () => {
      expect(comp.formatNumber(2000)).toBe('2k');
    });
  });

  // ── formatFollowers() ────────────────────────────────────────────────────

  describe('formatFollowers()', () => {
    let comp: SocialProofComponent;

    beforeEach(() => {
      comp = TestBed.createComponent(SocialProofComponent).componentInstance;
    });

    it('returns the number as-is for < 1000', () => {
      expect(comp.formatFollowers(500)).toBe('500');
    });

    it('converts 1000 to "1K"', () => {
      expect(comp.formatFollowers(1000)).toBe('1K');
    });

    it('converts 1_000_000 to "1M"', () => {
      expect(comp.formatFollowers(1_000_000)).toBe('1M');
    });

    it('converts 2_500_000 to "2.5M"', () => {
      expect(comp.formatFollowers(2_500_000)).toBe('2.5M');
    });
  });

  // ── formatResponseTime() ─────────────────────────────────────────────────

  describe('formatResponseTime()', () => {
    it('returns "<1h" for sub-hour response times', () => {
      const fixture = createFixture(makeData({ avgResponseTime: 0.5 }));
      expect(fixture.componentInstance.formatResponseTime()).toBe('<1h');
    });

    it('returns "Xh" for same-day response times', () => {
      const fixture = createFixture(makeData({ avgResponseTime: 6 }));
      expect(fixture.componentInstance.formatResponseTime()).toBe('6h');
    });

    it('returns "Xd" for multi-day response times', () => {
      const fixture = createFixture(makeData({ avgResponseTime: 48 }));
      expect(fixture.componentInstance.formatResponseTime()).toBe('2d');
    });
  });

  // ── formatJoinDate() ─────────────────────────────────────────────────────

  describe('formatJoinDate()', () => {
    let comp: SocialProofComponent;

    beforeEach(() => {
      comp = TestBed.createComponent(SocialProofComponent).componentInstance;
    });

    it('formats an ISO date string into a readable month/year', () => {
      const result = comp.formatJoinDate('2024-06-15T00:00:00Z');
      // Result varies by locale but should contain a year
      expect(result).toContain('2024');
    });
  });

  // ── responseBarWidth ─────────────────────────────────────────────────────

  describe('responseBarWidth computed signal', () => {
    const cases: [number, number][] = [
      [1, 100], // excellent
      [4, 85], // fast
      [12, 70], // good
      [36, 50], // average
      [72, 30], // slow
    ];

    cases.forEach(([hours, expectedWidth]) => {
      it(`bar width is ${String(expectedWidth)} for ${String(hours)} h`, () => {
        const fixture = createFixture(makeData({ avgResponseTime: hours }));
        const comp = fixture.componentInstance as unknown as {
          responseBarWidth: () => number;
        };
        expect(comp.responseBarWidth()).toBe(expectedWidth);
      });
    });
  });
});
