/**
 * Unit tests for ResponseTemplateService
 * Covers: initialization, CRUD operations, search, favorite toggle,
 * usage tracking, template variable substitution, and import/export.
 */

import { TestBed } from '@angular/core/testing';
import {
  ResponseTemplateService,
  ResponseTemplate,
  DEFAULT_TEMPLATES,
} from './response-template.service';

describe('ResponseTemplateService', () => {
  let service: ResponseTemplateService;

  // Clear localStorage between tests so state doesn't leak
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ResponseTemplateService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('starts with no templates before initialization', () => {
    expect(service.allTemplates().length).toBe(0);
  });

  // ── initializeTemplates() ──────────────────────────────────────────────────

  describe('initializeTemplates()', () => {
    it('loads all default templates for a new creator', () => {
      service.initializeTemplates('creator-1', 'Alice');
      expect(service.allTemplates().length).toBe(DEFAULT_TEMPLATES.length);
    });

    it('sets the current creator id', () => {
      service.initializeTemplates('creator-42', 'Bob');
      expect(service.currentCreatorId()).toBe('creator-42');
    });

    it('sets the creator name when provided', () => {
      service.initializeTemplates('creator-1', 'Carol');
      expect(service.currentCreatorName()).toBe('Carol');
    });

    it('is idempotent — calling twice does not duplicate templates', () => {
      service.initializeTemplates('creator-1');
      service.initializeTemplates('creator-1');
      expect(service.allTemplates().length).toBe(DEFAULT_TEMPLATES.length);
    });
  });

  // ── favoriteTemplates computed ─────────────────────────────────────────────

  describe('favoriteTemplates computed', () => {
    it('returns only templates marked as favorites', () => {
      service.initializeTemplates('creator-1');
      const favorites = service.favoriteTemplates();
      const expected = DEFAULT_TEMPLATES.filter((t) => t.is_favorite).length;
      expect(favorites.length).toBe(expected);
      expect(favorites.every((t) => t.is_favorite)).toBeTrue();
    });
  });

  // ── categories computed ────────────────────────────────────────────────────

  describe('categories computed', () => {
    it('returns a category entry for each distinct category', () => {
      service.initializeTemplates('creator-1');
      const categories = service.categories();
      const distinctCategories = new Set(DEFAULT_TEMPLATES.map((t) => t.category));
      expect(categories.length).toBe(distinctCategories.size);
    });

    it('provides a count that matches the number of templates in that category', () => {
      service.initializeTemplates('creator-1');
      service.categories().forEach((cat) => {
        const count = service.allTemplates().filter((t) => t.category === cat.name).length;
        expect(cat.count).toBe(count);
      });
    });
  });

  // ── createTemplate() ──────────────────────────────────────────────────────

  describe('createTemplate()', () => {
    it('adds a new template to the list', () => {
      service.initializeTemplates('creator-1');
      const before = service.allTemplates().length;
      service.createTemplate({
        creator_id: 'creator-1',
        title: 'Custom',
        content: 'Hi {sender_name}!',
        category: 'Other',
        is_favorite: false,
      });
      expect(service.allTemplates().length).toBe(before + 1);
    });

    it('returns the newly created template with a unique id', () => {
      service.initializeTemplates('creator-1');
      const t = service.createTemplate({
        creator_id: 'creator-1',
        title: 'My Template',
        content: 'Content',
        category: 'General',
        is_favorite: false,
      });
      expect(t.id).toBeTruthy();
      expect(t.usage_count).toBe(0);
    });
  });

  // ── updateTemplate() ──────────────────────────────────────────────────────

  describe('updateTemplate()', () => {
    it('updates the title of an existing template', () => {
      service.initializeTemplates('creator-1');
      const id = service.allTemplates()[0].id;
      service.updateTemplate(id, { title: 'Updated Title' });
      const updated = service.allTemplates().find((t) => t.id === id);
      expect(updated?.title).toBe('Updated Title');
    });

    it('returns null for a non-existent id', () => {
      service.initializeTemplates('creator-1');
      const result = service.updateTemplate('nonexistent-id', { title: 'X' });
      expect(result).toBeNull();
    });
  });

  // ── deleteTemplate() ──────────────────────────────────────────────────────

  describe('deleteTemplate()', () => {
    it('removes the template with the given id', () => {
      service.initializeTemplates('creator-1');
      const id = service.allTemplates()[0].id;
      const before = service.allTemplates().length;
      const result = service.deleteTemplate(id);
      expect(result).toBeTrue();
      expect(service.allTemplates().length).toBe(before - 1);
      expect(service.allTemplates().find((t) => t.id === id)).toBeUndefined();
    });

    it('returns false when the id does not exist', () => {
      service.initializeTemplates('creator-1');
      const result = service.deleteTemplate('ghost-id');
      expect(result).toBeFalse();
    });
  });

  // ── toggleFavorite() ──────────────────────────────────────────────────────

  describe('toggleFavorite()', () => {
    it('flips a favorite template to non-favorite', () => {
      service.initializeTemplates('creator-1');
      const favId = service.favoriteTemplates()[0].id;
      service.toggleFavorite(favId);
      const toggled = service.allTemplates().find((t) => t.id === favId);
      expect(toggled?.is_favorite).toBeFalse();
    });

    it('flips a non-favorite template to favorite', () => {
      service.initializeTemplates('creator-1');
      const nonFav = service.allTemplates().find((t) => !t.is_favorite);
      if (!nonFav) {
        pending('No non-favorite templates to test');
        return;
      }
      service.toggleFavorite(nonFav.id);
      const toggled = service.allTemplates().find((t) => t.id === nonFav.id);
      expect(toggled?.is_favorite).toBeTrue();
    });
  });

  // ── incrementUsage() ──────────────────────────────────────────────────────

  describe('incrementUsage()', () => {
    it('increments the usage_count by 1', () => {
      service.initializeTemplates('creator-1');
      const id = service.allTemplates()[0].id;
      const before = service.allTemplates()[0].usage_count;
      service.incrementUsage(id);
      const after = service.allTemplates().find((t) => t.id === id)?.usage_count;
      expect(after).toBe(before + 1);
    });
  });

  // ── searchTemplates() ─────────────────────────────────────────────────────

  describe('searchTemplates()', () => {
    it('returns all templates when query is empty string', () => {
      service.initializeTemplates('creator-1');
      const results = service.searchTemplates('');
      expect(results.length).toBe(service.allTemplates().length);
    });

    it('matches by title (case-insensitive)', () => {
      service.initializeTemplates('creator-1');
      const results = service.searchTemplates('thank you');
      expect(results.length).toBeGreaterThan(0);
      results.forEach((t) => {
        const matchesTitle = t.title.toLowerCase().includes('thank you');
        const matchesContent = t.content.toLowerCase().includes('thank you');
        const matchesCategory = t.category.toLowerCase().includes('thank you');
        expect(matchesTitle || matchesContent || matchesCategory).toBeTrue();
      });
    });

    it('returns empty array for a query with no matches', () => {
      service.initializeTemplates('creator-1');
      const results = service.searchTemplates('xyzzy-no-match');
      expect(results).toEqual([]);
    });
  });

  // ── getTemplatesByCategory() ──────────────────────────────────────────────

  describe('getTemplatesByCategory()', () => {
    it('returns only templates in the given category', () => {
      service.initializeTemplates('creator-1');
      const category = 'Business';
      const results = service.getTemplatesByCategory(category);
      expect(results.every((t) => t.category === category)).toBeTrue();
    });
  });

  // ── applyTemplate() ───────────────────────────────────────────────────────

  describe('applyTemplate()', () => {
    it('replaces {sender_name} and {creator_name} placeholders', () => {
      service.initializeTemplates('creator-1', 'Creator Joe');
      const template = service.allTemplates()[0];
      const result = service.applyTemplate(template, {
        sender_name: 'Fan Maria',
        creator_name: 'Creator Joe',
      });
      expect(result).not.toContain('{sender_name}');
      expect(result).not.toContain('{creator_name}');
      expect(result).toContain('Fan Maria');
      expect(result).toContain('Creator Joe');
    });

    it('increments usage count after applying', () => {
      service.initializeTemplates('creator-1');
      const template = service.allTemplates()[0];
      const before = template.usage_count;
      service.applyTemplate(template, {});
      const after = service.allTemplates().find((t) => t.id === template.id)?.usage_count;
      expect(after).toBe(before + 1);
    });
  });

  // ── getMostUsedTemplates() ────────────────────────────────────────────────

  describe('getMostUsedTemplates()', () => {
    it('returns templates sorted by usage_count descending', () => {
      service.initializeTemplates('creator-1');
      const templates = service.allTemplates();
      service.incrementUsage(templates[2].id);
      service.incrementUsage(templates[2].id);
      service.incrementUsage(templates[0].id);

      const top = service.getMostUsedTemplates(2);
      expect(top.length).toBe(2);
      expect(top[0].usage_count).toBeGreaterThanOrEqual(top[1].usage_count);
    });
  });

  // ── export / import ───────────────────────────────────────────────────────

  describe('exportTemplates() / importTemplates()', () => {
    it('roundtrips templates through JSON', () => {
      service.initializeTemplates('creator-1');
      const exported = service.exportTemplates();
      const parsed: ResponseTemplate[] = JSON.parse(exported);
      expect(parsed.length).toBe(service.allTemplates().length);
    });

    it('importTemplates() adds templates to the existing list', () => {
      service.initializeTemplates('creator-1');
      const before = service.allTemplates().length;
      const json = JSON.stringify([
        {
          title: 'Imported',
          content: 'Content',
          category: 'Other',
          usage_count: 0,
          is_favorite: false,
        },
      ]);
      const count = service.importTemplates(json, 'creator-1');
      expect(count).toBe(1);
      expect(service.allTemplates().length).toBe(before + 1);
    });

    it('importTemplates() returns 0 for malformed JSON', () => {
      service.initializeTemplates('creator-1');
      const count = service.importTemplates('not-valid-json', 'creator-1');
      expect(count).toBe(0);
    });
  });
});
