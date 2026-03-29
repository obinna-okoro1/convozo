import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, output } from '@angular/core';

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
  @Input() public variant: ButtonVariant = 'primary';
  @Input() public size: ButtonSize = 'md';
  @Input() public type: 'button' | 'submit' | 'reset' = 'button';
  @Input() public disabled = false;
  @Input() public loading = false;
  @Input() public fullWidth = false;
  @Input() public icon = false;

  public clicked = output<Event>();

  public get buttonClasses(): string {
    const baseClasses = this.getVariantClasses();
    const sizeClasses = this.getSizeClasses();
    const widthClass = this.fullWidth ? 'w-full' : '';

    return `tap-highlight transform active:scale-[0.97] transition-transform duration-150 ${baseClasses} ${sizeClasses} ${widthClass}`;
  }

  public handleClick(event: Event): void {
    if (!this.disabled && !this.loading) {
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

    return variants[this.variant];
  }

  private getSizeClasses(): string {
    const sizes: Record<ButtonSize, string> = {
      sm: 'btn-sm',
      md: '',
      lg: 'btn-lg',
    };

    return sizes[this.size];
  }
}
