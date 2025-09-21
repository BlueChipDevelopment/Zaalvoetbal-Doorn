import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PwaInstallService {
  private deferredPrompt: any = null;
  private canInstall$ = new BehaviorSubject<boolean>(false);
  private isInstalled$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.checkInstallation();
    this.setupInstallPromptListener();
  }

  get canInstall(): Observable<boolean> {
    return this.canInstall$.asObservable();
  }

  get isInstalled(): Observable<boolean> {
    return this.isInstalled$.asObservable();
  }

  get isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  get isAndroid(): boolean {
    return /Android/.test(navigator.userAgent);
  }

  get isMobile(): boolean {
    return this.isIOS || this.isAndroid;
  }

  private checkInstallation(): void {
    // Check if already installed as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    
    this.isInstalled$.next(isStandalone || isInWebAppiOS);
  }

  private setupInstallPromptListener(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('🔄 PWA Install prompt available');
      e.preventDefault();
      this.deferredPrompt = e;
      this.canInstall$.next(true);
    });

    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA installed successfully');
      this.isInstalled$.next(true);
      this.canInstall$.next(false);
      this.deferredPrompt = null;
    });
  }

  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      
      console.log(`🎯 PWA install choice: ${outcome}`);
      
      if (outcome === 'accepted') {
        this.canInstall$.next(false);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ PWA install error:', error);
      return false;
    }
  }

  getInstallInstructions(): string[] {
    if (this.isIOS) {
      return [
        'Tik op het deel-icoon onderaan je scherm',
        'Scroll naar beneden en tik op "Zet op beginscherm"', 
        'Tik op "Voeg toe" om de app te installeren'
      ];
    } else if (this.isAndroid) {
      return [
        'Tik op de menu-knop (⋮) rechtsboven',
        'Tik op "App installeren" of "Toevoegen aan startscherm"',
        'Tik op "Installeren" om te bevestigen'
      ];
    } else {
      return [
        'Klik op het installatie-icoon in de adresbalk',
        'Of ga naar browserinstellingen → "App installeren"',
        'Klik op "Installeren" om te bevestigen'
      ];
    }
  }
}