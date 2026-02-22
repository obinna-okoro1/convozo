/**
 * Toast Notification Service
 * Provides non-blocking UI feedback instead of browser alert() dialogs.
 * Manages a stack of toast messages with auto-dismiss.
 */

import { Injectable, signal, computed } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

const DEFAULT_DURATION = 4000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly _toasts = signal<Toast[]>([]);
  public readonly toasts = computed(() => this._toasts());

  /** Show a success toast */
  success(message: string, duration = DEFAULT_DURATION): void {
    this.add(message, 'success', duration);
  }

  /** Show an error toast */
  error(message: string, duration = 5000): void {
    this.add(message, 'error', duration);
  }

  /** Show an info toast */
  info(message: string, duration = DEFAULT_DURATION): void {
    this.add(message, 'info', duration);
  }

  /** Show a warning toast */
  warning(message: string, duration = DEFAULT_DURATION): void {
    this.add(message, 'warning', duration);
  }

  /** Dismiss a specific toast by id */
  dismiss(id: number): void {
    this._toasts.update(ts => ts.filter(t => t.id !== id));
  }

  private add(message: string, type: ToastType, duration: number): void {
    const id = this.nextId++;
    const toast: Toast = { id, message, type, duration };
    this._toasts.update(ts => [...ts, toast]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }
}
