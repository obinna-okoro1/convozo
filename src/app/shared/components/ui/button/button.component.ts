/**
 * Premium Button Component
 * Mobile-first, accessible, with micro-interactions
 */

import { Component, Input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ui-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      [class]="buttonClasses"
      (click)="handleClick($event)"
      class="tap-highlight"
    >
      @if (loading) {
        <svg 
          class="animate-spin h-5 w-5" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            class="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            stroke-width="4"
          />
          <path 
            class="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      }
      
      @if (icon && !loading) {
        <span class="flex-shrink-0">
          <ng-content select="[slot=icon]"></ng-content>
        </span>
      }
      
      <span class="flex-1">
        <ng-content></ng-content>
      </span>
    </button>
  `,
  styles: []
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() fullWidth = false;
  @Input() icon = false;
  
  clicked = output<Event>();
  
  get buttonClasses(): string {
    const baseClasses = this.getVariantClasses();
    const sizeClasses = this.getSizeClasses();
    const widthClass = this.fullWidth ? 'w-full' : '';
    
    return `${baseClasses} ${sizeClasses} ${widthClass}`;
  }
  
  private getVariantClasses(): string {
    const variants: Record<ButtonVariant, string> = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
      danger: 'btn-danger'
    };
    
    return variants[this.variant];
  }
  
  private getSizeClasses(): string {
    const sizes: Record<ButtonSize, string> = {
      sm: 'btn-sm',
      md: '',
      lg: 'btn-lg'
    };
    
    return sizes[this.size];
  }
  
  handleClick(event: Event): void {
    if (!this.disabled && !this.loading) {
      this.clicked.emit(event);
    }
  }
}
