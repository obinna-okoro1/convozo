import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  public readonly variant = input<ButtonVariant>('primary');
  public readonly size = input<ButtonSize>('md');
  public readonly type = input<'button' | 'submit' | 'reset'>('button');
  public readonly disabled = input(false);
  public readonly loading = input(false);
  public readonly fullWidth = input(false);
  public readonly icon = input(false);

  public clicked = output<Event>();

  public get buttonClasses(): string {
    const baseClasses = this.getVariantClasses();
    const sizeClasses = this.getSizeClasses();
    const widthClass = this.fullWidth() ? 'w-full' : '';

    return `tap-highlight transform active:scale-[0.97] transition-transform duration-150 ${baseClasses} ${sizeClasses} ${widthClass}`;
  }

  public handleClick(event: Event): void {
    if (!this.disabled() && !this.loading()) {
      this.clicked.emit(event);
    }
  }

  private getVariantClasses(): string {
    const variants: Record<ButtonVariant, string> = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
      danger: 'btn-danger',
    };

    return variants[this.variant()];
  }

  private getSizeClasses(): string {
    const sizes: Record<ButtonSize, string> = {
      sm: 'btn-sm',
      md: '',
      lg: 'btn-lg',
    };

    return sizes[this.size()];
  }
}
