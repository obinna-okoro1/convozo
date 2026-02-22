/**
 * Response Templates Service
 * Manages saved response templates for quick replies
 */

import { Injectable, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ResponseTemplate {
  id: string;
  creator_id: string;
  title: string;
  content: string;
  category: string;
  usage_count: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateCategory {
  name: string;
  icon: string;
  count: number;
}

// Default templates to get users started
export const DEFAULT_TEMPLATES: Omit<ResponseTemplate, 'id' | 'creator_id' | 'created_at' | 'updated_at'>[] = [
  {
    title: 'Thank you for reaching out',
    content: `Hi {sender_name}! 👋

Thank you so much for taking the time to send me a message. I really appreciate your support and kind words.

I'll make sure to address your question/request properly. If you have any follow-up questions, feel free to reach out again!

Best,
{creator_name}`,
    category: 'General',
    usage_count: 0,
    is_favorite: true,
  },
  {
    title: 'Collaboration inquiry',
    content: `Hi {sender_name}!

Thank you for your interest in collaborating! I'd love to learn more about your brand and what you have in mind.

Could you please share:
- Your brand/company name and website
- The type of collaboration you're envisioning
- Timeline and budget range

Looking forward to hearing more!

Best,
{creator_name}`,
    category: 'Business',
    usage_count: 0,
    is_favorite: false,
  },
  {
    title: 'Not a good fit',
    content: `Hi {sender_name}!

Thank you so much for thinking of me for this opportunity! After reviewing your message, I don't think this is the right fit for me at the moment.

I appreciate you reaching out and wish you the best with your project!

Best,
{creator_name}`,
    category: 'Business',
    usage_count: 0,
    is_favorite: false,
  },
  {
    title: 'Content advice',
    content: `Hi {sender_name}!

Thanks for your question about content creation! Here are my thoughts:

{your_advice_here}

Remember, consistency is key. Keep creating and don't be afraid to experiment!

Good luck on your journey! 🚀

Best,
{creator_name}`,
    category: 'Advice',
    usage_count: 0,
    is_favorite: false,
  },
  {
    title: 'Schedule a call',
    content: `Hi {sender_name}!

I'd love to chat with you more about this! You can book a call with me directly through my page:

{call_booking_link}

Looking forward to connecting!

Best,
{creator_name}`,
    category: 'General',
    usage_count: 0,
    is_favorite: true,
  },
];

const STORAGE_KEY = 'convozo_response_templates';

@Injectable({
  providedIn: 'root'
})
export class ResponseTemplateService {
  private readonly templates = signal<ResponseTemplate[]>([]);
  
  public readonly allTemplates = computed(() => this.templates());
  public readonly favoriteTemplates = computed(() => 
    this.templates().filter(t => t.is_favorite)
  );
  
  public readonly categories = computed<TemplateCategory[]>(() => {
    const categoryMap = new Map<string, number>();
    this.templates().forEach(t => {
      categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + 1);
    });
    
    const categoryIcons: Record<string, string> = {
      'General': '💬',
      'Business': '💼',
      'Advice': '💡',
      'Follow-up': '🔄',
      'Decline': '👋',
      'Other': '📝',
    };
    
    return Array.from(categoryMap.entries()).map(([name, count]) => ({
      name,
      icon: categoryIcons[name] || '📝',
      count,
    }));
  });

  constructor(private readonly supabaseService: SupabaseService) {
    this.loadTemplates();
  }

  /**
   * Load templates from storage
   */
  private loadTemplates(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.templates.set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }

  /**
   * Save templates to storage
   */
  private saveTemplates(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.templates()));
    } catch (error) {
      console.error('Failed to save templates:', error);
    }
  }

  /**
   * Initialize templates for a creator
   */
  public async initializeTemplates(creatorId: string): Promise<void> {
    // Check if already initialized
    if (this.templates().length > 0) return;

    // Create default templates
    const now = new Date().toISOString();
    const defaultTemplates: ResponseTemplate[] = DEFAULT_TEMPLATES.map((t, index) => ({
      ...t,
      id: `template_${creatorId}_${index}`,
      creator_id: creatorId,
      created_at: now,
      updated_at: now,
    }));

    this.templates.set(defaultTemplates);
    this.saveTemplates();
  }

  /**
   * Get templates by category
   */
  public getTemplatesByCategory(category: string): ResponseTemplate[] {
    return this.templates().filter(t => t.category === category);
  }

  /**
   * Search templates
   */
  public searchTemplates(query: string): ResponseTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.templates().filter(t => 
      t.title.toLowerCase().includes(lowerQuery) ||
      t.content.toLowerCase().includes(lowerQuery) ||
      t.category.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Create a new template
   */
  public createTemplate(template: Omit<ResponseTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count'>): ResponseTemplate {
    const now = new Date().toISOString();
    const newTemplate: ResponseTemplate = {
      ...template,
      id: `template_${Date.now()}`,
      usage_count: 0,
      created_at: now,
      updated_at: now,
    };

    this.templates.update(templates => [...templates, newTemplate]);
    this.saveTemplates();
    return newTemplate;
  }

  /**
   * Update a template
   */
  public updateTemplate(id: string, updates: Partial<ResponseTemplate>): ResponseTemplate | null {
    let updated: ResponseTemplate | null = null;
    
    this.templates.update(templates => 
      templates.map(t => {
        if (t.id === id) {
          updated = { ...t, ...updates, updated_at: new Date().toISOString() };
          return updated;
        }
        return t;
      })
    );

    this.saveTemplates();
    return updated;
  }

  /**
   * Delete a template
   */
  public deleteTemplate(id: string): boolean {
    const before = this.templates().length;
    this.templates.update(templates => templates.filter(t => t.id !== id));
    this.saveTemplates();
    return this.templates().length < before;
  }

  /**
   * Toggle favorite status
   */
  public toggleFavorite(id: string): void {
    this.templates.update(templates =>
      templates.map(t => 
        t.id === id ? { ...t, is_favorite: !t.is_favorite } : t
      )
    );
    this.saveTemplates();
  }

  /**
   * Increment usage count
   */
  public incrementUsage(id: string): void {
    this.templates.update(templates =>
      templates.map(t => 
        t.id === id ? { ...t, usage_count: t.usage_count + 1 } : t
      )
    );
    this.saveTemplates();
  }

  /**
   * Apply template with variable substitution
   */
  public applyTemplate(
    template: ResponseTemplate, 
    variables: Record<string, string>
  ): string {
    let content = template.content;
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      content = content.replace(regex, value);
    });

    // Increment usage
    this.incrementUsage(template.id);
    
    return content;
  }

  /**
   * Get most used templates
   */
  public getMostUsedTemplates(limit: number = 5): ResponseTemplate[] {
    return [...this.templates()]
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, limit);
  }

  /**
   * Export templates as JSON
   */
  public exportTemplates(): string {
    return JSON.stringify(this.templates(), null, 2);
  }

  /**
   * Import templates from JSON
   */
  public importTemplates(json: string, creatorId: string): number {
    try {
      const imported = JSON.parse(json) as ResponseTemplate[];
      const now = new Date().toISOString();
      
      const newTemplates = imported.map((t, index) => ({
        ...t,
        id: `template_${creatorId}_import_${Date.now()}_${index}`,
        creator_id: creatorId,
        created_at: now,
        updated_at: now,
      }));

      this.templates.update(templates => [...templates, ...newTemplates]);
      this.saveTemplates();
      return newTemplates.length;
    } catch (error) {
      console.error('Failed to import templates:', error);
      return 0;
    }
  }
}
