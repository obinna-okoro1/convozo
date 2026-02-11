/**
 * Loading Spinner Component
 * Elegant loading indicator
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type SpinnerSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ui-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="containerClasses" role="status">
      <svg 
        class="animate-spin"
        [class]="sizeClass"
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
      
      @if (label) {
        <span class="ml-2 text-sm text-neutral-600">{{ label }}</span>
      }
      
      <span class="sr-only">Loading...</span>
    </div>
  `,
  styles: []
})
export class SpinnerComponent {
  @Input() size: SpinnerSize = 'md';
  @Input() label = '';
  @Input() center = false;
  
  get containerClasses(): string {
    const centerClass = this.center ? 'flex items-center justify-center min-h-[200px]' : 'inline-flex items-center';
    return centerClass;
  }
  
  get sizeClass(): string {
    const sizes: Record<SpinnerSize, string> = {
      sm: 'w-4 h-4',
      md: 'w-6 h-6',
      lg: 'w-8 h-8'
    };
    
    return sizes[this.size];
  }
}
