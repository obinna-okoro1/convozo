/**
 * Empty State Component
 * For when there's no content to display
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col items-center justify-center py-12 px-4 text-center animate-in">
      <div class="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
        @if (icon) {
          <ng-content select="[slot=icon]"></ng-content>
        } @else {
          <svg class="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        }
      </div>
      
      @if (title) {
        <h3 class="text-lg font-semibold text-neutral-900 mb-2">{{ title }}</h3>
      }
      
      @if (description) {
        <p class="text-sm text-neutral-600 max-w-sm mb-6">{{ description }}</p>
      }
      
      @if (action) {
        <div>
          <ng-content select="[slot=action]"></ng-content>
        </div>
      }
    </div>
  `,
  styles: []
})
export class EmptyStateComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() icon = false;
  @Input() action = false;
}
