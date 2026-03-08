/**
 * Response Template Picker Component
 * Allows creators to quickly select and use response templates
 */

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ResponseTemplateService,
  ResponseTemplate,
  TemplateCategory,
} from '../../../../core/services/response-template.service';

@Component({
  selector: 'app-template-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class TemplatePickerComponent implements OnInit {
  public readonly templateSelected = output<string>();
  public readonly closed = output();

  protected readonly searchQuery = signal<string>('');
  protected readonly selectedCategory = signal<string>('');
  protected readonly showCreateModal = signal<boolean>(false);

  protected readonly categories = computed<TemplateCategory[]>(() =>
    this.templateService.categories(),
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

  public ngOnInit(): void {
    const creatorId = this.templateService.currentCreatorId();
    if (creatorId) {
      this.templateService.initializeTemplates(creatorId);
    }
  }

  /**
   * Extract string value from an input/textarea/select event
   */
  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected selectTemplate(template: ResponseTemplate): void {
    const variables = {
      sender_name: '{sender_name}', // Will be replaced by the caller
      creator_name: this.templateService.currentCreatorName() || '{creator_name}',
      call_booking_link: window.location.origin + '/' + '{slug}' + '/call',
    };

    const content = this.templateService.applyTemplate(template, variables);
    this.templateSelected.emit(content);
    this.closed.emit();
  }

  protected toggleFavorite(event: Event, template: ResponseTemplate): void {
    event.stopPropagation();
    this.templateService.toggleFavorite(template.id);
  }

  protected createTemplate(): void {
    if (!this.newTemplate.title || !this.newTemplate.content) {
      return;
    }

    this.templateService.createTemplate({
      ...this.newTemplate,
      creator_id: this.templateService.currentCreatorId(),
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
