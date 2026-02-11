/**
 * Premium Input Component
 * Accessible with validation states
 */

import { Component, Input, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'ui-input',
  standalone: true,
  imports: [CommonModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => InputComponent),
    multi: true
  }],
  template: `
    <div class="space-y-1.5">
      @if (label) {
        <label 
          [for]="id" 
          class="block text-sm font-medium text-neutral-700"
        >
          {{ label }}
          @if (required) {
            <span class="text-danger-500">*</span>
          }
        </label>
      }
      
      <div class="relative">
        @if (icon) {
          <div class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <ng-content select="[slot=icon]"></ng-content>
          </div>
        }
        
        <input
          [id]="id"
          [type]="type"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [required]="required"
          [value]="value()"
          (input)="onInput($event)"
          (blur)="onTouched()"
          [class]="inputClasses"
        />
        
        @if (error && touched) {
          <div class="absolute right-3 top-1/2 -translate-y-1/2 text-danger-500">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        }
      </div>
      
      @if (hint && !error) {
        <p class="text-xs text-neutral-500">{{ hint }}</p>
      }
      
      @if (error && touched) {
        <p class="text-xs text-danger-600 animate-slide-down">{{ error }}</p>
      }
    </div>
  `,
  styles: []
})
export class InputComponent implements ControlValueAccessor {
  @Input() id = `input-${Math.random().toString(36).substr(2, 9)}`;
  @Input() label = '';
  @Input() type: 'text' | 'email' | 'password' | 'tel' | 'url' = 'text';
  @Input() placeholder = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() disabled = false;
  @Input() icon = false;
  
  value = signal('');
  touched = false;
  
  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};
  
  get inputClasses(): string {
    const baseClass = 'input';
    const errorClass = this.error && this.touched ? 'input-error' : '';
    const iconClass = this.icon ? 'pl-10' : '';
    
    return `${baseClass} ${errorClass} ${iconClass}`;
  }
  
  writeValue(value: string): void {
    this.value.set(value || '');
  }
  
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
  
  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value.set(target.value);
    this.onChange(target.value);
    this.touched = true;
  }
}
