/**
 * Unit tests for brand-detection utilities
 * Pure functions – no TestBed needed.
 * Covers: detectBrand, detectBrandKey, getBrandByKey, getAllBrands.
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { detectBrand, detectBrandKey, getBrandByKey, getAllBrands } from './brand-detection';

describe('brand-detection', () => {
  // ── detectBrand ───────────────────────────────────────────────────────────

  describe('detectBrand()', () => {
    it('detects YouTube from youtube.com', () => {
      const brand = detectBrand('https://youtube.com/watch?v=abc');
      expect(brand?.key).toBe('youtube');
      expect(brand?.label).toBe('YouTube');
    });

    it('detects YouTube from youtu.be short links', () => {
      expect(detectBrand('https://youtu.be/abc123')?.key).toBe('youtube');
    });

    it('detects YouTube with www prefix', () => {
      expect(detectBrand('https://www.youtube.com/channel/test')?.key).toBe('youtube');
    });

    it('detects Twitter/X from twitter.com', () => {
      expect(detectBrand('https://twitter.com/user')?.key).toBe('twitter');
    });

    it('detects Twitter/X from x.com', () => {
      expect(detectBrand('https://x.com/user')?.key).toBe('twitter');
    });

    it('detects Instagram', () => {
      expect(detectBrand('https://instagram.com/username')?.key).toBe('instagram');
    });

    it('detects TikTok', () => {
      expect(detectBrand('https://tiktok.com/@username')?.key).toBe('tiktok');
    });

    it('detects Spotify from open.spotify.com', () => {
      expect(detectBrand('https://open.spotify.com/artist/abc')?.key).toBe('spotify');
    });

    it('detects LinkedIn', () => {
      expect(detectBrand('https://linkedin.com/in/user')?.key).toBe('linkedin');
    });

    it('detects GitHub', () => {
      expect(detectBrand('https://github.com/user/repo')?.key).toBe('github');
    });

    it('detects Twitch', () => {
      expect(detectBrand('https://twitch.tv/username')?.key).toBe('twitch');
    });

    it('detects Discord from discord.gg', () => {
      expect(detectBrand('https://discord.gg/invite')?.key).toBe('discord');
    });

    it('detects Discord from discord.com', () => {
      expect(detectBrand('https://discord.com/channels/123')?.key).toBe('discord');
    });

    it('detects Facebook', () => {
      expect(detectBrand('https://facebook.com/page')?.key).toBe('facebook');
    });

    it('detects Facebook from fb.com', () => {
      expect(detectBrand('https://fb.com/page')?.key).toBe('facebook');
    });

    it('detects WhatsApp from wa.me', () => {
      expect(detectBrand('https://wa.me/1234567890')?.key).toBe('whatsapp');
    });

    it('detects Telegram from t.me', () => {
      expect(detectBrand('https://t.me/username')?.key).toBe('telegram');
    });

    it('detects Patreon', () => {
      expect(detectBrand('https://patreon.com/creator')?.key).toBe('patreon');
    });

    it('detects Ko-fi', () => {
      expect(detectBrand('https://ko-fi.com/creator')?.key).toBe('ko-fi');
    });

    it('detects Substack', () => {
      expect(detectBrand('https://substack.com/newsletter')?.key).toBe('substack');
    });

    it('returns null for an unrecognized domain', () => {
      expect(detectBrand('https://mywebsite.com')).toBeNull();
    });

    it('returns null for an invalid URL', () => {
      expect(detectBrand('not-a-url')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(detectBrand('')).toBeNull();
    });

    it('returns a brand info object with required fields', () => {
      const brand = detectBrand('https://youtube.com');
      expect(brand).toBeTruthy();
      expect(brand?.key).toBeDefined();
      expect(brand?.label).toBeDefined();
      expect(brand?.color).toBeDefined();
      expect(brand?.svgPath).toBeDefined();
    });
  });

  // ── detectBrandKey ────────────────────────────────────────────────────────

  describe('detectBrandKey()', () => {
    it('returns the brand key for a known URL', () => {
      expect(detectBrandKey('https://instagram.com/user')).toBe('instagram');
    });

    it('returns null for an unknown URL', () => {
      expect(detectBrandKey('https://unknown-website.io')).toBeNull();
    });

    it('returns null for an invalid URL', () => {
      expect(detectBrandKey('bad-url')).toBeNull();
    });
  });

  // ── getBrandByKey ──────────────────────────────────────────────────────────

  describe('getBrandByKey()', () => {
    it('returns the brand for a known key', () => {
      const brand = getBrandByKey('youtube');
      expect(brand?.key).toBe('youtube');
      expect(brand?.label).toBe('YouTube');
      expect(brand?.color).toBe('#FF0000');
    });

    it('returns the brand for twitter key', () => {
      expect(getBrandByKey('twitter')?.label).toBe('X (Twitter)');
    });

    it('returns null for an unknown key', () => {
      expect(getBrandByKey('not-a-brand')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(getBrandByKey('')).toBeNull();
    });
  });

  // ── getAllBrands ───────────────────────────────────────────────────────────

  describe('getAllBrands()', () => {
    it('returns an array of brands', () => {
      const brands = getAllBrands();
      expect(Array.isArray(brands)).toBeTrue();
      expect(brands.length).toBeGreaterThan(10);
    });

    it('each brand has required fields', () => {
      for (const brand of getAllBrands()) {
        expect(brand.key).toBeTruthy();
        expect(brand.label).toBeTruthy();
        expect(brand.color).toBeTruthy();
        expect(brand.svgPath).toBeTruthy();
      }
    });

    it('returns a copy (modifying result does not affect the source)', () => {
      const brands1 = getAllBrands();
      const brands2 = getAllBrands();
      brands1.push({ key: 'fake', label: 'Fake', color: '#000', svgPath: '' });
      expect(brands2.length).not.toBe(brands1.length);
    });

    it('includes youtube, instagram, tiktok in the list', () => {
      const keys = getAllBrands().map((b) => b.key);
      expect(keys).toContain('youtube');
      expect(keys).toContain('instagram');
      expect(keys).toContain('tiktok');
    });
  });
});
