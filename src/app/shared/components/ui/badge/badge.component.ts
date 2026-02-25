/**
 * Premium Badge Component
 * For status indicators and labels
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'neutral' | 'danger';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './badge.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  @Input() public variant: BadgeVariant = 'neutral';
  @Input() public dot = false;

  public get badgeClasses(): string {
    const variants: Record<BadgeVariant, string> = {
      primary: 'badge-primary',
      success: 'badge-success',
      warning: 'badge-warning',
      neutral: 'badge-neutral',
      danger: 'badge bg-danger-100 text-danger-700',
    };

    return variants[this.variant];
  }
}
