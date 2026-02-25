/**
 * Toast Container Component
 * Renders the global toast notification stack.
 * Place once in the root template (app.ts).
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  templateUrl: './toast-container.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainerComponent {
  constructor(protected readonly toastService: ToastService) {}

  protected getToastClasses(toast: Toast): string {
    const base = 'border';
    switch (toast.type) {
      case 'success':
        return `${base} bg-emerald-500/20 border-emerald-500/30 shadow-emerald-500/20`;
      case 'error':
        return `${base} bg-red-500/20 border-red-500/30 shadow-red-500/20`;
      case 'warning':
        return `${base} bg-yellow-500/20 border-yellow-500/30 shadow-yellow-500/20`;
      case 'info':
      default:
        return `${base} bg-blue-500/20 border-blue-500/30 shadow-blue-500/20`;
    }
  }

  protected getIconBgClasses(toast: Toast): string {
    switch (toast.type) {
      case 'success':
        return 'bg-gradient-to-br from-emerald-500 to-green-500';
      case 'error':
        return 'bg-gradient-to-br from-red-500 to-orange-500';
      case 'warning':
        return 'bg-gradient-to-br from-yellow-500 to-orange-500';
      case 'info':
      default:
        return 'bg-gradient-to-br from-blue-500 to-cyan-500';
    }
  }
}
