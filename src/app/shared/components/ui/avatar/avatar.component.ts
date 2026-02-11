/**
 * Avatar Component
 * For user profile images with fallback
 */

import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'ui-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="containerClasses">
      @if (src && !imageError()) {
        <img 
          [src]="src" 
          [alt]="alt"
          (error)="handleImageError()"
          class="w-full h-full object-cover"
        />
      } @else if (initials) {
        <span [class]="textClasses">{{ initials }}</span>
      } @else {
        <svg class="w-2/3 h-2/3 text-neutral-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      }
      
      @if (status) {
        <span [class]="statusClasses"></span>
      }
    </div>
  `,
  styles: []
})
export class AvatarComponent {
  @Input() src = '';
  @Input() alt = 'Avatar';
  @Input() initials = '';
  @Input() size: AvatarSize = 'md';
  @Input() status: 'online' | 'offline' | 'away' | null = null;
  
  imageError = signal(false);
  
  get containerClasses(): string {
    const sizes: Record<AvatarSize, string> = {
      sm: 'w-8 h-8',
      md: 'w-10 h-10',
      lg: 'w-12 h-12',
      xl: 'w-16 h-16'
    };
    
    return `relative flex items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white overflow-hidden ring-2 ring-white ${sizes[this.size]}`;
  }
  
  get textClasses(): string {
    const sizes: Record<AvatarSize, string> = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
      xl: 'text-xl'
    };
    
    return `font-semibold ${sizes[this.size]}`;
  }
  
  get statusClasses(): string {
    const statusColors = {
      online: 'bg-success-500',
      offline: 'bg-neutral-400',
      away: 'bg-warning-500'
    };
    
    const color = this.status ? statusColors[this.status] : '';
    return `absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${color}`;
  }
  
  handleImageError(): void {
    this.imageError.set(true);
  }
}
