/**
 * Error Message Component
 * Displays user-friendly error messages
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-error-message',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error-message.component.html',
  styleUrls: ['./error-message.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorMessageComponent {
  @Input() public title: string = 'Error';
  @Input() public message?: string;
  @Input() public dismissible: boolean = true;
  @Output() public dismissed = new EventEmitter<void>();

  protected onDismiss(): void {
    this.dismissed.emit();
  }
}
