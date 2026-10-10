/**
 * Unit tests for FormValidators
 * Pure static methods – no TestBed needed.
 * Covers: email validation, message length, isEmpty, generateSlug, sanitizeSlug, isValidSlug.
 */




import { FormValidators } from './form-validators';

describe('FormValidators', () => {
  // ── isValidEmail ──────────────────────────────────────────────────────────

  describe('isValidEmail()', () => {
    it('returns true for a standard email', () => {
      expect(FormValidators.isValidEmail('user@example.com'))
        .toBe(true);
    });

    it('returns true for email with subdomain', () => {
      expect(FormValidators.isValidEmail('user@mail.example.co.uk'))
        .toBe(true);
    });

    it('returns true for email with plus tag', () => {
      expect(FormValidators.isValidEmail('user+tag@example.com'))
        .toBe(true);
    });

    it('returns false for missing @', () => {
      expect(FormValidators.isValidEmail('userexample.com'))
        .toBe(false);
    });

    it('returns false for missing domain', () => {
      expect(FormValidators.isValidEmail('user@'))
        .toBe(false);
    });

    it('returns false for empty string', () => {
      expect(FormValidators.isValidEmail(''))
        .toBe(false);
    });

    it('returns false for only whitespace', () => {
      expect(FormValidators.isValidEmail('   '))
        .toBe(false);
    });
  });

  // ── isValidMessageLength ──────────────────────────────────────────────────

  describe('isValidMessageLength()', () => {
    it('returns true for a short valid message', () => {
      expect(FormValidators.isValidMessageLength('Hello world'))
        .toBe(true);
    });

    it('returns true for exactly 1000 characters', () => {
      expect(FormValidators.isValidMessageLength('a'.repeat(1000)))
        .toBe(true);
    });

    it('returns false for empty string', () => {
      expect(FormValidators.isValidMessageLength(''))
        .toBe(false);
    });

    it('returns false for 1001 characters', () => {
      expect(FormValidators.isValidMessageLength('a'.repeat(1001)))
        .toBe(false);
    });
  });

  // ── isNotEmpty ────────────────────────────────────────────────────────────

  describe('isNotEmpty()', () => {
    it('returns true for a non-empty string', () => {
      expect(FormValidators.isNotEmpty('hello'))
        .toBe(true);
    });

    it('returns false for empty string', () => {
      expect(FormValidators.isNotEmpty(''))
        .toBe(false);
    });

    it('returns false for whitespace-only string', () => {
      expect(FormValidators.isNotEmpty('   '))
        .toBe(false);
    });

    it('returns true for string with leading/trailing spaces', () => {
      expect(FormValidators.isNotEmpty('  hi  '))
        .toBe(true);
    });
  });

  // ── generateSlug ──────────────────────────────────────────────────────────

  describe('generateSlug()', () => {
    it('lowercases the input', () => {
      expect(FormValidators.generateSlug('Hello'))
        .toBe('hello');
    });

    it('replaces spaces with hyphens', () => {
      expect(FormValidators.generateSlug('John Doe'))
        .toBe('john-doe');
    });

    it('replaces multiple spaces with a single hyphen', () => {
      expect(FormValidators.generateSlug('John  Doe'))
        .toBe('john-doe');
    });

    it('strips leading and trailing hyphens', () => {
      expect(FormValidators.generateSlug(' Hello '))
        .toBe('hello');
    });

    it('strips special characters', () => {
      expect(FormValidators.generateSlug('Hello! World@'))
        .toBe('hello-world');
    });

    it('handles a name that is already lowercase with no spaces', () => {
      expect(FormValidators.generateSlug('johndoe'))
        .toBe('johndoe');
    });

    it('handles numbers in the name', () => {
      expect(FormValidators.generateSlug('Creator 42'))
        .toBe('creator-42');
    });
  });

  // ── sanitizeSlug ─────────────────────────────────────────────────────────

  describe('sanitizeSlug()', () => {
    it('lowercases the input', () => {
      expect(FormValidators.sanitizeSlug('Hello'))
        .toBe('hello');
    });

    it('removes characters that are not a-z, 0-9, hyphen, or underscore', () => {
      // space and ! are stripped (not replaced) – collapses adjacent valid chars
      expect(FormValidators.sanitizeSlug('hello world!'))
        .toBe('helloworld');
    });

    it('collapses consecutive hyphens into one', () => {
      expect(FormValidators.sanitizeSlug('hello--world'))
        .toBe('hello-world');
    });

    it('strips a leading hyphen', () => {
      expect(FormValidators.sanitizeSlug('-hello'))
        .toBe('hello');
    });

    it('strips a leading underscore', () => {
      expect(FormValidators.sanitizeSlug('_hello'))
        .toBe('hello');
    });

    it('preserves underscores in the middle', () => {
      expect(FormValidators.sanitizeSlug('hello_world'))
        .toBe('hello_world');
    });

    it('returns empty string for all-invalid input', () => {
      expect(FormValidators.sanitizeSlug('!!!'))
        .toBe('');
    });
  });

  // ── isValidSlug ───────────────────────────────────────────────────────────

  describe('isValidSlug()', () => {
    it('returns true for a valid slug of exactly 3 chars', () => {
      expect(FormValidators.isValidSlug('abc'))
        .toBe(true);
    });

    it('returns true for a valid slug of 30 chars', () => {
      expect(FormValidators.isValidSlug('a'.repeat(30)))
        .toBe(true);
    });

    it('returns true for a slug with hyphens and underscores', () => {
      expect(FormValidators.isValidSlug('my-creator_slug'))
        .toBe(true);
    });

    it('returns true for a slug with numbers', () => {
      expect(FormValidators.isValidSlug('creator123'))
        .toBe(true);
    });

    it('returns false for a 2-character slug (too short)', () => {
      expect(FormValidators.isValidSlug('ab'))
        .toBe(false);
    });

    it('returns false for a 31-character slug (too long)', () => {
      expect(FormValidators.isValidSlug('a'.repeat(31)))
        .toBe(false);
    });

    it('returns false for a slug starting with a hyphen', () => {
      expect(FormValidators.isValidSlug('-hello'))
        .toBe(false);
    });

    it('returns false for a slug starting with an underscore', () => {
      expect(FormValidators.isValidSlug('_hello'))
        .toBe(false);
    });

    it('returns false for uppercase letters', () => {
      expect(FormValidators.isValidSlug('Hello'))
        .toBe(false);
    });

    it('returns false for slugs with spaces', () => {
      expect(FormValidators.isValidSlug('hello world'))
        .toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(FormValidators.isValidSlug(''))
        .toBe(false);
    });
  });
});
