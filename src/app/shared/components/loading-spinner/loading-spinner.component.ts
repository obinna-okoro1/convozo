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
  templateUrl: './loading-spinner.component.html',
  styleUrls: ['./loading-spinner.component.css']
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
