/**
 * Loading Spinner Component
 * Elegant loading indicator
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type SpinnerSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './spinner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpinnerComponent {
  @Input() public size: SpinnerSize = 'md';
  @Input() public label = '';
  @Input() public center = false;

  public get containerClasses(): string {
    const centerClass = this.center
      ? 'flex items-center justify-center min-h-[12.5rem]'
      : 'inline-flex items-center';
    return centerClass;
  }

  public get sizeClass(): string {
    const sizes: Record<SpinnerSize, string> = {
      sm: 'w-4 h-4',
      md: 'w-6 h-6',
      lg: 'w-8 h-8',
    };

    return sizes[this.size];
  }
}
