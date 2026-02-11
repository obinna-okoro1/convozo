/**
 * Premium Card Component
 * Flexible container with optional hover effects
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="cardClasses">
      @if (header) {
        <div class="card-header">
          <ng-content select="[slot=header]"></ng-content>
        </div>
      }
      
      <div [class]="padding ? 'card-padding' : ''">
        <ng-content></ng-content>
      </div>
      
      @if (footer) {
        <div class="px-6 py-4 border-t border-neutral-200/50 bg-neutral-50/50">
          <ng-content select="[slot=footer]"></ng-content>
        </div>
      }
    </div>
  `,
  styles: []
})
export class CardComponent {
  @Input() hover = false;
  @Input() padding = true;
  @Input() header = false;
  @Input() footer = false;
  
  get cardClasses(): string {
    const baseClass = this.hover ? 'card-hover' : 'card';
    return `${baseClass} animate-in`;
  }
}
