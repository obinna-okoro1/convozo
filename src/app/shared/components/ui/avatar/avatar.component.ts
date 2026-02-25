/**
 * Avatar Component
 * For user profile images with fallback
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './avatar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  @Input() public src = '';
  @Input() public alt = 'Avatar';
  @Input() public initials = '';
  @Input() public size: AvatarSize = 'md';
  @Input() public status: 'online' | 'offline' | 'away' | null = null;

  public imageError = signal(false);

  public get containerClasses(): string {
    const sizes: Record<AvatarSize, string> = {
      sm: 'w-8 h-8',
      md: 'w-10 h-10',
      lg: 'w-12 h-12',
      xl: 'w-16 h-16',
    };

    return `relative flex items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white overflow-hidden ring-2 ring-white ${sizes[this.size]}`;
  }

  public get textClasses(): string {
    const sizes: Record<AvatarSize, string> = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
      xl: 'text-xl',
    };

    return `font-semibold ${sizes[this.size]}`;
  }

  public get statusClasses(): string {
    const statusColors = {
      online: 'bg-success-500',
      offline: 'bg-neutral-400',
      away: 'bg-warning-500',
    };

    const color = this.status ? statusColors[this.status] : '';
    return `absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${color}`;
  }

  public handleImageError(): void {
    this.imageError.set(true);
  }
}
