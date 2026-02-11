/**
 * Loading Spinner Component
 * Reusable loading indicator for async operations
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center justify-center" [class.h-screen]="fullScreen">
      <div class="animate-spin rounded-full border-t-2 border-b-2 border-primary-600"
           [ngClass]="sizeClass">
      </div>
      @if (message) {
        <p class="ml-3 text-gray-600">{{ message }}</p>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class LoadingSpinnerComponent {
  @Input() public size: 'small' | 'medium' | 'large' = 'medium';
  @Input() public message?: string;
  @Input() public fullScreen: boolean = false;

  protected get sizeClass(): string {
    const sizes = {
      small: 'h-4 w-4',
      medium: 'h-8 w-8',
      large: 'h-12 w-12'
    };
    return sizes[this.size];
  }
}
