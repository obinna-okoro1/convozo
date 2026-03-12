/**
 * Push Notification Service
 * Handles push notification subscription and management
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  public readonly isSupported = computed(
    () => 'serviceWorker' in navigator && 'PushManager' in window,
  );

  public readonly isSubscribed = computed(() => this.pushSubscription() !== null);
  public readonly permissionState = signal<NotificationPermission>('default');

  private readonly supabaseService = inject(SupabaseService);
  private readonly swRegistration = signal<ServiceWorkerRegistration | null>(null);
  private readonly pushSubscription = signal<PushSubscription | null>(null);

  constructor() {
    void this.initializeServiceWorker();
  }

  /**
   * Request permission and subscribe to push notifications
   */
  public async subscribe(): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      return { success: false, error: 'Push notifications not supported' };
    }

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      this.permissionState.set(permission);

      if (permission !== 'granted') {
        return { success: false, error: 'Permission denied' };
      }

      const registration = this.swRegistration();
      if (!registration) {
        return { success: false, error: 'Service worker not registered' };
      }

      // Subscribe to push notifications
      const vapidKey = environment.vapidPublicKey;
      const applicationServerKey = vapidKey ? this.urlBase64ToUint8Array(vapidKey) : undefined;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      this.pushSubscription.set(subscription);

      // Send subscription to server
      this.sendSubscriptionToServer(subscription);

      return { success: true };
    } catch (error) {
      console.error('Push subscription failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Subscription failed',
      };
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  public async unsubscribe(): Promise<{ success: boolean; error?: string }> {
    const subscription = this.pushSubscription();
    if (!subscription) {
      return { success: false, error: 'Not subscribed' };
    }

    try {
      await subscription.unsubscribe();
      this.pushSubscription.set(null);

      // Remove subscription from server
      this.removeSubscriptionFromServer(subscription);

      return { success: true };
    } catch (error) {
      console.error('Push unsubscription failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unsubscription failed',
      };
    }
  }

  /**
   * Send local notification (for testing)
   */
  public async sendLocalNotification(title: string, body: string, url?: string): Promise<void> {
    if (Notification.permission !== 'granted') {
      return;
    }

    const registration = this.swRegistration();
    if (!registration) {
      return;
    }

    await registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { url: url ?? '/creator/dashboard' },
    } as NotificationOptions);
  }

  /**
   * Initialize service worker and check existing subscription
   */
  private async initializeServiceWorker(): Promise<void> {
    if (!this.isSupported()) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      this.swRegistration.set(registration);

      // Check for existing subscription
      const subscription = await registration.pushManager.getSubscription();
      this.pushSubscription.set(subscription);

      // Get current permission state
      this.permissionState.set(Notification.permission);
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  }

  /**
   * Save subscription to Supabase so the server can send push notifications later.
   * Uses upsert to handle re-subscribing on the same device gracefully.
   * Fire-and-forget: errors are logged but never propagate to the caller.
   */
  private sendSubscriptionToServer(subscription: PushSubscription): void {
    void (async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await this.supabaseService.client.auth.getUser();

        if (userError || !user) {
          console.error('[PushNotification] Cannot save subscription — user not authenticated');
          return;
        }

        // PushSubscription.toJSON() gives base64url-encoded keys ready for web-push
        const json = subscription.toJSON() as {
          endpoint: string;
          keys?: { p256dh?: string; auth?: string };
        };
        const p256dh = json.keys?.p256dh;
        const auth = json.keys?.auth;

        if (!json.endpoint || !p256dh || !auth) {
          console.error('[PushNotification] Subscription is missing required encryption keys');
          return;
        }

        const { error } = await this.supabaseService.client
          .from('push_subscriptions')
          .upsert(
            { creator_id: user.id, endpoint: json.endpoint, p256dh, auth },
            { onConflict: 'creator_id,endpoint' },
          );

        if (error) {
          console.error('[PushNotification] Failed to save subscription:', error.message);
        }
      } catch (err) {
        console.error('[PushNotification] Unexpected error saving subscription:', err);
      }
    })();
  }

  /**
   * Delete subscription from Supabase when user unsubscribes.
   * Fire-and-forget: errors are logged but never propagate to the caller.
   */
  private removeSubscriptionFromServer(subscription: PushSubscription): void {
    void (async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await this.supabaseService.client.auth.getUser();

        if (userError || !user) {
          return;
        }

        const { error } = await this.supabaseService.client
          .from('push_subscriptions')
          .delete()
          .eq('creator_id', user.id)
          .eq('endpoint', subscription.endpoint);

        if (error) {
          console.error('[PushNotification] Failed to remove subscription:', error.message);
        }
      } catch (err) {
        console.error('[PushNotification] Unexpected error removing subscription:', err);
      }
    })();
  }

  /**
   * Convert VAPID key from base64url to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    if (!base64String) {
      return new Uint8Array();
    }

    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
