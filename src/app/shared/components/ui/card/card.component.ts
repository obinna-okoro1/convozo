/**
 * Premium Card Component
 * Flexible container with optional hover effects
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  @Input() public hover = false;
  @Input() public padding = true;
  @Input() public header = false;
  @Input() public footer = false;

  public get cardClasses(): string {
    const baseClass = this.hover ? 'card-hover' : 'card';
    return `${baseClass} animate-in`;
  }
}
