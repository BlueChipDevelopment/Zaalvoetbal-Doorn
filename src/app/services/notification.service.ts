import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { GoogleSheetsService } from './google-sheets-service';
import { NOTIFICATIES_COLUMNS, SHEET_NAMES } from '../constants/sheet-columns';
import { getCurrentDateTimeISO } from '../utils/date-utils';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private isSupported$ = new BehaviorSubject<boolean>(false);
  private isEnabled$ = new BehaviorSubject<boolean>(false);
  private subscription$ = new BehaviorSubject<PushSubscription | null>(null);

  // VAPID public key from Firebase Functions
  private readonly vapidPublicKey = 'BJPF_ap7zo3m8LviC3mOKVEW-ks2BgudLf6ZQxkoECTxcR5f6KBwCavpd2X7bcIjwTaDn8fZio1Pm5lmNtCWmhU';

  constructor(private googleSheetsService: GoogleSheetsService) {
    this.checkSupport();
    this.checkCurrentStatus();
  }

  get isSupported(): Observable<boolean> {
    return this.isSupported$.asObservable();
  }

  get isEnabled(): Observable<boolean> {
    return this.isEnabled$.asObservable();
  }

  get currentSubscription(): Observable<PushSubscription | null> {
    return this.subscription$.asObservable();
  }

  get isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  private checkSupport(): void {
    const isSupported = 'serviceWorker' in navigator && 
                       'PushManager' in window && 
                       'Notification' in window;
    
    this.isSupported$.next(isSupported);
    console.log('🔔 Push notifications supported:', isSupported, this.isIOS ? '(iOS device detected)' : '');
  }

  private async checkCurrentStatus(): Promise<void> {
    if (!this.isSupported$.value) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        this.subscription$.next(subscription);
        this.isEnabled$.next(true);
        console.log('✅ Found existing push subscription');
      } else {
        this.isEnabled$.next(false);
        console.log('❌ No existing push subscription found');
      }
    } catch (error) {
      console.error('❌ Error checking notification status:', error);
      this.isEnabled$.next(false);
    }
  }

  async requestPermission(playerName?: string): Promise<boolean> {
    if (!this.isSupported$.value) {
      console.log('❌ Push notifications not supported on this device/browser');
      return false;
    }

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        console.log('❌ Notification permission denied');
        return false;
      }

      console.log('✅ Notification permission granted');

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      console.log('✅ Push subscription created:', subscription);

      // Store subscription
      this.subscription$.next(subscription);
      this.isEnabled$.next(true);

      // Save subscription to backend
      try {
        await this.saveSubscriptionToServer(subscription, playerName);
        console.log('✅ Notification setup completed successfully');
      } catch (saveError) {
        console.error('⚠️ Notifications enabled locally but failed to save to server:', saveError);
        // Save to localStorage as fallback
        this.saveSubscriptionToLocalStorage(subscription);
        console.log('📱 Subscription saved to localStorage as fallback');
      }

      return true;

    } catch (error) {
      console.error('❌ Error requesting notification permission:', error);
      this.isEnabled$.next(false);
      return false;
    }
  }

  async disableNotifications(): Promise<boolean> {
    try {
      const subscription = this.subscription$.value;
      
      if (subscription) {
        // Unsubscribe from push notifications
        await subscription.unsubscribe();
        console.log('✅ Push subscription unsubscribed');

        // Remove subscription from backend (we'll implement this later)
        await this.removeSubscriptionFromServer(subscription);
      }

      this.subscription$.next(null);
      this.isEnabled$.next(false);
      
      return true;

    } catch (error) {
      console.error('❌ Error disabling notifications:', error);
      return false;
    }
  }

  private async saveSubscriptionToServer(subscription: PushSubscription, playerName?: string): Promise<void> {
    try {
      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
          auth: this.arrayBufferToBase64(subscription.getKey('auth'))
        },
        userAgent: navigator.userAgent,
        timestamp: getCurrentDateTimeISO(),
        active: true,
        playerName: playerName || ''
      };

      console.log('💾 Saving subscription to server:', subscriptionData);

      const row = [
        subscriptionData.endpoint,
        subscriptionData.keys.p256dh,
        subscriptionData.keys.auth,
        subscriptionData.userAgent,
        subscriptionData.timestamp,
        subscriptionData.active,
        subscriptionData.playerName
      ];

      const result = await this.googleSheetsService.appendSheetRow(SHEET_NAMES.NOTIFICATIES, row).toPromise();
      console.log('✅ Subscription saved to Google Sheets successfully:', result);
      
    } catch (error) {
      console.error('❌ Error saving subscription to server:', error);
      if (error instanceof TypeError) {
        console.error('Network error - check if Firebase Functions are accessible');
      }
      throw error; // Re-throw so calling code can handle it
    }
  }

  private async removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    try {
      console.log('🗑️ Removing subscription from server:', subscription.endpoint);
      
      // 1. First find the row with this endpoint
      const rows = await this.googleSheetsService.getSheetData(SHEET_NAMES.NOTIFICATIES).toPromise();
      
      if (!rows || rows.length === 0) {
        console.warn('No notifications data found to remove');
        return;
      }

      // 2. Find the matching row
      let targetRowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row[NOTIFICATIES_COLUMNS.ENDPOINT] === subscription.endpoint) {
          targetRowIndex = i + 1; // +1 because Google Sheets is 1-indexed
          break;
        }
      }

      if (targetRowIndex === -1) {
        console.warn('Could not find subscription to remove:', subscription.endpoint);
        return;
      }

      // 3. Update the row to mark as inactive
      const originalRow = rows[targetRowIndex - 1]; // Convert back to 0-indexed for array access
      const updatedRow = [...originalRow];
      updatedRow[NOTIFICATIES_COLUMNS.ACTIVE] = false;

      const result = await this.googleSheetsService.updateSheetRow(
        SHEET_NAMES.NOTIFICATIES, 
        targetRowIndex, 
        updatedRow
      ).toPromise();

      console.log('✅ Subscription marked as inactive on server');
      
    } catch (error) {
      console.error('❌ Error removing subscription from server:', error);
      // Don't throw the error - we still want to remove it locally even if server update fails
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | null): string {
    if (!buffer) return '';
    
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return window.btoa(binary);
  }

  private saveSubscriptionToLocalStorage(subscription: PushSubscription): void {
    try {
      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
          auth: this.arrayBufferToBase64(subscription.getKey('auth'))
        },
        userAgent: navigator.userAgent,
        timestamp: getCurrentDateTimeISO(),
        active: true
      };

      localStorage.setItem('futsal-notification-subscription', JSON.stringify(subscriptionData));
    } catch (error) {
      console.error('❌ Error saving subscription to localStorage:', error);
    }
  }

  async checkPlayerNotificationStatus(playerName: string): Promise<boolean> {
    try {
      // 1. Check browser subscription
      if (!this.isSupported$.value) {
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const browserSubscription = await registration.pushManager.getSubscription();
      
      if (!browserSubscription) {
        console.log(`❌ No browser subscription found for ${playerName}`);
        return false;
      }

      // 2. Check Google Sheets Notificaties for this player
      const rows = await this.googleSheetsService.getSheetData(SHEET_NAMES.NOTIFICATIES).toPromise();
      
      if (!rows || rows.length === 0) {
        console.log(`❌ No notification data found in Google Sheets for ${playerName}`);
        return false;
      }
      
      // Check if player has active subscription in Google Sheets
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length >= Object.keys(NOTIFICATIES_COLUMNS).length) {
          const sheetPlayerName = row[NOTIFICATIES_COLUMNS.PLAYER_NAME];
          const activeValue = row[NOTIFICATIES_COLUMNS.ACTIVE];
          const isActive = activeValue === 'true' || activeValue === true || activeValue === 'TRUE';
          const endpoint = row[NOTIFICATIES_COLUMNS.ENDPOINT];
          
          if (sheetPlayerName === playerName && isActive && endpoint === browserSubscription.endpoint) {
            console.log(`✅ Found active notification subscription for ${playerName}`);
            return true;
          }
        }
      }

      console.log(`❌ No active Google Sheets subscription found for ${playerName}`);
      return false;

    } catch (error) {
      console.error('Error checking player notification status:', error);
      return false;
    }
  }

  getNotificationCapabilities(): string[] {
    if (!('serviceWorker' in navigator)) {
      return ['Je browser ondersteunt geen service workers'];
    }

    if (!('PushManager' in window)) {
      return ['Je browser ondersteunt geen push notifications'];
    }

    if (!('Notification' in window)) {
      return ['Je browser ondersteunt geen notifications'];
    }

    if (this.isIOS) {
      return [
        'iOS Safari ondersteunt web push notifications (vanaf iOS 16.4)',
        'Je krijgt notificaties zelfs als Safari gesloten is',
        'Voor de beste ervaring: voeg deze site toe aan je startscherm',
        'Zorg dat je iOS 16.4 of nieuwer hebt geïnstalleerd'
      ];
    }

    return [
      'Je browser ondersteunt push notifications volledig!',
      'Je ontvangt notificaties zelfs als de app gesloten is',
      'Notificaties werken op Android, Windows en Mac'
    ];
  }
}