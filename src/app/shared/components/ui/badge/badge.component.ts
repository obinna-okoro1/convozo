/**
 * Premium Badge Component
 * For status indicators and labels
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'neutral' | 'danger';

@Component({
  selector: 'ui-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [class]="badgeClasses">
      @if (dot) {
        <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
      }
      <ng-content></ng-content>
    </span>
  `,
  styles: []
})
export class BadgeComponent {
  @Input() variant: BadgeVariant = 'neutral';
  @Input() dot = false;
  
  get badgeClasses(): string {
    const variants: Record<BadgeVariant, string> = {
      primary: 'badge-primary',
      success: 'badge-success',
      warning: 'badge-warning',
      neutral: 'badge-neutral',
      danger: 'badge bg-danger-100 text-danger-700'
    };
    
    return variants[this.variant];
  }
}
