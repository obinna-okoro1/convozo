/**
 * Toast Container Component
 * Renders the global toast notification stack.
 * Place once in the root template (app.ts).
 */

import { Component, inject } from '@angular/core';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto animate-slide-down backdrop-blur-2xl border rounded-2xl p-4 shadow-2xl flex items-start gap-3 transition-all duration-300"
          [class]="getToastClasses(toast)"
        >
          <div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" [class]="getIconBgClasses(toast)">
            @switch (toast.type) {
              @case ('success') {
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              }
              @case ('error') {
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              }
              @case ('warning') {
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              @default {
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            }
          </div>
          <p class="text-sm font-medium text-white flex-1">{{ toast.message }}</p>
          <button
            (click)="toastService.dismiss(toast.id)"
            class="flex-shrink-0 text-white/50 hover:text-white transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);

  protected getToastClasses(toast: Toast): string {
    const base = 'border';
    switch (toast.type) {
      case 'success':
        return `${base} bg-emerald-500/20 border-emerald-500/30 shadow-emerald-500/20`;
      case 'error':
        return `${base} bg-red-500/20 border-red-500/30 shadow-red-500/20`;
      case 'warning':
        return `${base} bg-yellow-500/20 border-yellow-500/30 shadow-yellow-500/20`;
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
      default:
        return 'bg-gradient-to-br from-blue-500 to-cyan-500';
    }
  }
}
