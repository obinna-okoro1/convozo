/**
 * Premium Input Component
 * Accessible with validation states
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, forwardRef, signal, computed } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
  templateUrl: './input.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InputComponent implements ControlValueAccessor {
  @Input() public id = `input-${Math.random().toString(36).substring(2, 11)}`;
  @Input() public label = '';
  @Input() public type: 'text' | 'email' | 'password' | 'tel' | 'url' = 'text';
  @Input() public placeholder = '';
  @Input() public hint = '';
  @Input() public error = '';
  @Input() public required = false;
  @Input() public disabled = false;
  @Input() public icon = false;

  public touched = false;

  // ControlValueAccessor callback fields — must be assignable, causing a member-ordering quirk
  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/member-ordering
  public onChange: (value: string) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/member-ordering
  public onTouched: () => void = () => {};

  // eslint-disable-next-line @typescript-eslint/member-ordering
  public readonly currentValue = computed(() => this._value());

  // eslint-disable-next-line @typescript-eslint/member-ordering
  public readonly inputClasses = computed(() => {
    const baseClass = 'input';
    const errorClass = this.error && this.touched ? 'input-error' : '';
    const iconClass = this.icon ? 'pl-10' : '';
    return `${baseClass} ${errorClass} ${iconClass}`;
  });

  private readonly _value = signal('');

  public writeValue(value: string): void {
    this._value.set(value || '');
  }

  public registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  public onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this._value.set(target.value);
    this.onChange(target.value);
    this.touched = true;
  }
}
