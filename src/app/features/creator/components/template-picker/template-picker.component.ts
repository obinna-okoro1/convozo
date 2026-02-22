/**
 * Response Template Picker Component
 * Allows creators to quickly select and use response templates
 */

import { Component, signal, output, computed, OnInit, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResponseTemplateService, ResponseTemplate, TemplateCategory } from '../../../../core/services/response-template.service';

@Component({
  selector: 'app-template-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white rounded-xl border border-neutral-200 shadow-soft-lg overflow-hidden max-w-md w-full">
      <!-- Header -->
      <div class="p-4 border-b border-neutral-200 bg-neutral-50">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-neutral-900">Quick Replies</h3>
          <button 
            (click)="close.emit()"
            class="p-1.5 hover:bg-neutral-200 rounded-lg transition-colors"
          >
            <svg class="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Search -->
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
            placeholder="Search templates..."
            class="w-full pl-10 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      <!-- Category Tabs -->
      <div class="flex gap-1 p-2 border-b border-neutral-100 overflow-x-auto">
        <button
          (click)="selectedCategory.set('')"
          [class.bg-primary-100]="!selectedCategory()"
          [class.text-primary-700]="!selectedCategory()"
          class="px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap hover:bg-neutral-100 transition-colors"
        >
          All
        </button>
        <button
          (click)="selectedCategory.set('favorites')"
          [class.bg-primary-100]="selectedCategory() === 'favorites'"
          [class.text-primary-700]="selectedCategory() === 'favorites'"
          class="px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap hover:bg-neutral-100 transition-colors"
        >
          ⭐ Favorites
        </button>
        @for (category of categories(); track category.name) {
          <button
            (click)="selectedCategory.set(category.name)"
            [class.bg-primary-100]="selectedCategory() === category.name"
            [class.text-primary-700]="selectedCategory() === category.name"
            class="px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap hover:bg-neutral-100 transition-colors"
          >
            {{ category.icon }} {{ category.name }}
          </button>
        }
      </div>

      <!-- Templates List -->
      <div class="max-h-80 overflow-y-auto p-2">
        @if (filteredTemplates().length > 0) {
          <div class="space-y-2">
            @for (template of filteredTemplates(); track template.id) {
              <button
                (click)="selectTemplate(template)"
                class="w-full p-3 text-left rounded-lg border border-neutral-200 hover:border-primary-300 hover:bg-primary-50 transition-all group"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm text-neutral-900 truncate">{{ template.title }}</div>
                    <div class="text-xs text-neutral-500 line-clamp-2 mt-1">{{ template.content }}</div>
                  </div>
                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      (click)="toggleFavorite($event, template)"
                      class="p-1 hover:bg-white rounded transition-colors"
                    >
                      @if (template.is_favorite) {
                        <span class="text-yellow-500">⭐</span>
                      } @else {
                        <span class="text-neutral-300 hover:text-yellow-500">☆</span>
                      }
                    </button>
                  </div>
                </div>
                <div class="flex items-center gap-2 mt-2">
                  <span class="px-2 py-0.5 text-xs bg-neutral-100 text-neutral-600 rounded">{{ template.category }}</span>
                  @if (template.usage_count > 0) {
                    <span class="text-xs text-neutral-400">Used {{ template.usage_count }}x</span>
                  }
                </div>
              </button>
            }
          </div>
        } @else {
          <div class="text-center py-8 text-neutral-500">
            <span class="text-3xl mb-2 block">📝</span>
            <p class="text-sm">No templates found</p>
            <button
              (click)="showCreateModal.set(true)"
              class="mt-3 text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              Create your first template
            </button>
          </div>
        }
      </div>

      <!-- Footer -->
      <div class="p-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
        <button
          (click)="showCreateModal.set(true)"
          class="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </button>
        <span class="text-xs text-neutral-400">{{ filteredTemplates().length }} templates</span>
      </div>
    </div>

    <!-- Create Template Modal -->
    @if (showCreateModal()) {
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" (click)="showCreateModal.set(false)">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg" (click)="$event.stopPropagation()">
          <div class="p-4 border-b border-neutral-200">
            <h3 class="font-semibold text-neutral-900">Create Template</h3>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1">Title</label>
              <input
                type="text"
                [value]="newTemplate.title"
                (input)="newTemplate.title = $any($event.target).value"
                placeholder="e.g., Thank you response"
                class="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1">Category</label>
              <select
                [value]="newTemplate.category"
                (change)="newTemplate.category = $any($event.target).value"
                class="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="General">General</option>
                <option value="Business">Business</option>
                <option value="Advice">Advice</option>
                <option value="Follow-up">Follow-up</option>
                <option value="Decline">Decline</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1">Content</label>
              <textarea
                [value]="newTemplate.content"
                (input)="newTemplate.content = $any($event.target).value"
                placeholder="Type your template content here..."
                rows="6"
                class="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none"
              ></textarea>
              <p class="text-xs text-neutral-500 mt-1">
                Variables: {{ '{' }}sender_name{{ '}' }}, {{ '{' }}creator_name{{ '}' }}, {{ '{' }}call_booking_link{{ '}' }}
              </p>
            </div>
          </div>
          <div class="p-4 border-t border-neutral-200 flex justify-end gap-3">
            <button
              (click)="showCreateModal.set(false)"
              class="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              (click)="createTemplate()"
              [disabled]="!newTemplate.title || !newTemplate.content"
              class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Create Template
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class TemplatePickerComponent implements OnInit {
  creatorId = input<string>('');
  creatorName = input<string>('');
  
  templateSelected = output<string>();
  close = output<void>();

  protected readonly searchQuery = signal<string>('');
  protected readonly selectedCategory = signal<string>('');
  protected readonly showCreateModal = signal<boolean>(false);

  protected readonly categories = computed<TemplateCategory[]>(() => 
    this.templateService.categories()
  );

  protected readonly filteredTemplates = computed<ResponseTemplate[]>(() => {
    let templates = this.templateService.allTemplates();
    
    const query = this.searchQuery();
    const category = this.selectedCategory();

    if (query) {
      templates = this.templateService.searchTemplates(query);
    } else if (category === 'favorites') {
      templates = this.templateService.favoriteTemplates();
    } else if (category) {
      templates = this.templateService.getTemplatesByCategory(category);
    }

    return templates;
  });

  protected newTemplate = {
    title: '',
    content: '',
    category: 'General',
    is_favorite: false,
  };

  constructor(private readonly templateService: ResponseTemplateService) {}

  ngOnInit(): void {
    const creatorId = this.creatorId();
    if (creatorId) {
      this.templateService.initializeTemplates(creatorId);
    }
  }

  selectTemplate(template: ResponseTemplate): void {
    const variables = {
      sender_name: '{sender_name}', // Will be replaced by the caller
      creator_name: this.creatorName() || '{creator_name}',
      call_booking_link: window.location.origin + '/' + '{slug}' + '?tab=call',
    };

    const content = this.templateService.applyTemplate(template, variables);
    this.templateSelected.emit(content);
    this.close.emit();
  }

  toggleFavorite(event: Event, template: ResponseTemplate): void {
    event.stopPropagation();
    this.templateService.toggleFavorite(template.id);
  }

  createTemplate(): void {
    if (!this.newTemplate.title || !this.newTemplate.content) return;

    this.templateService.createTemplate({
      ...this.newTemplate,
      creator_id: this.creatorId(),
    });

    // Reset form
    this.newTemplate = {
      title: '',
      content: '',
      category: 'General',
      is_favorite: false,
    };
    this.showCreateModal.set(false);
  }
}
